/**
 * Lightweight PDF text extractor for Cloudflare Workers.
 * Parses PDF binary format to extract text from content streams.
 * For scanned PDFs, extracts embedded JPEG images for OCR.
 * No external dependencies — works with the Web API only.
 */

/**
 * Extract text content from a PDF file.
 * Handles compressed (FlateDecode) and uncompressed text streams.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const text = new TextDecoder("latin1").decode(bytes);
  const lines: string[] = [];

  // Strategy 1: Extract text from BT/ET blocks (text objects)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match: RegExpExecArray | null;

  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const extracted = extractTextFromBlock(block);
    if (extracted) lines.push(extracted);
  }

  // Strategy 2: Try decompressing FlateDecode streams
  if (lines.length === 0) {
    const streamTexts = await extractFromStreams(bytes, text);
    if (streamTexts) lines.push(streamTexts);
  }

  return lines.join("\n").trim();
}

/**
 * Extract embedded JPEG images from a PDF.
 * Returns up to maxImages JPEG byte arrays (for OCR via vision model).
 */
export function extractPdfImages(
  bytes: Uint8Array,
  maxImages = 3,
): Uint8Array[] {
  const text = new TextDecoder("latin1").decode(bytes);
  const images: Uint8Array[] = [];

  // Find stream boundaries
  const streamStarts: number[] = [];
  const streamEnds: number[] = [];
  const streamRegex = /stream\r?\n/g;
  const endStreamRegex = /\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = streamRegex.exec(text)) !== null) {
    streamStarts.push(m.index + m[0].length);
  }
  while ((m = endStreamRegex.exec(text)) !== null) {
    streamEnds.push(m.index);
  }

  for (
    let i = 0;
    i < Math.min(streamStarts.length, streamEnds.length) &&
    images.length < maxImages;
    i++
  ) {
    const start = streamStarts[i];
    const end = streamEnds[i];
    if (end <= start || end - start < 1000) continue;

    // Check if this stream is a DCTDecode (JPEG) image
    const preceding = text.slice(
      Math.max(0, start - 500),
      start,
    );
    if (!/\/Filter\s*\/DCTDecode/i.test(preceding)) continue;

    const streamBytes = bytes.slice(start, end);
    // Verify JPEG magic bytes (FFD8)
    if (streamBytes[0] === 0xff && streamBytes[1] === 0xd8) {
      images.push(streamBytes);
    }
  }

  return images;
}

/**
 * Extract text from a BT/ET block by parsing Tj, TJ, and ' operators.
 */
function extractTextFromBlock(block: string): string {
  const parts: string[] = [];

  // Match (text) Tj — show string
  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tjRegex.exec(block)) !== null) {
    parts.push(unescapePdfString(m[1]));
  }

  // Match [(text)(text)] TJ — show array of strings
  const tjArrayRegex = /\[((?:[^[\]]*?))\]\s*TJ/gi;
  while ((m = tjArrayRegex.exec(block)) !== null) {
    const arrayContent = m[1];
    const stringRegex = /\(([^)]*)\)/g;
    let s: RegExpExecArray | null;
    while ((s = stringRegex.exec(arrayContent)) !== null) {
      parts.push(unescapePdfString(s[1]));
    }
  }

  // Match (text) ' — move to next line and show
  const quoteRegex = /\(([^)]*)\)\s*'/g;
  while ((m = quoteRegex.exec(block)) !== null) {
    parts.push(unescapePdfString(m[1]));
  }

  return parts.join("").trim();
}

/**
 * Try to decompress FlateDecode streams and extract text from them.
 */
async function extractFromStreams(
  bytes: Uint8Array,
  text: string,
): Promise<string> {
  const lines: string[] = [];

  const streamStarts: number[] = [];
  const streamEnds: number[] = [];
  const streamRegex = /stream\r?\n/g;
  const endStreamRegex = /\r?\nendstream/g;
  let sm: RegExpExecArray | null;

  while ((sm = streamRegex.exec(text)) !== null) {
    streamStarts.push(sm.index + sm[0].length);
  }
  while ((sm = endStreamRegex.exec(text)) !== null) {
    streamEnds.push(sm.index);
  }

  for (let i = 0; i < Math.min(streamStarts.length, streamEnds.length); i++) {
    const start = streamStarts[i];
    const end = streamEnds[i];
    if (end <= start || end - start > 1_000_000) continue;

    const streamBytes = bytes.slice(start, end);

    const preceding = text.slice(
      Math.max(0, start - 500),
      start,
    );
    const isCompressed = /\/Filter\s*\/FlateDecode/i.test(preceding);

    let decoded: string;
    if (isCompressed) {
      try {
        const ds = new DecompressionStream("deflate");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        writer.write(streamBytes);
        writer.close();

        const chunks: Uint8Array[] = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        const combined = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        decoded = new TextDecoder("latin1").decode(combined);
      } catch {
        continue;
      }
    } else {
      decoded = new TextDecoder("latin1").decode(streamBytes);
    }

    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let btMatch: RegExpExecArray | null;
    while ((btMatch = btEtRegex.exec(decoded)) !== null) {
      const extracted = extractTextFromBlock(btMatch[1]);
      if (extracted) lines.push(extracted);
    }
  }

  return lines.join("\n").trim();
}

/**
 * Unescape PDF string escape sequences.
 */
function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8)),
    );
}

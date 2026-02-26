/**
 * Document Processor — Server-side text extraction.
 *
 * Supports: images (png, jpg, webp), PDFs, text files, CSVs
 * Uses z.ai (OpenAI-compatible vision API) for OCR on images/scanned PDFs.
 * Falls back to Workers AI if z.ai unavailable.
 * Uses custom PDF parser for text-based PDFs.
 */
import { extractPdfText, extractPdfImages } from "./pdfExtractor";

const SUPPORTED_TYPES: Record<string, string> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/csv": "text",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const OCR_PROMPT =
  "Read and transcribe every word, number, and label visible in this image exactly as written. Output the raw text only — no descriptions, no formatting commentary. If you see tables, output them as rows. If you see headers, amounts, dates, or account numbers, include them all. Do NOT describe what the image looks like — only output the actual text content.";

export function validateFile(
  fileType: string,
  fileSize: number,
): { valid: boolean; error?: string } {
  if (!SUPPORTED_TYPES[fileType]) {
    return {
      valid: false,
      error: `Unsupported file type: ${fileType}. Accepted: ${Object.keys(SUPPORTED_TYPES).join(", ")}`,
    };
  }
  if (fileSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum: 10MB`,
    };
  }
  return { valid: true };
}

/**
 * Convert bytes to base64 string (works in Workers runtime).
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Detect MIME type from image bytes.
 */
function detectImageMime(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

/**
 * Extract text from an image using z.ai (OpenAI-compatible vision API).
 */
async function extractTextViaZai(
  apiKey: string,
  baseUrl: string,
  imageBytes: Uint8Array,
): Promise<string> {
  const mime = detectImageMime(imageBytes);
  const base64 = bytesToBase64(imageBytes);
  const dataUri = `data:${mime};base64,${base64}`;

  // Use the standard z.ai API path for vision (not the coding API)
  const visionBaseUrl = baseUrl.replace("/api/coding/paas/v4", "/api/paas/v4");
  const res = await fetch(`${visionBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-4v-plus",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`z.ai vision failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Extract text from a text/CSV file via UTF-8 decode.
 */
function extractTextFromTextFile(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Process a document and extract text.
 * Uses z.ai vision API for OCR tasks (much better than Workers AI for text extraction).
 */
export async function processDocument(
  _ai: Ai,
  fileBytes: Uint8Array,
  fileType: string,
  zaiApiKey?: string,
  zaiBaseUrl?: string,
): Promise<{ text: string; method: string }> {
  const category = SUPPORTED_TYPES[fileType];

  const doOcr = async (imageBytes: Uint8Array): Promise<string> => {
    if (zaiApiKey && zaiBaseUrl) {
      return extractTextViaZai(zaiApiKey, zaiBaseUrl, imageBytes);
    }
    throw new Error("No vision API configured");
  };

  switch (category) {
    case "image":
      try {
        return {
          text: await doOcr(fileBytes),
          method: "zai-vision",
        };
      } catch (err) {
        return {
          text: "",
          method: `image-ocr-failed:${err instanceof Error ? err.message : "unknown"}`,
        };
      }

    case "pdf":
      try {
        // Strategy 1: Parse text directly from PDF streams
        const pdfText = await extractPdfText(fileBytes);
        if (pdfText.length > 50) {
          return { text: pdfText, method: "pdf-text-parser" };
        }

        // Strategy 2: Extract embedded JPEG images and OCR via z.ai
        const images = extractPdfImages(fileBytes, 3);
        if (images.length > 0) {
          const pageTexts: string[] = [];
          const errors: string[] = [];
          for (let i = 0; i < images.length; i++) {
            try {
              const pageText = await doOcr(images[i]);
              if (pageText) pageTexts.push(`--- Page ${i + 1} ---\n${pageText}`);
            } catch (err) {
              errors.push(`p${i + 1}:${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`);
            }
          }
          if (pageTexts.length > 0) {
            return { text: pageTexts.join("\n\n"), method: "pdf-image-ocr" };
          }
          return {
            text: pdfText,
            method: `pdf-ocr-failed(${images.length}imgs,${errors.join(";")})`,
          };
        }

        return { text: pdfText, method: "pdf-no-images-found" };
      } catch {
        return { text: "", method: "pdf-extraction-failed" };
      }

    case "text":
      return {
        text: extractTextFromTextFile(fileBytes),
        method: "utf8-decode",
      };

    default:
      return { text: "", method: "unsupported" };
  }
}

export { SUPPORTED_TYPES, MAX_FILE_SIZE };

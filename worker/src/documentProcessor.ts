/**
 * Document Processor — Server-side text extraction using Workers AI
 *
 * Supports: images (png, jpg, webp), PDFs, text files, CSVs
 * Uses @cf/meta/llama-3.2-11b-vision-instruct for vision tasks
 * Uses custom PDF parser for text extraction from PDFs
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
 * Extract text from an image using Workers AI vision model.
 */
async function extractTextFromImage(
  ai: Ai,
  imageBytes: Uint8Array,
): Promise<string> {
  const response = (await ai.run(
    "@cf/meta/llama-3.2-11b-vision-instruct" as Parameters<Ai["run"]>[0],
    {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract ALL text from this image. Return ONLY the extracted text, preserving the original structure (tables, lists, paragraphs). If this is a financial document, invoice, or receipt, extract every number, date, and label precisely. Do not add commentary.",
            },
            {
              type: "image",
              image: Array.from(imageBytes),
            },
          ],
        },
      ],
      max_tokens: 4096,
    } as Record<string, unknown>,
  )) as { response?: string };

  return response?.response || "";
}

/**
 * Extract text from a text/CSV file via UTF-8 decode.
 */
function extractTextFromTextFile(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Process a document and extract text.
 * Returns extracted text and the method used.
 */
export async function processDocument(
  ai: Ai,
  fileBytes: Uint8Array,
  fileType: string,
): Promise<{ text: string; method: string }> {
  const category = SUPPORTED_TYPES[fileType];

  switch (category) {
    case "image":
      return {
        text: await extractTextFromImage(ai, fileBytes),
        method: "workers-ai-vision",
      };

    case "pdf":
      try {
        // Strategy 1: Try parsing text directly from PDF streams
        const pdfText = await extractPdfText(fileBytes);
        if (pdfText.length > 50) {
          return { text: pdfText, method: "pdf-text-parser" };
        }

        // Strategy 2: Extract embedded JPEG images and OCR them
        const images = extractPdfImages(fileBytes, 3);
        if (images.length > 0) {
          const pageTexts: string[] = [];
          for (let i = 0; i < images.length; i++) {
            try {
              const pageText = await extractTextFromImage(ai, images[i]);
              if (pageText) pageTexts.push(`--- Page ${i + 1} ---\n${pageText}`);
            } catch {
              // Skip failed pages
            }
          }
          if (pageTexts.length > 0) {
            return { text: pageTexts.join("\n\n"), method: "pdf-image-ocr" };
          }
        }

        return { text: pdfText, method: "pdf-extraction-minimal" };
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

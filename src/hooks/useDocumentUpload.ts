import { useState, useCallback } from "react";
import type { DocumentUpload } from "../types";
import { uploadDocument } from "../services/api";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILES = 5;

/**
 * Get the Tesseract recognize function, handling CJS/ESM interop.
 */
async function getTesseractRecognize(): Promise<
  (image: unknown, lang: string) => Promise<{ data: { text: string } }>
> {
  const mod = await import("tesseract.js");
  // Handle CJS/ESM interop — recognize could be on default or top-level
  const recognize =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mod as any).recognize ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mod as any).default?.recognize;
  if (typeof recognize !== "function") {
    throw new Error("Tesseract.recognize not found — check import");
  }
  return recognize;
}

/**
 * Extract text from a PDF using pdf.js text layer.
 * For scanned PDFs, renders pages to canvas and runs Tesseract OCR.
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  // Use Vite's ?url suffix to get the worker URL as a string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerUrl = ((await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as any).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  const maxPages = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (text) pageTexts.push(text);
  }

  const fullText = pageTexts.join("\n\n");

  // If text layer had meaningful content, use it
  if (fullText.length > 50) {
    return fullText;
  }

  // Scanned PDF — render pages to canvas and OCR with Tesseract
  try {
    const recognize = await getTesseractRecognize();
    const ocrTexts: string[] = [];

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const result = await recognize(canvas, "eng");
      const pageText = result.data.text.trim();
      if (pageText) {
        ocrTexts.push(pageText);
      }
      canvas.remove();
    }

    if (ocrTexts.length > 0) {
      return ocrTexts.join("\n\n");
    }
  } catch (err) {
    console.error("[PDF OCR] Tesseract failed:", err);
  }

  return fullText;
}

export function useDocumentUpload() {
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const updateDoc = (id: string, updates: Partial<DocumentUpload>) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, MAX_FILES - documents.length);
      if (fileArray.length === 0) return;

      setIsUploading(true);

      for (const file of fileArray) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        setDocuments((prev) => [
          ...prev,
          {
            id: tempId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            extractedText: null,
            status: "extracting",
          },
        ]);

        try {
          let clientText: string | undefined;

          if (IMAGE_TYPES.includes(file.type)) {
            // Image OCR with Tesseract
            try {
              const recognize = await getTesseractRecognize();
              const result = await recognize(file, "eng");
              clientText = result.data.text;
              updateDoc(tempId, { clientText, status: "uploading" });
            } catch (err) {
              console.error("[OCR] Tesseract failed:", err);
              updateDoc(tempId, { status: "uploading" });
            }
          } else if (file.type === "application/pdf") {
            // PDF text extraction (text layer + OCR fallback)
            try {
              const text = await extractPdfText(file);
              if (text) clientText = text;
              updateDoc(tempId, { clientText, status: "uploading" });
            } catch (err) {
              console.error("[PDF] extraction failed:", err);
              updateDoc(tempId, { status: "uploading" });
            }
          } else {
            updateDoc(tempId, { status: "uploading" });
          }

          // Upload to server
          const result = await uploadDocument(file, clientText);

          setDocuments((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? {
                    ...d,
                    id: result.id,
                    extractedText: result.extracted_text,
                    status: result.status === "completed" ? "ready" : "error",
                    error: result.error || undefined,
                  }
                : d,
            ),
          );
        } catch (err) {
          updateDoc(tempId, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      setIsUploading(false);
    },
    [documents.length],
  );

  const removeFile = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getReadyDocumentIds = useCallback((): string[] => {
    return documents
      .filter((d) => d.status === "ready" && !d.id.startsWith("temp-"))
      .map((d) => d.id);
  }, [documents]);

  const clear = useCallback(() => {
    setDocuments([]);
    setIsUploading(false);
  }, []);

  return {
    documents,
    isUploading,
    addFiles,
    removeFile,
    getReadyDocumentIds,
    clear,
  };
}

import { useState, useCallback } from "react";
import type { DocumentUpload } from "../types";
import { uploadDocument } from "../services/api";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILES = 5;

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
        // Create a temporary ID for tracking
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        // Add to state immediately
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
          // Step 1: Client-side OCR with Tesseract.js for images
          let clientText: string | undefined;
          if (IMAGE_TYPES.includes(file.type)) {
            try {
              const Tesseract = await import("tesseract.js");
              const result = await Tesseract.recognize(file, "eng");
              clientText = result.data.text;
              updateDoc(tempId, { clientText, status: "uploading" });
            } catch {
              // Tesseract failed — continue without client text
              updateDoc(tempId, { status: "uploading" });
            }
          } else {
            updateDoc(tempId, { status: "uploading" });
          }

          // Step 2: Upload to server
          const result = await uploadDocument(file, clientText);

          // Replace temp doc with server response
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

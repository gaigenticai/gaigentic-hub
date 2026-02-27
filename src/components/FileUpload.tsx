import { useRef, useState } from "react";
import {
  Upload,
  X,
  FileText,
  Image,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DocumentUpload } from "../types";

const ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv";

const FILE_ICONS: Record<string, typeof FileText> = {
  "image/png": Image,
  "image/jpeg": Image,
  "image/webp": Image,
  "application/pdf": FileText,
  "text/plain": FileText,
  "text/csv": FileText,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  documents: DocumentUpload[];
  isUploading: boolean;
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (id: string) => void;
}

export default function FileUpload({
  documents,
  isUploading,
  onAddFiles,
  onRemoveFile,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
        Upload Documents (optional)
      </label>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${
          dragOver
            ? "border-cta bg-cta-light"
            : "border-ink-200 bg-ink-50/50 hover:border-ink-300 hover:bg-ink-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <Upload
          className={`mx-auto mb-1.5 h-5 w-5 ${dragOver ? "text-cta" : "text-ink-400"}`}
        />
        <p className="text-xs text-ink-500">
          Drop files here or{" "}
          <span className="font-medium text-cta">browse</span>
        </p>
        <p className="mt-0.5 text-[10px] text-ink-400">
          Images, PDFs, text, CSV — max 10MB each
        </p>
      </div>

      {/* File list */}
      {documents.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {documents.map((doc) => {
            const Icon = FILE_ICONS[doc.fileType] || FileText;
            const isExpanded = expandedId === doc.id;

            return (
              <div
                key={doc.id}
                className="rounded-lg border border-ink-200 bg-white"
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-ink-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink-700">
                      {doc.fileName}
                    </p>
                    <p className="text-[10px] text-ink-400">
                      {formatSize(doc.fileSize)}
                    </p>
                  </div>

                  {/* Status */}
                  {doc.status === "extracting" && (
                    <span className="flex items-center gap-1 text-[10px] text-cta">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      OCR...
                    </span>
                  )}
                  {doc.status === "uploading" && (
                    <span className="flex items-center gap-1 text-[10px] text-cobalt">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading
                    </span>
                  )}
                  {doc.status === "ready" && (
                    <span className="flex items-center gap-1 text-[10px] text-signal-green">
                      <CheckCircle2 className="h-3 w-3" />
                      Ready
                    </span>
                  )}
                  {doc.status === "error" && (
                    <span
                      className="flex items-center gap-1 text-[10px] text-signal-red"
                      title={doc.error}
                    >
                      <AlertCircle className="h-3 w-3" />
                      Failed
                    </span>
                  )}

                  {/* Preview toggle */}
                  {doc.extractedText && (
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : doc.id)
                      }
                      className="text-ink-400 hover:text-ink-600"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  {/* Remove */}
                  <button
                    onClick={() => onRemoveFile(doc.id)}
                    className="text-ink-400 hover:text-signal-red"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Expanded text preview */}
                {isExpanded && doc.extractedText && (
                  <div className="border-t border-ink-100 px-3 py-2">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-ink-400">
                      Extracted Text
                    </p>
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600">
                      {doc.extractedText}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Uploading indicator */}
      {isUploading && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-cta">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing files...
        </p>
      )}
    </div>
  );
}

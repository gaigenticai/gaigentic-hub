import { useState, useCallback } from "react";
import { AlertCircle, Check } from "lucide-react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function JsonEditor({
  value,
  onChange,
  placeholder,
  readOnly,
}: JsonEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      onChange(text);

      if (!text.trim()) {
        setError(null);
        return;
      }

      try {
        JSON.parse(text);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [onChange],
  );

  const formatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(value);
      onChange(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      // Can't format invalid JSON
    }
  }, [value, onChange]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-gray-200 bg-white/80 px-3 py-2">
        <span className="text-xs font-medium text-gray-600">
          JSON Input
        </span>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              Invalid JSON
            </span>
          ) : value.trim() ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3 w-3" />
              Valid
            </span>
          ) : null}
          {!readOnly && (
            <button
              onClick={formatJson}
              className="rounded px-2 py-0.5 text-xs text-purple-600 hover:bg-purple-100"
            >
              Format
            </button>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck={false}
        className="w-full rounded-b-lg border border-gray-200 bg-white p-4 font-mono text-sm text-emerald-600 placeholder-surface-200/30 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        rows={12}
      />
    </div>
  );
}

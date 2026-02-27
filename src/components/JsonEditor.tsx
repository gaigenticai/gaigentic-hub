import { useState, useCallback } from "react";
import { AlertCircle, Check } from "lucide-react";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  sampleInput?: string;
}

export default function JsonEditor({
  value,
  onChange,
  placeholder,
  readOnly,
  sampleInput,
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

  const populateSample = useCallback(() => {
    if (!sampleInput) return;
    try {
      const parsed = JSON.parse(sampleInput);
      onChange(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      onChange(sampleInput);
    }
  }, [sampleInput, onChange]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-ink-200 bg-ink-25 px-3 py-2">
        <span className="text-xs font-medium text-ink-500 uppercase tracking-widest">
          JSON Input
        </span>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="flex items-center gap-1 text-xs text-signal-red">
              <AlertCircle className="h-3 w-3" />
              Invalid JSON
            </span>
          ) : value.trim() ? (
            <span className="flex items-center gap-1 text-xs text-signal-green">
              <Check className="h-3 w-3" />
              Valid
            </span>
          ) : null}
          {!readOnly && sampleInput && (
            <button
              onClick={populateSample}
              className="rounded px-2 py-0.5 text-xs text-cobalt hover:bg-cobalt-light"
            >
              Populate Sample
            </button>
          )}
          {!readOnly && value.trim() && (
            <button
              onClick={formatJson}
              className="rounded px-2 py-0.5 text-xs text-cobalt hover:bg-cobalt-light"
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
        className="w-full rounded-b-lg border border-ink-200 bg-white p-4 font-mono text-sm text-signal-green placeholder-ink-400 focus:border-ink-300 focus:outline-none focus:ring-1 focus:ring-ink-300"
        rows={12}
      />
    </div>
  );
}

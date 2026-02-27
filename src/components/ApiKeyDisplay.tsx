import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";

interface ApiKeyDisplayProps {
  keyValue: string;
  prefix?: string;
  expiresAt?: string;
}

export default function ApiKeyDisplay({
  keyValue,
  prefix,
  expiresAt,
}: ApiKeyDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const display = revealed ? keyValue : prefix ? `${prefix}${"*".repeat(32)}` : "*".repeat(40);

  const copy = async () => {
    await navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const daysLeft = expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm text-ink-900">
          {display}
        </code>
        <button
          onClick={() => setRevealed(!revealed)}
          className="btn-icon"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={copy}
          className="btn-icon"
          title="Copy"
        >
          {copied ? (
            <Check className="h-4 w-4 text-signal-green" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      {daysLeft !== null && (
        <p className="mt-2 text-xs text-ink-500">
          {daysLeft > 0
            ? `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
            : "Expired"}
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: string;
  lang?: string;
}

export default function CodeBlock({ children, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="text-xs font-medium text-gray-500">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-white hover:text-gray-900"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-sm text-emerald-600">{children}</code>
      </pre>
    </div>
  );
}

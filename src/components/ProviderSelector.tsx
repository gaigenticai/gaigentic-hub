import { AlertTriangle, Lock } from "lucide-react";
import type { LLMProvider } from "../types";

interface ProviderSelectorProps {
  provider: LLMProvider;
  onProviderChange: (p: LLMProvider) => void;
  apiKey: string;
  onApiKeyChange: (k: string) => void;
}

const PROVIDERS: Array<{ id: LLMProvider; name: string; placeholder: string }> = [
  { id: "zai", name: "z.ai (Free Default)", placeholder: "Using shared key..." },
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-..." },
];

export default function ProviderSelector({
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
}: ProviderSelectorProps) {
  const isShared = provider === "zai" && !apiKey;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          AI Provider
        </label>
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onProviderChange(p.id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                provider === p.id
                  ? "border-brand-500 bg-purple-100 text-purple-600"
                  : "border-gray-200 bg-white text-gray-600 hover:border-surface-200/30"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {provider !== "zai" || apiKey ? (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder}
            className="input font-mono text-xs"
          />
          <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
            <Lock className="h-3 w-3" />
            Your key is encrypted with AES-256 and never stored in plain text.
          </p>
        </div>
      ) : null}

      {isShared && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            Using shared z.ai key — may hit rate limits. For optimal results,
            enter your own API key above.
          </p>
        </div>
      )}
    </div>
  );
}

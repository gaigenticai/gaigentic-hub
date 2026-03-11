import { useState } from "react";
import { AlertTriangle, Lock, CheckCircle2, XCircle, Loader2, ChevronDown } from "lucide-react";
import type { LLMProvider } from "../types";
import { testApiKey } from "../services/api";

interface ProviderSelectorProps {
  provider: LLMProvider;
  onProviderChange: (p: LLMProvider) => void;
  apiKey: string;
  onApiKeyChange: (k: string) => void;
  model?: string;
  onModelChange?: (m: string) => void;
}

const PROVIDERS: Array<{ id: LLMProvider; name: string; placeholder: string }> = [
  { id: "zai", name: "z.ai (Free Default)", placeholder: "Using shared key..." },
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", name: "Anthropic", placeholder: "sk-ant-..." },
];

interface ModelOption {
  id: string;
  name: string;
  tier: "budget" | "standard" | "premium" | "reasoning";
  description: string;
}

const OPENAI_MODELS: ModelOption[] = [
  // Standard — all models here support multi-step tool calling
  { id: "gpt-5-mini", name: "GPT-5 Mini", tier: "standard", description: "Fast, reliable, great for most agents" },
  // Premium
  { id: "gpt-5.4", name: "GPT-5.4", tier: "premium", description: "Latest flagship, 1M context" },
  { id: "gpt-5.4-pro", name: "GPT-5.4 Pro", tier: "premium", description: "Most capable, most expensive" },
  // Reasoning
  { id: "o4-mini", name: "o4-mini", tier: "reasoning", description: "Latest reasoning model, math/code focused" },
];

const ANTHROPIC_MODELS: ModelOption[] = [
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", tier: "budget", description: "Fastest, cheapest Claude — still very capable" },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "standard", description: "Best balance of speed, quality, and cost" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", tier: "premium", description: "Most capable Claude — complex reasoning" },
];

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  budget: { label: "Budget", color: "text-signal-green" },
  standard: { label: "Standard", color: "text-cobalt" },
  premium: { label: "Premium", color: "text-purple-600" },
  reasoning: { label: "Reasoning", color: "text-amber-600" },
};

function getModelsForProvider(provider: LLMProvider): ModelOption[] {
  if (provider === "openai") return OPENAI_MODELS;
  if (provider === "anthropic") return ANTHROPIC_MODELS;
  return [];
}

function getDefaultModel(provider: LLMProvider): string {
  if (provider === "openai") return "gpt-5-mini";
  if (provider === "anthropic") return "claude-sonnet-4-6";
  return "";
}

export default function ProviderSelector({
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
}: ProviderSelectorProps) {
  const isShared = provider === "zai" && !apiKey;
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [testMessage, setTestMessage] = useState("");

  const models = getModelsForProvider(provider);
  const selectedModel = model || getDefaultModel(provider);

  const handleTest = async () => {
    if (!apiKey.trim()) return;
    setTestStatus("testing");
    setTestMessage("");

    try {
      const result = await testApiKey(provider, apiKey);
      if (result.valid) {
        setTestStatus("valid");
        setTestMessage(`Connected to ${result.provider} (${result.model})`);
      } else {
        setTestStatus("invalid");
        setTestMessage(result.error || "Invalid API key");
      }
    } catch (err) {
      setTestStatus("invalid");
      setTestMessage((err as Error).message || "Connection failed");
    }
  };

  const handleProviderChange = (p: LLMProvider) => {
    onProviderChange(p);
    onModelChange?.(getDefaultModel(p));
    setTestStatus("idle");
    setTestMessage("");
  };

  const handleKeyChange = (k: string) => {
    onApiKeyChange(k);
    if (testStatus !== "idle") {
      setTestStatus("idle");
      setTestMessage("");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
          AI Provider
        </label>
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                provider === p.id
                  ? "border-ink-950 bg-ink-50 text-ink-900"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {provider !== "zai" || apiKey ? (
        <div className="space-y-3">
          {/* API Key input */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder}
                className="input flex-1 font-mono text-xs"
              />
              <button
                onClick={handleTest}
                disabled={!apiKey.trim() || testStatus === "testing"}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  testStatus === "valid"
                    ? "border-signal-green/30 bg-signal-green/10 text-signal-green"
                    : testStatus === "invalid"
                      ? "border-signal-red/30 bg-signal-red/10 text-signal-red"
                      : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-800"
                }`}
              >
                {testStatus === "testing" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Testing...
                  </span>
                ) : testStatus === "valid" ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Valid
                  </span>
                ) : testStatus === "invalid" ? (
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-3 w-3" />
                    Failed
                  </span>
                ) : (
                  "Test Key"
                )}
              </button>
            </div>

            {/* Test result message */}
            {testMessage && (
              <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${
                testStatus === "valid" ? "text-signal-green" : "text-signal-red"
              }`}>
                {testStatus === "valid" ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 shrink-0" />
                )}
                <span>{testMessage}</span>
              </div>
            )}

            {!testMessage && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-ink-400">
                <Lock className="h-3 w-3" />
                Your key is sent directly to the provider — never stored in plain text.
              </p>
            )}
          </div>

          {/* Model selector — appears when API key is entered */}
          {apiKey && models.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
                Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => onModelChange?.(e.target.value)}
                  className="input appearance-none pr-8 text-xs"
                >
                  {(["budget", "standard", "premium", "reasoning"] as const).map((tier) => {
                    const tierModels = models.filter((m) => m.tier === tier);
                    if (tierModels.length === 0) return null;
                    return (
                      <optgroup key={tier} label={`── ${TIER_LABELS[tier].label} ──`}>
                        {tierModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.description}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
              </div>
              {selectedModel && (
                <p className="mt-1 text-[10px] text-ink-400">
                  {models.find((m) => m.id === selectedModel)?.tier === "budget" && "Cheapest option — good for testing and most tasks"}
                  {models.find((m) => m.id === selectedModel)?.tier === "standard" && "Good balance of quality and cost"}
                  {models.find((m) => m.id === selectedModel)?.tier === "premium" && "Highest quality — uses more tokens/costs more"}
                  {models.find((m) => m.id === selectedModel)?.tier === "reasoning" && "Chain-of-thought reasoning — uses extra tokens for thinking"}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      {isShared && (
        <div className="flex items-start gap-2 rounded-lg border border-signal-amber/20 bg-signal-amber-light p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-amber" />
          <p className="text-xs text-signal-amber">
            Using shared z.ai key — may hit rate limits. For optimal results,
            select OpenAI or Anthropic and enter your own API key.
          </p>
        </div>
      )}

      {apiKey && !isShared && testStatus !== "invalid" && (
        <div className="flex items-start gap-2 rounded-lg border border-signal-green/20 bg-signal-green/5 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-green" />
          <p className="text-xs text-signal-green">
            Your API key will be used for all agent executions — overrides the default shared key.
          </p>
        </div>
      )}
    </div>
  );
}

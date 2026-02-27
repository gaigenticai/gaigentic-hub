import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Check, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { LLMProvider } from "../types";
import { saveLLMConfig } from "../services/api";

const PROVIDERS: Array<{ id: LLMProvider; name: string; desc: string }> = [
  { id: "zai", name: "z.ai", desc: "Default free provider (shared, may rate limit)" },
  { id: "openai", name: "OpenAI", desc: "GPT-4o, GPT-4o-mini" },
  { id: "anthropic", name: "Anthropic", desc: "Claude Sonnet, Claude Opus" },
];

export default function Settings() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>("zai");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (auth.status !== "authenticated") {
    navigate("/login");
    return null;
  }

  const handleSave = async () => {
    if (!providerApiKey) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLLMConfig(selectedProvider, providerApiKey, isDefault);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setProviderApiKey("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-2xl font-semibold text-ink-950 font-headline">Settings</h1>

      {/* Account Info */}
      <div className="card mb-6">
        <h4 className="mb-4">Account</h4>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Name</span>
            <span className="text-ink-900">{auth.user!.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Email</span>
            <span className="text-ink-900">{auth.user!.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Company</span>
            <span className="text-ink-900">{auth.user!.company_name}</span>
          </div>
          {auth.user!.chaosbird_username && (
            <div className="flex justify-between">
              <span className="text-ink-500">Chaosbird</span>
              <span className="font-mono text-ink-900">
                {auth.user!.chaosbird_username}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* LLM Provider Config */}
      <div className="card">
        <h4 className="mb-4">AI Provider Configuration</h4>
        <p className="mb-4 text-sm text-ink-500">
          Save your own API key for optimal performance. Keys are encrypted and
          stored securely.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
              Provider
            </label>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors duration-150 ${
                    selectedProvider === p.id
                      ? "border-ink-950 bg-ink-50"
                      : "border-ink-200 hover:border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={selectedProvider === p.id}
                    onChange={() => setSelectedProvider(p.id)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded-full border-2 transition-colors duration-150 ${
                      selectedProvider === p.id
                        ? "border-ink-950 bg-ink-950"
                        : "border-ink-300"
                    }`}
                  />
                  <div>
                    <span className="text-sm font-medium text-ink-900">
                      {p.name}
                    </span>
                    <p className="text-xs text-ink-500">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
              API Key
            </label>
            <input
              type="password"
              value={providerApiKey}
              onChange={(e) => setProviderApiKey(e.target.value)}
              placeholder="Enter your API key..."
              className="input font-mono"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-ink-300 bg-white"
            />
            <span className="text-sm text-ink-600">
              Set as default provider
            </span>
          </label>

          {saveError && (
            <div className="flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-red" />
              <p className="text-sm text-signal-red">{saveError}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !providerApiKey}
            className="btn-primary"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Configuration"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Check } from "lucide-react";
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

  if (auth.status !== "authenticated") {
    navigate("/signup");
    return null;
  }

  const handleSave = async () => {
    if (!providerApiKey) return;
    setSaving(true);
    try {
      await saveLLMConfig(selectedProvider, providerApiKey, isDefault);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setProviderApiKey("");
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Settings</h1>

      {/* Account Info */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="text-gray-900">{auth.user!.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-900">{auth.user!.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Company</span>
            <span className="text-gray-900">{auth.user!.company_name}</span>
          </div>
          {auth.user!.chaosbird_username && (
            <div className="flex justify-between">
              <span className="text-gray-500">Chaosbird</span>
              <span className="font-mono text-purple-600">
                {auth.user!.chaosbird_username}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* LLM Provider Config */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          AI Provider Configuration
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Save your own API key for optimal performance. Keys are encrypted and
          stored securely.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-600">
              Provider
            </label>
            <div className="space-y-2">
              {PROVIDERS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                    selectedProvider === p.id
                      ? "border-brand-500 bg-brand-500/5"
                      : "border-gray-200 hover:border-surface-200/30"
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
                    className={`h-4 w-4 rounded-full border-2 ${
                      selectedProvider === p.id
                        ? "border-brand-500 bg-brand-500"
                        : "border-surface-200/30"
                    }`}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {p.name}
                    </span>
                    <p className="text-xs text-gray-500">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-600">
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
              className="rounded border-gray-200 bg-white"
            />
            <span className="text-sm text-gray-600">
              Set as default provider
            </span>
          </label>

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

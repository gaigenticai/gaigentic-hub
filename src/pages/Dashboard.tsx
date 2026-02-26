import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Key, Play, BarChart3, Plus, Trash2, Clock, MessageCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { ApiKey, UsageStats } from "../types";
import { getMyApiKeys, generateApiKey, revokeApiKey, getMyUsage } from "../services/api";
import ApiKeyDisplay from "../components/ApiKeyDisplay";

export default function Dashboard() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      navigate("/signup");
      return;
    }
    Promise.all([getMyApiKeys(), getMyUsage()])
      .then(([k, u]) => {
        setKeys(k);
        setUsage(u);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth, navigate]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateApiKey();
      setNewKey(result.key);
      const updated = await getMyApiKeys();
      setKeys(updated);
    } catch {
      // handle error
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    await revokeApiKey(keyId);
    setKeys(keys.filter((k) => k.id !== keyId));
  };

  if (auth.status !== "authenticated") return null;

  const user = auth.user!;
  const activeKeys = keys.filter(
    (k) => !k.revoked && new Date(k.expires_at) > new Date(),
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {user.company_name} — Your no-obligation trial is active
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usage?.total_calls || 0}
              </p>
              <p className="text-xs text-gray-500">Total API Calls</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <Play className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usage?.calls_today || 0}
              </p>
              <p className="text-xs text-gray-500">Calls Today</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Key className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {activeKeys.length}
              </p>
              <p className="text-xs text-gray-500">Active API Keys</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usage?.api_key?.calls_remaining ?? 50}
              </p>
              <p className="text-xs text-gray-500">Calls Remaining</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Key Banner */}
      {newKey && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="mb-2 font-semibold text-emerald-600">
            API Key Generated!
          </h3>
          <p className="mb-3 text-sm text-gray-600">
            Copy this key now — you won't be able to see it again.
          </p>
          <ApiKeyDisplay keyValue={newKey} expiresAt="" />
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* API Keys */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <button
            onClick={handleGenerate}
            disabled={generating || activeKeys.length >= 3}
            className="btn-primary text-sm"
          >
            <Plus className="h-4 w-4" />
            {generating ? "Generating..." : "Generate Key"}
          </button>
        </div>

        {loading ? (
          <div className="card animate-pulse h-20" />
        ) : keys.length === 0 ? (
          <div className="card text-center py-8">
            <Key className="mx-auto mb-3 h-8 w-8 text-gray-600/30" />
            <p className="text-sm text-gray-500">
              No API keys yet. Generate one to start integrating.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => {
              const expired = new Date(key.expires_at) < new Date();
              return (
                <div
                  key={key.id}
                  className={`card flex items-center justify-between ${expired || key.revoked ? "opacity-50" : ""}`}
                >
                  <div>
                    <code className="font-mono text-sm text-emerald-600">
                      {key.key_prefix}{"*".repeat(20)}
                    </code>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        Created{" "}
                        {new Date(key.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        {key.revoked
                          ? "Revoked"
                          : expired
                            ? "Expired"
                            : `Expires ${new Date(key.expires_at).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                  {!key.revoked && !expired && (
                    <button
                      onClick={() => handleRevoke(key.id)}
                      className="rounded p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                      title="Revoke"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chaosbird Channel */}
      {user.chaosbird_username && (
        <div className="card border-purple-200">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Your Support Channel
              </h3>
              <p className="text-sm text-gray-600">
                Chat with our team on Chaosbird:{" "}
                <a
                  href="https://chaosbird.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  {user.chaosbird_username}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/agents"
          className="card flex items-center gap-4 hover:border-purple-200 transition-all"
        >
          <Play className="h-8 w-8 text-purple-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Browse Agents</h3>
            <p className="text-sm text-gray-500">
              Explore our catalog of AI agents
            </p>
          </div>
        </Link>
        <Link
          to="/playground"
          className="card flex items-center gap-4 hover:border-purple-200 transition-all"
        >
          <BarChart3 className="h-8 w-8 text-purple-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Open Playground</h3>
            <p className="text-sm text-gray-500">
              Test agents with sample data
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

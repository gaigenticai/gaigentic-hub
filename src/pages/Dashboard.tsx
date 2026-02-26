import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Key, Play, BarChart3, Plus, Trash2, Clock, MessageCircle, X, Calendar, Send, CheckCircle } from "lucide-react";
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatSent, setChatSent] = useState(false);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      navigate("/login");
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

  const trialExpiresAt = user.trial_expires_at ? new Date(user.trial_expires_at) : null;
  const daysRemaining = trialExpiresAt
    ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const trialExpired = daysRemaining !== null && daysRemaining <= 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user.name}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {user.company_name} —{" "}
          {trialExpired ? (
            <span className="font-medium text-red-600">Trial expired. Contact us for enterprise access.</span>
          ) : daysRemaining !== null ? (
            <span className={daysRemaining <= 3 ? "font-medium text-amber-600" : ""}>
              {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining in your trial
            </span>
          ) : (
            "Your no-obligation trial is active"
          )}
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

      {/* Support — Chat with Krishna */}
      <div className="overflow-hidden rounded-2xl border border-purple-200">
        {/* Header */}
        <div className="flex items-center justify-between bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 text-purple-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Need Help? Chat with Us
              </h3>
              <p className="text-sm text-gray-600">
                Message Krishna directly — questions, feedback, or enterprise plans.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://calendly.com/krishnagai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition-all hover:border-blue-300 hover:shadow-sm"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              Book a Demo
            </a>
            {chatOpen ? (
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-lg border border-gray-200 p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setChatOpen(true)}
                className="btn-primary text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Chat Now
              </button>
            )}
          </div>
        </div>

        {/* Inline chat widget */}
        {chatOpen && (
          <div className="border-t border-gray-100">
            {/* Chat header bar */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
                K
              </div>
              <span className="text-sm font-medium text-white">Krishna</span>
              <span className="ml-auto text-[10px] text-purple-200">
                {user.chaosbird_username && `@${user.chaosbird_username}`}
              </span>
            </div>

            {/* Messages area */}
            <div className="bg-gray-50/50 px-4 py-4">
              {/* Krishna's greeting */}
              <div className="mb-3 flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[10px] font-bold text-white">
                  K
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm">
                  <p>Hey {user.name.split(" ")[0]}! How can I help you today?</p>
                  <p className="mt-1 text-gray-500">Ask me about agents, enterprise plans, or anything else.</p>
                </div>
              </div>

              {/* User's sent message */}
              {chatSent && (
                <div className="mb-3 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-purple-600 px-4 py-2.5 text-sm text-white">
                    {chatMessage}
                  </div>
                </div>
              )}

              {/* Chat input or confirmation */}
              {chatSent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <CheckCircle className="mx-auto h-5 w-5 text-emerald-500" />
                  <p className="mt-1 text-sm font-medium text-emerald-700">Message sent!</p>
                  <p className="text-xs text-emerald-600">Krishna will reply on Chaosbird</p>
                  <button
                    onClick={() => { setChatSent(false); setChatMessage(""); }}
                    className="mt-2 text-xs text-emerald-600 underline hover:text-emerald-700"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-end gap-2">
                  <textarea
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) {
                        e.preventDefault();
                        document.getElementById("dash-chat-send")?.click();
                      }
                    }}
                    placeholder="Type a message to Krishna..."
                    className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    rows={2}
                    autoFocus
                  />
                  <button
                    id="dash-chat-send"
                    onClick={async () => {
                      if (!chatMessage.trim() || !user.chaosbird_username) return;
                      setChatSending(true);
                      try {
                        await fetch("/api/chat/send", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            username: user.chaosbird_username,
                            message: chatMessage.trim(),
                          }),
                        });
                        setChatSent(true);
                      } catch {
                        // silent fail
                      } finally {
                        setChatSending(false);
                      }
                    }}
                    disabled={chatSending || !chatMessage.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
              <p className="text-center text-[10px] text-gray-400">
                Messages sent as <span className="font-medium">{user.chaosbird_username}</span> via Chaosbird
              </p>
            </div>
          </div>
        )}
      </div>

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

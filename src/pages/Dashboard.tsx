import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Key, Play, BarChart3, Plus, Trash2, Clock, MessageCircle, X, Calendar, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { ApiKey, UsageStats } from "../types";
import { getMyApiKeys, generateApiKey, revokeApiKey, getMyUsage } from "../services/api";
import ApiKeyDisplay from "../components/ApiKeyDisplay";

interface ChatMessage {
  id: string;
  sender_name: string;
  receiver_name: string;
  content: string;
  created_at: string;
  seen_at: string | null;
}

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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  }, [auth, navigate]);

  // Fetch chat messages from Chaosbird
  const fetchMessages = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.user?.chaosbird_username) return;
    try {
      const res = await fetch(`/api/chat/messages?username=${auth.user.chaosbird_username}&limit=50`);
      if (res.ok) {
        const data = await res.json() as { messages: ChatMessage[] };
        setChatMessages(data.messages || []);
      }
    } catch {
      // silent — polling will retry
    }
  }, [auth]);

  // Load messages when chat opens + poll every 5s
  useEffect(() => {
    if (!chatOpen) return;
    setChatLoading(true);
    fetchMessages().finally(() => setChatLoading(false));
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [chatOpen, fetchMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateApiKey();
      setNewKey(result.key);
      const updated = await getMyApiKeys();
      setKeys(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key");
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
        <h1 className="text-2xl font-semibold text-ink-950 font-headline">
          Welcome, {user.name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {user.company_name} —{" "}
          {trialExpired ? (
            <span className="font-medium text-signal-red">Trial expired. Contact us for enterprise access.</span>
          ) : daysRemaining !== null ? (
            <span className={daysRemaining <= 3 ? "font-medium text-signal-amber" : ""}>
              {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining in your trial
            </span>
          ) : (
            "Your no-obligation trial is active"
          )}
        </p>
      </div>

      {/* Quick Stats — Ledger style */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <h4 className="mb-1">Total API Calls</h4>
          <p className="text-metric">{usage?.total_calls || 0}</p>
        </div>
        <div className="card">
          <h4 className="mb-1">Calls Today</h4>
          <p className="text-metric">{usage?.calls_today || 0}</p>
        </div>
        <div className="card">
          <h4 className="mb-1">Active API Keys</h4>
          <p className="text-metric">{activeKeys.length}</p>
        </div>
        <div className="card">
          <h4 className="mb-1">Calls Remaining</h4>
          <p className="text-metric">{usage?.api_key?.calls_remaining ?? "—"}</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-red" />
          <div className="flex-1">
            <p className="text-sm text-signal-red">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-signal-red/50 hover:text-signal-red">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* New Key Banner */}
      {newKey && (
        <div className="mb-6 rounded-lg border border-signal-green/20 bg-signal-green-light p-5">
          <h3 className="mb-2 text-sm font-semibold text-signal-green">
            API Key Generated
          </h3>
          <p className="mb-3 text-sm text-ink-600">
            Copy this key now — you won't be able to see it again.
          </p>
          <ApiKeyDisplay keyValue={newKey} expiresAt="" />
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-ink-500 hover:text-ink-900 transition-colors duration-150"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* API Keys */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h4>API Keys</h4>
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
            <Key className="mx-auto mb-3 h-6 w-6 text-ink-300" />
            <p className="text-sm text-ink-500">
              No API keys yet. Generate one to start integrating.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => {
              const expired = new Date(key.expires_at) < new Date();
              return (
                <div
                  key={key.id}
                  className={`card flex items-center justify-between ${expired || key.revoked ? "opacity-50" : ""}`}
                >
                  <div>
                    <code className="font-mono text-sm text-signal-green">
                      {key.key_prefix}{"*".repeat(20)}
                    </code>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-400">
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
                      className="btn-icon text-ink-400 hover:text-signal-red hover:bg-signal-red-light"
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
      <div className="grid gap-4 lg:grid-cols-[1fr,380px]">
        {/* Left: CTA card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-0.5 h-5 w-5 text-ink-600" />
              <div>
                <h3 className="text-sm font-semibold text-ink-900">
                  Need Help? Chat with Us
                </h3>
                <p className="mt-1 text-sm text-ink-500 leading-relaxed">
                  Message Krishna directly — questions, feedback, or enterprise plans.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            {!chatOpen && (
              <button
                onClick={() => setChatOpen(true)}
                className="btn-primary text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Chat Now
              </button>
            )}
            <a
              href="https://calendly.com/krishnagai"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm"
            >
              <Calendar className="h-3.5 w-3.5" />
              Book a Demo
            </a>
          </div>
        </div>

        {/* Right: Chat panel */}
        {chatOpen ? (
          <div className="flex flex-col overflow-hidden rounded-lg border border-ink-200">
            {/* Chat header bar */}
            <div className="flex items-center gap-2 bg-ink-950 px-4 py-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                K
              </div>
              <span className="text-sm font-medium text-white">Krishna</span>
              <span className="ml-auto text-[10px] text-white/50">
                {user.chaosbird_username && `@${user.chaosbird_username}`}
              </span>
              <button
                onClick={() => setChatOpen(false)}
                className="ml-2 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors duration-150"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Messages area — scrollable */}
            <div className="flex-1 overflow-y-auto bg-ink-100 px-4 py-4" style={{ minHeight: 300, maxHeight: 420 }}>
              {chatLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
                </div>
              ) : chatMessages.length === 0 ? (
                /* Empty state — show greeting */
                <div className="mb-4 flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">
                    K
                  </div>
                  <div className="rounded-xl rounded-bl-sm bg-white px-4 py-3 text-sm shadow-sm">
                    <p className="font-semibold text-ink-950">Hey {user.name.split(" ")[0]}!</p>
                    <p className="mt-1 text-ink-700 leading-relaxed">How can I help you today? Ask me about agents, enterprise plans, or anything else.</p>
                  </div>
                </div>
              ) : (
                /* Render real messages */
                chatMessages.map((msg) => {
                  const isMe = msg.sender_name === user.chaosbird_username;
                  return isMe ? (
                    <div key={msg.id} className="mb-3 flex justify-end">
                      <div className="max-w-[85%]">
                        <div className="rounded-xl rounded-br-sm bg-ink-950 px-4 py-3 text-sm text-white shadow-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        <p className="mt-1 text-right text-[10px] text-ink-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="mb-3 flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">
                        K
                      </div>
                      <div className="max-w-[85%]">
                        <div className="rounded-xl rounded-bl-sm bg-white px-4 py-3 text-sm text-ink-800 shadow-sm whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Chat error */}
              {chatError && (
                <div className="mb-3 rounded-lg border border-signal-red/20 bg-signal-red-light px-3 py-2 text-xs text-signal-red">
                  {chatError}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input — always visible */}
            <div className="border-t border-ink-200 bg-white px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) {
                      e.preventDefault();
                      document.getElementById("dash-chat-send")?.click();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 resize-none rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-300 focus:outline-none focus:ring-1 focus:ring-ink-300"
                  rows={1}
                  autoFocus
                />
                <button
                  id="dash-chat-send"
                  onClick={async () => {
                    if (!chatMessage.trim() || !user.chaosbird_username) return;
                    setChatSending(true);
                    setChatError(null);
                    try {
                      const res = await fetch("/api/chat/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          username: user.chaosbird_username,
                          message: chatMessage.trim(),
                        }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({ error: "Send failed" }));
                        throw new Error((data as { error?: string }).error || `Send failed (${res.status})`);
                      }
                      setChatMessage("");
                      // Refetch messages to show the sent message
                      await fetchMessages();
                    } catch (err) {
                      setChatError(err instanceof Error ? err.message : "Failed to send message");
                    } finally {
                      setChatSending(false);
                    }
                  }}
                  disabled={chatSending || !chatMessage.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white transition-colors duration-150 hover:bg-ink-800 disabled:opacity-40"
                >
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="border-t border-ink-200 bg-ink-50 px-3 py-1.5">
              <p className="text-center text-[10px] text-ink-500">
                via <span className="font-semibold text-ink-700">{user.chaosbird_username}</span> on Chaosbird
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setChatOpen(true)}
            className="card-interactive flex cursor-pointer flex-col items-center justify-center py-10 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-950 text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-900">Chat with Krishna</p>
            <p className="mt-1 text-xs text-ink-500">Click to open</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/agents"
          className="card-interactive flex items-center gap-4"
        >
          <Play className="h-6 w-6 text-ink-600" />
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Browse Agents</h3>
            <p className="text-sm text-ink-500">
              Explore our catalog of AI agents
            </p>
          </div>
        </Link>
        <Link
          to="/playground"
          className="card-interactive flex items-center gap-4"
        >
          <BarChart3 className="h-6 w-6 text-ink-600" />
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Open Playground</h3>
            <p className="text-sm text-ink-500">
              Test agents with sample data
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}

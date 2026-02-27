import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BarChart3,
  Key,
  Search,
  MessageCircle,
  Send,
  Clock,
  X,
  ChevronDown,
  ChevronRight,
  Star,
  Bot,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import type { AdminStats, AdminSignup } from "../types";
import {
  getAdminStats,
  getAdminSignups,
  contactUser,
  extendTrial,
} from "../services/api";

export default function Admin() {
  const { auth } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [signups, setSignups] = useState<AdminSignup[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Contact modal
  const [contactModal, setContactModal] = useState<AdminSignup | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user?.role !== "admin") {
      navigate("/");
      return;
    }
    Promise.all([getAdminStats(), getAdminSignups(1, 50, "")])
      .then(([s, sg]) => {
        setStats(s);
        setSignups(sg.signups);
        setTotal(sg.total);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
      })
      .finally(() => setLoading(false));
  }, [auth, navigate]);

  const handleSearch = async () => {
    setError(null);
    try {
      const result = await getAdminSignups(1, 50, search);
      setSignups(result.signups);
      setTotal(result.total);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  };

  const handleContact = async () => {
    if (!contactModal || !message.trim()) return;
    setSending(true);
    setContactError(null);
    try {
      await contactUser(contactModal.id, message.trim());
      setContactModal(null);
      setMessage("");
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleExtend = async (userId: string) => {
    await extendTrial(userId, 14);
    const result = await getAdminSignups(page, 50, search);
    setSignups(result.signups);
  };

  if (auth.user?.role !== "admin") return null;

  const ratingLabel = (r: number) =>
    r === 1 ? "Poor" : r === 2 ? "Bad" : r === 3 ? "OK" : r === 4 ? "Good" : "Great";

  const ratingColor = (r: number) =>
    r >= 4 ? "text-signal-green" : r === 3 ? "text-signal-amber" : "text-signal-red";

  const trialStatus = (s: AdminSignup) => {
    if (!s.trial_expires_at) return null;
    const d = Math.ceil((new Date(s.trial_expires_at).getTime() - Date.now()) / 86400000);
    if (d <= 0) return <span className="text-[10px] font-medium text-signal-red">expired</span>;
    if (d <= 3) return <span className="text-[10px] font-medium text-signal-amber">{d}d left</span>;
    return <span className="text-[10px] text-ink-400">{d}d left</span>;
  };

  return (
    <div>
      <h1 className="mb-8 text-2xl font-semibold text-ink-950 font-headline">Admin Dashboard</h1>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-red" />
          <p className="flex-1 text-sm text-signal-red">{error}</p>
          <button onClick={() => setError(null)} className="text-signal-red/50 hover:text-signal-red">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats — Ledger style */}
      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <h4 className="mb-1">Total Signups</h4>
            <p className="text-metric">{stats.total_signups}</p>
            <p className="text-xs text-ink-400">+{stats.signups_today} today</p>
          </div>
          <div className="card">
            <h4 className="mb-1">Total API Calls</h4>
            <p className="text-metric">{stats.total_api_calls}</p>
            <p className="text-xs text-ink-400">+{stats.calls_today} today</p>
          </div>
          <div className="card">
            <h4 className="mb-1">Active API Keys</h4>
            <p className="text-metric">{stats.active_api_keys}</p>
          </div>
          <div className="card">
            <h4 className="mb-1">Signups This Week</h4>
            <p className="text-metric">{stats.signups_this_week}</p>
          </div>
        </div>
      )}

      {/* Signups Table */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h4>All Signups ({total})</h4>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search..."
                className="input pl-10 py-2 text-sm w-64"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-ink-50" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Name</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Company</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Email</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Calls</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Agents</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Trial</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Signed Up</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-ink-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => {
                  const isExpanded = expandedId === s.id;
                  const hasDetails = s.agents_tried.length > 0 || s.feedback.length > 0;
                  return (
                    <>
                      <tr
                        key={s.id}
                        className={`border-b border-ink-100 hover:bg-ink-25 ${hasDetails ? "cursor-pointer" : ""}`}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : s.id)}
                      >
                        <td className="px-2 py-3 text-ink-400">
                          {hasDetails && (
                            isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-ink-900">{s.name}</td>
                        <td className="px-3 py-3 text-ink-600">{s.company_name}</td>
                        <td className="px-3 py-3 text-ink-600">{s.email}</td>
                        <td className="px-3 py-3 font-mono text-ink-600">{s.api_calls}</td>
                        <td className="px-3 py-3">
                          {s.agents_tried.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.agents_tried.slice(0, 3).map((a) => (
                                <span key={a.agent_slug} className="inline-flex items-center rounded-md bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-700 border border-ink-200">
                                  {a.agent_slug}
                                  <span className="ml-1 text-ink-400">x{a.count}</span>
                                </span>
                              ))}
                              {s.agents_tried.length > 3 && (
                                <span className="text-[10px] text-ink-400">+{s.agents_tried.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{trialStatus(s)}</td>
                        <td className="px-3 py-3 text-ink-500">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setContactModal(s)}
                              className="btn-icon text-cobalt"
                              title="Contact via Chaosbird"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleExtend(s.id)}
                              className="btn-icon text-signal-amber"
                              title="Extend trial +14 days"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${s.id}-detail`} className="border-b border-ink-100 bg-ink-25">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid gap-6 lg:grid-cols-2">
                              {/* Agents Tried */}
                              <div>
                                <h4 className="mb-2 flex items-center gap-1.5">
                                  <Bot className="h-3.5 w-3.5" />
                                  Agents Tried ({s.agents_tried.length})
                                </h4>
                                {s.agents_tried.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {s.agents_tried.map((a) => (
                                      <div key={a.agent_slug} className="flex items-center justify-between rounded-lg bg-white border border-ink-100 px-3 py-2 text-sm">
                                        <span className="font-medium text-ink-800">{a.agent_slug}</span>
                                        <div className="flex items-center gap-3 text-xs text-ink-500">
                                          <span>{a.count} call{a.count !== 1 ? "s" : ""}</span>
                                          <span>Last: {new Date(a.last_used).toLocaleDateString()}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-ink-400">No agents tried yet</p>
                                )}
                              </div>

                              {/* Feedback */}
                              <div>
                                <h4 className="mb-2 flex items-center gap-1.5">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Feedback ({s.feedback.length})
                                </h4>
                                {s.feedback.length > 0 ? (
                                  <div className="space-y-2">
                                    {s.feedback.map((f, i) => (
                                      <div key={i} className="rounded-lg bg-white border border-ink-100 px-3 py-2 text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="tag text-[10px]">
                                              {f.agent_slug}
                                            </span>
                                            <span className={`flex items-center gap-0.5 text-xs font-medium ${ratingColor(f.rating)}`}>
                                              <Star className="h-3 w-3" />
                                              {f.rating}/5 ({ratingLabel(f.rating)})
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-ink-400">
                                            {new Date(f.created_at).toLocaleDateString()}
                                          </span>
                                        </div>
                                        {f.comment && (
                                          <p className="text-xs text-ink-600 mt-1">{f.comment}</p>
                                        )}
                                        {f.correction && (
                                          <div className="mt-1 rounded bg-signal-amber-light px-2 py-1 text-xs text-signal-amber">
                                            Correction: {f.correction}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-ink-400">No feedback submitted</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 px-4">
          <div className="card w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">
                Contact {contactModal.name}
              </h3>
              <button
                onClick={() => setContactModal(null)}
                className="btn-icon"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-xs text-ink-500">
              via Chaosbird: {contactModal.chaosbird_username || "No account"}
            </p>
            {contactError && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-3 py-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-red" />
                <p className="text-sm text-signal-red">{contactError}</p>
              </div>
            )}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="input mb-4"
              rows={4}
            />
            <button
              onClick={handleContact}
              disabled={sending || !message.trim() || !contactModal.chaosbird_username}
              className="btn-primary w-full justify-center"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending..." : "Send via Chaosbird"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

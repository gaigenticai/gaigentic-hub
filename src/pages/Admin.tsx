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

  // Contact modal
  const [contactModal, setContactModal] = useState<AdminSignup | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth, navigate]);

  const handleSearch = async () => {
    const result = await getAdminSignups(1, 50, search);
    setSignups(result.signups);
    setTotal(result.total);
    setPage(1);
  };

  const handleContact = async () => {
    if (!contactModal || !message.trim()) return;
    setSending(true);
    try {
      await contactUser(contactModal.id, message.trim());
      setContactModal(null);
      setMessage("");
    } catch {
      // handle error
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
    r >= 4 ? "text-emerald-600" : r === 3 ? "text-amber-600" : "text-red-600";

  const trialStatus = (s: AdminSignup) => {
    if (!s.trial_expires_at) return null;
    const d = Math.ceil((new Date(s.trial_expires_at).getTime() - Date.now()) / 86400000);
    if (d <= 0) return <span className="text-[10px] font-medium text-red-500">expired</span>;
    if (d <= 3) return <span className="text-[10px] font-medium text-amber-500">{d}d left</span>;
    return <span className="text-[10px] text-gray-400">{d}d left</span>;
  };

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <Users className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-3xl font-bold text-gray-900">{stats.total_signups}</p>
            <p className="text-xs text-gray-500">Total Signups (+{stats.signups_today} today)</p>
          </div>
          <div className="card">
            <BarChart3 className="mb-2 h-5 w-5 text-emerald-600" />
            <p className="text-3xl font-bold text-gray-900">{stats.total_api_calls}</p>
            <p className="text-xs text-gray-500">Total API Calls (+{stats.calls_today} today)</p>
          </div>
          <div className="card">
            <Key className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-3xl font-bold text-gray-900">{stats.active_api_keys}</p>
            <p className="text-xs text-gray-500">Active API Keys</p>
          </div>
          <div className="card">
            <Clock className="mb-2 h-5 w-5 text-amber-600" />
            <p className="text-3xl font-bold text-gray-900">{stats.signups_this_week}</p>
            <p className="text-xs text-gray-500">Signups This Week</p>
          </div>
        </div>
      )}

      {/* Signups Table */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Signups ({total})</h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
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
              <div key={i} className="h-12 rounded bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Company</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Email</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Calls</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Agents</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Trial</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Signed Up</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">Actions</th>
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
                        className={`border-b border-gray-200 hover:bg-gray-50/50 ${hasDetails ? "cursor-pointer" : ""}`}
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : s.id)}
                      >
                        <td className="px-2 py-3 text-gray-400">
                          {hasDetails && (
                            isExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-3 py-3 text-gray-600">{s.company_name}</td>
                        <td className="px-3 py-3 text-gray-600">{s.email}</td>
                        <td className="px-3 py-3 text-gray-600">{s.api_calls}</td>
                        <td className="px-3 py-3">
                          {s.agents_tried.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.agents_tried.slice(0, 3).map((a) => (
                                <span key={a.agent_slug} className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                                  {a.agent_slug}
                                  <span className="ml-1 text-purple-400">x{a.count}</span>
                                </span>
                              ))}
                              {s.agents_tried.length > 3 && (
                                <span className="text-[10px] text-gray-400">+{s.agents_tried.length - 3}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{trialStatus(s)}</td>
                        <td className="px-3 py-3 text-gray-500">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setContactModal(s)}
                              className="rounded p-1.5 text-purple-600 hover:bg-purple-100"
                              title="Contact via Chaosbird"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleExtend(s.id)}
                              className="rounded p-1.5 text-amber-600 hover:bg-amber-50"
                              title="Extend trial +14 days"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr key={`${s.id}-detail`} className="border-b border-gray-200 bg-gray-50/50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid gap-6 lg:grid-cols-2">
                              {/* Agents Tried */}
                              <div>
                                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
                                  <Bot className="h-3.5 w-3.5" />
                                  Agents Tried ({s.agents_tried.length})
                                </h4>
                                {s.agents_tried.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {s.agents_tried.map((a) => (
                                      <div key={a.agent_slug} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                                        <span className="font-medium text-gray-800">{a.agent_slug}</span>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                          <span>{a.count} call{a.count !== 1 ? "s" : ""}</span>
                                          <span>Last: {new Date(a.last_used).toLocaleDateString()}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No agents tried yet</p>
                                )}
                              </div>

                              {/* Feedback */}
                              <div>
                                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Feedback ({s.feedback.length})
                                </h4>
                                {s.feedback.length > 0 ? (
                                  <div className="space-y-2">
                                    {s.feedback.map((f, i) => (
                                      <div key={i} className="rounded-lg bg-white px-3 py-2 text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] rounded-full bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                                              {f.agent_slug}
                                            </span>
                                            <span className={`flex items-center gap-0.5 text-xs font-medium ${ratingColor(f.rating)}`}>
                                              <Star className="h-3 w-3" />
                                              {f.rating}/5 ({ratingLabel(f.rating)})
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-gray-400">
                                            {new Date(f.created_at).toLocaleDateString()}
                                          </span>
                                        </div>
                                        {f.comment && (
                                          <p className="text-xs text-gray-600 mt-1">{f.comment}</p>
                                        )}
                                        {f.correction && (
                                          <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                                            Correction: {f.correction}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">No feedback submitted</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="card w-full max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Contact {contactModal.name}
              </h3>
              <button
                onClick={() => setContactModal(null)}
                className="text-gray-500 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              via Chaosbird: {contactModal.chaosbird_username || "No account"}
            </p>
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

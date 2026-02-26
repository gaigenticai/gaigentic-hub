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
    // Refresh
    const result = await getAdminSignups(page, 50, search);
    setSignups(result.signups);
  };

  if (auth.user?.role !== "admin") return null;

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Stats */}
      {stats && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <Users className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_signups}
            </p>
            <p className="text-xs text-gray-500">
              Total Signups (+{stats.signups_today} today)
            </p>
          </div>
          <div className="card">
            <BarChart3 className="mb-2 h-5 w-5 text-emerald-600" />
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_api_calls}
            </p>
            <p className="text-xs text-gray-500">
              Total API Calls (+{stats.calls_today} today)
            </p>
          </div>
          <div className="card">
            <Key className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-3xl font-bold text-gray-900">
              {stats.active_api_keys}
            </p>
            <p className="text-xs text-gray-500">Active API Keys</p>
          </div>
          <div className="card">
            <Clock className="mb-2 h-5 w-5 text-amber-600" />
            <p className="text-3xl font-bold text-gray-900">
              {stats.signups_this_week}
            </p>
            <p className="text-xs text-gray-500">Signups This Week</p>
          </div>
        </div>
      )}

      {/* Signups Table */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            All Signups ({total})
          </h2>
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
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    Company
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    Email
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    API Calls
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    Signed Up
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-200 hover:bg-gray-100/30"
                  >
                    <td className="px-3 py-3 text-gray-900">{s.name}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {s.company_name}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{s.email}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {s.api_calls}
                    </td>
                    <td className="px-3 py-3 text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
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
                ))}
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

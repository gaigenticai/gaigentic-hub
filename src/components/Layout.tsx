import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  LayoutDashboard,
  Key,
  Settings,
  Shield,
  Play,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/playground", label: "Playground", icon: Play },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, auth: true },
  { to: "/settings", label: "Settings", icon: Settings, auth: true },
];

export default function Layout() {
  const { auth, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthenticated = auth.status === "authenticated";
  const isAdmin = auth.user?.role === "admin";

  return (
    <div className="min-h-screen bg-white">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-xs font-semibold font-headline text-ink-400 tracking-wide uppercase">agent hub</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_ITEMS.filter((n) => !n.auth || isAuthenticated).map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "text-ink-950"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {active && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-ink-950 rounded-full" />
                  )}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  location.pathname === "/admin"
                    ? "text-cta"
                    : "text-ink-500 hover:text-ink-900"
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && (() => {
              const t = auth.user?.trial_expires_at;
              if (!t) return null;
              const d = Math.max(0, Math.ceil((new Date(t).getTime() - Date.now()) / 86400000));
              if (d > 7) return null;
              return (
                <span className={`hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                  d <= 0 ? "bg-signal-red-light text-signal-red" :
                  d <= 3 ? "bg-signal-amber-light text-signal-amber" :
                  "bg-cobalt-light text-cobalt"
                }`}>
                  {d <= 0 ? "Trial expired" : `${d}d left`}
                </span>
              );
            })()}
            {isAuthenticated ? (
              <>
                <Link
                  to="/apikeys"
                  className="hidden items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50 sm:flex"
                >
                  <Key className="h-3.5 w-3.5" />
                  API Keys
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="btn-icon"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors duration-150">
                  Log In
                </Link>
                <Link to="/signup" className="btn-primary text-sm">
                  Get Started Free
                </Link>
              </>
            )}
            <button
              className="md:hidden btn-icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="border-t border-ink-100 bg-white px-4 pb-3 md:hidden">
            {NAV_ITEMS.filter((n) => !n.auth || isAuthenticated).map(
              (item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors duration-150"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ),
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

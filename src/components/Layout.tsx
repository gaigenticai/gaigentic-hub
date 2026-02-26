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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold font-headline text-gray-900">
              GaiGentic<span className="text-gradient"> Hub</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.filter((n) => !n.auth || isAuthenticated).map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors relative ${
                    active
                      ? "text-purple-700"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {active && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full" />
                  )}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname === "/admin"
                    ? "text-amber-600"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link
                  to="/apikeys"
                  className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:shadow-md sm:flex"
                >
                  <Key className="h-4 w-4" />
                  API Keys
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <Link to="/signup" className="btn-primary text-sm">
                Get Started Free
              </Link>
            )}
            <button
              className="md:hidden text-gray-500"
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
          <div className="border-t border-gray-200 bg-white px-4 pb-4 md:hidden">
            {NAV_ITEMS.filter((n) => !n.auth || isAuthenticated).map(
              (item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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

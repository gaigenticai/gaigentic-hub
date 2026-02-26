import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({
        email: email.trim(),
        password: needsPassword ? password : undefined,
      });
      navigate("/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "Password required") {
        setNeedsPassword(true);
        setError("");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2">
            <span className="text-xl font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-sm font-bold font-headline text-gray-400 tracking-wide">agent hub</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 font-headline">
            Welcome back
          </h1>
          <p className="mt-2 text-gray-600">
            Log in with your work email to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-flat space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setNeedsPassword(false);
                setError("");
              }}
              placeholder="you@yourcompany.com"
              className="input"
              autoFocus
            />
          </div>

          {needsPassword && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input"
                autoFocus
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error === "Account not found"
                ? "No account found with this email. Please sign up first."
                : error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? "Logging in..." : "Log In"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <p className="text-center text-xs text-gray-500">
            Don't have an account?{" "}
            <Link to="/signup" className="text-purple-600 hover:underline">
              Start free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2">
            <span className="text-lg font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-xs font-semibold font-headline text-ink-400 tracking-wide uppercase">agent hub</span>
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink-950 font-headline">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Log in with your work email to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-flat space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
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
              <label className="mb-1.5 block text-sm font-medium text-ink-600">
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
            <div className="rounded-lg border border-signal-red/20 bg-signal-red-light px-4 py-3 text-sm text-signal-red">
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

          <p className="text-center text-xs text-ink-500">
            Don't have an account?{" "}
            <Link to="/signup" className="text-cobalt hover:underline">
              Start free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

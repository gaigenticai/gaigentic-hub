import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, ArrowRight, MessageCircle, CheckCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    chaosbird_username: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signup({
        name: name.trim(),
        email: email.trim(),
        company_name: companyName.trim(),
      });
      setSuccess({ chaosbird_username: result.chaosbird_username });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
        <div className="w-full max-w-md">
          <div className="card-flat text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 font-headline">
              Welcome to GaiGentic Hub!
            </h2>
            <p className="mt-2 text-gray-600">
              Your no-obligation 14-day trial is active. Start exploring AI
              agents now.
            </p>

            {/* Chaosbird instructions */}
            <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-4 text-left">
              <div className="flex items-center gap-2 text-purple-700">
                <MessageCircle className="h-5 w-5" />
                <span className="font-semibold">Your Feedback Channel</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                We've created a direct communication channel for you on
                Chaosbird, our messaging platform:
              </p>
              <div className="mt-2 rounded-lg bg-gray-900 px-3 py-2 font-mono text-sm text-emerald-400">
                Username: {success.chaosbird_username}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Visit{" "}
                <a
                  href="https://chaosbird.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 underline"
                >
                  chaosbird.app
                </a>{" "}
                and log in with your username above to chat with our team
                directly. No password needed!
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => navigate("/agents")}
                className="btn-primary justify-center"
              >
                Browse Agents
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate("/playground")}
                className="btn-secondary justify-center"
              >
                Open Playground
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold font-headline text-gray-900">
              GaiGentic<span className="text-gradient"> Hub</span>
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 font-headline">
            Start your free trial
          </h1>
          <p className="mt-2 text-gray-600">
            No credit card. No obligations. 14-day free access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-flat space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="input"
              minLength={2}
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Financial"
              className="input"
              minLength={2}
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@acme.com"
              className="input"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? "Creating account..." : "Get Started Free"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <p className="text-center text-xs text-gray-500">
            Already have an account?{" "}
            <Link to="/agents" className="text-purple-600 hover:underline">
              Browse agents
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

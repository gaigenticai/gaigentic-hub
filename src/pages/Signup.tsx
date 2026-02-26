import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, CheckCircle, Copy, Check, Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const BLOCKED_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "protonmail.com",
  "proton.me", "mail.com", "zoho.com", "yandex.com", "gmx.com", "gmx.net",
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "yopmail.com",
];

function isBlockedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? BLOCKED_EMAIL_DOMAINS.includes(domain) : false;
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailWarning, setEmailWarning] = useState("");
  const [copied, setCopied] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatSent, setChatSent] = useState(false);
  const [success, setSuccess] = useState<{
    chaosbird_username: string;
  } | null>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value && value.includes("@") && isBlockedEmail(value.trim())) {
      setEmailWarning("Please use your work email address");
    } else {
      setEmailWarning("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlockedEmail(email.trim())) {
      setError("Please use your work email. Consumer email addresses like Gmail and Yahoo are not accepted.");
      return;
    }
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

  const handleCopy = () => {
    if (!success) return;
    navigator.clipboard.writeText(success.chaosbird_username);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
        <div className="w-full max-w-4xl">
          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            {/* Left — Welcome + Details */}
            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 font-headline">
                    Welcome to gaigentic Agent Hub!
                  </h2>
                  <p className="text-sm text-gray-500">
                    Your 14-day free trial is active
                  </p>
                </div>
              </div>

              {/* Account details */}
              <div className="mt-5 space-y-3">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Name
                  </p>
                  <p className="text-sm font-medium text-gray-900">{name}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Email
                  </p>
                  <p className="text-sm font-medium text-gray-900">{email}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Company
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {companyName}
                  </p>
                </div>
              </div>

              {/* Chaosbird username */}
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-purple-500">
                  Your Messaging Username
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-md bg-gray-900 px-3 py-1.5 font-mono text-sm text-emerald-400">
                    {success.chaosbird_username}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    title="Copy username"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  Use this at{" "}
                  <a
                    href="https://chaosbird.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 underline"
                  >
                    chaosbird.app
                  </a>{" "}
                  to continue conversations anytime
                </p>
              </div>

              {/* Action buttons */}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => navigate("/agents")}
                  className="btn-primary flex-1 justify-center"
                >
                  Browse Agents
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/playground")}
                  className="btn-secondary flex-1 justify-center"
                >
                  Open Playground
                </button>
              </div>
            </div>

            {/* Right — Chat with Krishna (custom widget) */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
                <MessageCircle className="h-4 w-4 text-white" />
                <span className="text-sm font-semibold text-white">
                  Chat with Krishna
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                {/* Auto-sent lead message (shown as already sent) */}
                <div className="mb-3 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-purple-600 px-4 py-2.5 text-sm text-white">
                    <p className="font-medium">Hi Krishna!</p>
                    <p className="mt-1 text-purple-100">
                      I just signed up for gaigentic Agent Hub.
                    </p>
                    <p className="mt-1 text-[11px] text-purple-200">
                      {name} &middot; {companyName} &middot; {email}
                    </p>
                  </div>
                </div>

                <div className="mb-3 flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[10px] font-bold text-white">
                    K
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-700">
                    <p>Welcome {name.split(" ")[0]}! Thanks for signing up.</p>
                    <p className="mt-1">I'll review your details and get back to you shortly. Feel free to send me a message!</p>
                  </div>
                </div>

                {/* User replies */}
                {chatSent && (
                  <div className="mb-3 flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-purple-600 px-4 py-2.5 text-sm text-white">
                      {chatMessage}
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                {/* Chat input */}
                {chatSent ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                    <CheckCircle className="mx-auto h-5 w-5 text-emerald-500" />
                    <p className="mt-1 text-sm font-medium text-emerald-700">Message sent!</p>
                    <p className="text-xs text-emerald-600">Krishna will reply on Chaosbird</p>
                  </div>
                ) : (
                  <div className="mt-2 flex items-end gap-2">
                    <textarea
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Type a message to Krishna..."
                      className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      rows={2}
                    />
                    <button
                      onClick={async () => {
                        if (!chatMessage.trim() || !success) return;
                        setChatSending(true);
                        try {
                          await fetch("/api/chat/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              username: success.chaosbird_username,
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

              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-center text-[10px] text-gray-400">
                  Powered by{" "}
                  <a href="https://chaosbird.app" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">
                    ChaosBird
                  </a>
                  {" "}&middot; Your details have been shared with Krishna
                </p>
              </div>
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
          <Link to="/" className="mb-6 inline-flex items-center gap-2">
            <span className="text-xl font-bold font-headline tracking-tight">
              g<span className="text-[#E63226]">ai</span>gentic.ai
            </span>
            <span className="text-sm font-bold font-headline text-gray-400 tracking-wide">agent hub</span>
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
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="john@acme.com"
              className={`input ${emailWarning ? "border-amber-400 focus:ring-amber-400" : ""}`}
            />
            {emailWarning ? (
              <p className="mt-1 text-xs text-amber-600">{emailWarning}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Business email required (e.g., you@yourcompany.com)
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!emailWarning}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? "Creating account..." : "Get Started Free"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>

          <p className="text-center text-xs text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="text-purple-600 hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

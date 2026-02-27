import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessageCircle, CheckCircle, Copy, Check, Send, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface ChatMsg {
  id: string;
  sender_name: string;
  receiver_name: string;
  content: string;
  created_at: string;
  seen_at: string | null;
}

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
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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

  // Fetch chat messages from Chaosbird
  const fetchMessages = useCallback(async () => {
    if (!success) return;
    try {
      const res = await fetch(`/api/chat/messages?username=${success.chaosbird_username}&limit=50`);
      if (res.ok) {
        const data = await res.json() as { messages: ChatMsg[] };
        setChatMessages(data.messages || []);
      }
    } catch {
      // silent — polling will retry
    }
  }, [success]);

  // Poll messages every 5s when signup is complete
  useEffect(() => {
    if (!success) return;
    setChatLoading(true);
    fetchMessages().finally(() => setChatLoading(false));
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [success, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !success) return;
    setChatSending(true);
    setChatError(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: success.chaosbird_username,
          message: chatMessage.trim(),
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      setChatMessage("");
      await fetchMessages();
    } catch {
      setChatError("Failed to send message");
    } finally {
      setChatSending(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="w-full max-w-4xl">
          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            {/* Left — Welcome + Details */}
            <div className="card-flat">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-green-light">
                  <CheckCircle className="h-5 w-5 text-signal-green" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-ink-950 font-headline">
                    Welcome to gaigentic Agent Hub
                  </h2>
                  <p className="text-sm text-ink-500">
                    Your 14-day free trial is active
                  </p>
                </div>
              </div>

              {/* Account details */}
              <div className="mt-5 space-y-2">
                <div className="rounded-lg bg-ink-50 px-4 py-3">
                  <h4 className="mb-0.5">Name</h4>
                  <p className="text-sm font-medium text-ink-900">{name}</p>
                </div>
                <div className="rounded-lg bg-ink-50 px-4 py-3">
                  <h4 className="mb-0.5">Email</h4>
                  <p className="text-sm font-medium text-ink-900">{email}</p>
                </div>
                <div className="rounded-lg bg-ink-50 px-4 py-3">
                  <h4 className="mb-0.5">Company</h4>
                  <p className="text-sm font-medium text-ink-900">
                    {companyName}
                  </p>
                </div>
              </div>

              {/* Chaosbird username */}
              <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
                <h4 className="mb-1">Your Messaging Username</h4>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-md bg-ink-950 px-3 py-1.5 font-mono text-sm text-white">
                    {success.chaosbird_username}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="btn-icon"
                    title="Copy username"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-signal-green" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-ink-500">
                  Use this at{" "}
                  <a
                    href="https://chaosbird.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cobalt underline"
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

            {/* Right — Chat with Krishna */}
            <div className="flex flex-col overflow-hidden rounded-lg border border-ink-200">
              <div className="flex items-center gap-2 bg-ink-950 px-4 py-3">
                <MessageCircle className="h-4 w-4 text-white" />
                <span className="text-sm font-semibold text-white">
                  Chat with Krishna
                </span>
              </div>

              {/* Messages area — scrollable */}
              <div className="flex-1 overflow-y-auto bg-ink-100 px-4 py-4" style={{ minHeight: 300, maxHeight: 420 }}>
                {chatLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  /* Empty state — show welcome greeting */
                  <>
                    <div className="mb-3 flex items-start gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">
                        K
                      </div>
                      <div className="rounded-xl rounded-bl-sm bg-white px-4 py-3 text-sm shadow-sm">
                        <p className="font-semibold text-ink-950">Welcome {name.split(" ")[0]}!</p>
                        <p className="mt-1 text-ink-700 leading-relaxed">Thanks for signing up. I'll review your details and get back to you shortly. Send me a message!</p>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Render real messages */
                  chatMessages.map((msg) => {
                    const isMe = msg.sender_name === success.chaosbird_username;
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
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 resize-none rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-300 focus:outline-none focus:ring-1 focus:ring-ink-300"
                    rows={1}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={chatSending || !chatMessage.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white transition-colors duration-150 hover:bg-ink-800 disabled:opacity-40"
                  >
                    {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-ink-200 bg-ink-50 px-3 py-1.5">
                <p className="text-center text-[10px] text-ink-500">
                  via <span className="font-semibold text-ink-700">{success.chaosbird_username}</span> on Chaosbird
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Start your free trial
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            No credit card. No obligations. 14-day free access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-flat space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
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
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
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
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="john@acme.com"
              className={`input ${emailWarning ? "border-signal-amber focus-visible:ring-signal-amber/20" : ""}`}
            />
            {emailWarning ? (
              <p className="mt-1 text-xs text-signal-amber">{emailWarning}</p>
            ) : (
              <p className="mt-1 text-xs text-ink-400">
                Business email required (e.g., you@yourcompany.com)
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-signal-red/20 bg-signal-red-light px-4 py-3 text-sm text-signal-red">
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

          <p className="text-center text-xs text-ink-500">
            Already have an account?{" "}
            <Link to="/login" className="text-cobalt hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

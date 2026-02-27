import { useEffect, useRef, useState, useCallback } from "react";
import { Calendar, MessageCircle, Send, X, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface ChatMessage {
  id: string;
  sender_name: string;
  receiver_name: string;
  content: string;
  created_at: string;
  seen_at: string | null;
}

interface Props {
  agentColor?: string;
  compact?: boolean;
}

/* ── Authenticated two-way chat with Krishna ── */
function KrishnaChat({ userName, chaosbirdUsername }: { userName: string; chaosbirdUsername: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?username=${chaosbirdUsername}&limit=50`);
      if (res.ok) {
        const data = (await res.json()) as { messages: ChatMessage[] };
        setMessages(data.messages || []);
      }
    } catch {
      /* polling will retry */
    }
  }, [chaosbirdUsername]);

  // Load + poll when open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchMessages().finally(() => setLoading(false));
    const iv = setInterval(fetchMessages, 5000);
    return () => clearInterval(iv);
  }, [open, fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: chaosbirdUsername, message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Send failed" }));
        throw new Error((data as { error?: string }).error || `Send failed (${res.status})`);
      }
      setMessage("");
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-white shadow-lg transition-colors duration-150 hover:bg-ink-800"
        title="Chat with Krishna"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-[360px] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg" style={{ maxHeight: "min(520px, calc(100vh - 100px))" }}>
      {/* Header */}
      <div className="flex items-center gap-2 bg-ink-950 px-4 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">K</div>
        <span className="text-sm font-medium text-white">Krishna</span>
        <span className="ml-auto text-[10px] text-white/50">@{chaosbirdUsername}</span>
        <button onClick={() => setOpen(false)} className="ml-2 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors duration-150">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-ink-100 px-4 py-4" style={{ minHeight: 260 }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-ink-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="mb-4 flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">K</div>
            <div className="rounded-xl rounded-bl-sm bg-white px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-ink-950">Hey {userName.split(" ")[0]}!</p>
              <p className="mt-1 text-ink-700 leading-relaxed">How can I help you? Ask me about agents, enterprise plans, or anything else.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_name === chaosbirdUsername;
            return isMe ? (
              <div key={msg.id} className="mb-3 flex justify-end">
                <div className="max-w-[85%]">
                  <div className="rounded-xl rounded-br-sm bg-ink-950 px-4 py-3 text-sm text-white shadow-sm whitespace-pre-wrap">{msg.content}</div>
                  <p className="mt-1 text-right text-[10px] text-ink-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ) : (
              <div key={msg.id} className="mb-3 flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-950 text-xs font-bold text-white">K</div>
                <div className="max-w-[85%]">
                  <div className="rounded-xl rounded-bl-sm bg-white px-4 py-3 text-sm text-ink-800 shadow-sm whitespace-pre-wrap">{msg.content}</div>
                  <p className="mt-1 text-[10px] text-ink-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            );
          })
        )}
        {error && (
          <div className="mb-3 rounded-lg border border-signal-red/20 bg-signal-red-light px-3 py-2 text-xs text-signal-red">{error}</div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="border-t border-ink-200 bg-white px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-lg border border-ink-200 bg-ink-25 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-300 focus:outline-none focus:ring-1 focus:ring-ink-300"
            rows={1}
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white transition-colors duration-150 hover:bg-ink-800 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50 px-3 py-1.5">
        <p className="text-center text-[10px] text-ink-500">
          via <span className="font-semibold text-ink-700">{chaosbirdUsername}</span> on Chaosbird
        </p>
      </div>
    </div>
  );
}

/* ── Fallback: generic Chaosbird embed for unauthenticated users ── */
const CHAOSBIRD_CODE = "3529a4556f2a4d70a38c042978c7c867";

function ChaosbirdEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const existingScript = document.querySelector('script[src="https://chaosbird.app/embed.js"]');
    if (existingScript) return;
    const script = document.createElement("script");
    script.src = "https://chaosbird.app/embed.js";
    script.setAttribute("data-code", CHAOSBIRD_CODE);
    script.setAttribute("data-theme", "dark");
    script.async = true;
    containerRef.current.appendChild(script);
    return () => { script.remove(); };
  }, []);

  return <div ref={containerRef} />;
}

/* ── Main export ── */
export default function ContactCTA({ compact = false }: Props) {
  const { auth } = useAuth();
  const isLoggedIn = auth.status === "authenticated" && auth.user?.chaosbird_username;

  // Authenticated: show floating Krishna chat (no inline CTA needed)
  if (isLoggedIn) {
    return (
      <>
        <KrishnaChat userName={auth.user!.name} chaosbirdUsername={auth.user!.chaosbird_username!} />
        {!compact && (
          <a
            href="https://calendly.com/krishnagai"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <Calendar className="h-4 w-4" />
            Book a Demo
          </a>
        )}
      </>
    );
  }

  // Unauthenticated: fallback to generic embed
  if (compact) {
    return (
      <div className="space-y-2">
        <ChaosbirdEmbed />
        <a
          href="https://calendly.com/krishnagai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition-colors duration-150 hover:border-ink-300 hover:bg-ink-50"
        >
          <Calendar className="h-3.5 w-3.5 text-cobalt" />
          Book a Demo
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-100 bg-white p-5">
      <h3 className="mb-1 text-sm font-semibold text-ink-900">Questions about this agent?</h3>
      <p className="mb-4 text-sm text-ink-500">Chat with Krishna directly or book a demo to discuss your use case.</p>
      <div className="mb-4"><ChaosbirdEmbed /></div>
      <a
        href="https://calendly.com/krishnagai"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary text-sm"
      >
        <Calendar className="h-4 w-4" />
        Book a Demo
      </a>
    </div>
  );
}

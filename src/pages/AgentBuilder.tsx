import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Wand2,
  Check,
  ChevronDown,
  ChevronRight,
  Wrench,
  Shield,
  Brain,
  Target,
  Globe,
  BarChart3,
  AlertTriangle,
  FileJson,
  Sparkles,
  Rocket,
  ArrowRight,
  Square,
  RotateCcw,
  Eye,
  FlaskConical,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import DemoBanner from "../components/DemoBanner";
import { getSessionToken } from "../services/api";

/* ══════════════════════════════════════════
   Types
   ══════════════════════════════════════════ */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SkillInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  required_tools: string[];
  reuse_count: number;
}

interface NewSkill {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  required_tools: string[];
  prompt_template: string;
  input_hints: string[];
  visual_outputs: string[];
}

interface QuickReply {
  label: string;
  options: string[];
  multi: boolean;
}

interface AgentDefinition {
  status: "gathering" | "building" | "refining" | "complete";
  progress: number;
  metadata: {
    name: string;
    slug: string;
    tagline: string;
    description: string;
    category: string;
    icon: string;
    color: string;
  };
  skills: string[]; // skill slugs from repository
  new_skills: NewSkill[]; // newly created skills
  system_prompt_sections: {
    agent_identity: string | null;
    agent_objective: string | null;
    domain_context: string | null;
    scoring_methodology: string | null;
    jurisdiction_knowledge: string | null;
    visual_output_rules: string | null;
    guardrails: string | null;
  };
  tools: string[];
  sample_input: Record<string, unknown> | null;
  capabilities: Array<{ icon: string; title: string; description: string }>;
  jurisdictions: string[];
  guardrails_config: { max_tokens: number; temperature: number };
  quick_replies: QuickReply[];
}

const EMPTY_AGENT: AgentDefinition = {
  status: "gathering",
  progress: 0,
  metadata: { name: "", slug: "", tagline: "", description: "", category: "", icon: "", color: "#3B82F6" },
  skills: [],
  new_skills: [],
  system_prompt_sections: {
    agent_identity: null,
    agent_objective: null,
    domain_context: null,
    scoring_methodology: null,
    jurisdiction_knowledge: null,
    visual_output_rules: null,
    guardrails: null,
  },
  tools: [],
  sample_input: null,
  capabilities: [],
  jurisdictions: [],
  guardrails_config: { max_tokens: 4096, temperature: 0.3 },
  quick_replies: [],
};

const AGENT_UPDATE_OPEN = "|||AGENT_UPDATE|||";
const AGENT_UPDATE_CLOSE = "|||END_AGENT_UPDATE|||";

const API_BASE = "/api";

/* ══════════════════════════════════════════
   SSE Parser (reused pattern)
   ══════════════════════════════════════════ */

function createSSEParser() {
  let buffer = "";
  return function parseChunk(chunk: string): Array<{ event: string; data: string }> {
    buffer += chunk;
    const events: Array<{ event: string; data: string }> = [];
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const message = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let eventType = "";
      let data = "";
      for (const line of message.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) data = line.slice(6);
      }
      if (data) events.push({ event: eventType || "message", data });
      boundary = buffer.indexOf("\n\n");
    }
    return events;
  };
}

/* ══════════════════════════════════════════
   Parse agent update from raw text
   ══════════════════════════════════════════ */

function extractAgentUpdate(rawText: string): { chatText: string; agent: AgentDefinition | null } {
  const openIdx = rawText.lastIndexOf(AGENT_UPDATE_OPEN);
  if (openIdx === -1) return { chatText: rawText, agent: null };

  const jsonStart = openIdx + AGENT_UPDATE_OPEN.length;
  const closeIdx = rawText.indexOf(AGENT_UPDATE_CLOSE, jsonStart);

  const textBefore = rawText.slice(0, openIdx).trim();
  const textAfter = closeIdx !== -1 ? rawText.slice(closeIdx + AGENT_UPDATE_CLOSE.length).trim() : "";
  const chatText = (textBefore + (textAfter ? "\n\n" + textAfter : "")).trim();

  if (closeIdx === -1) return { chatText, agent: null };

  const jsonStr = rawText.slice(jsonStart, closeIdx).trim();
  try {
    const parsed = JSON.parse(jsonStr);
    return { chatText, agent: { ...EMPTY_AGENT, ...parsed } };
  } catch {
    return { chatText, agent: null };
  }
}

/* ══════════════════════════════════════════
   Section Config
   ══════════════════════════════════════════ */

const SECTION_CONFIG: Record<string, { label: string; icon: typeof Brain; color: string; bg: string }> = {
  agent_identity: { label: "Identity", icon: User, color: "text-blue-600", bg: "bg-blue-50" },
  agent_objective: { label: "Objective", icon: Target, color: "text-purple-600", bg: "bg-purple-50" },
  domain_context: { label: "Domain Context", icon: Brain, color: "text-cyan-600", bg: "bg-cyan-50" },
  scoring_methodology: { label: "Scoring", icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
  jurisdiction_knowledge: { label: "Jurisdictions", icon: Globe, color: "text-emerald-600", bg: "bg-emerald-50" },
  visual_output_rules: { label: "Visual Output", icon: Eye, color: "text-indigo-600", bg: "bg-indigo-50" },
  guardrails: { label: "Guardrails", icon: Shield, color: "text-red-600", bg: "bg-red-50" },
};

const TOOL_LABELS: Record<string, string> = {
  rag_query: "Knowledge Base",
  calculate: "Calculator",
  data_validation: "Data Validation",
  document_analysis: "Document Analysis",
  regulatory_lookup: "Regulatory Lookup",
  credit_assessment: "Credit Assessment",
  collections_scoring: "Collections",
  escalate_to_agent: "Escalation",
  verify_us_entity: "Entity Verification",
  sanctions_screener: "Sanctions Screen",
  burner_email_detector: "Email Check",
  bin_iin_lookup: "BIN/IIN Lookup",
  ecfr_lookup: "eCFR Lookup",
  macroeconomic_indicator: "Macro Data",
  amortization_restructurer: "Amortization",
  rss_news_parser: "News Parser",
};

const STATUS_CONFIG = {
  gathering: { label: "Gathering Intent", color: "text-blue-600", bg: "bg-blue-500" },
  building: { label: "Building Agent", color: "text-cta", bg: "bg-cta" },
  refining: { label: "Refining", color: "text-purple-600", bg: "bg-purple-500" },
  complete: { label: "Ready to Create", color: "text-signal-green", bg: "bg-signal-green" },
};

const STARTER_PROMPTS = [
  "I need an agent that evaluates insurance claims for fraud patterns",
  "Build me an AML transaction monitoring agent for a neobank",
  "I want a tax compliance agent for Indian freelancers",
  "Create an invoice reconciliation agent for accounts payable",
];

/* ══════════════════════════════════════════
   Collapsible Section
   ══════════════════════════════════════════ */

function PromptSection({ sectionKey, content }: { sectionKey: string; content: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const config = SECTION_CONFIG[sectionKey];
  if (!config) return null;
  const { label, icon: Icon, color, bg } = config;
  const filled = !!content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border transition-all duration-200 ${filled ? "border-ink-200 bg-white" : "border-ink-100 bg-ink-25"}`}
    >
      <button
        onClick={() => filled && setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-ink-50/50 transition-colors rounded-lg"
        disabled={!filled}
      >
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${filled ? bg : "bg-ink-100"}`}>
          {filled ? (
            <Icon className={`h-3.5 w-3.5 ${color}`} />
          ) : (
            <div className="h-2 w-2 rounded-full bg-ink-300" />
          )}
        </div>
        <span className={`text-xs font-semibold flex-1 ${filled ? "text-ink-800" : "text-ink-400"}`}>
          {label}
        </span>
        {filled && (
          <Check className="h-3.5 w-3.5 text-signal-green" />
        )}
        {filled && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-ink-400" />
            : <ChevronRight className="h-3 w-3 text-ink-400" />
        )}
      </button>
      <AnimatePresence>
        {expanded && content && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="mx-3 mb-3 text-[11px] leading-relaxed text-ink-600 bg-ink-50 border border-ink-100 rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
              {content}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   Quick Replies — Clickable option chips
   ══════════════════════════════════════════ */

function QuickReplies({
  replies,
  selections,
  onToggle,
}: {
  replies: QuickReply[];
  selections: Record<string, string[]>;
  onToggle: (label: string, option: string, multi: boolean) => void;
}) {
  if (!replies || replies.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="ml-9 space-y-3 mt-2"
    >
      {replies.map((reply) => {
        const selected = selections[reply.label] || [];
        return (
          <div key={reply.label}>
            <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              {reply.label}
              {reply.multi && (
                <span className="font-normal normal-case text-ink-400">(select multiple)</span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {reply.options.map((opt) => {
                const isSelected = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => onToggle(reply.label, opt, reply.multi)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 border ${
                      isSelected
                        ? "bg-cta text-white border-cta shadow-sm scale-[1.02]"
                        : "bg-white text-ink-600 border-ink-200 hover:border-cta/40 hover:bg-cta-light/50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 inline mr-1 -mt-0.5" />}
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

/* ══════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════ */

export default function AgentBuilder() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [agentDef, setAgentDef] = useState<AgentDefinition>(EMPTY_AGENT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [chipSelections, setChipSelections] = useState<Record<string, string[]>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load available skills from repository
  useEffect(() => {
    fetch(`${API_BASE}/builder/skills`)
      .then((r) => r.json())
      .then((data: { skills?: SkillInfo[] }) => {
        if (data.skills) setAvailableSkills(data.skills);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Toggle a chip selection
  const handleChipToggle = useCallback((label: string, option: string, multi: boolean) => {
    setChipSelections((prev) => {
      const current = prev[label] || [];
      if (multi) {
        // Toggle: add or remove
        const updated = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [label]: updated };
      } else {
        // Single select: replace
        return { ...prev, [label]: current.includes(option) ? [] : [option] };
      }
    });
  }, []);

  // Compose message from chip selections + optional free text
  const composeMessage = useCallback(() => {
    const parts: string[] = [];
    const entries = Object.entries(chipSelections).filter(([, vals]) => vals.length > 0);
    for (const [label, vals] of entries) {
      parts.push(`${label}: ${vals.join(", ")}`);
    }
    const freeText = input.trim();
    if (freeText) parts.push(freeText);
    return parts.join("\n");
  }, [chipSelections, input]);

  const sendMessage = useCallback(async (userMessage: string) => {
    if (!userMessage.trim() || isStreaming) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage.trim() }];
    setMessages(newMessages);
    setInput("");
    setChipSelections({}); // Reset chip selections after sending
    setError(null);
    setIsStreaming(true);
    setStreamingText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getSessionToken();
      const res = await fetch(`${API_BASE}/builder/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setError((body as { error?: string }).error || "Request failed");
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      const sseParser = createSSEParser();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = sseParser(chunk);

        for (const evt of events) {
          if (evt.event === "token" || evt.event === "message" || evt.event === "") {
            try {
              const parsed = JSON.parse(evt.data);
              const text = parsed.text || parsed.content || "";
              fullText += text;
              setStreamingText(fullText);

              // Try to parse agent update from accumulated text
              const { agent } = extractAgentUpdate(fullText);
              if (agent) setAgentDef(agent);
            } catch {
              // Some providers send raw text
              if (typeof evt.data === "string" && !evt.data.startsWith("{")) {
                fullText += evt.data;
                setStreamingText(fullText);
              }
            }
          } else if (evt.event === "done") {
            // Stream complete
          } else if (evt.event === "error") {
            try {
              const { error: errMsg } = JSON.parse(evt.data);
              setError(errMsg);
            } catch {
              setError("Streaming error");
            }
          }
        }
      }

      // Final parse
      const { chatText, agent } = extractAgentUpdate(fullText);
      if (agent) setAgentDef(agent);

      setMessages((prev) => [...prev, { role: "assistant", content: chatText || fullText }]);
      setStreamingText("");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    }

    setIsStreaming(false);
  }, [messages, isStreaming]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    if (streamingText) {
      const { chatText, agent } = extractAgentUpdate(streamingText);
      if (agent) setAgentDef(agent);
      setMessages((prev) => [...prev, { role: "assistant", content: chatText || streamingText }]);
      setStreamingText("");
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setStreamingText("");
    setAgentDef(EMPTY_AGENT);
    setChipSelections({});
    setError(null);
    setIsStreaming(false);
  };

  const handleSave = async () => {
    if (agentDef.status !== "complete" && agentDef.progress < 70) {
      setError("Keep chatting to complete the agent definition first.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = getSessionToken();
      const res = await fetch(`${API_BASE}/builder/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          metadata: agentDef.metadata,
          skills: agentDef.skills,
          new_skills: agentDef.new_skills || [],
          system_prompt_sections: agentDef.system_prompt_sections,
          tools: agentDef.tools,
          sample_input: agentDef.sample_input,
          capabilities: agentDef.capabilities,
          jurisdictions: agentDef.jurisdictions,
          guardrails_config: agentDef.guardrails_config,
        }),
      });

      const data = await res.json() as { success?: boolean; agent?: { slug: string }; error?: string };

      if (!res.ok) {
        setError(data.error || "Failed to save agent");
        setSaving(false);
        return;
      }

      // Navigate to the new agent's page
      navigate(`/agents/${data.agent?.slug}`);
    } catch (err) {
      setError((err as Error).message);
    }

    setSaving(false);
  };

  const handleSend = () => {
    const composed = composeMessage();
    if (composed) {
      sendMessage(composed);
    } else if (input.trim()) {
      sendMessage(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasChipSelections = Object.values(chipSelections).some((v) => v.length > 0);
  const canSend = hasChipSelections || !!input.trim();
  const filledSections = Object.values(agentDef.system_prompt_sections).filter(Boolean).length;
  const totalSections = Object.keys(agentDef.system_prompt_sections).length;
  const statusConf = STATUS_CONFIG[agentDef.status] || STATUS_CONFIG.gathering;
  const hasStarted = messages.length > 0;
  const isComplete = agentDef.status === "complete" || agentDef.progress >= 90;
  const currentStreamChat = streamingText ? extractAgentUpdate(streamingText).chatText : "";
  const showQuickReplies = !isStreaming && agentDef.quick_replies.length > 0 && messages.length > 0 && messages[messages.length - 1]?.role === "assistant";

  return (
    <PageTransition>
      <DemoBanner />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-ink-950 font-headline">Agent Builder</h1>
            <span className="rounded-md bg-cta-light text-cta text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
              Intent Engine
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-500 ml-10">
            Describe your agent in plain English. I'll ask the right questions and build it live.
          </p>
        </div>
        {hasStarted && (
          <button onClick={handleReset} className="btn-secondary !text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </button>
        )}
      </div>

      {/* ── Split Screen ── */}
      <div className="flex gap-4 h-[calc(100vh-14rem)] min-h-[500px]">

        {/* ═══ LEFT: Chat Panel ═══ */}
        <div className="flex flex-col w-full lg:w-[48%] rounded-xl border border-ink-200 bg-white overflow-hidden">
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Welcome state */}
            {!hasStarted && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cta/10 to-amber-100 mb-4">
                  <Sparkles className="h-7 w-7 text-cta" />
                </div>
                <h2 className="text-lg font-semibold text-ink-900 font-headline">
                  What agent do you want to build?
                </h2>
                <p className="text-sm text-ink-500 mt-1.5 max-w-sm">
                  Describe it in plain English. I'll ask clarifying questions, select the right tools, and engineer the full agent — live.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                  {STARTER_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="text-left rounded-lg border border-ink-100 bg-ink-25 px-3 py-2.5 text-xs text-ink-600 hover:border-cta/30 hover:bg-cta-light/50 transition-all duration-200 group"
                    >
                      <ArrowRight className="h-3 w-3 text-ink-300 group-hover:text-cta inline mr-1.5 -mt-0.5 transition-colors" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-ink-900 text-white rounded-br-md"
                      : "bg-ink-50 text-ink-800 border border-ink-100 rounded-bl-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cobalt mt-0.5">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {isStreaming && currentStreamChat && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="max-w-[85%] rounded-xl rounded-bl-md bg-ink-50 text-ink-800 border border-ink-100 px-3.5 py-2.5 text-sm leading-relaxed">
                  <div className="whitespace-pre-wrap">{currentStreamChat}</div>
                  <span className="inline-block w-1.5 h-4 bg-cta animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isStreaming && !currentStreamChat && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="rounded-xl rounded-bl-md bg-ink-50 border border-ink-100 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {/* Quick Reply Chips */}
            {showQuickReplies && (
              <QuickReplies
                replies={agentDef.quick_replies}
                selections={chipSelections}
                onToggle={handleChipToggle}
              />
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-signal-red mt-0.5" />
                <p className="text-xs text-signal-red">{error}</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-ink-100 bg-white p-3">
            {/* Chip selection summary */}
            {hasChipSelections && (
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(chipSelections).map(([label, vals]) =>
                  vals.map((v) => (
                    <span
                      key={`${label}-${v}`}
                      className="inline-flex items-center gap-1 rounded-md bg-cta/10 text-cta text-[10px] font-medium px-2 py-0.5 border border-cta/15"
                    >
                      <Check className="h-2.5 w-2.5" />
                      {v}
                      <button
                        onClick={() => handleChipToggle(label, v, true)}
                        className="ml-0.5 hover:text-cta-hover"
                      >
                        x
                      </button>
                    </span>
                  ))
                )}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  hasChipSelections
                    ? "Add extra details (optional), or just hit send..."
                    : hasStarted
                      ? "Select options above, or type your answer..."
                      : "Describe the agent you want to build..."
                }
                className="flex-1 resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta/30 transition-colors"
                rows={hasChipSelections ? 1 : 2}
                disabled={isStreaming}
              />
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="self-end rounded-lg bg-ink-200 p-2.5 text-ink-600 hover:bg-ink-300 transition-colors"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="self-end rounded-lg bg-cta p-2.5 text-white hover:bg-cta-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Live Agent Preview ═══ */}
        <div className="hidden lg:flex flex-col w-[52%] rounded-xl border border-ink-200 bg-ink-25 overflow-hidden">
          {/* Preview Header */}
          <div className="bg-white border-b border-ink-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-ink-500" />
              <span className="text-sm font-semibold text-ink-800">Agent Blueprint</span>
            </div>
            {hasStarted && (
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConf.color}`}>
                  {statusConf.label}
                </span>
                <span className="text-[10px] font-mono tabular-nums text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded">
                  {filledSections}/{totalSections} sections
                </span>
              </div>
            )}
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!hasStarted ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 mb-4">
                  <Wrench className="h-8 w-8 text-ink-300" />
                </div>
                <p className="text-sm font-medium text-ink-400">Your agent blueprint will appear here</p>
                <p className="text-xs text-ink-300 mt-1 max-w-xs">
                  Start a conversation on the left and watch the agent come to life in real-time.
                </p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="rounded-lg bg-white border border-ink-100 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Build Progress</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: agentDef.metadata.color || "#3B82F6" }}>
                      {agentDef.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: agentDef.metadata.color || "#3B82F6" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${agentDef.progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Metadata Card */}
                {agentDef.metadata.name && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg bg-white border border-ink-200 p-4 shadow-premium-sm"
                  >
                    <div className="flex items-start gap-3">
                      {agentDef.metadata.icon && (
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                          style={{
                            backgroundColor: (agentDef.metadata.color || "#3B82F6") + "18",
                          }}
                        >
                          {agentDef.metadata.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-ink-900 font-headline">
                          {agentDef.metadata.name}
                        </h3>
                        {agentDef.metadata.tagline && (
                          <p className="text-xs text-ink-500 mt-0.5">{agentDef.metadata.tagline}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {agentDef.metadata.category && (
                            <span className="tag">{agentDef.metadata.category}</span>
                          )}
                          {agentDef.metadata.slug && (
                            <span className="text-[10px] font-mono text-ink-400">/{agentDef.metadata.slug}</span>
                          )}
                        </div>
                      </div>
                      {agentDef.metadata.color && (
                        <div
                          className="h-3 w-3 rounded-full ring-2 ring-white shadow-sm shrink-0"
                          style={{ backgroundColor: agentDef.metadata.color }}
                        />
                      )}
                    </div>
                    {agentDef.metadata.description && (
                      <p className="text-xs text-ink-600 mt-3 leading-relaxed border-t border-ink-50 pt-2.5">
                        {agentDef.metadata.description}
                      </p>
                    )}
                  </motion.div>
                )}

                {/* System Prompt Sections */}
                <div>
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2 px-0.5">
                    System Prompt Sections
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(agentDef.system_prompt_sections).map(([key, val]) => (
                      <PromptSection key={key} sectionKey={key} content={val} />
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div className="rounded-lg bg-white border border-ink-200 p-3 shadow-premium-sm">
                  <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-cta" />
                    Skills
                  </p>
                  {(agentDef.skills.length > 0 || (agentDef.new_skills && agentDef.new_skills.length > 0)) ? (
                    <div className="space-y-1.5">
                      {/* Existing skills from repository */}
                      {agentDef.skills.map((slug) => {
                        const info = availableSkills.find((s) => s.slug === slug);
                        return (
                          <motion.div
                            key={slug}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-1.5"
                          >
                            <Check className="h-3 w-3 text-signal-green shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold text-ink-800">{info?.name || slug}</span>
                              {info && (
                                <span className="ml-1.5 text-[9px] text-ink-400">
                                  {info.required_tools.length} tools · {info.reuse_count} reuses
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                              {info?.category || "custom"}
                            </span>
                          </motion.div>
                        );
                      })}
                      {/* Newly created skills */}
                      {agentDef.new_skills?.map((skill) => (
                        <motion.div
                          key={skill.slug}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 rounded-md bg-cta-light border border-cta/15 px-2.5 py-1.5"
                        >
                          <Sparkles className="h-3 w-3 text-cta shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-semibold text-ink-800">{skill.name}</span>
                            <span className="ml-1.5 text-[9px] text-ink-400">{skill.required_tools.length} tools</span>
                          </div>
                          <span className="text-[9px] font-medium text-cta bg-cta/10 px-1.5 py-0.5 rounded">new</span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-300 italic">Skills will be recommended as you describe your agent</p>
                  )}
                  {availableSkills.length > 0 && agentDef.skills.length === 0 && !agentDef.new_skills?.length && (
                    <p className="text-[10px] text-ink-400 mt-2">
                      {availableSkills.length} skills available in repository
                    </p>
                  )}
                </div>

                {/* Tools (auto-populated from skills) */}
                <div className="rounded-lg bg-white border border-ink-100 p-3">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Wrench className="h-3 w-3" />
                    Tools <span className="font-normal">(from skills)</span>
                  </p>
                  {agentDef.tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {agentDef.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 rounded-md bg-ink-50 text-ink-600 text-[10px] font-medium px-2 py-1 border border-ink-100"
                        >
                          {TOOL_LABELS[tool] || tool}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-300 italic">Auto-populated when skills are selected</p>
                  )}
                </div>

                {/* Jurisdictions */}
                {agentDef.jurisdictions.length > 0 && (
                  <div className="rounded-lg bg-white border border-ink-100 p-3">
                    <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />
                      Jurisdictions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {agentDef.jurisdictions.map((j) => (
                        <span key={j} className="tag">{j}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Input */}
                {agentDef.sample_input && (
                  <div className="rounded-lg bg-white border border-ink-100 p-3">
                    <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileJson className="h-3 w-3" />
                      Sample Input
                    </p>
                    <pre className="text-[11px] bg-ink-50 border border-ink-100 rounded-md p-2 overflow-x-auto font-mono text-ink-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(agentDef.sample_input, null, 2)}
                    </pre>
                  </div>
                )}

                {/* AI Configuration */}
                <div className="rounded-lg bg-white border border-ink-100 p-3">
                  <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Brain className="h-3 w-3" />
                    AI Configuration
                  </p>
                  {/* Temperature slider */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-ink-500">Temperature</span>
                      <span className="text-[11px] font-mono font-semibold text-ink-700">{agentDef.guardrails_config.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={agentDef.guardrails_config.temperature}
                      onChange={(e) =>
                        setAgentDef((prev) => ({
                          ...prev,
                          guardrails_config: { ...prev.guardrails_config, temperature: parseFloat(e.target.value) },
                        }))
                      }
                      className="w-full h-1 bg-ink-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cta [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-ink-300">Precise</span>
                      <span className="text-[9px] text-ink-300">Creative</span>
                    </div>
                  </div>
                  {/* Max tokens */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-ink-500">Max Tokens</span>
                      <span className="text-[11px] font-mono font-semibold text-ink-700">{agentDef.guardrails_config.max_tokens}</span>
                    </div>
                    <input
                      type="range"
                      min="1024"
                      max="8192"
                      step="1024"
                      value={agentDef.guardrails_config.max_tokens}
                      onChange={(e) =>
                        setAgentDef((prev) => ({
                          ...prev,
                          guardrails_config: { ...prev.guardrails_config, max_tokens: parseInt(e.target.value) },
                        }))
                      }
                      className="w-full h-1 bg-ink-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cobalt [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-ink-300">Short</span>
                      <span className="text-[9px] text-ink-300">Detailed</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview Footer — Action Buttons */}
          {hasStarted && (
            <div className="border-t border-ink-100 bg-white p-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-ink-400">
                {isComplete
                  ? "Agent definition is ready. Create it!"
                  : "Keep chatting to build your agent."
                }
              </div>
              <button
                onClick={handleSave}
                disabled={(!isComplete && agentDef.progress < 70) || saving || isStreaming}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isComplete
                    ? "bg-signal-green text-white hover:brightness-110 shadow-sm"
                    : "bg-ink-100 text-ink-400 cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {saving ? "Creating..." : "Create Agent"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

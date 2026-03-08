import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Key,
  Lock,
  X,
  Info,
  Zap,
  Crown,
  ExternalLink,
  Calendar,
  Download,
  MessageSquare,
  Clock,
  Layers,
  Activity,
} from "lucide-react";
import PageTransition from "../components/PageTransition";
import DemoBanner from "../components/DemoBanner";
import { getSessionToken } from "../services/api";
import { CALENDLY_URL } from "../config";

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

interface AuditEntry {
  id: number;
  timestamp: Date;
  type: "user_message" | "ai_response" | "skill_added" | "skill_created" | "prompt_filled" | "tool_activated" | "config_changed" | "phase_change" | "agent_named" | "jurisdiction_set" | "agent_complete";
  icon: string;
  title: string;
  detail: string;
  color: string;
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
// For SSE streaming, bypass the Pages Function proxy and call the Worker directly.
// The proxy buffers responses which breaks Server-Sent Events.
const STREAM_API_BASE = window.location.hostname === "localhost"
  ? "/api"
  : "https://gaigentic-hub-api.krishnagaigenticai.workers.dev";

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

/** Tool metadata — fetched from backend at startup, NOT hardcoded */
interface ToolMeta {
  name: string;
  description: string;
  category: string;
  stepType: string;
}

/** Fallback display name (only used if backend hasn't loaded yet) */
function toolDisplayName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
   Markdown stripping — clean LLM artifacts
   ══════════════════════════════════════════ */

function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")              // ## Heading → Heading
    .replace(/\*\*([^*]*)\*\*/g, "$1")         // **bold** → bold (greedy)
    .replace(/\*([^*]+)\*/g, "$1")             // *italic* → italic
    .replace(/`([^`]+)`/g, "$1")               // `code` → code
    .replace(/^[\s]*[-*+]\s+/gm, "  ")         // - list / * list / + list → indented
    .replace(/^---+$/gm, "")                   // --- horizontal rules
    .replace(/^-{3,}$/gm, "")
    .replace(/^\d+\.\s*\*\*/gm, "")            // 1. ** numbered bold starts
    .replace(/\n{3,}/g, "\n\n")                // collapse triple+ newlines
    .trim();
}

/* ══════════════════════════════════════════
   Auto-detect question lines → generate chips
   ══════════════════════════════════════════ */

const QUESTION_OPTION_MAP: Record<string, string[]> = {
  // Tax / Compliance
  "tax": ["GST", "Income Tax", "TDS", "Advance Tax", "ITR Filing", "Tax Audit", "International Tax"],
  "compliance": ["SOX", "GDPR", "AML/KYC", "RBI Guidelines", "SEC Rules", "PCI-DSS", "HIPAA"],
  "regulation": ["US Federal", "EU Directives", "India (SEBI/RBI)", "UK FCA", "Multi-jurisdiction"],
  // Users
  "user": ["Freelancers", "Small Business Owners", "Accountants/CAs", "CFOs/Finance Teams", "Compliance Officers", "Individual Taxpayers"],
  "audience": ["Freelancers", "Small Business Owners", "Accountants/CAs", "CFOs/Finance Teams", "Compliance Officers"],
  // Domain
  "area": ["Tax Filing", "Compliance Checks", "Document Verification", "Risk Scoring", "Reconciliation", "Reporting"],
  "focus": ["Tax Filing", "Compliance Audit", "Document Verification", "Risk Assessment", "Reconciliation", "Reporting"],
  "domain": ["Finance", "Banking", "Insurance", "Healthcare", "Legal", "Accounting", "E-commerce"],
  "industry": ["Fintech", "Banking", "Insurance", "Healthcare", "Legal", "Accounting", "E-commerce"],
  // Input
  "input": ["JSON Data", "PDF Documents", "Images/Receipts", "CSV/Excel", "Free-text Queries", "API Webhooks"],
  "data": ["JSON Data", "PDF Documents", "Images/Receipts", "CSV/Excel Files", "Bank Statements", "Invoices"],
  "source": ["JSON API", "PDF Documents", "Bank Statements", "CSV/Excel", "Invoices", "Government Portals"],
  "format": ["JSON", "PDF", "CSV/Excel", "Images", "Free Text", "XML"],
  // Output
  "output": ["Risk Scores", "Compliance Reports", "Recommendations", "Alerts", "Dashboards", "Audit Trail"],
  "result": ["Risk Scores", "Reports", "Recommendations", "Alerts", "Visual Dashboards"],
  "produce": ["Risk Scores", "Reports", "Recommendations", "Alerts", "Dashboards"],
  // Jurisdiction
  "jurisdiction": ["India", "US", "EU", "UK", "Global", "APAC"],
  "country": ["India", "US", "EU", "UK", "Singapore", "Global"],
  "region": ["India", "US", "EU", "UK", "Global", "APAC"],
  // Priority
  "priority": ["Critical — must have", "Important — should have", "Nice to have"],
  "important": ["Critical", "Important", "Nice to have"],
  // Sophistication / Level
  "sophistication": ["Basic — single income", "Moderate — multiple sources", "Complex — business + investments", "Enterprise — multi-entity"],
  "level": ["Basic", "Intermediate", "Advanced", "Enterprise"],
  "complexity": ["Simple", "Moderate", "Complex", "Enterprise-grade"],
  // Explainability
  "explain": ["Every decision justified", "Key decisions explained", "Summary only"],
  "audit": ["Full audit trail", "Key decisions only", "Summary report"],
  // Scale
  "volume": ["< 100/month", "100-1000/month", "1000-10000/month", "10000+/month"],
  "scale": ["Small (< 100)", "Medium (100-1K)", "Large (1K-10K)", "Enterprise (10K+)"],
};

function autoDetectQuickReplies(messageText: string): QuickReply[] {
  const cleaned = cleanMarkdown(messageText);
  const lines = cleaned.split("\n");
  const replies: QuickReply[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Must end with ? and be a short question line (not a sentence in a paragraph)
    if (!trimmed.endsWith("?") || trimmed.length > 80 || trimmed.length < 8) continue;
    // Skip if it's a long conversational question (contains too many words)
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > 10) continue;

    const label = trimmed.replace(/\?$/, "").trim();
    const labelLower = label.toLowerCase();

    // Find best matching options
    let bestOptions: string[] | null = null;
    let bestScore = 0;

    for (const [keyword, options] of Object.entries(QUESTION_OPTION_MAP)) {
      if (labelLower.includes(keyword)) {
        const score = keyword.length;
        if (score > bestScore) {
          bestScore = score;
          bestOptions = options;
        }
      }
    }

    if (bestOptions) {
      replies.push({ label, options: bestOptions, multi: true });
    }
  }

  return replies;
}

/* ══════════════════════════════════════════
   Message with inline chips
   ══════════════════════════════════════════ */

function MessageWithInlineChips({
  content,
  replies,
  selections,
  onToggle,
}: {
  content: string;
  replies: QuickReply[];
  selections: Record<string, string[]>;
  onToggle: (label: string, option: string, multi: boolean) => void;
}) {
  const cleaned = cleanMarkdown(content);

  if (!replies || replies.length === 0) {
    return <div className="whitespace-pre-wrap">{cleaned}</div>;
  }

  // Build a map of label (lowercased) → QuickReply
  const replyMap = new Map<string, QuickReply>();
  for (const r of replies) {
    replyMap.set(r.label.toLowerCase(), r);
  }

  // Split text into lines, find lines matching reply labels, inject chips
  const lines = cleaned.split("\n");
  const elements: React.ReactNode[] = [];
  const usedLabels = new Set<string>();
  let textBuffer: string[] = [];

  const flushText = (idx: number) => {
    const text = textBuffer.join("\n").trim();
    if (text) {
      elements.push(
        <span key={`t-${idx}`} className="whitespace-pre-wrap block">{text}</span>,
      );
    }
    textBuffer = [];
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineClean = line.replace(/[?:]/g, "").trim().toLowerCase();

    // Check if this line matches a reply label
    let foundReply: QuickReply | null = null;
    for (const [labelLower, reply] of replyMap) {
      if (
        !usedLabels.has(labelLower) &&
        (lineClean === labelLower ||
          lineClean.includes(labelLower) ||
          labelLower.includes(lineClean)) &&
        lineClean.length > 2
      ) {
        foundReply = reply;
        usedLabels.add(labelLower);
        break;
      }
    }

    if (foundReply) {
      flushText(li);
      const selected = selections[foundReply.label] || [];

      elements.push(
        <div key={`c-${li}`} className="my-2">
          <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {foundReply.label}
            {foundReply.multi && (
              <span className="font-normal normal-case text-ink-400">(select multiple)</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {foundReply.options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => onToggle(foundReply!.label, opt, foundReply!.multi)}
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
        </div>,
      );
    } else {
      textBuffer.push(line);
    }
  }

  flushText(lines.length);

  // Render any unmatched replies at the bottom
  for (const reply of replies) {
    if (!usedLabels.has(reply.label.toLowerCase())) {
      const selected = selections[reply.label] || [];
      elements.push(
        <div key={`u-${reply.label}`} className="my-2">
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
        </div>,
      );
    }
  }

  return <div>{elements}</div>;
}

/* ══════════════════════════════════════════
   Build Pipeline — animated stage indicator
   ══════════════════════════════════════════ */

const BUILD_STAGES = [
  { key: "intent", label: "Intent", icon: Target, threshold: 15 },
  { key: "skills", label: "Skills", icon: Sparkles, threshold: 35 },
  { key: "prompts", label: "Prompts", icon: Brain, threshold: 55 },
  { key: "tools", label: "Tools", icon: Wrench, threshold: 70 },
  { key: "guardrails", label: "Guards", icon: Shield, threshold: 85 },
  { key: "deploy", label: "Ready", icon: Rocket, threshold: 95 },
];

function BuildPipeline({
  progress,
  agentDef,
  availableSkills,
  availableTools,
}: {
  progress: number;
  agentDef: AgentDefinition;
  availableSkills: SkillInfo[];
  availableTools: ToolMeta[];
}) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const getStageContent = (key: string): { title: string; items: Array<{ label: string; value: string }> } | null => {
    switch (key) {
      case "intent": {
        const items: Array<{ label: string; value: string }> = [];
        if (agentDef.metadata.name) items.push({ label: "Agent", value: agentDef.metadata.name });
        if (agentDef.metadata.category) items.push({ label: "Category", value: agentDef.metadata.category });
        if (agentDef.jurisdictions.length > 0) items.push({ label: "Jurisdictions", value: agentDef.jurisdictions.join(", ") });
        if (agentDef.metadata.tagline) items.push({ label: "Purpose", value: agentDef.metadata.tagline });
        return items.length > 0 ? { title: "Intent Discovery", items } : null;
      }
      case "skills": {
        const items: Array<{ label: string; value: string }> = [];
        for (const slug of agentDef.skills) {
          const info = availableSkills.find((s) => s.slug === slug);
          items.push({ label: info?.category || "skill", value: info?.name || slug });
        }
        for (const ns of agentDef.new_skills || []) {
          items.push({ label: "new · " + ns.category, value: ns.name });
        }
        return items.length > 0 ? { title: "Selected Skills", items } : null;
      }
      case "prompts": {
        const items: Array<{ label: string; value: string }> = [];
        for (const [k, v] of Object.entries(agentDef.system_prompt_sections)) {
          if (v) {
            const cfg = SECTION_CONFIG[k];
            items.push({ label: cfg?.label || k, value: v.slice(0, 120) + (v.length > 120 ? "..." : "") });
          }
        }
        return items.length > 0 ? { title: "System Prompt", items } : null;
      }
      case "tools": {
        const items = agentDef.tools.map((t) => {
          const meta = availableTools.find((m) => m.name === t);
          return {
            label: meta ? toolDisplayName(meta.name) : toolDisplayName(t),
            value: meta?.description || meta?.category || t,
          };
        });
        return items.length > 0 ? { title: "Active Tools", items } : null;
      }
      case "guardrails": {
        const items: Array<{ label: string; value: string }> = [];
        if (agentDef.system_prompt_sections.guardrails) {
          items.push({ label: "Guardrails", value: agentDef.system_prompt_sections.guardrails.slice(0, 150) + "..." });
        }
        items.push({ label: "Temperature", value: String(agentDef.guardrails_config.temperature) });
        items.push({ label: "Max Tokens", value: String(agentDef.guardrails_config.max_tokens) });
        return { title: "Safety & Guards", items };
      }
      case "deploy": {
        const items: Array<{ label: string; value: string }> = [];
        const filled = Object.values(agentDef.system_prompt_sections).filter(Boolean).length;
        const total = Object.keys(agentDef.system_prompt_sections).length;
        items.push({ label: "Status", value: agentDef.status });
        items.push({ label: "Completeness", value: `${filled}/${total} sections` });
        items.push({ label: "Skills", value: `${agentDef.skills.length + (agentDef.new_skills?.length || 0)} equipped` });
        items.push({ label: "Tools", value: `${agentDef.tools.length} active` });
        return { title: "Deployment Summary", items };
      }
      default:
        return null;
    }
  };

  return (
    <div className="rounded-xl bg-white border border-ink-100 p-4 shadow-premium-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider">Build Pipeline</span>
        <span className="text-xs font-bold tabular-nums text-cta">{progress}%</span>
      </div>
      <div className="flex items-center gap-0">
        {BUILD_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isComplete = progress >= stage.threshold;
          const isActive = !isComplete && (i === 0 || progress >= BUILD_STAGES[i - 1].threshold);
          const hasContent = isComplete || isActive;
          const isExpanded = expandedStage === stage.key;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              {/* Stage node */}
              <div
                className={`flex flex-col items-center gap-1.5 relative ${hasContent ? "cursor-pointer" : ""}`}
                onClick={() => hasContent && setExpandedStage(isExpanded ? null : stage.key)}
              >
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{
                    scale: isActive ? [1, 1.15, 1] : 1,
                    boxShadow: isActive
                      ? "0 0 12px rgba(255,122,0,0.4)"
                      : isExpanded
                        ? "0 0 8px rgba(255,122,0,0.25)"
                        : "none",
                  }}
                  transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isComplete
                      ? isExpanded
                        ? "bg-signal-green border-signal-green ring-2 ring-signal-green/20"
                        : "bg-signal-green border-signal-green"
                      : isActive
                        ? "bg-cta border-cta"
                        : "bg-ink-50 border-ink-200"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-ink-300"}`} />
                  )}
                </motion.div>
                <span
                  className={`text-[9px] font-semibold tracking-wide transition-colors duration-300 ${
                    isExpanded ? "text-cta" : isComplete ? "text-signal-green" : isActive ? "text-cta" : "text-ink-300"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {/* Connector line */}
              {i < BUILD_STAGES.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 rounded-full bg-ink-100 overflow-hidden relative -mt-5">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-signal-green"
                    initial={{ width: "0%" }}
                    animate={{
                      width: isComplete ? "100%" : isActive ? "50%" : "0%",
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Slide-down content panel */}
      <AnimatePresence mode="wait">
        {expandedStage && (() => {
          const content = getStageContent(expandedStage);
          if (!content) return null;
          const stageInfo = BUILD_STAGES.find((s) => s.key === expandedStage);
          const StageIcon = stageInfo?.icon || Target;

          return (
            <motion.div
              key={expandedStage}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-ink-100">
                <div className="flex items-center gap-2 mb-2">
                  <StageIcon className="h-3.5 w-3.5 text-cta" />
                  <span className="text-[10px] font-bold text-ink-700 uppercase tracking-wider">{content.title}</span>
                </div>
                <div className="grid gap-1.5">
                  {content.items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="flex items-start gap-2 rounded-md bg-ink-25 border border-ink-100/60 px-2.5 py-1.5"
                    >
                      <span className="text-[9px] font-semibold text-ink-400 uppercase tracking-wider shrink-0 mt-0.5 min-w-[60px]">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-ink-700 leading-relaxed">{item.value}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════
   Confetti — celebration on completion
   ══════════════════════════════════════════ */

const CONFETTI_COLORS = ["#FF7A00", "#0052CC", "#22C55E", "#8B5CF6", "#F43F5E", "#EAB308", "#06B6D4"];

function Confetti({ show }: { show: boolean }) {
  if (!show) return null;

  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 720,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1, rotate: 0 }}
          animate={{ y: "110%", opacity: 0, rotate: p.rotation }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   Audit Whiteboard — real-time build log
   ══════════════════════════════════════════ */

const AUDIT_COLORS: Record<string, string> = {
  user_message: "text-cobalt",
  ai_response: "text-cta",
  skill_added: "text-emerald-600",
  skill_created: "text-purple-600",
  prompt_filled: "text-cyan-600",
  tool_activated: "text-amber-600",
  config_changed: "text-indigo-600",
  phase_change: "text-blue-600",
  agent_named: "text-pink-600",
  jurisdiction_set: "text-emerald-600",
  agent_complete: "text-signal-green",
};

const AUDIT_ICONS: Record<string, typeof MessageSquare> = {
  user_message: MessageSquare,
  ai_response: Bot,
  skill_added: Sparkles,
  skill_created: Zap,
  prompt_filled: Brain,
  tool_activated: Wrench,
  config_changed: BarChart3,
  phase_change: Layers,
  agent_named: Target,
  jurisdiction_set: Globe,
  agent_complete: Rocket,
};

const AUDIT_BG: Record<string, string> = {
  user_message: "bg-cobalt/8",
  ai_response: "bg-cta/8",
  skill_added: "bg-emerald-500/8",
  skill_created: "bg-purple-500/8",
  prompt_filled: "bg-cyan-500/8",
  tool_activated: "bg-amber-500/8",
  config_changed: "bg-indigo-500/8",
  phase_change: "bg-blue-500/8",
  agent_named: "bg-pink-500/8",
  jurisdiction_set: "bg-emerald-500/8",
  agent_complete: "bg-signal-green/8",
};

function AuditWhiteboard({
  entries,
  agentDef,
  onDownload,
}: {
  entries: AuditEntry[];
  agentDef: AgentDefinition;
  onDownload: (format: "json" | "csv") => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  const timeStr = (d: Date) => {
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    const s = d.getSeconds().toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-ink-100 px-3 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-ink-800 to-ink-600">
            <Activity className="h-3 w-3 text-white" />
          </div>
          <span className="text-xs font-semibold text-ink-800">Build Log</span>
          {entries.length > 0 && (
            <span className="text-[9px] font-mono bg-ink-100 text-ink-500 px-1.5 py-0.5 rounded">
              {entries.length}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setDownloadOpen(!downloadOpen)}
              className="flex items-center gap-1 text-[10px] font-semibold text-ink-500 hover:text-cta transition-colors rounded-md px-2 py-1 hover:bg-ink-50"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
            <AnimatePresence>
              {downloadOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 z-10 bg-white rounded-lg border border-ink-200 shadow-lg overflow-hidden"
                >
                  <button
                    onClick={() => { onDownload("json"); setDownloadOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-[11px] text-ink-700 hover:bg-ink-50 w-full text-left"
                  >
                    <FileJson className="h-3 w-3 text-cta" />
                    Download JSON
                  </button>
                  <button
                    onClick={() => { onDownload("csv"); setDownloadOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-[11px] text-ink-700 hover:bg-ink-50 w-full text-left border-t border-ink-100"
                  >
                    <BarChart3 className="h-3 w-3 text-cobalt" />
                    Download CSV
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <motion.div
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 border border-ink-100 mb-3"
            >
              <Clock className="h-5 w-5 text-ink-300" />
            </motion.div>
            <p className="text-xs font-semibold text-ink-400">Audit trail starts here</p>
            <p className="text-[10px] text-ink-300 mt-1 max-w-[180px]">
              Every action, decision, and configuration will be logged in real-time
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-ink-200 via-ink-100 to-transparent" />

            <div className="space-y-1">
              {entries.map((entry, i) => {
                const IconComp = AUDIT_ICONS[entry.type] || Activity;
                const color = AUDIT_COLORS[entry.type] || "text-ink-500";
                const bg = AUDIT_BG[entry.type] || "bg-ink-50";

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -8, y: 4 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.25, delay: i === entries.length - 1 ? 0.1 : 0 }}
                    className="relative flex gap-2 group"
                  >
                    {/* Timeline dot */}
                    <div className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${bg} ring-2 ring-white`}>
                      <IconComp className={`h-2.5 w-2.5 ${color}`} />
                    </div>
                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 pb-2 cursor-pointer"
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[10px] font-semibold ${color}`}>{entry.title}</span>
                        <span className="text-[8px] font-mono text-ink-300 shrink-0">{timeStr(entry.timestamp)}</span>
                      </div>
                      {expandedEntry === entry.id ? (
                        <p className="text-[10px] text-ink-600 leading-relaxed mt-0.5 break-words whitespace-pre-wrap bg-ink-50 rounded px-1.5 py-1 border border-ink-100">
                          {entry.detail}
                        </p>
                      ) : (
                        <p className="text-[10px] text-ink-500 leading-relaxed mt-0.5 break-words truncate">
                          {entry.detail}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {entries.length > 0 && (
        <div className="border-t border-ink-100 bg-white/80 backdrop-blur-sm px-3 py-2 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[9px] text-ink-400 uppercase tracking-wider">Steps</p>
              <p className="text-sm font-bold text-ink-800 tabular-nums">{entries.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-ink-400 uppercase tracking-wider">Skills</p>
              <p className="text-sm font-bold text-emerald-600 tabular-nums">
                {agentDef.skills.length + (agentDef.new_skills?.length || 0)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-ink-400 uppercase tracking-wider">Tools</p>
              <p className="text-sm font-bold text-amber-600 tabular-nums">{agentDef.tools.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
   AI Provider Banner
   ══════════════════════════════════════════ */

const PROVIDERS = [
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { value: "zai", label: "z.ai (GLM)", placeholder: "your-zai-key..." },
];

const SESSION_KEY_PROVIDER = "builder_ai_provider";
const SESSION_KEY_APIKEY = "builder_ai_key";

function AIProviderBanner({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  onClear,
}: {
  provider: string;
  apiKey: string;
  onProviderChange: (p: string) => void;
  onApiKeyChange: (k: string) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(!apiKey);
  const [showKey, setShowKey] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  // Close provider dropdown on outside click
  useEffect(() => {
    if (!providerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setProviderOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [providerOpen]);
  const hasKey = !!apiKey.trim();
  const selectedProvider = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];

  return (
    <div className={`rounded-xl border transition-all duration-300 ${
      hasKey
        ? "border-signal-green/30 bg-signal-green/5"
        : "border-amber-300/60 bg-amber-50/60"
    }`}>
      {/* Collapsed / Summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          hasKey ? "bg-signal-green/15" : "bg-amber-100"
        }`}>
          {hasKey ? (
            <Lock className="h-3.5 w-3.5 text-signal-green" />
          ) : (
            <Key className="h-3.5 w-3.5 text-amber-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {hasKey ? (
            <p className="text-xs font-semibold text-signal-green">
              Using your {selectedProvider.label} key
              <span className="ml-1.5 font-normal text-ink-400">· Stored in session only</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-amber-700">
              Bring your own AI key
              <span className="ml-1.5 font-normal text-amber-600/80">for best results & privacy</span>
            </p>
          )}
        </div>
        {hasKey && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-ink-400 hover:text-signal-red transition-colors p-1 rounded-md hover:bg-signal-red/10"
            title="Remove API key"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded config panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              <div className="flex gap-2">
                {/* Provider selector — custom dropdown */}
                <div className="relative" ref={providerRef}>
                  <button
                    type="button"
                    onClick={() => setProviderOpen(!providerOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs font-medium text-ink-700 hover:border-ink-300 hover:bg-ink-50 focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta/30 transition-colors min-w-[110px]"
                  >
                    <span className="flex-1 text-left">{selectedProvider.label}</span>
                    <ChevronDown className={`h-3 w-3 text-ink-400 transition-transform duration-150 ${providerOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {providerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-ink-200 bg-white shadow-lg overflow-hidden"
                      >
                        {PROVIDERS.map((p) => (
                          <button
                            key={p.value}
                            onClick={() => { onProviderChange(p.value); setProviderOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                              provider === p.value
                                ? "bg-cta/8 text-cta font-semibold"
                                : "text-ink-700 hover:bg-ink-50"
                            }`}
                          >
                            {provider === p.value && (
                              <Check className="h-3 w-3 shrink-0" />
                            )}
                            <span className={provider === p.value ? "" : "ml-5"}>{p.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* API key input */}
                <div className="flex-1 relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    placeholder={selectedProvider.placeholder}
                    className="w-full rounded-lg border border-ink-200 bg-white pl-3 pr-8 py-2 text-xs text-ink-700 placeholder:text-ink-300 focus:border-cta focus:outline-none focus:ring-1 focus:ring-cta/30 font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-500 transition-colors"
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Security info */}
              <div className="flex items-start gap-2 rounded-lg bg-white/60 border border-ink-100 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-cobalt shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-[10px] text-ink-500 leading-relaxed">
                    <span className="font-semibold text-ink-700">Your key is secure.</span>
                    {" "}Stored in your browser's session storage only — never saved to our database.
                  </p>
                  <p className="text-[10px] text-ink-400 leading-relaxed">
                    Automatically destroyed when you close this tab or browser. Used only for this builder session.
                  </p>
                </div>
              </div>

              {!hasKey && (
                <p className="text-[10px] text-amber-600/80 flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Without your own key, the builder will use our shared AI — which may be slower or rate-limited.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  const [availableTools, setAvailableTools] = useState<ToolMeta[]>([]);
  const [chipSelections, setChipSelections] = useState<Record<string, string[]>>({});
  const [userProvider, setUserProvider] = useState(() => sessionStorage.getItem(SESSION_KEY_PROVIDER) || "openai");
  const [userApiKey, setUserApiKey] = useState(() => sessionStorage.getItem(SESSION_KEY_APIKEY) || "");
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiShownRef = useRef(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const auditIdRef = useRef(0);
  const prevAgentDefRef = useRef<AgentDefinition>(EMPTY_AGENT);

  const addAudit = useCallback((type: AuditEntry["type"], title: string, detail: string) => {
    auditIdRef.current += 1;
    const entry: AuditEntry = {
      id: auditIdRef.current,
      timestamp: new Date(),
      type,
      icon: "",
      title,
      detail,
      color: AUDIT_COLORS[type] || "text-ink-500",
    };
    setAuditLog((prev) => [...prev, entry]);
  }, []);

  // Dynamic lookup helpers — always use fetched data, never hardcoded
  const getToolInfo = useCallback((name: string) => {
    const tool = availableTools.find((t) => t.name === name);
    return {
      label: tool ? toolDisplayName(tool.name) : toolDisplayName(name),
      description: tool?.description || "",
      category: tool?.category || "",
    };
  }, [availableTools]);

  const getSkillInfo = useCallback((slug: string) => {
    const skill = availableSkills.find((s) => s.slug === slug);
    return {
      name: skill?.name || slug,
      description: skill?.description || "",
      category: skill?.category || "",
      toolCount: skill?.required_tools?.length || 0,
    };
  }, [availableSkills]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync provider/key to sessionStorage
  useEffect(() => {
    if (userProvider) sessionStorage.setItem(SESSION_KEY_PROVIDER, userProvider);
    if (userApiKey) sessionStorage.setItem(SESSION_KEY_APIKEY, userApiKey);
    else sessionStorage.removeItem(SESSION_KEY_APIKEY);
  }, [userProvider, userApiKey]);

  const handleClearKey = useCallback(() => {
    setUserApiKey("");
    sessionStorage.removeItem(SESSION_KEY_APIKEY);
  }, []);

  // Confetti trigger on completion
  useEffect(() => {
    if ((agentDef.status === "complete" || agentDef.progress >= 95) && !confettiShownRef.current) {
      confettiShownRef.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [agentDef.status, agentDef.progress]);

  // Audit trail — diff agentDef changes
  useEffect(() => {
    const prev = prevAgentDefRef.current;
    const curr = agentDef;

    // Phase change
    if (curr.status !== prev.status && curr.status !== "gathering") {
      const labels: Record<string, string> = { building: "Building phase started", refining: "Refinement phase", complete: "Agent complete!" };
      addAudit("phase_change", labels[curr.status] || curr.status, `Progress: ${curr.progress}%`);
    }

    // Agent named
    if (curr.metadata.name && curr.metadata.name !== prev.metadata.name) {
      addAudit("agent_named", "Agent named", `"${curr.metadata.name}" — ${curr.metadata.tagline || curr.metadata.category || ""}`);
    }

    // Skills added
    for (const slug of curr.skills) {
      if (!prev.skills.includes(slug)) {
        const info = getSkillInfo(slug);
        addAudit("skill_added", info.name, info.description || `${info.category} skill — ${info.toolCount} tools`);
      }
    }

    // New skills created
    for (const ns of curr.new_skills || []) {
      if (!(prev.new_skills || []).find((p) => p.slug === ns.slug)) {
        addAudit("skill_created", `New: ${ns.name}`, ns.description || `${ns.category} — custom skill created for this agent`);
      }
    }

    // Prompt sections filled
    for (const [key, val] of Object.entries(curr.system_prompt_sections)) {
      const prevVal = prev.system_prompt_sections[key as keyof typeof prev.system_prompt_sections];
      if (val && !prevVal) {
        const cfg = SECTION_CONFIG[key];
        addAudit("prompt_filled", "Prompt section ready", cfg?.label || key);
      }
    }

    // Tools activated
    for (const tool of curr.tools) {
      if (!prev.tools.includes(tool)) {
        const info = getToolInfo(tool);
        addAudit("tool_activated", info.label, info.description || `${info.category} tool`);
      }
    }

    // Jurisdictions
    for (const j of curr.jurisdictions) {
      if (!prev.jurisdictions.includes(j)) {
        addAudit("jurisdiction_set", "Jurisdiction added", j);
      }
    }

    // Completion
    if ((curr.status === "complete" || curr.progress >= 95) && prev.status !== "complete" && prev.progress < 95) {
      addAudit("agent_complete", "Agent ready!", `${curr.metadata.name} is ready for deployment`);
    }

    prevAgentDefRef.current = curr;
  }, [agentDef, addAudit, getToolInfo, getSkillInfo]);

  // Load available skills and tools from backend
  useEffect(() => {
    fetch(`${API_BASE}/builder/skills`)
      .then((r) => r.json())
      .then((data: { skills?: SkillInfo[] }) => {
        if (data.skills) setAvailableSkills(data.skills);
      })
      .catch(() => {});
    fetch(`${API_BASE}/builder/tools`)
      .then((r) => r.json())
      .then((data: { tools?: ToolMeta[] }) => {
        if (data.tools) setAvailableTools(data.tools);
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

    addAudit("user_message", "User message", userMessage.trim().slice(0, 100) + (userMessage.length > 100 ? "..." : ""));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const token = getSessionToken();
      const res = await fetch(`${STREAM_API_BASE}/builder/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          ...(userApiKey.trim() ? { provider: userProvider, user_api_key: userApiKey.trim() } : {}),
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

      const displayText = chatText || fullText;

      // If we got nothing back at all, show an error
      if (!displayText.trim()) {
        setError("No response received. The AI provider may be unavailable — try again or switch providers.");
        setIsStreaming(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: displayText }]);
      setStreamingText("");
      addAudit("ai_response", "AI responded", displayText.slice(0, 80) + "...");

      // Auto-retry: if LLM responded without AGENT_UPDATE block past the first exchange,
      // use the dedicated /extract endpoint with a condensed prompt to get the JSON
      if (!agent && newMessages.length >= 2 && !fullText.includes(AGENT_UPDATE_OPEN)) {
        setIsStreaming(true);
        setStreamingText("");
        addAudit("system", "Auto-extracting", "LLM didn't output JSON block — retrying with extraction endpoint");
        try {
          const token = getSessionToken();
          const extractRes = await fetch(`${STREAM_API_BASE}/builder/extract`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({
              messages: [...newMessages, { role: "assistant", content: displayText }].map((m) => ({ role: m.role, content: m.content })),
              ...(userApiKey.trim() ? { provider: userProvider, user_api_key: userApiKey.trim() } : {}),
            }),
            signal: abortRef.current?.signal,
          });

          if (extractRes.ok && extractRes.body) {
            const retryReader = extractRes.body.getReader();
            const retryDecoder = new TextDecoder();
            const retrySseParser = createSSEParser();
            let retryFull = "";

            while (true) {
              const { done: rDone, value: rVal } = await retryReader.read();
              if (rDone) break;
              const rChunk = retryDecoder.decode(rVal, { stream: true });
              const rEvents = retrySseParser(rChunk);
              for (const evt of rEvents) {
                if (evt.event === "token" || evt.event === "message" || evt.event === "") {
                  try {
                    const parsed = JSON.parse(evt.data);
                    retryFull += parsed.text || parsed.content || "";
                    setStreamingText(retryFull);
                    const { agent: rAgent } = extractAgentUpdate(retryFull);
                    if (rAgent) setAgentDef(rAgent);
                  } catch {
                    if (typeof evt.data === "string" && !evt.data.startsWith("{")) {
                      retryFull += evt.data;
                      setStreamingText(retryFull);
                    }
                  }
                }
              }
            }

            const { chatText: retryChatText, agent: retryAgent } = extractAgentUpdate(retryFull);
            if (retryAgent) {
              setAgentDef(retryAgent);
              addAudit("system", "Extraction succeeded", `Agent: ${retryAgent.metadata?.name || "unnamed"}`);
            }
            if (retryChatText) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + "\n\n" + retryChatText };
                }
                return updated;
              });
            }
            setStreamingText("");
          }
        } catch {
          // Retry failed silently — user can continue chatting
        }
        setIsStreaming(false);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    }

    setIsStreaming(false);
  }, [messages, isStreaming, userProvider, userApiKey, addAudit]);

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
    setShowConfetti(false);
    confettiShownRef.current = false;
    setAuditLog([]);
    auditIdRef.current = 0;
    prevAgentDefRef.current = EMPTY_AGENT;
  };

  const handleDownloadAudit = useCallback((format: "json" | "csv") => {
    const exportData = {
      exported_at: new Date().toISOString(),
      agent: agentDef.metadata.name || "Untitled Agent",
      slug: agentDef.metadata.slug,
      status: agentDef.status,
      progress: agentDef.progress,
      skills: agentDef.skills,
      new_skills: (agentDef.new_skills || []).map((s) => s.name),
      tools: agentDef.tools,
      jurisdictions: agentDef.jurisdictions,
      system_prompt_sections: Object.fromEntries(
        Object.entries(agentDef.system_prompt_sections).map(([k, v]) => [k, v ? "filled" : "empty"]),
      ),
      audit_trail: auditLog.map((e) => ({
        step: e.id,
        time: e.timestamp.toISOString(),
        type: e.type,
        title: e.title,
        detail: e.detail,
      })),
    };

    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(exportData, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const rows = [["Step", "Time", "Type", "Title", "Detail"]];
      for (const e of exportData.audit_trail) {
        rows.push([String(e.step), e.time, e.type, e.title, `"${e.detail.replace(/"/g, '""')}"`]);
      }
      content = rows.map((r) => r.join(",")).join("\n");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agentDef.metadata.slug || "agent"}-build-log.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [agentDef, auditLog]);

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
  const lastAssistantMsg = messages.length > 0 && messages[messages.length - 1]?.role === "assistant" ? messages[messages.length - 1].content : "";
  // Collect labels already answered in previous user messages
  // e.g. "Industry: Manufacturing" means "Industry" is answered
  const answeredLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const msg of messages) {
      if (msg.role !== "user") continue;
      // Match patterns like "Label: Value" or "Label : Value"
      const labelMatches = msg.content.matchAll(/^([A-Za-z][A-Za-z /&]+?):\s/gm);
      for (const m of labelMatches) {
        labels.add(m[1].trim().toLowerCase());
      }
    }
    return labels;
  }, [messages]);

  // Use LLM-provided quick_replies if available, otherwise auto-detect from question lines
  // Filter out already-answered question groups
  const rawQuickReplies = agentDef.quick_replies.length > 0
    ? agentDef.quick_replies
    : (lastAssistantMsg ? autoDetectQuickReplies(lastAssistantMsg) : []);
  const effectiveQuickReplies = rawQuickReplies.filter(
    (qr) => !answeredLabels.has(qr.label.toLowerCase())
  );
  const showQuickReplies = !isStreaming && effectiveQuickReplies.length > 0 && !!lastAssistantMsg;

  return (
    <PageTransition>
      <DemoBanner />

      {/* Header + BYOK — compact single row */}
      <div className="mb-2 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500">
            <Wand2 className="h-3.5 w-3.5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-ink-950 font-headline">Agent Builder</h1>
          <span className="rounded-md bg-cta-light text-cta text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider">
            Intent Engine
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <AIProviderBanner
            provider={userProvider}
            apiKey={userApiKey}
            onProviderChange={setUserProvider}
            onApiKeyChange={setUserApiKey}
            onClear={handleClearKey}
          />
        </div>
        {hasStarted && (
          <button onClick={handleReset} className="btn-secondary !text-xs shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
            Start Over
          </button>
        )}
      </div>

      {/* ── Three-Column Layout ── */}
      <div className="flex gap-3 h-[calc(100vh-8rem)] min-h-[500px]">

        {/* ═══ LEFT: Chat Panel ═══ */}
        <div className="flex flex-col w-full lg:w-[30%] rounded-xl border border-ink-200 bg-white overflow-hidden">
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
            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && i === messages.length - 1;
              const hasInlineChips = isLastAssistant && showQuickReplies;

              return (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "max-w-[85%] bg-ink-900 text-white rounded-br-md"
                        : hasInlineChips
                          ? "max-w-[95%] bg-ink-50 text-ink-800 border border-ink-100 rounded-bl-md"
                          : "max-w-[85%] bg-ink-50 text-ink-800 border border-ink-100 rounded-bl-md"
                    }`}
                  >
                    {hasInlineChips ? (
                      <MessageWithInlineChips
                        content={msg.content}
                        replies={effectiveQuickReplies}
                        selections={chipSelections}
                        onToggle={handleChipToggle}
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {msg.role === "assistant" ? cleanMarkdown(msg.content) : msg.content}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cobalt mt-0.5">
                      <User className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Streaming message */}
            {isStreaming && currentStreamChat && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cta to-amber-500 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="max-w-[85%] rounded-xl rounded-bl-md bg-ink-50 text-ink-800 border border-ink-100 px-3.5 py-2.5 text-sm leading-relaxed">
                  <div className="whitespace-pre-wrap">{cleanMarkdown(currentStreamChat)}</div>
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

        {/* ═══ CENTER: Live Agent Preview ═══ */}
        <div className="hidden lg:flex flex-col w-[40%] rounded-xl border border-ink-200 bg-gradient-to-br from-ink-25 via-white to-ink-50 overflow-hidden relative">
          {/* Confetti overlay */}
          <Confetti show={showConfetti} />

          {/* Preview Header */}
          <div className="bg-white/80 backdrop-blur-sm border-b border-ink-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-cta/10 to-purple-100">
                <FlaskConical className="h-3.5 w-3.5 text-cta" />
              </div>
              <span className="text-sm font-semibold text-ink-800">Agent Blueprint</span>
              {isComplete && (
                <span className="rounded-full bg-signal-green/10 text-signal-green text-[9px] font-bold px-2 py-0.5 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" />
                  Ready
                </span>
              )}
            </div>
            {hasStarted && (
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${statusConf.color}`}>
                  {statusConf.label}
                </span>
                <span className="text-[10px] font-mono tabular-nums text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded">
                  {filledSections}/{totalSections}
                </span>
              </div>
            )}
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {!hasStarted ? (
              /* Empty state — premium */
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <motion.div
                  animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cta/10 via-purple-50 to-cobalt/10 border border-ink-100 mb-5 shadow-premium-sm"
                >
                  <Wand2 className="h-9 w-9 text-cta" />
                </motion.div>
                <h3 className="text-base font-semibold text-ink-800 font-headline">Your agent blueprint will appear here</h3>
                <p className="text-xs text-ink-400 mt-2 max-w-xs leading-relaxed">
                  Start a conversation and watch skills, prompts, tools, and guardrails assemble in real-time.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {BUILD_STAGES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.key} className="flex items-center gap-1 rounded-full bg-ink-50 border border-ink-100 px-2.5 py-1">
                        <Icon className="h-3 w-3 text-ink-300" />
                        <span className="text-[9px] font-medium text-ink-400">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Build Pipeline */}
                <BuildPipeline progress={agentDef.progress} agentDef={agentDef} availableSkills={availableSkills} availableTools={availableTools} />

                {/* Metadata Card — Premium */}
                {agentDef.metadata.name && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl p-[1.5px] shadow-premium-sm"
                    style={{
                      background: `linear-gradient(135deg, ${agentDef.metadata.color || "#3B82F6"}40, ${agentDef.metadata.color || "#3B82F6"}15, ${agentDef.metadata.color || "#3B82F6"}40)`,
                    }}
                  >
                  <div className="rounded-[10px] bg-white p-4">
                    <div className="flex items-start gap-3">
                      {agentDef.metadata.icon && (
                        <motion.div
                          initial={{ rotate: -10, scale: 0 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 200, damping: 12 }}
                          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm"
                          style={{
                            backgroundColor: (agentDef.metadata.color || "#3B82F6") + "18",
                            border: `1px solid ${(agentDef.metadata.color || "#3B82F6")}25`,
                          }}
                        >
                          {agentDef.metadata.icon}
                        </motion.div>
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
                  </div>
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
                      {agentDef.tools.map((tool) => {
                        const meta = availableTools.find((t) => t.name === tool);
                        return (
                          <span
                            key={tool}
                            className="inline-flex items-center gap-1 rounded-md bg-ink-50 text-ink-600 text-[10px] font-medium px-2 py-1 border border-ink-100"
                            title={meta?.description || ""}
                          >
                            {meta ? toolDisplayName(meta.name) : toolDisplayName(tool)}
                          </span>
                        );
                      })}
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

          {/* Preview Footer — Enterprise Deploy Gate */}
          {hasStarted && (
            <div className="border-t border-ink-100 bg-white/90 backdrop-blur-sm p-3">
              {isComplete ? (
                <div className="space-y-3">
                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving || isStreaming}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold bg-signal-green text-white hover:brightness-110 shadow-sm transition-all"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FlaskConical className="h-4 w-4" />
                      )}
                      {saving ? "Creating..." : "Test in Sandbox"}
                    </button>
                    <a
                      href={CALENDLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-cta to-amber-500 text-white hover:brightness-110 shadow-sm transition-all"
                    >
                      <Crown className="h-4 w-4" />
                      Deploy to Production
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>
                  {/* Enterprise features teaser */}
                  <div className="flex items-center gap-2 rounded-lg bg-ink-50 border border-ink-100 px-3 py-2">
                    <Calendar className="h-3.5 w-3.5 text-cobalt shrink-0" />
                    <p className="text-[10px] text-ink-500 leading-relaxed">
                      <span className="font-semibold text-ink-700">Production deployment includes:</span>
                      {" "}SLA guarantee, SSO/SAML, audit log export, webhooks, dedicated support, and custom domain.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-ink-400">
                    Keep chatting to build your agent.
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={agentDef.progress < 70 || saving || isStreaming}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-ink-100 text-ink-400 cursor-not-allowed transition-all"
                  >
                    <Rocket className="h-4 w-4" />
                    Create Agent
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Audit Whiteboard ═══ */}
        <div className="hidden xl:flex flex-col w-[30%] rounded-xl border border-ink-200 bg-gradient-to-b from-white to-ink-25 overflow-hidden">
          <AuditWhiteboard
            entries={auditLog}
            agentDef={agentDef}
            onDownload={handleDownloadAudit}
          />
        </div>
      </div>
    </PageTransition>
  );
}

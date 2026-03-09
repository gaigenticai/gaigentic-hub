import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Play, Square, RotateCcw, AlertCircle, Info, Copy, Download, Check, Brain, FileSearch, Database, Shield, ChevronDown, ChevronUp, ChevronRight, Pencil, Search, Calculator, ShieldCheck, FileText, Scale, Loader2, AlertTriangle, Clock, Zap, Sparkles, Send, User, Bot } from "lucide-react";
import type { Agent, LLMProvider, AgentStep, StepType } from "../types";
import { getAgents, getAgent } from "../services/api";
import { useAgentExecution } from "../hooks/useAgentExecution";
import { useDocumentUpload } from "../hooks/useDocumentUpload";
import JsonEditor from "../components/JsonEditor";
import ResponseViewer from "../components/ResponseViewer";
import ProviderSelector from "../components/ProviderSelector";
import FileUpload from "../components/FileUpload";
import FeedbackWidget from "../components/FeedbackWidget";
import ContactCTA from "../components/ContactCTA";
import PageTransition from "../components/PageTransition";
import ErrorBoundary from "../components/ErrorBoundary";
import DemoBanner from "../components/DemoBanner";
import AgentIcon from "../components/AgentIcon";

/* ── Step type configuration ── */
const STEP_TYPE_CONFIG: Record<StepType, { icon: typeof Search; color: string; bg: string; border: string; label: string }> = {
  tool_call: { icon: Zap, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: "Tool Call" },
  data_fetch: { icon: Database, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", label: "Data Fetch" },
  llm_reasoning: { icon: Brain, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", label: "AI Reasoning" },
  rule_check: { icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Rule Check" },
  decision: { icon: Check, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Decision" },
};

const TOOL_ICONS: Record<string, typeof Search> = {
  rag_query: Search,
  calculate: Calculator,
  data_validation: ShieldCheck,
  document_analysis: FileText,
  regulatory_lookup: Scale,
  llm: Brain,
  final_output: Check,
  escalate_to_agent: Sparkles,
  verify_us_entity: Database,
  sanctions_screener: Shield,
  burner_email_detector: AlertCircle,
  bin_iin_lookup: Search,
  ecfr_lookup: Scale,
  macroeconomic_indicator: Database,
  amortization_restructurer: Calculator,
  rss_news_parser: FileSearch,
};

/* ── Expandable step detail ── */
function StepDetail({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);
  const config = STEP_TYPE_CONFIG[step.step_type] || STEP_TYPE_CONFIG.tool_call;
  const TypeIcon = config.icon;
  const ToolIcon = TOOL_ICONS[step.tool] || config.icon;
  const isRunning = step.status === "running";
  const isDone = step.status === "completed";
  const isError = step.status === "error";

  return (
    <div className={`rounded-lg border transition-all duration-200 ${isRunning ? "border-cta/30 bg-cta/[0.03] shadow-sm"
      : isError ? "border-signal-red/30 bg-signal-red/[0.03]"
        : `${config.border}/60 bg-white`
      }`}>
      <button
        onClick={() => !isRunning && setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-ink-50/50 transition-colors rounded-lg"
        disabled={isRunning}
      >
        {/* Step type icon */}
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md mt-0.5 ${isRunning ? "bg-cta/10 text-cta"
          : isError ? "bg-signal-red/10 text-signal-red"
            : `${config.bg} ${config.color}`
          }`}>
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isDone ? (
            <TypeIcon className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-signal-red" />
          )}
        </div>

        {/* Step info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
            {step.tool !== "llm" && step.tool !== "final_output" && (
              <span className="flex items-center gap-1 text-[10px] text-ink-400">
                <ToolIcon className="h-2.5 w-2.5" />
                <code className="font-mono bg-ink-50 px-1 py-0.5 rounded text-[9px]">
                  {step.tool}
                </code>
              </span>
            )}
          </div>
          <p className={`text-xs mt-0.5 leading-relaxed ${isRunning ? "text-ink-700" : isError ? "text-signal-red" : "text-ink-500"
            }`}>
            {isError ? (step.error_message || "Step failed") : (step.summary || step.label)}
          </p>
        </div>

        {/* Right metadata */}
        <div className="flex items-center gap-2 shrink-0">
          {step.duration_ms != null && (
            <span className="flex items-center gap-0.5 text-[10px] tabular-nums text-ink-300">
              <Clock className="h-2.5 w-2.5" />
              {step.duration_ms < 1000 ? `${step.duration_ms}ms` : `${(step.duration_ms / 1000).toFixed(1)}s`}
            </span>
          )}
          {step.error_message && <AlertTriangle className="h-3 w-3 text-signal-red" />}
          {!isRunning && (step.input_data || step.output_data) && (
            expanded
              ? <ChevronDown className="h-3 w-3 text-ink-300" />
              : <ChevronRight className="h-3 w-3 text-ink-300" />
          )}
        </div>
      </button>

      {/* Expanded detail — input/output data */}
      {expanded && (
        <div className="mx-3 mb-3 ml-12 space-y-2">
          {step.input_data && Object.keys(step.input_data).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Input</p>
              <pre className="text-[11px] bg-ink-50 border border-ink-100 rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap text-ink-600 max-h-32 overflow-y-auto">
                {JSON.stringify(step.input_data, null, 2)}
              </pre>
            </div>
          )}
          {step.output_data && Object.keys(step.output_data).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Output</p>
              <pre className={`text-[11px] border rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${step.step_type === "llm_reasoning"
                ? "bg-purple-50/50 border-purple-100 text-purple-800"
                : step.step_type === "decision"
                  ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                  : "bg-ink-50 border-ink-100 text-ink-600"
                }`}>
                {JSON.stringify(step.output_data, null, 2)}
              </pre>
            </div>
          )}
          {step.error_message && (
            <div className="text-[11px] bg-signal-red/5 border border-signal-red/20 rounded-md p-2 text-signal-red">
              {step.error_message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Agent execution timeline ── */
function AgentSteps({ steps, agent, isStreaming }: { steps: AgentStep[]; agent: Agent | null; isStreaming: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isStreaming]);

  const completedSteps = steps.filter((s) => s.status !== "running");
  const hasDecision = steps.some((s) => s.step_type === "decision");
  const allDone = steps.length > 0 && steps.every((s) => s.status !== "running");

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {agent && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
              style={{ backgroundColor: agent.color + "18", color: agent.color }}
            >
              <AgentIcon icon={agent.icon} className="w-4 h-4" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {agent?.name || "Agent"}{" "}
              <span className="font-normal text-ink-400">
                {isStreaming ? "is working..." : `completed ${completedSteps.length} steps`}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-cta">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cta" />
              {elapsed}s
            </span>
          )}
          {completedSteps.length > 0 && (
            <span className="text-[10px] font-mono tabular-nums text-ink-300 bg-ink-50 px-1.5 py-0.5 rounded">
              {completedSteps.length} step{completedSteps.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        {steps.map((step, i) => (
          <StepDetail key={`${step.step}-${step.tool}-${i}`} step={step} />
        ))}

        {/* Simple processing indicator when no steps yet */}
        {steps.length === 0 && isStreaming && (
          <div className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/30 px-3 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cta/10 text-cta">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-600">Processing input</p>
              <p className="text-[10px] text-ink-400">Preparing analysis pipeline...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  blocks?: import("../types").VisualBlock[];
  steps?: AgentStep[];
  isInitial?: boolean;
}

export default function Playground() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(paramSlug || "");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inputJson, setInputJson] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("zai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [hasExecuted, setHasExecuted] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [followUpText, setFollowUpText] = useState("");
  const followUpRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const { blocks, steps, isStreaming, error, auditLogId, execute, stop, reset, getRawText } =
    useAgentExecution();
  const [copied, setCopied] = useState(false);

  const {
    documents,
    isUploading,
    addFiles,
    removeFile,
    getReadyDocumentIds,
    clear: clearDocuments,
  } = useDocumentUpload();

  // Load agents list
  useEffect(() => {
    getAgents().then((a) => {
      setAgents(a);
      if (!selectedSlug && a.length > 0) {
        setSelectedSlug(a[0].slug);
      }
    });
  }, []);

  // Load selected agent
  useEffect(() => {
    if (!selectedSlug) return;
    getAgent(selectedSlug).then((a) => {
      setSelectedAgent(a);
      setInputJson("");
    });
  }, [selectedSlug]);

  const handleExecute = async (
    overrideSlug?: string,
    overrideInput?: Record<string, unknown>,
    overridePrompt?: string
  ) => {
    const slugToRun = overrideSlug || selectedAgent?.slug;
    if (!slugToRun || isStreaming) return;

    const documentIds = getReadyDocumentIds();
    let parsedInput: Record<string, unknown> = {};

    if (overrideInput) {
      parsedInput = overrideInput;
    } else if (inputJson.trim()) {
      try {
        parsedInput = JSON.parse(inputJson);
      } catch {
        return; // Invalid JSON
      }
    }

    const promptToRun = overridePrompt ?? userPrompt.trim();

    setHasExecuted(true);
    setConversation([]);
    const result = await execute(slugToRun, parsedInput, {
      provider,
      model: model || undefined,
      userApiKey: apiKey || undefined,
      documentIds: overrideSlug ? undefined : documentIds.length > 0 ? documentIds : undefined,
      prompt: promptToRun || undefined,
    });

    // Record initial conversation turn
    const userContent = promptToRun || JSON.stringify(parsedInput, null, 2);
    setConversation([
      { role: "user", content: userContent, isInitial: true },
      { role: "assistant", content: result.rawText },
    ]);

    // Handle seamless agent-to-agent handoff
    if (result.handoff) {
      const { target_agent_slug, context_payload, action_requested } = result.handoff;

      // Update UI state to reflect the new agent
      setSelectedSlug(target_agent_slug);
      setInputJson(JSON.stringify(context_payload, null, 2));
      setUserPrompt(action_requested);

      // Clear legacy documents since they probably aren't relevant to the new agent
      clearDocuments();

      // Immediately trigger the new agent with the inherited context
      handleExecute(target_agent_slug, context_payload, action_requested);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpText.trim() || isStreaming || !selectedAgent) return;

    const userMessage = followUpText.trim();
    setFollowUpText("");

    // Build messages from conversation history + new message
    const historyMessages = conversation.map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    }));
    historyMessages.push({ role: "user" as const, content: userMessage });

    // Add user turn to conversation immediately
    setConversation((prev) => [...prev, { role: "user", content: userMessage }]);

    // Execute with full message history
    const result = await execute(selectedAgent.slug, {}, {
      provider,
      model: model || undefined,
      userApiKey: apiKey || undefined,
      messages: historyMessages,
    });

    // Add assistant response
    setConversation((prev) => [
      ...prev,
      { role: "assistant", content: result.rawText },
    ]);
  };

  const handleReset = () => {
    reset();
    clearDocuments();
    setUserPrompt("");
    setHasExecuted(false);
    setCopied(false);
    setConversation([]);
    setFollowUpText("");
  };

  const handleCopyRaw = () => {
    const raw = getRawText();
    if (!raw) return;
    navigator.clipboard.writeText(raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadRaw = () => {
    const raw = getRawText();
    if (!raw) return;
    const blob = new Blob([raw], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedAgent?.slug || "response"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasDocuments = documents.length > 0;
  const hasInput = !!inputJson.trim();
  const hasPrompt = !!userPrompt.trim();
  let isValidJson = false;
  try {
    if (hasInput) {
      JSON.parse(inputJson);
      isValidJson = true;
    }
  } catch {
    isValidJson = false;
  }

  // Auto-scroll to bottom on new conversation turns
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  const executionDone = hasExecuted && !isStreaming && blocks.length > 0;
  const showingResponse = hasExecuted || isStreaming;
  const [inputExpanded, setInputExpanded] = useState(false);

  const applyPreset = (type: 'risk' | 'kyb') => {
    if (type === 'risk') {
      setUserPrompt("Analyze this transaction for potential BSA/AML risk. Identify any suspicious velocity patterns or geographic anomalies.");
      setInputJson(JSON.stringify({
        "transaction_id": "TX-9982",
        "amount_usd": 12500,
        "originating_country": "US",
        "beneficiary_country": "SC",
        "user_account_age_days": 12
      }, null, 2));
    } else {
      setUserPrompt("Verify this business entity against standard KYB requirements. Flag any missing documentation or high-risk industries.");
      setInputJson(JSON.stringify({
        "entity_name": "Nebula Trading LLC",
        "registration_number": "1992883-X",
        "jurisdiction": "DE",
        "industry_code": "522320",
        "documents_provided": ["certificate_of_incorporation"]
      }, null, 2));
    }
  };

  return (
    <PageTransition>
      <DemoBanner />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink-950 font-headline">API Playground</h1>
        <p className="mt-1 text-sm text-ink-500">
          Test agents live with sample data. Upload documents for AI-powered
          analysis. Responses stream in real-time with visual dashboards.
        </p>
      </div>

      {/* ── Input Section ── */}
      {showingResponse ? (
        /* Collapsed input bar when response is showing */
        <div className="mb-6 rounded-lg border border-ink-100 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {selectedAgent && (
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                  style={{ backgroundColor: selectedAgent.color + "18", color: selectedAgent.color }}
                >
                  <AgentIcon icon={selectedAgent.icon} className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{selectedAgent?.name}</p>
                <p className="text-xs text-ink-400 truncate">
                  {hasInput ? "JSON input provided" : ""}
                  {hasInput && hasDocuments ? " + " : ""}
                  {hasDocuments ? `${documents.length} document${documents.length > 1 ? "s" : ""}` : ""}
                  {!hasInput && !hasDocuments && hasPrompt ? "Text prompt" : ""}
                  {(hasInput || hasDocuments) && hasPrompt ? " + custom prompt" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setInputExpanded(!inputExpanded)}
                className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition-colors duration-150"
              >
                <Pencil className="h-3 w-3" />
                Edit Input
                {inputExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <button onClick={handleReset} className="btn-secondary !py-1 !px-2.5 !text-xs">
                <RotateCcw className="h-3 w-3" />
                New
              </button>
            </div>
          </div>

          {/* Expandable input form */}
          {inputExpanded && (
            <div className="border-t border-ink-100 p-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  {/* Agent selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
                      Select Agent
                    </label>
                    <select
                      value={selectedSlug}
                      onChange={(e) => {
                        setSelectedSlug(e.target.value);
                        handleReset();
                      }}
                      className="input"
                    >
                      {agents.map((a) => (
                        <option key={a.slug} value={a.slug}>
                          {a.name} — {a.tagline}
                        </option>
                      ))}
                    </select>
                  </div>
                  <JsonEditor
                    value={inputJson}
                    onChange={setInputJson}
                    placeholder='{"key": "value"}'
                    sampleInput={selectedAgent?.sample_input}
                  />
                </div>
                <div className="space-y-4">
                  <FileUpload
                    documents={documents}
                    isUploading={isUploading}
                    onAddFiles={addFiles}
                    onRemoveFile={removeFile}
                  />
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-ink-500 uppercase tracking-widest">
                        Your Instructions <span className="normal-case font-normal text-ink-400">(optional)</span>
                      </label>
                      <div className="flex gap-1.5">
                        <button onClick={() => applyPreset('risk')} className="tag cursor-pointer hover:bg-ink-100 transition-colors flex items-center gap-1 !py-0.5"><Sparkles className="h-3 w-3 text-cta" /> Risk</button>
                        <button onClick={() => applyPreset('kyb')} className="tag cursor-pointer hover:bg-ink-100 transition-colors flex items-center gap-1 !py-0.5"><Sparkles className="h-3 w-3 text-cta" /> KYB</button>
                      </div>
                    </div>
                    <textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder="e.g. Focus on recurring payments and flag anomalies."
                      className="input min-h-[80px] resize-y"
                      rows={3}
                    />
                  </div>
                  <ProviderSelector
                    provider={provider}
                    onProviderChange={setProvider}
                    apiKey={apiKey}
                    onApiKeyChange={setApiKey}
                    model={model}
                    onModelChange={setModel}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  setInputExpanded(false);
                  handleExecute();
                }}
                disabled={(!isValidJson && !hasDocuments && !hasPrompt) || (hasInput && !isValidJson) || !selectedAgent || isUploading}
                className="btn-primary"
              >
                <Play className="h-4 w-4" />
                Re-Execute
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Full-width input form before execution */
        <div className="space-y-4">
          {/* Agent selector — full width */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
              Select Agent
            </label>
            <select
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                handleReset();
              }}
              className="input"
            >
              {agents.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name} — {a.tagline}
                </option>
              ))}
            </select>
          </div>

          {/* Agent instructions */}
          {selectedAgent?.playground_instructions && (
            <div className="flex gap-2.5 rounded-lg border border-cobalt/15 bg-cobalt-light px-3.5 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
              <p className="text-sm leading-relaxed text-ink-600 whitespace-pre-line">
                {selectedAgent.playground_instructions}
              </p>
            </div>
          )}

          {/* Two-column: JSON + Files/Prompt side by side */}
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            {/* Left: JSON Input */}
            <JsonEditor
              value={inputJson}
              onChange={setInputJson}
              placeholder='{"key": "value"}'
              sampleInput={selectedAgent?.sample_input}
            />

            {/* Right: Files + Prompt */}
            <div className="space-y-4">
              <FileUpload
                documents={documents}
                isUploading={isUploading}
                onAddFiles={addFiles}
                onRemoveFile={removeFile}
              />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-ink-500 uppercase tracking-widest">
                    Your Instructions <span className="normal-case font-normal text-ink-400">(optional)</span>
                  </label>
                  <div className="flex gap-1.5 hidden sm:flex">
                    <button onClick={() => applyPreset('risk')} className="tag cursor-pointer hover:bg-ink-100 transition-colors flex items-center gap-1 !pb-0.5 !pt-0.5"><Sparkles className="h-3 w-3 text-cta" /> Risk Example</button>
                    <button onClick={() => applyPreset('kyb')} className="tag cursor-pointer hover:bg-ink-100 transition-colors flex items-center gap-1 !pb-0.5 !pt-0.5"><Sparkles className="h-3 w-3 text-cta" /> KYB Example</button>
                  </div>
                </div>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g. Categorize all transactions and flag any expenses over $100. Focus on recurring payments."
                  className="input min-h-[80px] resize-y"
                  rows={3}
                />
                <p className="mt-1 text-[11px] text-ink-400">
                  Tell the AI what to do — in plain English. Combine with JSON input or documents above.
                </p>
              </div>
            </div>
          </div>

          {/* Provider + Actions — full width row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <ProviderSelector
                provider={provider}
                onProviderChange={setProvider}
                apiKey={apiKey}
                onApiKeyChange={setApiKey}
                model={model}
                onModelChange={setModel}
              />
            </div>
            <div className="flex gap-3 shrink-0">
              {isStreaming ? (
                <button onClick={stop} className="btn-secondary">
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => handleExecute()}
                  disabled={(!isValidJson && !hasDocuments && !hasPrompt) || (hasInput && !isValidJson) || !selectedAgent || isUploading}
                  className="btn-primary"
                >
                  <Play className="h-4 w-4" />
                  Execute
                  {documents.length > 0 && (
                    <span className="ml-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px]">
                      +{documents.filter((d) => d.status === "ready").length} docs
                    </span>
                  )}
                </button>
              )}
              <button onClick={handleReset} className="btn-secondary">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-Width Response (after execution) ── */}
      {showingResponse && (
        <div className="space-y-4">
          <div className="card min-h-[400px] overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h4>Response</h4>
              <div className="flex items-center gap-2">
                {executionDone && (
                  <>
                    <button
                      onClick={handleCopyRaw}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition-colors duration-150"
                      title="Copy raw output"
                    >
                      {copied ? <Check className="h-3 w-3 text-signal-green" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy Raw"}
                    </button>
                    <button
                      onClick={handleDownloadRaw}
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-700 transition-colors duration-150"
                      title="Download as Markdown"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </>
                )}
                {isStreaming && (
                  <span className="flex items-center gap-1.5 text-xs text-cta">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cta" />
                    Streaming...
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-signal-red" />
                <p className="text-sm text-signal-red">{error}</p>
              </div>
            )}

            <ErrorBoundary>
              {/* Previous conversation turns (completed) */}
              {conversation.length > 2 && (
                <div className="mb-4 space-y-3">
                  {conversation.slice(0, -2).map((turn, i) => (
                    <div key={i}>
                      {turn.role === "user" && !turn.isInitial && (
                        <div className="flex items-start gap-2.5 mb-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cobalt/10 text-cobalt mt-0.5">
                            <User className="h-3 w-3" />
                          </div>
                          <div className="flex-1 rounded-lg bg-cobalt/[0.04] border border-cobalt/10 px-3 py-2">
                            <p className="text-sm text-ink-700">{turn.content}</p>
                          </div>
                        </div>
                      )}
                      {turn.role === "assistant" && (
                        <div className="flex items-start gap-2.5">
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5"
                            style={{ backgroundColor: (selectedAgent?.color || "#6B7280") + "18", color: selectedAgent?.color || "#6B7280" }}
                          >
                            <Bot className="h-3 w-3" />
                          </div>
                          <div className="flex-1 text-sm text-ink-600 leading-relaxed border-b border-ink-100 pb-3 mb-1">
                            <p className="line-clamp-4 whitespace-pre-wrap">{turn.content.slice(0, 500)}{turn.content.length > 500 ? "..." : ""}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Show follow-up user message if this is a follow-up turn */}
              {conversation.length > 2 && (
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cobalt/10 text-cobalt mt-0.5">
                    <User className="h-3 w-3" />
                  </div>
                  <div className="flex-1 rounded-lg bg-cobalt/[0.04] border border-cobalt/10 px-3 py-2">
                    <p className="text-sm text-ink-700">{conversation[conversation.length - 2]?.content}</p>
                  </div>
                </div>
              )}

              {/* Current streaming response (latest turn) */}
              {steps.length > 0 && (
                <div className="mb-4">
                  <AgentSteps steps={steps} agent={selectedAgent} isStreaming={blocks.length === 0 && isStreaming} />
                </div>
              )}

              {blocks.length === 0 && isStreaming && steps.length === 0 ? (
                <AgentSteps steps={[]} agent={selectedAgent} isStreaming={isStreaming} />
              ) : (
                <ResponseViewer blocks={blocks} isStreaming={isStreaming} />
              )}

              <div ref={conversationEndRef} />
            </ErrorBoundary>
          </div>

          {/* Follow-up chat input */}
          {executionDone && (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={followUpRef}
                  type="text"
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFollowUp();
                    }
                  }}
                  placeholder="Ask a follow-up question..."
                  className="input !pr-10"
                  disabled={isStreaming}
                />
                <button
                  onClick={handleFollowUp}
                  disabled={!followUpText.trim() || isStreaming}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md bg-cta text-white hover:bg-cta/90 disabled:opacity-30 disabled:hover:bg-cta transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Post-execution feedback + contact */}
          {executionDone && (
            <div className="space-y-4">
              <FeedbackWidget auditLogId={auditLogId} />
              <ContactCTA compact agentColor={selectedAgent?.color} />
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}

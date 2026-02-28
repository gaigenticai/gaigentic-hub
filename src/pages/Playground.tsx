import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Play, Square, RotateCcw, AlertCircle, Info, Copy, Download, Check, Brain, FileSearch, Database, Shield, ChevronDown, ChevronUp, ChevronRight, Pencil, Search, Calculator, ShieldCheck, FileText, Scale, Loader2, AlertTriangle, Clock, Zap } from "lucide-react";
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

/* ── Step type configuration ── */
const STEP_TYPE_CONFIG: Record<StepType, { icon: typeof Search; color: string; bg: string; border: string; label: string }> = {
  tool_call:     { icon: Zap,         color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200",    label: "Tool Call" },
  data_fetch:    { icon: Database,    color: "text-cyan-600",    bg: "bg-cyan-50",    border: "border-cyan-200",    label: "Data Fetch" },
  llm_reasoning: { icon: Brain,       color: "text-purple-600",  bg: "bg-purple-50",  border: "border-purple-200",  label: "AI Reasoning" },
  rule_check:    { icon: ShieldCheck, color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200",   label: "Rule Check" },
  decision:      { icon: Check,       color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Decision" },
};

const TOOL_ICONS: Record<string, typeof Search> = {
  rag_query: Search,
  calculate: Calculator,
  data_validation: ShieldCheck,
  document_analysis: FileText,
  regulatory_lookup: Scale,
  llm: Brain,
  final_output: Check,
};

/* ── Expandable step detail ── */
function StepDetail({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false);
  const config = STEP_TYPE_CONFIG[step.step_type] || STEP_TYPE_CONFIG.tool_call;
  const TypeIcon = config.icon;
  const ToolIcon = TOOL_ICONS[step.tool] || config.icon;
  const isRunning = step.status === "running";
  const isDone = step.status === "completed";

  return (
    <div className={`rounded-lg border transition-all duration-200 ${
      isRunning ? "border-cta/30 bg-cta/[0.03] shadow-sm" : `${config.border}/60 bg-white`
    }`}>
      <button
        onClick={() => !isRunning && setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-ink-50/50 transition-colors rounded-lg"
        disabled={isRunning}
      >
        {/* Step type icon */}
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md mt-0.5 ${
          isRunning ? "bg-cta/10 text-cta" : `${config.bg} ${config.color}`
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
          <p className={`text-xs mt-0.5 leading-relaxed ${
            isRunning ? "text-ink-700" : "text-ink-500"
          }`}>
            {step.summary || step.label}
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
              <pre className={`text-[11px] border rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap max-h-40 overflow-y-auto ${
                step.step_type === "llm_reasoning"
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
              {agent.icon}
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

export default function Playground() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(paramSlug || "");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inputJson, setInputJson] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("zai");
  const [apiKey, setApiKey] = useState("");
  const [hasExecuted, setHasExecuted] = useState(false);

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

  const handleExecute = () => {
    if (!selectedAgent || isStreaming) return;
    const documentIds = getReadyDocumentIds();
    let input: Record<string, unknown> = {};
    if (inputJson.trim()) {
      try {
        input = JSON.parse(inputJson);
      } catch {
        return; // Invalid JSON
      }
    }
    setHasExecuted(true);
    execute(selectedAgent.slug, input, {
      provider,
      userApiKey: apiKey || undefined,
      documentIds: documentIds.length > 0 ? documentIds : undefined,
      prompt: userPrompt.trim() || undefined,
    });
  };

  const handleReset = () => {
    reset();
    clearDocuments();
    setUserPrompt("");
    setHasExecuted(false);
    setCopied(false);
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

  const executionDone = hasExecuted && !isStreaming && blocks.length > 0;
  const showingResponse = hasExecuted || isStreaming;
  const [inputExpanded, setInputExpanded] = useState(false);

  return (
    <div>
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
                  style={{ backgroundColor: selectedAgent.color + "18" }}
                >
                  {selectedAgent.icon}
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
                    <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
                      Your Instructions <span className="normal-case font-normal text-ink-400">(optional)</span>
                    </label>
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
                <label className="mb-1.5 block text-xs font-medium text-ink-500 uppercase tracking-widest">
                  Your Instructions <span className="normal-case font-normal text-ink-400">(optional)</span>
                </label>
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
                  onClick={handleExecute}
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

            {/* Real agentic steps */}
            {steps.length > 0 && (
              <div className="mb-4">
                <AgentSteps steps={steps} agent={selectedAgent} isStreaming={blocks.length === 0 && isStreaming} />
              </div>
            )}

            {blocks.length === 0 && isStreaming && steps.length === 0 ? (
              /* Fallback for single-shot agents (no tools) */
              <AgentSteps steps={[]} agent={selectedAgent} isStreaming={isStreaming} />
            ) : (
              <ResponseViewer blocks={blocks} isStreaming={isStreaming} />
            )}
          </div>

          {/* Post-execution feedback + contact */}
          {executionDone && (
            <div className="space-y-4">
              <FeedbackWidget auditLogId={auditLogId} />
              <ContactCTA compact agentColor={selectedAgent?.color} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

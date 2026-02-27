import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Play, Square, RotateCcw, AlertCircle, Info, Copy, Download, Check, Brain, FileSearch, Database, Shield, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { Agent, LLMProvider } from "../types";
import { getAgents, getAgent } from "../services/api";
import { useAgentExecution } from "../hooks/useAgentExecution";
import { useDocumentUpload } from "../hooks/useDocumentUpload";
import JsonEditor from "../components/JsonEditor";
import ResponseViewer from "../components/ResponseViewer";
import ProviderSelector from "../components/ProviderSelector";
import FileUpload from "../components/FileUpload";
import FeedbackWidget from "../components/FeedbackWidget";
import ContactCTA from "../components/ContactCTA";

/* ── Thinking state while agent processes ── */
function AgentThinking({ agent, hasDocuments }: { agent: Agent | null; hasDocuments: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const startRef = useRef(Date.now());

  const steps = [
    { icon: FileSearch, label: "Reading input & documents", delay: 0 },
    { icon: Database, label: "Querying knowledge base", delay: 2 },
    { icon: Brain, label: "Analyzing & reasoning", delay: 5 },
    { icon: Shield, label: "Applying compliance checks", delay: 9 },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(secs);
      const next = steps.findIndex((s) => s.delay > secs);
      setActiveStep(next === -1 ? steps.length - 1 : Math.max(0, next - 1));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10">
      {/* Agent identity */}
      {agent && (
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: agent.color + "18", color: agent.color }}
          >
            {agent.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">{agent.name}</p>
            <p className="text-xs text-ink-400">{hasDocuments ? "Processing documents..." : "Working..."}</p>
          </div>
        </div>
      )}

      {/* Step progress */}
      <div className="w-full max-w-xs space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === activeStep;
          const isDone = i < activeStep;
          const isPending = i > activeStep;
          return (
            <div key={i} className={`flex items-center gap-3 transition-opacity duration-300 ${isPending ? "opacity-30" : "opacity-100"}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-300 ${
                isActive ? "bg-cta/10 text-cta" : isDone ? "bg-ink-50 text-ink-400" : "bg-ink-50 text-ink-200"
              }`}>
                {isActive ? (
                  <Icon className="h-3.5 w-3.5 animate-pulse" />
                ) : isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className={`text-xs transition-colors duration-300 ${
                isActive ? "font-medium text-ink-900" : isDone ? "text-ink-400 line-through" : "text-ink-300"
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timer */}
      <p className="mt-6 font-mono text-xs tabular-nums text-ink-300">
        {elapsed}s elapsed
      </p>
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

  const { blocks, isStreaming, error, auditLogId, execute, stop, reset, getRawText } =
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
        /* Full input form before execution */
        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
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

            {/* Agent instructions */}
            {selectedAgent?.playground_instructions && (
              <div className="flex gap-2.5 rounded-lg border border-cobalt/15 bg-cobalt-light px-3.5 py-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cobalt" />
                <p className="text-sm leading-relaxed text-ink-600 whitespace-pre-line">
                  {selectedAgent.playground_instructions}
                </p>
              </div>
            )}

            {/* JSON Input */}
            <JsonEditor
              value={inputJson}
              onChange={setInputJson}
              placeholder='{"key": "value"}'
              sampleInput={selectedAgent?.sample_input}
            />

            {/* File Upload */}
            <FileUpload
              documents={documents}
              isUploading={isUploading}
              onAddFiles={addFiles}
              onRemoveFile={removeFile}
            />

            {/* Additional Prompt */}
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

            {/* Provider */}
            <ProviderSelector
              provider={provider}
              onProviderChange={setProvider}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
            />

            {/* Actions */}
            <div className="flex gap-3">
              {isStreaming ? (
                <button onClick={stop} className="btn-secondary flex-1">
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleExecute}
                  disabled={(!isValidJson && !hasDocuments && !hasPrompt) || (hasInput && !isValidJson) || !selectedAgent || isUploading}
                  className="btn-primary flex-1"
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

          {/* Right: Output placeholder before execution */}
          <div className="space-y-4">
            <div className="card min-h-[400px] overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h4>Response</h4>
              </div>
              <div className="flex h-64 items-center justify-center text-sm text-ink-300">
                Execute an agent to see the response here
              </div>
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

            {blocks.length === 0 && isStreaming ? (
              <AgentThinking agent={selectedAgent} hasDocuments={hasDocuments} />
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

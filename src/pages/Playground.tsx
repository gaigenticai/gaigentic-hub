import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Play, Square, RotateCcw, AlertCircle } from "lucide-react";
import type { Agent, LLMProvider } from "../types";
import { getAgents, getAgent } from "../services/api";
import { useAgentExecution } from "../hooks/useAgentExecution";
import JsonEditor from "../components/JsonEditor";
import ResponseViewer from "../components/ResponseViewer";
import ProviderSelector from "../components/ProviderSelector";
import FeedbackWidget from "../components/FeedbackWidget";
import ContactCTA from "../components/ContactCTA";

export default function Playground() {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSlug, setSelectedSlug] = useState(paramSlug || "");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inputJson, setInputJson] = useState("");
  const [provider, setProvider] = useState<LLMProvider>("zai");
  const [apiKey, setApiKey] = useState("");
  const [hasExecuted, setHasExecuted] = useState(false);

  const { blocks, isStreaming, error, auditLogId, execute, stop, reset } =
    useAgentExecution();

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
      try {
        setInputJson(JSON.stringify(JSON.parse(a.sample_input), null, 2));
      } catch {
        setInputJson(a.sample_input);
      }
    });
  }, [selectedSlug]);

  const handleExecute = () => {
    if (!selectedAgent || isStreaming) return;
    try {
      const input = JSON.parse(inputJson);
      setHasExecuted(true);
      execute(selectedAgent.slug, input, {
        provider,
        userApiKey: apiKey || undefined,
      });
    } catch {
      // Invalid JSON
    }
  };

  const handleReset = () => {
    reset();
    setHasExecuted(false);
  };

  let isValidJson = false;
  try {
    if (inputJson.trim()) {
      JSON.parse(inputJson);
      isValidJson = true;
    }
  } catch {
    isValidJson = false;
  }

  const executionDone = hasExecuted && !isStreaming && blocks.length > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">API Playground</h1>
        <p className="mt-1 text-sm text-gray-600">
          Test agents live with sample data. Responses stream in real-time with
          visual dashboards.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Input */}
        <div className="space-y-4">
          {/* Agent selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
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

          {/* JSON Input */}
          <JsonEditor
            value={inputJson}
            onChange={setInputJson}
            placeholder='{"key": "value"}'
          />

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
                disabled={!isValidJson || !selectedAgent}
                className="btn-primary flex-1"
              >
                <Play className="h-4 w-4" />
                Execute
              </button>
            )}
            <button onClick={handleReset} className="btn-secondary">
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: Output */}
        <div className="space-y-4">
          <div className="card min-h-[400px]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Response</h3>
              {isStreaming && (
                <span className="flex items-center gap-1.5 text-xs text-purple-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
                  Streaming...
                </span>
              )}
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {blocks.length === 0 && !isStreaming && !error ? (
              <div className="flex h-64 items-center justify-center text-sm text-gray-600/30">
                Execute an agent to see the response here
              </div>
            ) : (
              <ResponseViewer blocks={blocks} isStreaming={isStreaming} />
            )}
          </div>

          {/* Post-execution feedback + contact */}
          {executionDone && (
            <div className="space-y-4">
              <FeedbackWidget auditLogId={auditLogId} />
              <ContactCTA
                compact
                agentColor={selectedAgent?.color}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Play, Key, ArrowLeft, Code } from "lucide-react";
import type { Agent } from "../types";
import { getAgent } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import CodeBlock from "../components/CodeBlock";

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "api">("overview");

  useEffect(() => {
    if (!slug) return;
    getAgent(slug)
      .then(setAgent)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-gray-100" />
        <div className="h-4 w-96 rounded bg-gray-100" />
        <div className="h-64 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500">Agent not found.</p>
        <Link to="/agents" className="btn-secondary mt-4 inline-flex">
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>
      </div>
    );
  }

  let sampleInput = "";
  try {
    sampleInput = JSON.stringify(JSON.parse(agent.sample_input), null, 2);
  } catch {
    sampleInput = agent.sample_input;
  }

  let sampleOutput = "";
  try {
    sampleOutput = JSON.stringify(JSON.parse(agent.sample_output), null, 2);
  } catch {
    sampleOutput = agent.sample_output;
  }

  const curlExample = `curl -X POST https://hub.gaigentic.ai/api/v1/agents/${agent.slug}/run \\
  -H "Authorization: Bearer ghk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${agent.sample_input}'`;

  return (
    <div>
      <Link
        to="/agents"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to catalog
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{
              backgroundColor: `${agent.color}20`,
              color: agent.color,
            }}
          >
            {agent.icon}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{agent.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <p className="mt-1 text-lg text-gray-600">
              {agent.tagline}
            </p>
            <p className="mt-1 text-xs text-gray-600/40">
              v{agent.version}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/playground/${agent.slug}`}
            className="btn-primary"
          >
            <Play className="h-4 w-4" />
            Try in Playground
          </Link>
          <Link to="/dashboard" className="btn-secondary">
            <Key className="h-4 w-4" />
            Get API Key
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab("overview")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            tab === "overview"
              ? "border-brand-500 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setTab("api")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
            tab === "api"
              ? "border-brand-500 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Code className="h-4 w-4" />
          API
        </button>
      </div>

      {tab === "overview" ? (
        <div className="space-y-8">
          {/* Description */}
          <div className="card">
            <h3 className="mb-3 font-semibold text-gray-900">Description</h3>
            <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
              {agent.description}
            </p>
          </div>

          {/* Sample I/O */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">
                Sample Input
              </h3>
              <CodeBlock lang="json">{sampleInput}</CodeBlock>
            </div>
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">
                Sample Output
              </h3>
              <CodeBlock lang="json">{sampleOutput}</CodeBlock>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 font-semibold text-gray-900">Quick Start</h3>
            <p className="mb-4 text-sm text-gray-600">
              1. Sign up and generate an API key from your dashboard.
              <br />
              2. Use the key to call the agent endpoint below.
            </p>
            <CodeBlock lang="bash">{curlExample}</CodeBlock>
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold text-gray-900">Endpoint</h3>
            <div className="rounded-lg bg-white p-4 font-mono text-sm">
              <span className="text-emerald-600">POST</span>{" "}
              <span className="text-gray-600">
                /api/v1/agents/{agent.slug}/run
              </span>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 font-semibold text-gray-900">Headers</h3>
            <div className="space-y-2 text-sm font-mono text-gray-600">
              <div>
                <span className="text-amber-600">Authorization</span>: Bearer
                ghk_YOUR_KEY
              </div>
              <div>
                <span className="text-amber-600">Content-Type</span>:
                application/json
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

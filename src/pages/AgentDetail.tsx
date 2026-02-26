import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Play,
  Key,
  ArrowLeft,
  Code,
  Eye,
  ArrowRight,
  Layers,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Agent } from "../types";
import { getAgent } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import CodeBlock from "../components/CodeBlock";
import AuditBadge from "../components/AuditBadge";
import CapabilityGrid from "../components/CapabilityGrid";
import JurisdictionPills from "../components/JurisdictionPills";
import ContactCTA from "../components/ContactCTA";

export default function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "capabilities" | "api">(
    "overview",
  );

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
        <div className="h-64 rounded-3xl bg-gray-100" />
        <div className="h-8 w-48 rounded bg-gray-100" />
        <div className="h-4 w-96 rounded bg-gray-100" />
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

  const TABS = [
    { id: "overview" as const, label: "Overview", icon: Eye },
    { id: "capabilities" as const, label: "Capabilities", icon: Layers },
    { id: "api" as const, label: "API", icon: Code },
  ];

  return (
    <div>
      {/* Back link */}
      <Link
        to="/agents"
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to catalog
      </Link>

      {/* Hero section */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
        {/* Background gradients */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            background: `radial-gradient(ellipse at top right, ${agent.color}, transparent 60%), radial-gradient(ellipse at bottom left, ${agent.color}, transparent 60%)`,
          }}
        />

        {/* Floating orbs */}
        <div
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl opacity-10 animate-float"
          style={{ backgroundColor: agent.color }}
        />
        <div
          className="absolute -left-10 bottom-0 h-40 w-40 rounded-full blur-3xl opacity-[0.07] animate-float"
          style={{
            backgroundColor: agent.color,
            animationDelay: "2s",
          }}
        />

        <div className="relative p-8 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-5">
              {/* Icon */}
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl shadow-lg animate-float"
                style={{
                  backgroundColor: `${agent.color}15`,
                  boxShadow: `0 8px 32px ${agent.color}20`,
                }}
              >
                {agent.icon}
              </div>

              {/* Info */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={agent.status} />
                  <AuditBadge />
                  {agent.featured === 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 font-headline sm:text-4xl">
                  {agent.name}
                </h1>
                <p className="mt-2 max-w-xl text-lg text-gray-600 leading-relaxed">
                  {agent.tagline}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  v{agent.version}
                </p>

                {/* Jurisdictions */}
                <div className="mt-4">
                  <JurisdictionPills jurisdictions={agent.jurisdictions} />
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex shrink-0 gap-3">
              <Link to={`/playground/${agent.slug}`} className="btn-primary">
                <Play className="h-4 w-4" />
                Try in Playground
              </Link>
              <Link to="/dashboard" className="btn-secondary">
                <Key className="h-4 w-4" />
                Get API Key
              </Link>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap gap-4 border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Built for Financial Compliance</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Eye className="h-4 w-4 text-blue-500" />
              <span>Explainable Reasoning in Every Response</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Layers className="h-4 w-4 text-purple-500" />
              <span>RAG-Powered Knowledge Base</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-8">
          {/* Description */}
          <div className="card">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              About this Agent
            </h3>
            <p className="text-sm leading-relaxed text-gray-600 whitespace-pre-wrap">
              {agent.description}
            </p>
          </div>

          {/* Try with sample data */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Try with Sample Data
              </h3>
              <Link
                to={`/playground/${agent.slug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                Open in Playground
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Input
                </h4>
                <CodeBlock lang="json">{sampleInput}</CodeBlock>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                  Output
                </h4>
                <CodeBlock lang="json">{sampleOutput}</CodeBlock>
              </div>
            </div>
          </div>

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}

      {tab === "capabilities" && (
        <div className="space-y-8">
          <CapabilityGrid
            capabilities={agent.capabilities}
            agentColor={agent.color}
          />

          {!agent.capabilities && (
            <div className="card text-center py-12">
              <Layers className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-gray-500">
                Capability details coming soon.
              </p>
            </div>
          )}

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Quick Start
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              1. Sign up and generate an API key from your dashboard.
              <br />
              2. Use the key to call the agent endpoint below.
            </p>
            <CodeBlock lang="bash">{curlExample}</CodeBlock>
          </div>

          <div className="card">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Endpoint
            </h3>
            <div className="rounded-lg bg-gray-50 p-4 font-mono text-sm">
              <span className="font-semibold text-emerald-600">POST</span>{" "}
              <span className="text-gray-700">
                /api/v1/agents/{agent.slug}/run
              </span>
            </div>
          </div>

          <div className="card">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Headers
            </h3>
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm font-mono text-gray-600">
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

          <div className="card">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">
              Response Format
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              Responses stream as Server-Sent Events (SSE). Each event contains
              a chunk of the agent's output including visual blocks (tables,
              charts, KPI cards) that you can render or process as plain text.
            </p>
            <div className="rounded-lg bg-gray-50 p-4 text-sm font-mono text-gray-600">
              <div className="text-gray-400">// SSE stream</div>
              <div>
                data: {`{"type":"text","content":"## Analysis..."}`}
              </div>
              <div>
                data: {`{"type":"text","content":"|||TABLE|||..."}`}
              </div>
              <div>data: [DONE]</div>
            </div>
          </div>

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}
    </div>
  );
}

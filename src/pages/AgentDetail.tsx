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
  FileInput,
  Brain,
  BarChart3,
  CheckCircle2,
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
        <div className="h-48 rounded-lg bg-ink-50" />
        <div className="h-6 w-48 rounded bg-ink-50" />
        <div className="h-4 w-96 rounded bg-ink-50" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="card text-center py-16">
        <p className="text-ink-500">Agent not found.</p>
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

  const curlSaveExample = `# Stream response and save to file
curl -X POST https://hub.gaigentic.ai/api/v1/agents/${agent.slug}/run \\
  -H "Authorization: Bearer ghk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${agent.sample_input}' \\
  -o response.txt`;

  const pythonExample = `import requests
import json

url = "https://hub.gaigentic.ai/api/v1/agents/${agent.slug}/run"
headers = {
    "Authorization": "Bearer ghk_YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = ${sampleInput}

# Stream the response and capture output
response = requests.post(url, headers=headers, json=payload, stream=True)
full_output = ""

for line in response.iter_lines():
    if line:
        line = line.decode("utf-8")
        if line.startswith("data: ") and line != "data: [DONE]":
            data = json.loads(line[6:])
            text = data.get("text", "")
            full_output += text
            print(text, end="", flush=True)

# Save to file
with open("output.md", "w") as f:
    f.write(full_output)
print(f"\\nSaved {len(full_output)} chars to output.md")`;

  const jsExample = `const response = await fetch(
  "https://hub.gaigentic.ai/api/v1/agents/${agent.slug}/run",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer ghk_YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(${sampleInput.replace(/\n\s*/g, " ")}),
  }
);

// Read the SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullOutput = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  for (const line of chunk.split("\\n")) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      const { text } = JSON.parse(line.slice(6));
      fullOutput += text;
    }
  }
}

// fullOutput now contains the complete response
console.log(fullOutput);`;

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
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to catalog
      </Link>

      {/* Hero section */}
      <div className="mb-8 rounded-lg border border-ink-100 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-3xl"
              style={{ backgroundColor: `${agent.color}12` }}
            >
              {agent.icon}
            </div>

            {/* Info */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={agent.status} />
                <AuditBadge />
                {agent.featured === 1 && (
                  <span className="tag-green">Featured</span>
                )}
              </div>
              <h1 className="text-2xl font-semibold text-ink-950 font-headline sm:text-3xl">
                {agent.name}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-ink-600 leading-relaxed">
                {agent.tagline}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                v{agent.version}
              </p>

              {/* Jurisdictions */}
              <div className="mt-3">
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
        <div className="mt-6 flex flex-wrap gap-4 border-t border-ink-100 pt-5">
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <Shield className="h-3.5 w-3.5 text-signal-green" />
            <span>Financial Compliance</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <Eye className="h-3.5 w-3.5 text-cobalt" />
            <span>Explainable Reasoning</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <Layers className="h-3.5 w-3.5 text-ink-400" />
            <span>RAG-Powered</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-0.5 border-b border-ink-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                tab === t.id
                  ? "border-ink-950 text-ink-950"
                  : "border-transparent text-ink-500 hover:text-ink-900"
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
        <div className="space-y-6">
          {/* Description */}
          <div className="card">
            <h4 className="mb-3">About this Agent</h4>
            <p className="text-sm leading-relaxed text-ink-600 whitespace-pre-wrap">
              {agent.description}
            </p>
          </div>

          {/* How It Works — visual step flow */}
          <div className="card">
            <h4 className="mb-4">How It Works</h4>
            <div className="grid gap-px sm:grid-cols-4 rounded-lg overflow-hidden border border-ink-100">
              {[
                {
                  step: "1",
                  icon: FileInput,
                  title: "Provide Input",
                  desc: "Submit data via JSON, upload documents (PDF, CSV, images), or describe your request in plain text.",
                },
                {
                  step: "2",
                  icon: Brain,
                  title: "AI Analysis",
                  desc: "The agent applies domain expertise with structured reasoning — every decision is traceable to input data.",
                },
                {
                  step: "3",
                  icon: BarChart3,
                  title: "Visual Report",
                  desc: "Get rich output with KPI dashboards, charts, tables, and detailed narrative — not just raw text.",
                },
                {
                  step: "4",
                  icon: CheckCircle2,
                  title: "Audit Trail",
                  desc: "Full reasoning trail with confidence levels, cited regulations, and assumptions — ready for compliance review.",
                },
              ].map((s) => {
                const StepIcon = s.icon;
                return (
                  <div key={s.step} className="bg-white p-4 sm:p-5 relative">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: agent.color || "#0052CC" }}
                      >
                        {s.step}
                      </div>
                      <StepIcon
                        className="h-4 w-4 shrink-0"
                        style={{ color: agent.color || "#0052CC" }}
                      />
                    </div>
                    <h4 className="text-sm font-semibold text-ink-900 mb-1 normal-case tracking-normal">
                      {s.title}
                    </h4>
                    <p className="text-xs leading-relaxed text-ink-500">
                      {s.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capabilities inline */}
          {agent.capabilities && (
            <div className="card">
              <h4 className="mb-4">What This Agent Can Do</h4>
              <CapabilityGrid
                capabilities={agent.capabilities}
                agentColor={agent.color}
              />
            </div>
          )}

          {/* Try with sample data */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4>Sample Data</h4>
              <Link
                to={`/playground/${agent.slug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-cobalt hover:text-cobalt-hover transition-colors duration-150"
              >
                Open in Playground
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2">Input</h4>
                <CodeBlock lang="json">{sampleInput}</CodeBlock>
              </div>
              <div>
                <h4 className="mb-2">Output</h4>
                <CodeBlock lang="json">{sampleOutput}</CodeBlock>
              </div>
            </div>
          </div>

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}

      {tab === "capabilities" && (
        <div className="space-y-6">
          <CapabilityGrid
            capabilities={agent.capabilities}
            agentColor={agent.color}
          />

          {!agent.capabilities && (
            <div className="card text-center py-12">
              <Layers className="mx-auto mb-3 h-8 w-8 text-ink-300" />
              <p className="text-ink-500">
                Capabilities for this agent have not been documented yet.
              </p>
              <Link
                to={`/playground/${agent.slug}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cobalt hover:text-cobalt-hover transition-colors duration-150"
              >
                <Play className="h-4 w-4" />
                Try it in the Playground to explore what it can do
              </Link>
            </div>
          )}

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-6">
          {/* Quick Start */}
          <div className="card">
            <h4 className="mb-3">Quick Start</h4>
            <ol className="mb-4 space-y-1.5 text-sm text-ink-600 list-decimal list-inside">
              <li>
                <Link to="/apikeys" className="text-cobalt hover:text-cobalt-hover font-medium">
                  Generate an API key
                </Link>{" "}from your dashboard.
              </li>
              <li>Call the agent endpoint below with your key.</li>
              <li>Parse the SSE stream to capture the full response.</li>
              <li>Store the output on your end — playground data is cleared after 7 days.</li>
            </ol>
            <CodeBlock lang="bash">{curlExample}</CodeBlock>
          </div>

          {/* Endpoint + Auth */}
          <div className="card">
            <h4 className="mb-3">Endpoint & Authentication</h4>
            <div className="rounded-lg bg-ink-50 p-3.5 font-mono text-sm mb-4">
              <span className="font-semibold text-signal-green">POST</span>{" "}
              <span className="text-ink-700">
                https://hub.gaigentic.ai/api/v1/agents/{agent.slug}/run
              </span>
            </div>
            <h4 className="mb-2">Headers</h4>
            <div className="space-y-2 rounded-lg bg-ink-50 p-3.5 text-sm font-mono text-ink-600 mb-4">
              <div>
                <span className="text-signal-amber">Authorization</span>: Bearer ghk_YOUR_KEY <span className="text-ink-400 text-xs">(required)</span>
              </div>
              <div>
                <span className="text-signal-amber">Content-Type</span>: application/json
              </div>
            </div>
            <h4 className="mb-2">Request Body</h4>
            <div className="rounded-lg bg-ink-50 p-3.5 text-sm font-mono text-ink-600">
              <div className="space-y-1.5">
                <div><span className="text-cobalt">input</span>: {`{}`} <span className="text-ink-400 text-xs">(required) — key-value pairs for the agent</span></div>
                <div><span className="text-cobalt">provider</span>: <span className="text-signal-green">"zai"</span> <span className="text-ink-400 text-xs">(optional) — "zai", "openai", or "anthropic"</span></div>
                <div><span className="text-cobalt">model</span>: <span className="text-signal-green">"string"</span> <span className="text-ink-400 text-xs">(optional) — override the default model</span></div>
                <div><span className="text-cobalt">user_api_key</span>: <span className="text-signal-green">"string"</span> <span className="text-ink-400 text-xs">(optional) — your own LLM provider key</span></div>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              API keys start with <code className="text-ink-500">ghk_</code>. Keys can be scoped to specific agents or work across all agents. If you don't provide a <code className="text-ink-500">user_api_key</code>, the shared platform key is used (subject to rate limits).
            </p>
          </div>

          {/* Response Format */}
          <div className="card">
            <h4 className="mb-3">Response Format (SSE Stream)</h4>
            <p className="mb-3 text-sm text-ink-600">
              Responses stream as <strong>Server-Sent Events</strong>. Each <code className="text-ink-700 bg-ink-50 px-1 rounded">data:</code> line contains a JSON object with a <code className="text-ink-700 bg-ink-50 px-1 rounded">text</code> field. Concatenate all text chunks to get the complete output.
            </p>
            <CodeBlock lang="bash">{`event: token
data: {"text":"# Financial Analysis\\n\\n"}

event: token
data: {"text":"## 1. Executive Summary\\n"}

event: token
data: {"text":"Revenue increased 12% YoY..."}

event: done
data: {"text":""}`}</CodeBlock>

            <h4 className="mt-4 mb-2">Response Headers</h4>
            <div className="rounded-lg bg-ink-50 p-3.5 text-sm font-mono text-ink-600">
              <div className="space-y-1.5">
                <div><span className="text-signal-amber">X-Audit-Log-Id</span> <span className="text-ink-400 text-xs">— unique ID for this execution (use for feedback)</span></div>
                <div><span className="text-signal-amber">X-Using-Shared-Key</span> <span className="text-ink-400 text-xs">— "true" if no custom LLM key was provided</span></div>
                <div><span className="text-signal-amber">X-Fallback-Provider</span> <span className="text-ink-400 text-xs">— set if primary LLM failed, shows fallback used</span></div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-signal-amber/20 bg-signal-amber-light px-3.5 py-2.5">
              <p className="text-xs text-ink-600">
                <strong className="text-signal-amber">Important:</strong> Responses are not stored permanently. Capture and save the output during streaming. Use the Playground's "Copy Raw" or "Download" buttons for quick testing, or parse the stream programmatically for production use.
              </p>
            </div>
          </div>

          {/* Code Examples */}
          <div className="card">
            <h4 className="mb-3">Capture & Save Output</h4>
            <p className="mb-4 text-sm text-ink-600">
              Parse the SSE stream, concatenate the text, and store it however you need — database, file, or downstream API.
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="mb-2">Python</h4>
                <CodeBlock lang="python">{pythonExample}</CodeBlock>
              </div>
              <div>
                <h4 className="mb-2">JavaScript / Node.js</h4>
                <CodeBlock lang="javascript">{jsExample}</CodeBlock>
              </div>
              <div>
                <h4 className="mb-2">cURL (save to file)</h4>
                <CodeBlock lang="bash">{curlSaveExample}</CodeBlock>
              </div>
            </div>
          </div>

          {/* Document Upload */}
          <div className="card">
            <h4 className="mb-3">Document Upload</h4>
            <p className="mb-3 text-sm text-ink-600">
              You can upload PDFs, images, and CSVs for AI-powered analysis. Documents are processed with OCR (for scanned files) and text extraction, then fed to the agent as context.
            </p>
            <div className="rounded-lg bg-ink-50 p-3.5 text-sm text-ink-600 space-y-2">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                <span><strong>Via Playground:</strong> Drag & drop files in the file upload area, then click Execute. Supports PDF, PNG, JPEG, WebP, CSV.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                <span><strong>Via API:</strong> Include document content directly in your <code className="text-ink-700 bg-ink-100 px-1 rounded">input</code> JSON. Pre-extract text from your files and pass it as a field value.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                <span><strong>Max files:</strong> 5 per execution. Scanned PDFs use Tesseract OCR (first 5 pages). Uploaded documents are deleted after 7 days.</span>
              </div>
            </div>
          </div>

          {/* Error Handling */}
          <div className="card">
            <h4 className="mb-3">Error Handling</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100">
                    <th className="py-2 pr-4 text-left font-medium text-ink-500">Status</th>
                    <th className="py-2 pr-4 text-left font-medium text-ink-500">Meaning</th>
                    <th className="py-2 text-left font-medium text-ink-500">Action</th>
                  </tr>
                </thead>
                <tbody className="text-ink-600">
                  <tr className="border-b border-ink-50">
                    <td className="py-2 pr-4 font-mono text-signal-red">401</td>
                    <td className="py-2 pr-4">Missing or invalid API key</td>
                    <td className="py-2">Check your <code className="text-ink-700 bg-ink-50 px-1 rounded">Authorization</code> header</td>
                  </tr>
                  <tr className="border-b border-ink-50">
                    <td className="py-2 pr-4 font-mono text-signal-red">403</td>
                    <td className="py-2 pr-4">Key not authorized for this agent</td>
                    <td className="py-2">Use a key scoped to this agent or a global key</td>
                  </tr>
                  <tr className="border-b border-ink-50">
                    <td className="py-2 pr-4 font-mono text-signal-amber">429</td>
                    <td className="py-2 pr-4">Rate limit exceeded</td>
                    <td className="py-2">Wait and retry — or contact us for higher limits</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-signal-red">500</td>
                    <td className="py-2 pr-4">Server error</td>
                    <td className="py-2">Retry with exponential backoff</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Errors during streaming arrive as <code className="text-ink-500">event: error</code> SSE events with a JSON <code className="text-ink-500">error</code> field.
            </p>
          </div>

          {/* Rate Limits & Data Retention */}
          <div className="card">
            <h4 className="mb-3">Limits & Data Retention</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-ink-50 p-3.5">
                <h4 className="text-sm font-medium text-ink-700 mb-2 normal-case tracking-normal">Rate Limits</h4>
                <ul className="space-y-1 text-xs text-ink-500">
                  <li>Free tier: 60 requests per minute</li>
                  <li>Max request body: 10MB</li>
                  <li>Max response: ~4,000 tokens</li>
                </ul>
              </div>
              <div className="rounded-lg bg-ink-50 p-3.5">
                <h4 className="text-sm font-medium text-ink-700 mb-2 normal-case tracking-normal">Data Retention</h4>
                <ul className="space-y-1 text-xs text-ink-500">
                  <li>Playground data: cleared after 7 days</li>
                  <li>Uploaded documents: deleted after 7 days</li>
                  <li>API responses: not stored — capture during streaming</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact CTA */}
          <ContactCTA agentColor={agent.color} />
        </div>
      )}
    </div>
  );
}

import { Terminal, Key, Play, ShieldCheck, ArrowRight, Code } from "lucide-react";
import { Link } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import CodeBlock from "../components/CodeBlock";

export default function Docs() {
    return (
        <PageTransition>
            <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-ink-950 font-headline">API Documentation</h1>
                    <p className="mt-2 text-ink-500 text-lg">
                        Integrate GaiGentic's production-ready Fintech AI agents directly into your workflows.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Section 1: Authentication */}
                    <section className="card">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cobalt-light text-cobalt">
                                <Key className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-ink-900 font-headline m-0">Authentication</h2>
                        </div>
                        <p className="mb-4 text-ink-600 leading-relaxed">
                            All API requests must be authenticated using a Bearer token in the <code className="bg-ink-50 px-1 rounded text-ink-700">Authorization</code> header.
                            You can generate an API key from your <Link to="/dashboard" className="text-cta hover:underline">Dashboard</Link>.
                        </p>
                        <CodeBlock lang="bash">{`# Example Request
curl -X GET https://hub.gaigentic.ai/api/v1/agents \\
  -H "Authorization: Bearer ghk_YOUR_API_KEY"`}</CodeBlock>
                    </section>

                    {/* Section 2: Executing Agents */}
                    <section className="card">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal-green-light text-signal-green">
                                <Play className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-ink-900 font-headline m-0">Executing Agents</h2>
                        </div>
                        <p className="mb-4 text-ink-600 leading-relaxed">
                            Agent execution endpoints return a <strong>Server-Sent Events (SSE) stream</strong> to provide real-time reasoning and output chunks.
                            For full examples, navigate to any <Link to="/agents" className="text-cta hover:underline">Agent Definition</Link> and check the "API" tab.
                        </p>

                        <div className="bg-ink-50 rounded-lg p-4 mb-4 border border-ink-100">
                            <div className="font-mono text-sm mb-2">
                                <span className="font-semibold text-signal-green">POST</span> <span className="text-ink-700">/api/v1/agents/&#123;agent_slug&#125;/run</span>
                            </div>
                            <div className="text-sm text-ink-500 mb-3">Executes an agent with the provided input payload.</div>
                            <CodeBlock lang="json">{`// Request Body Payload
{
  "input": {
    "key": "value",
    "transaction_id": "123"
  },
  "provider": "zai" // Optional: "zai", "openai", "anthropic"
}`}</CodeBlock>
                        </div>

                        <div className="rounded-lg border border-signal-amber/20 bg-signal-amber-light px-4 py-3 text-sm text-ink-800 flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-signal-amber shrink-0 mt-0.5" />
                            <div>
                                <strong>Data Privacy:</strong> API execution queries are completely ephemeral unless otherwise agreed under an Enterprise BAA. Playgrounds requests are purged after 7 days.
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Webhooks & Streaming */}
                    <section className="card">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                <Terminal className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-semibold text-ink-900 font-headline m-0">Handling the Stream</h2>
                        </div>
                        <p className="mb-4 text-ink-600 leading-relaxed">
                            Because financial agents often run complex tool calls (RAG checks, rule validation, DB lookups), responses are not instantaneous.
                            We emit <code>event: token</code> chunks as they are generated. Once the agent is done, we emit an <code>event: done</code> signal.
                        </p>
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-ink-100">
                            <Link to="/playground" className="btn-primary text-sm">
                                Open Playground <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </PageTransition>
    );
}

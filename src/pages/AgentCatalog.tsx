import { useEffect, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import type { Agent, AgentCategory } from "../types";
import { getAgents } from "../services/api";
import AgentCard from "../components/AgentCard";
import FeaturedAgent from "../components/FeaturedAgent";
import AgentSearch from "../components/AgentSearch";

const CATEGORIES: Array<{ id: AgentCategory | ""; label: string; icon: string }> = [
  { id: "", label: "All Agents", icon: "🏠" },
  { id: "compliance", label: "Compliance", icon: "🛡️" },
  { id: "underwriting", label: "Underwriting", icon: "📋" },
  { id: "credit", label: "Credit", icon: "💳" },
  { id: "collections", label: "Collections", icon: "💰" },
  { id: "intelligence", label: "Intelligence", icon: "🧠" },
  { id: "disputes", label: "Disputes", icon: "⚖️" },
  { id: "identity", label: "Identity", icon: "🪪" },
  { id: "payments", label: "Payments", icon: "💸" },
  { id: "lending", label: "Lending", icon: "🏦" },
  { id: "infrastructure", label: "Infrastructure", icon: "⚙️" },
];

export default function AgentCatalog() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AgentCategory | "">("");

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featured = agents.filter((a) => a.featured === 1);
  const filtered = agents.filter((a) => {
    if (category && a.category !== category) return false;
    return true;
  });

  // Group by category for the App Store sections
  const categorized = CATEGORIES.filter((c) => c.id !== "").reduce(
    (acc, cat) => {
      const catAgents = agents.filter((a) => a.category === cat.id);
      if (catAgents.length > 0) {
        acc.push({ ...cat, agents: catAgents });
      }
      return acc;
    },
    [] as Array<{ id: string; label: string; icon: string; agents: Agent[] }>,
  );

  return (
    <div>
      {/* Hero section */}
      <div className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4 py-1.5 text-sm font-medium text-purple-700">
          <Sparkles className="h-4 w-4" />
          AI Agents for Financial Services
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-gray-900 font-headline sm:text-5xl">
          Find the right agent for your workflow
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-gray-500">
          Browse, test, and integrate production-grade AI agents. Every agent is
          auditable, explainable, and built for compliance.
        </p>
      </div>

      {/* AI Search */}
      <div className="mb-12">
        <AgentSearch />
      </div>

      {/* Featured Agent */}
      {!loading && featured.length > 0 && !category && (
        <div className="mb-12">
          <FeaturedAgent agent={featured[0]} />
        </div>
      )}

      {/* Category pills */}
      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id as AgentCategory | "")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              category === cat.id
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <span className="text-sm">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="mb-4 h-12 w-12 rounded-xl bg-gray-100" />
              <div className="mb-2 h-5 w-32 rounded bg-gray-100" />
              <div className="mb-4 h-4 w-full rounded bg-gray-100" />
              <div className="h-6 w-20 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ) : category ? (
        /* Filtered grid when category selected */
        filtered.length === 0 ? (
          <div className="card text-center py-16">
            <Bot className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-500">No agents in this category yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )
      ) : (
        /* App Store sections when no category filter */
        <div className="space-y-12">
          {categorized.map((section) => (
            <div key={section.id}>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl">{section.icon}</span>
                <h2 className="text-xl font-bold text-gray-900 font-headline">
                  {section.label}
                </h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  {section.agents.length}
                </span>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {section.agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          ))}

          {categorized.length === 0 && (
            <div className="card text-center py-16">
              <Bot className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="text-gray-500">
                No agents available yet. The first one is coming soon!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

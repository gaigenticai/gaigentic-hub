import { useEffect, useState, useMemo } from "react";
import { Bot, AlertCircle } from "lucide-react";
import type { Agent } from "../types";
import { getAgents } from "../services/api";
import AgentCard from "../components/AgentCard";
import FeaturedAgent from "../components/FeaturedAgent";
import AgentSearch from "../components/AgentSearch";

export default function AgentCatalog() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState("");

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load agents");
      })
      .finally(() => setLoading(false));
  }, []);

  // Derive categories dynamically from agents
  const categories = useMemo(() => {
    const unique = [...new Set(agents.map((a) => a.category).filter(Boolean))].sort();
    return [
      { id: "", label: "All Agents" },
      ...unique.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })),
    ];
  }, [agents]);

  const featured = agents.filter((a) => a.featured === 1);
  const filtered = agents.filter((a) => {
    if (category && a.category !== category) return false;
    return true;
  });

  // Group by category for sections
  const categorized = categories.filter((c) => c.id !== "").reduce(
    (acc, cat) => {
      const catAgents = agents.filter((a) => a.category === cat.id);
      if (catAgents.length > 0) {
        acc.push({ ...cat, agents: catAgents });
      }
      return acc;
    },
    [] as Array<{ id: string; label: string; agents: Agent[] }>,
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-ink-950 font-headline">
          Agent Catalog
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-500">
          Browse, test, and integrate production-grade AI agents. Every agent is
          auditable, explainable, and built for compliance.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <AgentSearch />
      </div>

      {/* Featured Agent */}
      {!loading && featured.length > 0 && !category && (
        <div className="mb-8">
          <FeaturedAgent agent={featured[0]} />
        </div>
      )}

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              category === cat.id
                ? "bg-ink-950 text-white"
                : "bg-white text-ink-600 border border-ink-200 hover:border-ink-300"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="mb-3 h-10 w-10 rounded-lg bg-ink-50" />
              <div className="mb-2 h-4 w-32 rounded bg-ink-50" />
              <div className="mb-4 h-3 w-full rounded bg-ink-50" />
              <div className="h-5 w-20 rounded-md bg-ink-50" />
            </div>
          ))}
        </div>
      ) : category ? (
        /* Filtered grid when category selected */
        filtered.length === 0 ? (
          <div className="card text-center py-16">
            <Bot className="mx-auto mb-3 h-8 w-8 text-ink-300" />
            <p className="text-ink-500">No agents in this category yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )
      ) : (
        /* Sections when no category filter */
        <div className="space-y-10">
          {categorized.map((section) => (
            <div key={section.id}>
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  {section.label}
                </h4>
                <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                  {section.agents.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          ))}

          {categorized.length === 0 && !loadError && (
            <div className="card text-center py-16">
              <Bot className="mx-auto mb-3 h-8 w-8 text-ink-300" />
              <p className="text-ink-500">
                No agents available yet. Check back later or contact us to learn more.
              </p>
            </div>
          )}
          {loadError && (
            <div className="flex items-start gap-2 rounded-lg border border-signal-red/20 bg-signal-red-light px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal-red" />
              <p className="text-sm text-signal-red">{loadError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Agent } from "../types";
import { getAgents } from "../services/api";
import AgentCard from "../components/AgentCard";

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "underwriting", label: "Underwriting" },
  { id: "compliance", label: "Compliance" },
  { id: "collections", label: "Collections" },
  { id: "credit", label: "Credit" },
  { id: "intelligence", label: "Intelligence" },
  { id: "disputes", label: "Disputes" },
  { id: "identity", label: "Identity" },
  { id: "infrastructure", label: "Infrastructure" },
];

export default function AgentCatalog() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = agents.filter((a) => {
    if (category && a.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agent Catalog</h1>
        <p className="mt-2 text-gray-600">
          Browse and test production-grade AI agents for financial services.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              category === cat.id
                ? "bg-purple-600 text-gray-900"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
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
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">
            {agents.length === 0
              ? "No agents available yet. Check back soon!"
              : "No agents match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

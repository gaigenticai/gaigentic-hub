import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Agent } from "../types";
import { searchAgents } from "../services/api";

export default function AgentSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const agents = await searchAgents(query);
        setResults(agents);
        setOpen(agents.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="What do you need help with? e.g. 'GST compliance', 'invoice processing'"
          className="w-full rounded-2xl border border-gray-200 bg-white py-4 pl-12 pr-12 text-base text-gray-900 placeholder-gray-400 shadow-lg transition-all focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:shadow-xl"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-12 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {results.map((agent) => (
            <button
              key={agent.id}
              onClick={() => {
                navigate(`/agents/${agent.slug}`);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                style={{
                  backgroundColor: `${agent.color}15`,
                }}
              >
                {agent.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {agent.name}
                </p>
                <p className="truncate text-xs text-gray-500">{agent.tagline}</p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-medium capitalize text-gray-500">
                {agent.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

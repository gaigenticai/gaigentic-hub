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
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="What do you need help with? e.g. 'GST compliance', 'invoice processing'"
          className="input pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg animate-slide-up">
          {results.map((agent) => (
            <button
              key={agent.id}
              onClick={() => {
                navigate(`/agents/${agent.slug}`);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-ink-50"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{
                  backgroundColor: `${agent.color}12`,
                }}
              >
                {agent.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {agent.name}
                </p>
                <p className="truncate text-xs text-ink-500">{agent.tagline}</p>
              </div>
              <span className="shrink-0 rounded-md border border-ink-200 px-2 py-0.5 text-[10px] font-medium capitalize text-ink-500">
                {agent.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

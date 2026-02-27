import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Agent } from "../types";
import StatusBadge from "./StatusBadge";

const CATEGORY_COLORS: Record<string, string> = {
  underwriting: "bg-cobalt-light text-cobalt border-cobalt/15",
  compliance: "bg-signal-green-light text-signal-green border-signal-green/15",
  collections: "bg-signal-amber-light text-signal-amber border-signal-amber/15",
  credit: "bg-ink-50 text-ink-700 border-ink-200",
  infrastructure: "bg-ink-50 text-ink-500 border-ink-200",
  intelligence: "bg-cobalt-light text-cobalt border-cobalt/15",
  disputes: "bg-signal-red-light text-signal-red border-signal-red/15",
  identity: "bg-ink-50 text-ink-700 border-ink-200",
  payments: "bg-signal-amber-light text-signal-amber border-signal-amber/15",
  lending: "bg-cta-light text-cta border-cta/15",
};

export default function AgentCard({ agent }: { agent: Agent }) {
  const categoryClass =
    CATEGORY_COLORS[agent.category] ||
    "bg-ink-50 text-ink-600 border-ink-200";

  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group card-interactive flex flex-col"
    >
      <div className="mb-3 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
          style={{ backgroundColor: `${agent.color}12`, color: agent.color }}
        >
          {agent.icon}
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <h3 className="mb-1 text-sm font-semibold text-ink-900 group-hover:text-ink-950 transition-colors duration-150">
        {agent.name}
      </h3>
      <p className="mb-4 flex-1 text-sm text-ink-500 line-clamp-2">
        {agent.tagline}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${categoryClass}`}
        >
          {agent.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-400 group-hover:text-cta transition-colors duration-150">
          Explore
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

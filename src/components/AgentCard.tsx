import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Agent } from "../types";
import StatusBadge from "./StatusBadge";

const CATEGORY_COLORS: Record<string, string> = {
  underwriting: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  compliance: "bg-emerald-100 text-emerald-600 border-emerald-500/20",
  collections: "bg-amber-100 text-amber-600 border-amber-500/20",
  credit: "bg-purple-100 text-purple-600 border-purple-500/20",
  infrastructure: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  intelligence: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  disputes: "bg-red-500/10 text-red-600 border-red-500/20",
  identity: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  payments: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  lending: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function AgentCard({ agent }: { agent: Agent }) {
  const categoryClass =
    CATEGORY_COLORS[agent.category] ||
    "bg-gray-100/50 text-gray-600 border-gray-200";

  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group card flex flex-col transition-all hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5"
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
        >
          {agent.icon}
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <h3 className="mb-1 text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
        {agent.name}
      </h3>
      <p className="mb-4 flex-1 text-sm text-gray-600 line-clamp-2">
        {agent.tagline}
      </p>

      <div className="flex items-center justify-between">
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${categoryClass}`}
        >
          {agent.category}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-purple-600 transition-colors">
          Explore
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

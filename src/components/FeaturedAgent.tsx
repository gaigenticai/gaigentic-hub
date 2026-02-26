import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Agent } from "../types";
import AuditBadge from "./AuditBadge";
import JurisdictionPills from "./JurisdictionPills";

interface Props {
  agent: Agent;
}

export default function FeaturedAgent({ agent }: Props) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          background: `radial-gradient(ellipse at top right, ${agent.color}, transparent 70%), radial-gradient(ellipse at bottom left, ${agent.color}, transparent 70%)`,
        }}
      />

      {/* Floating orb */}
      <div
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-10 animate-float"
        style={{ backgroundColor: agent.color }}
      />

      <div className="relative flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
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

        {/* Content */}
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              <Sparkles className="h-3 w-3" />
              Featured
            </span>
            <AuditBadge />
          </div>
          <h2 className="mb-1 text-2xl font-bold text-gray-900 font-headline sm:text-3xl">
            {agent.name}
          </h2>
          <p className="mb-4 max-w-xl text-gray-600 leading-relaxed">
            {agent.tagline}
          </p>
          <div className="mb-5">
            <JurisdictionPills jurisdictions={agent.jurisdictions} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/playground/${agent.slug}`}
              className="btn-primary"
            >
              Try it Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/agents/${agent.slug}`}
              className="btn-secondary"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

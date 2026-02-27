import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Agent } from "../types";
import AuditBadge from "./AuditBadge";
import JurisdictionPills from "./JurisdictionPills";

interface Props {
  agent: Agent;
}

export default function FeaturedAgent({ agent }: Props) {
  return (
    <div className="rounded-lg border border-ink-100 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Icon */}
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-3xl"
          style={{ backgroundColor: `${agent.color}12` }}
        >
          {agent.icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="tag-green">Featured</span>
            <AuditBadge />
          </div>
          <h2 className="mb-1 text-xl font-semibold text-ink-950 font-headline sm:text-2xl">
            {agent.name}
          </h2>
          <p className="mb-4 max-w-xl text-sm text-ink-600 leading-relaxed">
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

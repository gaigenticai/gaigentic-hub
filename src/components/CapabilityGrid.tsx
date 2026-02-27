import {
  Calculator,
  TrendingUp,
  Receipt,
  FileText,
  HeartPulse,
  Brain,
  Shield,
  Zap,
  Search,
  BarChart3,
  Target,
  Globe,
  Tag,
  type LucideIcon,
} from "lucide-react";
import type { AgentCapability } from "../types";

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  TrendingUp,
  Receipt,
  FileText,
  HeartPulse,
  Brain,
  Shield,
  Zap,
  Search,
  BarChart3,
  Target,
  Globe,
  Tag,
};

interface Props {
  capabilities: string | null;
  agentColor?: string;
}

export default function CapabilityGrid({ capabilities, agentColor }: Props) {
  if (!capabilities) return null;

  let items: AgentCapability[] = [];
  try {
    items = JSON.parse(capabilities);
  } catch {
    return null;
  }

  if (items.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((cap, i) => {
        const Icon = ICON_MAP[cap.icon] || Zap;
        return (
          <div
            key={i}
            className="rounded-lg border border-ink-100 bg-white p-5"
          >
            <div
              className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                backgroundColor: agentColor ? `${agentColor}12` : "#F4F4F6",
                color: agentColor || "#6B6B78",
              }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>
            <h4 className="mb-1 text-sm font-semibold text-ink-900 normal-case tracking-normal">
              {cap.title}
            </h4>
            <p className="text-xs leading-relaxed text-ink-500">
              {cap.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}

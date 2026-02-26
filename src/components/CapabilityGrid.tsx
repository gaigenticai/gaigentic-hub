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
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            {/* Subtle color accent on hover */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: agentColor
                  ? `linear-gradient(135deg, ${agentColor}08, ${agentColor}04)`
                  : undefined,
              }}
            />
            <div className="relative">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: agentColor ? `${agentColor}15` : "#f3f4f6",
                  color: agentColor || "#6b7280",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h4 className="mb-1 text-sm font-semibold text-gray-900">
                {cap.title}
              </h4>
              <p className="text-xs leading-relaxed text-gray-500">
                {cap.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

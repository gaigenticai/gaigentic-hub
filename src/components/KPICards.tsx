import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIConfig } from "../types";

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: "text-signal-green" },
  down: { icon: TrendingDown, color: "text-signal-red" },
  stable: { icon: Minus, color: "text-ink-500" },
};

export default function KPICards({ config }: { config: KPIConfig }) {
  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {config.metrics.map((metric, i) => {
        const trend = TREND_CONFIG[metric.trend || "stable"];
        const TrendIcon = trend.icon;

        return (
          <div key={i} className="rounded-lg border border-ink-100 bg-white p-3">
            <p className="text-[11px] font-medium text-ink-500 uppercase tracking-widest leading-tight">
              {metric.label}
            </p>
            <p className="mt-1 text-base font-semibold font-mono tabular-nums text-ink-950 break-words leading-tight">
              {metric.value}
            </p>
            {metric.change && (
              <div className={`mt-0.5 flex items-center gap-1 text-[10px] ${trend.color}`}>
                <TrendIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{metric.change}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

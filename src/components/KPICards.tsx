import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Info, X } from "lucide-react";
import type { KPIConfig } from "../types";

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: "text-signal-green" },
  down: { icon: TrendingDown, color: "text-signal-red" },
  stable: { icon: Minus, color: "text-ink-500" },
};

export default function KPICards({ config }: { config: KPIConfig }) {
  const [openTooltip, setOpenTooltip] = useState<number | null>(null);

  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {config.metrics.map((metric, i) => {
        const trend = TREND_CONFIG[metric.trend || "stable"];
        const TrendIcon = trend.icon;
        const isOpen = openTooltip === i;

        return (
          <div key={i} className="relative rounded-lg border border-ink-100 bg-white p-3">
            {/* Info icon — top right */}
            {metric.description && (
              <button
                onClick={() => setOpenTooltip(isOpen ? null : i)}
                className="absolute top-2 right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full text-ink-300 hover:text-ink-500 hover:bg-ink-50 transition-colors duration-150"
                title="How is this calculated?"
              >
                <Info className="h-3 w-3" />
              </button>
            )}

            {/* Tooltip popover */}
            {isOpen && metric.description && (
              <div className="absolute top-0 right-0 z-20 w-64 -translate-y-full -mt-1.5 rounded-lg border border-ink-100 bg-white p-3 shadow-lg">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[11px] font-semibold text-ink-700 uppercase tracking-wide">
                    {metric.label}
                  </p>
                  <button
                    onClick={() => setOpenTooltip(null)}
                    className="shrink-0 text-ink-300 hover:text-ink-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  {metric.description}
                </p>
                {/* Arrow */}
                <div className="absolute bottom-0 right-3 translate-y-full">
                  <div className="h-2 w-2 rotate-45 border-r border-b border-ink-100 bg-white" />
                </div>
              </div>
            )}

            <p className="text-[11px] font-medium text-ink-500 uppercase tracking-widest leading-tight pr-5">
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

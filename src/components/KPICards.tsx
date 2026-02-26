import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIConfig } from "../types";

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: "text-emerald-600" },
  down: { icon: TrendingDown, color: "text-red-600" },
  stable: { icon: Minus, color: "text-gray-600" },
};

export default function KPICards({ config }: { config: KPIConfig }) {
  return (
    <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {config.metrics.map((metric, i) => {
        const trend = TREND_CONFIG[metric.trend || "stable"];
        const TrendIcon = trend.icon;

        return (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="truncate text-[11px] font-medium text-gray-500">
              {metric.label}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-gray-900">
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

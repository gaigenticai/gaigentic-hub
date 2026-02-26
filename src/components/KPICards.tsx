import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPIConfig } from "../types";

const TREND_CONFIG = {
  up: { icon: TrendingUp, color: "text-emerald-600" },
  down: { icon: TrendingDown, color: "text-red-600" },
  stable: { icon: Minus, color: "text-gray-600" },
};

export default function KPICards({ config }: { config: KPIConfig }) {
  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {config.metrics.map((metric, i) => {
        const trend = TREND_CONFIG[metric.trend || "stable"];
        const TrendIcon = trend.icon;

        return (
          <div key={i} className="card">
            <p className="text-xs font-medium text-gray-600">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {metric.value}
            </p>
            {metric.change && (
              <div className={`mt-1 flex items-center gap-1 text-xs ${trend.color}`}>
                <TrendIcon className="h-3 w-3" />
                {metric.change}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

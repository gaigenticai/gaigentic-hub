import type { VisualBlock, ChartConfig, TableConfig, KPIConfig } from "../types";
import ChartRenderer from "./ChartRenderer";
import TableRenderer from "./TableRenderer";
import KPICards from "./KPICards";

interface ResponseViewerProps {
  blocks: VisualBlock[];
  isStreaming: boolean;
}

export default function ResponseViewer({
  blocks,
  isStreaming,
}: ResponseViewerProps) {
  if (blocks.length === 0 && !isStreaming) return null;

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div
                key={i}
                className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600"
              >
                {block.content as string}
              </div>
            );
          case "chart":
            return <ChartRenderer key={i} config={block.content as ChartConfig} />;
          case "table":
            return <TableRenderer key={i} config={block.content as TableConfig} />;
          case "kpi":
            return <KPICards key={i} config={block.content as KPIConfig} />;
          default:
            return null;
        }
      })}
      {isStreaming && (
        <span className="inline-block h-4 w-2 animate-pulse bg-brand-400" />
      )}
    </div>
  );
}

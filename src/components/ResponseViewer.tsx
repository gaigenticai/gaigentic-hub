import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
    <div className="space-y-4 overflow-x-auto">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i} className="prose prose-sm max-w-none text-ink-700
                prose-headings:text-ink-900 prose-headings:font-semibold prose-headings:tracking-tight
                prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-ink-100
                prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2
                prose-h4:text-sm prose-h4:mt-4 prose-h4:mb-1
                prose-p:leading-relaxed prose-p:my-2
                prose-strong:text-ink-800 prose-strong:font-semibold
                prose-code:text-xs prose-code:font-mono prose-code:bg-ink-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-ink-700 prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-ink-900 prose-pre:text-ink-100 prose-pre:rounded-lg prose-pre:text-xs prose-pre:leading-relaxed prose-pre:my-3
                prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:leading-relaxed
                prose-table:text-xs prose-th:bg-ink-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-ink-700 prose-td:px-3 prose-td:py-1.5 prose-td:border-t prose-td:border-ink-100
                prose-blockquote:border-l-cta prose-blockquote:bg-cta/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                prose-hr:border-ink-100 prose-hr:my-6
                prose-a:text-cta prose-a:no-underline hover:prose-a:underline
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {block.content as string}
                </ReactMarkdown>
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
        <span className="inline-block h-4 w-2 animate-pulse bg-cta" />
      )}
    </div>
  );
}

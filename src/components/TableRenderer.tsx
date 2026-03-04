import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { TableConfig } from "../types";

export default function TableRenderer({ config }: { config: TableConfig }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  if (!config || typeof config !== 'object' || !Array.isArray((config as any).rows) || !Array.isArray((config as any).columns)) {
    return null;
  }

  const handleSort = (key: string) => {
    if (sortCol === key) {
      if (sortDesc) {
        setSortCol(null);
        setSortDesc(false);
      } else {
        setSortDesc(true);
      }
    } else {
      setSortCol(key);
      setSortDesc(false);
    }
  };

  const sortedRows = [...config.rows].sort((a, b) => {
    if (!sortCol) return 0;
    const aVal = a[sortCol];
    const bVal = b[sortCol];
    if (aVal === bVal) return 0;
    const isGreater = aVal > bVal ? 1 : -1;
    return sortDesc ? -isGreater : isGreater;
  });

  return (
    <div className="card my-4 overflow-hidden p-0 sm:p-0">
      <div className="p-4 sm:p-5 border-b border-ink-100 flex items-center justify-between bg-ink-50/50">
        <h4 className="m-0 text-ink-900 font-semibold normal-case tracking-normal">{config.title || "Data Table"}</h4>
        <span className="text-[10px] font-mono text-ink-500 bg-white px-2 py-1 rounded-md border border-ink-200 uppercase tracking-widest">{config.rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-white">
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-ink-500 cursor-pointer hover:bg-ink-50 transition-colors select-none group"
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <span className="text-ink-300 group-hover:text-ink-400 transition-colors">
                      {sortCol === col.key ? (
                        sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-ink-100 hover:bg-ink-50/50 transition-colors duration-150 bg-white"
              >
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink-700 whitespace-nowrap">
                    {String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={config.columns.length} className="px-4 py-8 text-center text-ink-500 text-sm bg-white">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

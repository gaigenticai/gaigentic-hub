import type { TableConfig } from "../types";

export default function TableRenderer({ config }: { config: TableConfig }) {
  return (
    <div className="card my-4 overflow-hidden">
      {config.title && (
        <h4 className="mb-4">{config.title}</h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100">
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-ink-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-ink-100 hover:bg-ink-25 transition-colors duration-150"
              >
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink-600">
                    {String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

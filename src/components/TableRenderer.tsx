import type { TableConfig } from "../types";

export default function TableRenderer({ config }: { config: TableConfig }) {
  return (
    <div className="card my-4 overflow-hidden">
      {config.title && (
        <h4 className="mb-4 text-sm font-semibold text-gray-900">
          {config.title}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
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
                className="border-b border-gray-200 hover:bg-gray-100/30 transition-colors"
              >
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-600">
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

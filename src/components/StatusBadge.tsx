const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  active: { dot: "bg-emerald-400", text: "text-emerald-600", bg: "bg-emerald-400/10" },
  maintenance: { dot: "bg-amber-400", text: "text-amber-600", bg: "bg-amber-400/10" },
  coming_soon: { dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-400/10" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const label = status === "coming_soon" ? "Coming Soon" : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

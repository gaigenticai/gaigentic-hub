const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  active: { dot: "bg-signal-green", text: "text-signal-green", bg: "bg-signal-green-light" },
  maintenance: { dot: "bg-signal-amber", text: "text-signal-amber", bg: "bg-signal-amber-light" },
  coming_soon: { dot: "bg-cobalt", text: "text-cobalt", bg: "bg-cobalt-light" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const label = status === "coming_soon" ? "Coming Soon" : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

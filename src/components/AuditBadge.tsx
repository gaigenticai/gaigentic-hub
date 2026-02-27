import { ShieldCheck } from "lucide-react";

export default function AuditBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border border-signal-green/20 bg-signal-green-light px-2.5 py-1 text-xs font-medium text-signal-green ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Auditable & Explainable
    </div>
  );
}

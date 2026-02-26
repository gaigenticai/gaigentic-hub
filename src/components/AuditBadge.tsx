import { ShieldCheck } from "lucide-react";

export default function AuditBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ${className}`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Auditable & Explainable
    </div>
  );
}

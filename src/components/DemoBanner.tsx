import { Info } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
      <p className="text-xs leading-relaxed text-amber-800">
        <span className="font-semibold">Live demo environment</span> — This system uses open-source AI models and external APIs that may occasionally be slow or unavailable. If you experience any issues, simply retry.
        For a tailored walkthrough with full reliability,{" "}
        <a
          href="https://calendly.com/krishnagai"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2 hover:text-amber-950"
        >
          request a personal demo
        </a>.
      </p>
    </div>
  );
}

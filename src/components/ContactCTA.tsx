import { useEffect, useRef } from "react";
import { Calendar } from "lucide-react";

const CHAOSBIRD_CODE = "3529a4556f2a4d70a38c042978c7c867";

interface Props {
  agentColor?: string;
  compact?: boolean;
}

function ChaosbirdEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if script already loaded globally
    const existingScript = document.querySelector(
      'script[src="https://chaosbird.app/embed.js"]',
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://chaosbird.app/embed.js";
    script.setAttribute("data-code", CHAOSBIRD_CODE);
    script.setAttribute("data-theme", "dark");
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return <div ref={containerRef} />;
}

export default function ContactCTA({ agentColor, compact = false }: Props) {
  if (compact) {
    return (
      <div className="space-y-2">
        <ChaosbirdEmbed />
        <a
          href="https://calendly.com/krishnagai"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-all hover:border-blue-300 hover:shadow-sm"
        >
          <Calendar className="h-3.5 w-3.5 text-blue-500" />
          Book a Demo
        </a>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6"
      style={
        agentColor
          ? {
              borderColor: `${agentColor}30`,
              background: `linear-gradient(135deg, white, ${agentColor}08)`,
            }
          : undefined
      }
    >
      <h3 className="mb-1 text-lg font-semibold text-gray-900 font-headline">
        Questions about this agent?
      </h3>
      <p className="mb-5 text-sm text-gray-500">
        Chat with Krishna directly or book a demo to discuss your use case.
      </p>
      <div className="mb-4">
        <ChaosbirdEmbed />
      </div>
      <a
        href="https://calendly.com/krishnagai"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:shadow-lg"
      >
        <Calendar className="h-4 w-4" />
        Book a Demo
      </a>
    </div>
  );
}

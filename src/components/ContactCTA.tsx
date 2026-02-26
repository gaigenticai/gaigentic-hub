import { MessageCircle, Calendar } from "lucide-react";

interface Props {
  agentColor?: string;
  compact?: boolean;
}

export default function ContactCTA({ agentColor, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href="https://chaosbird.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-all hover:border-purple-300 hover:shadow-sm"
        >
          <MessageCircle className="h-3.5 w-3.5 text-purple-500" />
          Chat with Krishna
        </a>
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
      <div className="flex flex-wrap gap-3">
        <a
          href="https://chaosbird.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 hover:shadow-lg"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with Krishna
        </a>
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
    </div>
  );
}

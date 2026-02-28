/**
 * Regulatory Lookup Tool — Look up regulation rules by jurisdiction.
 * Uses RAG to find specific regulatory references.
 */

import type { ToolDefinition } from "./types";
import { queryKnowledge } from "../rag";

export const regulatoryLookupTool: ToolDefinition = {
  name: "regulatory_lookup",
  description:
    "Look up specific regulations, compliance rules, and legal requirements by jurisdiction (US, EU, India). Use this for time limits, filing requirements, consumer protection rules, and network-specific policies.",
  parameters: {
    jurisdiction: {
      type: "string",
      description: 'Jurisdiction code: "US", "EU", "IN", or "ALL"',
      required: true,
    },
    topic: {
      type: "string",
      description:
        "The regulatory topic to look up, e.g. 'chargeback time limits', 'Reg E dispute rights', 'PSD2 SCA requirements'",
      required: true,
    },
    network: {
      type: "string",
      description:
        'Optional card network filter: "Visa", "Mastercard", "Amex", "Discover"',
    },
  },
  async execute(params, env, context) {
    const jurisdiction = params.jurisdiction as string;
    const topic = params.topic as string;
    const network = params.network as string | undefined;

    // Build enriched query for RAG
    const queryParts = [topic];
    if (jurisdiction !== "ALL") queryParts.push(`jurisdiction:${jurisdiction}`);
    if (network) queryParts.push(`network:${network}`);
    const enrichedQuery = queryParts.join(" ");

    // Query RAG with enriched search
    const results = await queryKnowledge(env, {
      query: enrichedQuery,
      agentId: context.agentId,
      topK: 5,
      scoreThreshold: 0.6,
    });

    // Also search for jurisdiction-specific terms
    const jurisdictionMap: Record<string, string[]> = {
      US: ["Regulation E", "Regulation Z", "FCBA", "EFTA", "CFPB", "Dodd-Frank"],
      EU: ["PSD2", "SCA", "GDPR", "EBA", "SEPA", "Strong Customer Authentication"],
      IN: ["RBI", "NPCI", "Payment and Settlement Systems Act", "Banking Ombudsman"],
    };

    const jurisdictionTerms = jurisdictionMap[jurisdiction] || [];
    let additionalResults: typeof results = [];

    if (results.length < 3 && jurisdictionTerms.length > 0) {
      const termQuery = `${topic} ${jurisdictionTerms.slice(0, 3).join(" ")}`;
      additionalResults = await queryKnowledge(env, {
        query: termQuery,
        agentId: context.agentId,
        topK: 3,
        scoreThreshold: 0.55,
      });
    }

    const allResults = [...results, ...additionalResults];
    // Deduplicate by content
    const seen = new Set<string>();
    const unique = allResults.filter((r) => {
      const key = r.content.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length === 0) {
      // Return built-in fallback knowledge for common queries
      const fallback = getFallbackRegulation(jurisdiction, topic);
      if (fallback) {
        return {
          success: true,
          data: { source: "built-in", regulation: fallback },
          summary: `Found built-in regulation reference for ${jurisdiction}: ${topic}`,
        };
      }
      return {
        success: true,
        data: { results: [] },
        summary: `No regulatory data found for ${jurisdiction} — ${topic}`,
      };
    }

    return {
      success: true,
      data: {
        jurisdiction,
        topic,
        results: unique.map((r) => ({
          content: r.content,
          source: r.source_name,
          relevance: Math.round(r.score * 100) + "%",
        })),
      },
      summary: `Found ${unique.length} regulatory references for ${jurisdiction}: ${topic}`,
    };
  },
};

function getFallbackRegulation(
  jurisdiction: string,
  topic: string,
): Record<string, string> | null {
  const lowerTopic = topic.toLowerCase();

  if (jurisdiction === "US") {
    if (lowerTopic.includes("time limit") || lowerTopic.includes("deadline")) {
      return {
        regulation: "Regulation E (EFTA) / Regulation Z (TILA)",
        consumer_deadline: "60 days from statement date",
        bank_investigation: "10 business days (45 days with provisional credit)",
        network_deadline: "120 days from transaction date (Visa/MC)",
      };
    }
    if (lowerTopic.includes("provisional credit")) {
      return {
        regulation: "Regulation E §1005.11",
        rule: "Provisional credit within 10 business days if investigation exceeds this period",
        exception: "New accounts: 20 business days",
      };
    }
  }

  if (jurisdiction === "EU") {
    if (lowerTopic.includes("sca") || lowerTopic.includes("authentication")) {
      return {
        regulation: "PSD2 — Strong Customer Authentication",
        requirement: "Two-factor authentication for electronic payments",
        exemptions: "Low value (<30 EUR), recurring, trusted beneficiaries, TRA",
        liability_shift: "Liability shifts to issuer if SCA was applied",
      };
    }
  }

  if (jurisdiction === "IN") {
    if (lowerTopic.includes("time limit") || lowerTopic.includes("deadline")) {
      return {
        regulation: "RBI Circular on Limiting Liability",
        customer_reporting: "3 working days for zero liability",
        bank_resolution: "90 days to resolve",
        refund_timeline: "10 working days after resolution",
      };
    }
  }

  return null;
}

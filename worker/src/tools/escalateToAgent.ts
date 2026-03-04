import type { ToolDefinition } from "./types";

export const escalateToAgentTool: ToolDefinition = {
    name: "escalate_to_agent",
    description:
        "Escalate the current interaction or workflow to a specialized agent. Use this when the user's request exceeds your capabilities, or when you have finished your triage and need an expert system to take over. You MUST provide all context inherited so far.",
    category: "system",
    stepType: "decision",
    parameters: {
        target_agent_slug: {
            type: "string",
            description: "The slug of the target agent to escalate to (e.g. 'chargeback-agent', 'collections-agent')",
            required: true,
        },
        context_payload: {
            type: "object",
            description: "A highly structured JSON object containing all the evidence, variables, and context the new agent will need to begin its work without asking the user to repeat themselves.",
            required: true,
        },
        action_requested: {
            type: "string",
            description: "A short instruction indicating what the new agent should do upon waking up.",
            required: true,
        },
    },
    async execute(params) {
        const target_agent_slug = params.target_agent_slug as string;
        const context_payload = params.context_payload as Record<string, unknown>;
        const action_requested = params.action_requested as string;

        // The backend agentic loop will intercept this specific successful result 
        // and trigger the SSE handoff event.
        return {
            success: true,
            data: {
                target_agent_slug,
                context_payload,
                action_requested,
            },
            summary: `Successfully initiated handoff to ${target_agent_slug}`,
        };
    },
};

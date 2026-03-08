import { Hono } from "hono";
import type { Env, LlmConfigRow } from "../types";
import { getSessionUser } from "../session";
import { checkRateLimit } from "../rateLimit";
import { getBuilderProvider, createProvider, getDefaultModel } from "../llm";
import { decrypt } from "../encryption";
import { buildBuilderPrompt } from "../builderPrompt";
import type { SkillSummary } from "../builderPrompt";
import { getAllTools } from "../tools/registry";
import { SKILL_STATUS, AGENT_STATUS, BUILDER_RATE_LIMIT, BUILDER_RATE_WINDOW_MS } from "../constants";

const builder = new Hono<{ Bindings: Env }>();

// GET /builder/tools — List all platform tools with metadata
builder.get("/tools", async (c) => {
  const tools = getAllTools().map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    stepType: t.stepType,
    parameters: Object.fromEntries(
      Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }])
    ),
  }));
  return c.json({ tools });
});

// GET /builder/skills — List all available skills
builder.get("/skills", async (c) => {
  const skills = await c.env.DB.prepare(
    `SELECT id, slug, name, description, category, icon, required_tools, input_hints, visual_outputs, reuse_count FROM skills WHERE status = '${SKILL_STATUS.ACTIVE}' ORDER BY reuse_count DESC`,
  ).all<{
    id: string;
    slug: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    required_tools: string;
    input_hints: string;
    visual_outputs: string;
    reuse_count: number;
  }>();

  return c.json({
    skills: skills.results.map((s) => ({
      ...s,
      required_tools: JSON.parse(s.required_tools || "[]"),
      input_hints: JSON.parse(s.input_hints || "[]"),
      visual_outputs: JSON.parse(s.visual_outputs || "[]"),
    })),
  });
});

// POST /builder/chat — Multi-turn conversation with builder agent (SSE stream)
builder.post("/chat", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";

  const rl = await checkRateLimit(c.env.DB, `builder:${ip}`, BUILDER_RATE_LIMIT, BUILDER_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Rate limit exceeded" }, 429);

  const body = await c.req.json<{
    messages: Array<{ role: string; content: string }>;
    provider?: string;
    user_api_key?: string;
  }>();

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return c.json({ error: "messages array is required" }, 400);
  }

  // Auth: require login for builder
  const email = await getSessionUser(c);
  if (!email) {
    return c.json({ error: "Please log in to use the Agent Builder" }, 401);
  }

  const user = await c.env.DB.prepare("SELECT id, trial_expires_at, role FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; trial_expires_at: string | null; role: string }>();

  if (!user) return c.json({ error: "User not found" }, 404);

  if (user.trial_expires_at && user.role !== "admin" && new Date(user.trial_expires_at) < new Date()) {
    return c.json({ error: "Your trial has expired. Contact us to continue." }, 403);
  }

  // Load all active skills for the builder prompt
  const skillRows = await c.env.DB.prepare(
    `SELECT slug, name, description, category, required_tools, reuse_count FROM skills WHERE status = '${SKILL_STATUS.ACTIVE}' ORDER BY reuse_count DESC`,
  ).all<{
    slug: string;
    name: string;
    description: string;
    category: string;
    required_tools: string;
    reuse_count: number;
  }>();

  const skills: SkillSummary[] = skillRows.results.map((s) => ({
    ...s,
    required_tools: JSON.parse(s.required_tools || "[]"),
  }));

  // Resolve LLM provider — Builder defaults to Workers AI (Llama 3.3 70B)
  // for reliable structured JSON output. BYOK users can override.
  let providerName = body.provider || "workers-ai";
  let providerApiKey = body.user_api_key || "";

  if (providerApiKey) {
    // User provided their own key — use their chosen provider
    providerName = body.provider || "openai";
  } else if (body.provider && body.provider !== "workers-ai") {
    // User selected a non-default provider — check for saved key
    const config = await c.env.DB.prepare(
      "SELECT * FROM llm_configs WHERE user_id = ? AND provider = ? LIMIT 1",
    )
      .bind(user.id, body.provider)
      .first<LlmConfigRow>();

    if (config) {
      providerApiKey = await decrypt(config.api_key_encrypted, c.env.ENCRYPTION_KEY);
      providerName = body.provider;
    }
  }

  const provider = providerApiKey
    ? createProvider(providerName, providerApiKey, c.env)
    : getBuilderProvider(c.env);

  const model = getDefaultModel(providerName);

  // Build system prompt with current skills
  const systemPrompt = buildBuilderPrompt(skills);

  const llmMessages = [
    { role: "system" as const, content: systemPrompt },
    ...body.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const stream = await provider.stream({
      model,
      messages: llmMessages,
      max_tokens: 8192,
      temperature: 0.4,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Builder chat failed";
    return c.json({ error: errorMsg }, 500);
  }
});

// POST /builder/extract — Dedicated endpoint to extract AGENT_UPDATE JSON from conversation
// Uses a minimal system prompt focused ONLY on JSON extraction, not conversation
builder.post("/extract", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{
    messages: Array<{ role: string; content: string }>;
    provider?: string;
    user_api_key?: string;
  }>();

  if (!body.messages?.length) return c.json({ error: "messages required" }, 400);

  // Load skills for reference
  const skillRows = await c.env.DB.prepare(
    `SELECT slug, name, description, category FROM skills WHERE status = '${SKILL_STATUS.ACTIVE}' ORDER BY reuse_count DESC`,
  ).all<{ slug: string; name: string; description: string; category: string }>();

  const skillList = skillRows.results.map((s) => `- ${s.slug}: ${s.name} (${s.category})`).join("\n");

  // Condensed extraction-only prompt — much smaller than the full builder prompt
  const extractPrompt = `You are a JSON extraction assistant. Your ONLY job is to read the conversation below and output a single |||AGENT_UPDATE||| JSON block.

Available skills from our repository:
${skillList}

Rules:
- Output ONLY 1-2 sentences of acknowledgment, then the |||AGENT_UPDATE||| JSON block
- The JSON must be valid and complete
- "capabilities" must be objects: [{"icon": "LucideIconName", "title": "...", "description": "..."}]. Use icons: Shield, Calculator, Search, FileText, Brain, Target, Globe, BarChart3, TrendingUp, Receipt, HeartPulse, Zap, Tag
- Include 3-5 capabilities based on what the agent does
- "skills" array: use slugs from the skill list above that match the agent's needs
- "tools" array: union of tools needed (e.g. "calculate", "classify_risk", "generate_report", "web_search")
- Fill ALL fields based on the conversation context. Do not leave fields null if the conversation discussed them.
- status must be "building" or "complete"

JSON template:
|||AGENT_UPDATE|||
{"metadata":{"name":"...","slug":"...","tagline":"...","description":"...","category":"...","icon":"emoji","color":"#hex"},"skills":[],"new_skills":[],"system_prompt_sections":{"agent_identity":"...","agent_objective":"...","domain_context":"...","scoring_methodology":null,"jurisdiction_knowledge":"...","visual_output_rules":null,"guardrails":"..."},"tools":[],"sample_input":null,"capabilities":[],"jurisdictions":[],"guardrails_config":{"max_tokens":4096,"temperature":0.3},"quick_replies":[],"status":"complete"}
|||END_AGENT_UPDATE|||`;

  // Only send last 6 messages to keep context small
  const recentMessages = body.messages.slice(-6);

  // Extract always uses Workers AI — fast, reliable, structured output
  const providerApiKey = body.user_api_key || "";
  const providerName = providerApiKey ? (body.provider || "openai") : "workers-ai";

  const provider = providerApiKey
    ? createProvider(providerName, providerApiKey, c.env)
    : getBuilderProvider(c.env);

  try {
    const stream = await provider.stream({
      model: getDefaultModel(providerName),
      messages: [
        { role: "system" as const, content: extractPrompt },
        ...recentMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: "Please output the |||AGENT_UPDATE||| JSON block now with the complete agent definition based on our conversation." },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Extract failed" }, 500);
  }
});

// POST /builder/save — Save a completed agent + link skills + save new skills
builder.post("/save", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{
    metadata: {
      name: string;
      slug: string;
      tagline: string;
      description: string;
      category: string;
      icon: string;
      color: string;
    };
    skills: string[]; // skill slugs
    new_skills: Array<{
      slug: string;
      name: string;
      description: string;
      category: string;
      icon: string;
      required_tools: string[];
      prompt_template: string;
      input_hints: string[];
      visual_outputs: string[];
    }>;
    system_prompt_sections: {
      agent_identity: string | null;
      agent_objective: string | null;
      domain_context: string | null;
      scoring_methodology: string | null;
      jurisdiction_knowledge: string | null;
      visual_output_rules: string | null;
      guardrails: string | null;
    };
    tools: string[];
    sample_input: Record<string, unknown> | null;
    capabilities: Array<{ icon: string; title: string; description: string }>;
    jurisdictions: string[];
    guardrails_config: { max_tokens: number; temperature: number };
  }>();

  if (!body.metadata?.name || !body.metadata?.slug) {
    return c.json({ error: "Agent name and slug are required" }, 400);
  }

  // Check slug uniqueness
  const existing = await c.env.DB.prepare("SELECT id FROM agents WHERE slug = ?")
    .bind(body.metadata.slug)
    .first();
  if (existing) {
    return c.json({ error: "An agent with this slug already exists. Choose a different name." }, 409);
  }

  // 1. Save any new skills to the repository
  const newSkillIds: string[] = [];
  if (body.new_skills && body.new_skills.length > 0) {
    for (const skill of body.new_skills) {
      const skillId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      // Check if skill slug already exists
      const existingSkill = await c.env.DB.prepare("SELECT id FROM skills WHERE slug = ?")
        .bind(skill.slug)
        .first<{ id: string }>();

      if (existingSkill) {
        newSkillIds.push(existingSkill.id);
      } else {
        await c.env.DB.prepare(
          `INSERT INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            skillId,
            skill.slug,
            skill.name,
            skill.description,
            skill.category,
            skill.icon,
            JSON.stringify(skill.required_tools),
            skill.prompt_template,
            JSON.stringify(skill.input_hints),
            JSON.stringify(skill.visual_outputs),
            user.id,
          )
          .run();
        newSkillIds.push(skillId);
      }
    }
  }

  // 2. Resolve existing skill IDs
  const existingSkillIds: string[] = [];
  if (body.skills && body.skills.length > 0) {
    for (const slug of body.skills) {
      const skillRow = await c.env.DB.prepare("SELECT id FROM skills WHERE slug = ?")
        .bind(slug)
        .first<{ id: string }>();
      if (skillRow) existingSkillIds.push(skillRow.id);
    }
  }

  const allSkillIds = [...existingSkillIds, ...newSkillIds];

  // 3. Load skill prompt templates to build the full system prompt
  let skillPrompts = "";
  if (allSkillIds.length > 0) {
    const placeholders = allSkillIds.map(() => "?").join(",");
    const skillData = await c.env.DB.prepare(
      `SELECT slug, name, prompt_template FROM skills WHERE id IN (${placeholders})`,
    )
      .bind(...allSkillIds)
      .all<{ slug: string; name: string; prompt_template: string }>();

    if (skillData.results.length > 0) {
      skillPrompts = "\n\n" + skillData.results
        .map((s) => `<skill name="${s.slug}" title="${s.name}">\n${s.prompt_template}\n</skill>`)
        .join("\n\n");
    }
  }

  // 4. Assemble the full system prompt from sections + skills
  const sections = body.system_prompt_sections;
  const promptParts: string[] = [];

  if (sections.agent_identity) {
    promptParts.push(`<agent_identity>\n${sections.agent_identity}\n</agent_identity>`);
  }
  if (sections.agent_objective) {
    promptParts.push(`<agent_objective>\n${sections.agent_objective}\n</agent_objective>`);
  }
  if (sections.domain_context) {
    promptParts.push(`<domain_context>\n${sections.domain_context}\n</domain_context>`);
  }
  if (sections.scoring_methodology) {
    promptParts.push(`<scoring_methodology>\n${sections.scoring_methodology}\n</scoring_methodology>`);
  }
  if (sections.jurisdiction_knowledge) {
    promptParts.push(`<jurisdiction_knowledge>\n${sections.jurisdiction_knowledge}\n</jurisdiction_knowledge>`);
  }
  if (sections.visual_output_rules) {
    promptParts.push(`<visual_output_rules>\n${sections.visual_output_rules}\n</visual_output_rules>`);
  }
  if (sections.guardrails) {
    promptParts.push(`<guardrails>\n${sections.guardrails}\n</guardrails>`);
  }

  const systemPrompt = promptParts.join("\n\n") + skillPrompts;

  if (systemPrompt.length < 100) {
    return c.json({ error: "Agent definition is too incomplete to save. Continue building in the chat." }, 400);
  }

  // 5. Normalize capabilities — LLM sometimes sends plain strings instead of objects
  const normalizedCapabilities = (body.capabilities || []).map(
    (cap: { icon: string; title: string; description: string } | string) =>
      typeof cap === "string"
        ? { icon: "Zap", title: cap, description: "" }
        : cap
  );

  // 6. Insert the agent
  const agentId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  await c.env.DB.prepare(
    `INSERT INTO agents (id, slug, name, tagline, description, category, icon, color, version, status, sample_input, sample_output, system_prompt, guardrails, capabilities, jurisdictions, tools, featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1.0.0', '${AGENT_STATUS.ACTIVE}', ?, '', ?, ?, ?, ?, ?, 0, 99)`,
  )
    .bind(
      agentId,
      body.metadata.slug,
      body.metadata.name,
      body.metadata.tagline,
      body.metadata.description,
      body.metadata.category,
      body.metadata.icon,
      body.metadata.color,
      body.sample_input ? JSON.stringify(body.sample_input) : "{}",
      systemPrompt,
      JSON.stringify(body.guardrails_config),
      JSON.stringify(normalizedCapabilities),
      JSON.stringify(body.jurisdictions),
      JSON.stringify(body.tools),
    )
    .run();

  // 7. Link skills to agent + increment reuse_count
  for (const skillId of allSkillIds) {
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO agent_skills (agent_id, skill_id) VALUES (?, ?)",
    )
      .bind(agentId, skillId)
      .run();

    await c.env.DB.prepare(
      "UPDATE skills SET reuse_count = reuse_count + 1 WHERE id = ?",
    )
      .bind(skillId)
      .run();
  }

  return c.json({
    success: true,
    agent: {
      id: agentId,
      slug: body.metadata.slug,
      name: body.metadata.name,
    },
    skills_linked: allSkillIds.length,
    new_skills_created: newSkillIds.length,
  });
});

export default builder;

/**
 * LLM Provider Abstraction.
 * Supports z.ai (default), OpenAI, and Anthropic.
 * All providers implement the same interface.
 */

import type { Env } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
  provider: string;
}

interface LLMProvider {
  name: string;
  chat(params: ChatParams): Promise<ChatResponse>;
  stream(params: ChatParams): Promise<ReadableStream>;
}

// ==========================================
// Timeout helper (AbortController doesn't work in CF Workers fetch)
// ==========================================

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return Promise.race([
    fetch(url, init),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out — the AI provider is slow or unavailable. Try again or use your own API key.")), timeoutMs),
    ),
  ]);
}

// ==========================================
// z.ai Provider (OpenAI-compatible)
// ==========================================

class ZaiProvider implements LLMProvider {
  name = "zai";
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          max_tokens: params.max_tokens || 2048,
          temperature: params.temperature ?? 0.7,
        }),
      },
      55000,
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`z.ai error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || "",
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
      model: params.model,
      provider: "zai",
    };
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    // z.ai's native SSE endpoint hangs intermittently — fetch full response then emit as SSE
    const response = await this.chat(params);
    const encoder = new TextEncoder();

    return new ReadableStream({
      start(controller) {
        // Emit the full response as a single token event
        controller.enqueue(
          encoder.encode(`event: token\ndata: ${JSON.stringify({ text: response.content })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider: "zai", model: params.model })}\n\n`),
        );
        controller.close();
      },
    });
  }
}

// ==========================================
// OpenAI Provider
// ==========================================

class OpenAIProvider implements LLMProvider {
  name = "openai";
  constructor(private apiKey: string) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    // Use streaming internally to avoid Cloudflare 524 timeout on large prompts.
    // Streaming gets first byte fast; we collect all tokens server-side.
    const model = params.model || "gpt-4.1-nano";

    // GPT-5 series and o-series reasoning models require max_completion_tokens
    // instead of max_tokens, and don't support custom temperature
    const isReasoningModel = /^(gpt-5|o[1-9])/.test(model);
    const tokenParam = isReasoningModel
      ? { max_completion_tokens: params.max_tokens || 4096 }
      : { max_tokens: params.max_tokens || 2048 };
    const tempParam = isReasoningModel ? {} : { temperature: params.temperature ?? 0.7 };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        ...tokenParam,
        ...tempParam,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
    }

    return collectOpenAIStream(res.body!, model);
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    const response = await this.chat(params);
    return emitAsSSE(response.content, "openai", response.model);
  }
}

// ==========================================
// Anthropic Provider
// ==========================================

class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  constructor(private apiKey: string) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    const systemMsg = params.messages.find((m) => m.role === "system");
    const nonSystemMsgs = params.messages.filter((m) => m.role !== "system");

    // Use streaming internally to avoid Cloudflare 524 timeout on large prompts.
    // Streaming gets first byte fast; we collect all tokens server-side.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-6",
        max_tokens: params.max_tokens || 2048,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: nonSystemMsgs,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }

    return collectAnthropicStream(res.body!, params.model || "claude-sonnet-4-6");
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    // Non-streaming fetch then emit as SSE — CF Workers streaming subrequests
    // to external APIs are unreliable (streams get cut off mid-response).
    const response = await this.chat(params);
    return emitAsSSE(response.content, "anthropic", response.model);
  }
}

// ==========================================
// Stream Collectors — consume streaming API responses server-side
// ==========================================

/**
 * Collect an OpenAI streaming response into a single ChatResponse.
 * Keeps the connection alive (first byte is fast) while avoiding
 * the unreliable pipe-through to the client.
 */
async function collectOpenAIStream(body: ReadableStream, model: string): Promise<ChatResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {
        // skip
      }
    }
  }

  return {
    content,
    usage: { input_tokens: 0, output_tokens: 0 },
    model,
    provider: "openai",
  };
}

/**
 * Collect an Anthropic streaming response into a single ChatResponse.
 */
async function collectAnthropicStream(body: ReadableStream, model: string): Promise<ChatResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          content += parsed.delta.text;
        } else if (parsed.type === "error") {
          throw new Error(parsed.error?.message || "Anthropic stream error");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Anthropic")) throw err;
        // skip malformed chunks
      }
    }
  }

  return {
    content,
    usage: { input_tokens: 0, output_tokens: 0 },
    model,
    provider: "anthropic",
  };
}

// ==========================================
// SSE Helpers
// ==========================================

/**
 * Emit a full text response as chunked SSE events.
 * Splits text into small chunks to simulate token streaming for better UX.
 */
function emitAsSSE(text: string, provider: string, model: string): ReadableStream {
  const encoder = new TextEncoder();
  const CHUNK_SIZE = 12; // chars per "token" — feels natural
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= text.length) {
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider, model })}\n\n`),
        );
        controller.close();
        return;
      }
      const chunk = text.slice(offset, offset + CHUNK_SIZE);
      offset += CHUNK_SIZE;
      controller.enqueue(
        encoder.encode(`event: token\ndata: ${JSON.stringify({ text: chunk })}\n\n`),
      );
    },
  });
}

// ==========================================
// Cloudflare Workers AI Provider (fallback)
// ==========================================

const WORKERS_AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

class WorkersAIProvider implements LLMProvider {
  name = "workers-ai";
  constructor(private ai: Ai) {}

  async chat(params: ChatParams): Promise<ChatResponse> {
    const result = (await this.ai.run(WORKERS_AI_MODEL, {
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: params.max_tokens || 2048,
      temperature: params.temperature ?? 0.7,
    })) as { response?: string };

    return {
      content: result.response || "",
      usage: { input_tokens: 0, output_tokens: 0 },
      model: WORKERS_AI_MODEL,
      provider: "workers-ai",
    };
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    const aiStream = (await this.ai.run(WORKERS_AI_MODEL, {
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: params.max_tokens || 2048,
      temperature: params.temperature ?? 0.7,
      stream: true,
    })) as ReadableStream;

    const encoder = new TextEncoder();
    const transformer = new TransformStream({
      transform(chunk, controller) {
        // Workers AI stream returns "data: {\"response\":\"token\"}\n\n" chunks
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.response) {
                controller.enqueue(
                  encoder.encode(`event: token\ndata: ${JSON.stringify({ text: parsed.response })}\n\n`),
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      },
      flush(controller) {
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider: "workers-ai", model: WORKERS_AI_MODEL })}\n\n`),
        );
      },
    });

    return aiStream.pipeThrough(transformer);
  }
}

// ==========================================
// z.ai + Workers AI Fallback Provider
// ==========================================

class ZaiWithFallbackProvider implements LLMProvider {
  name = "zai";
  private zai: ZaiProvider;
  private fallback: WorkersAIProvider;

  constructor(apiKey: string, baseUrl: string, ai: Ai) {
    this.zai = new ZaiProvider(apiKey, baseUrl);
    this.fallback = new WorkersAIProvider(ai);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    try {
      return await this.zai.chat(params);
    } catch {
      // z.ai failed (timeout/error) — fall back to Workers AI
      const result = await this.fallback.chat(params);
      return { ...result, provider: "workers-ai (fallback)" };
    }
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    const response = await this.chat(params);
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: token\ndata: ${JSON.stringify({ text: response.content })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider: response.provider, model: response.model })}\n\n`),
        );
        controller.close();
      },
    });
  }
}

// ==========================================
// Factory
// ==========================================

export function createProvider(
  providerName: string,
  apiKey: string,
  env: Env,
): LLMProvider {
  switch (providerName) {
    case "openai":
      return new OpenAIProvider(apiKey);
    case "anthropic":
      return new AnthropicProvider(apiKey);
    case "zai":
    default:
      return new ZaiProvider(apiKey, env.ZAI_BASE_URL);
  }
}

export function getDefaultProvider(env: Env): LLMProvider {
  if (env.DEFAULT_LLM_PROVIDER === "workers-ai") {
    return new WorkersAIProvider(env.AI);
  }
  return new ZaiWithFallbackProvider(env.ZAI_API_KEY, env.ZAI_BASE_URL, env.AI);
}

export function getFallbackProvider(env: Env): LLMProvider {
  return new WorkersAIProvider(env.AI);
}

/** Builder always uses Workers AI (Llama 3.3 70B) — reliable structured output */
export function getBuilderProvider(env: Env): LLMProvider {
  return new WorkersAIProvider(env.AI);
}

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4.1-nano";
    case "anthropic":
      return "claude-sonnet-4-6";
    case "workers-ai":
      return WORKERS_AI_MODEL;
    case "zai":
    default:
      return "glm-5";
  }
}

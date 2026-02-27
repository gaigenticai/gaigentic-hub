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
      90000,
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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "gpt-4o-mini",
        messages: params.messages,
        max_tokens: params.max_tokens || 2048,
        temperature: params.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
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
      model: params.model || "gpt-4o-mini",
      provider: "openai",
    };
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "gpt-4o-mini",
        messages: params.messages,
        max_tokens: params.max_tokens || 2048,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI stream error (${res.status}): ${err}`);
    }

    return transformSSEStream(res.body!, "openai", params.model || "gpt-4o-mini");
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

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-20250514",
        max_tokens: params.max_tokens || 2048,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: nonSystemMsgs,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text || "",
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      },
      model: params.model || "claude-sonnet-4-20250514",
      provider: "anthropic",
    };
  }

  async stream(params: ChatParams): Promise<ReadableStream> {
    const systemMsg = params.messages.find((m) => m.role === "system");
    const nonSystemMsgs = params.messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-20250514",
        max_tokens: params.max_tokens || 2048,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: nonSystemMsgs,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic stream error (${res.status}): ${err}`);
    }

    return transformAnthropicStream(
      res.body!,
      params.model || "claude-sonnet-4-20250514",
    );
  }
}

// ==========================================
// SSE Stream Transformers
// ==========================================

/**
 * Transform OpenAI-compatible SSE stream into our unified SSE format.
 */
function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("STREAM_TIMEOUT")), timeoutMs),
    ),
  ]);
}

function transformSSEStream(
  body: ReadableStream,
  provider: string,
  model: string,
): ReadableStream {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let hasContent = false;

  return new ReadableStream({
    async pull(controller) {
      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        // 25s timeout per chunk — if z.ai hangs, we detect and error
        const result = await readWithTimeout(reader, 25000);
        done = result.done;
        value = result.value;
      } catch (err) {
        if ((err as Error).message === "STREAM_TIMEOUT") {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "The LLM provider is not responding. The shared API key may be expired or rate-limited. Please try with your own API key (OpenAI or Anthropic)." })}\n\n`),
          );
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ provider, model })}\n\n`),
          );
          controller.close();
          reader.cancel();
          return;
        }
        throw err;
      }

      if (done) {
        if (!hasContent) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: `${provider} returned an empty response. The API key may be expired or the service is temporarily unavailable. Try using your own API key.` })}\n\n`),
          );
        }
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider, model })}\n\n`),
        );
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: parsed.error.message || JSON.stringify(parsed.error) })}\n\n`),
            );
            continue;
          }
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            hasContent = true;
            controller.enqueue(
              encoder.encode(`event: token\ndata: ${JSON.stringify({ text: content })}\n\n`),
            );
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    },
  });
}

/**
 * Transform Anthropic SSE stream into our unified SSE format.
 */
function transformAnthropicStream(
  body: ReadableStream,
  model: string,
): ReadableStream {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ provider: "anthropic", model })}\n\n`,
          ),
        );
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify({ text: parsed.delta.text })}\n\n`,
              ),
            );
          }
        } catch {
          // Skip
        }
      }
    },
  });
}

// ==========================================
// Cloudflare Workers AI Provider (fallback)
// ==========================================

const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
    const response = await this.chat(params);
    const encoder = new TextEncoder();

    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: token\ndata: ${JSON.stringify({ text: response.content })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`event: done\ndata: ${JSON.stringify({ provider: "workers-ai", model: WORKERS_AI_MODEL })}\n\n`),
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
  return new ZaiProvider(env.ZAI_API_KEY, env.ZAI_BASE_URL);
}

export function getFallbackProvider(env: Env): LLMProvider {
  return new WorkersAIProvider(env.AI);
}

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "workers-ai":
      return WORKERS_AI_MODEL;
    case "zai":
    default:
      return "glm-4.5";
  }
}

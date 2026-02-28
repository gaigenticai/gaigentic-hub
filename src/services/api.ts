import type {
  SignupPayload,
  LoginPayload,
  User,
  Agent,
  ApiKey,
  GeneratedApiKey,
  UsageStats,
  LLMProvider,
  AdminStats,
  AdminSignup,
  Feedback,
} from "../types";

const API_BASE = "/api";

// ==========================================
// Token Management
// ==========================================

const SESSION_KEY = "gaigentic-session";
const ADMIN_KEY = "gaigentic-admin-token";

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}

function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_KEY);
}

// ==========================================
// Request Helpers
// ==========================================

async function request<T>(
  path: string,
  options?: RequestInit,
  retries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        if (res.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        throw new Error(body.error || `Request failed: ${res.status}`);
      }

      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
  throw new Error("Request failed after retries");
}

async function authRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getSessionToken();
  if (!token) throw new Error("Session expired — please log in again");
  return request<T>(path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

async function adminRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const adminToken = getAdminToken();
  const sessionToken = getSessionToken();
  const token = adminToken || sessionToken;
  if (!token) throw new Error("Admin access required");
  return request<T>(path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// ==========================================
// Auth API
// ==========================================

interface SignupResponse {
  user: User;
  session_token: string;
  chaosbird_username: string;
}

interface LoginResponse {
  user: User;
  session_token: string;
  admin_token?: string;
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  return request<SignupResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshSession(): Promise<string> {
  const token = getSessionToken();
  if (!token) throw new Error("No session token");
  const result = await request<{ session_token: string }>(
    "/auth/refresh-session",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  setSessionToken(result.session_token);
  return result.session_token;
}

// ==========================================
// Agents API
// ==========================================

export async function getAgents(): Promise<Agent[]> {
  const result = await request<{ agents: Agent[] }>("/agents");
  return result.agents;
}

export async function getAgent(slug: string): Promise<Agent> {
  const result = await request<{ agent: Agent }>(`/agents/${slug}`);
  return result.agent;
}

export async function getFeaturedAgents(): Promise<Agent[]> {
  const result = await request<{ agents: Agent[] }>("/agents/featured");
  return result.agents;
}

export async function searchAgents(query: string): Promise<Agent[]> {
  const result = await request<{ agents: Agent[] }>(
    `/agents/search?q=${encodeURIComponent(query)}`,
  );
  return result.agents;
}

// ==========================================
// Feedback API
// ==========================================

export async function submitFeedback(
  auditLogId: string,
  rating: number,
  comment?: string,
  correction?: string,
): Promise<{ id: string }> {
  return authRequest<{ id: string }>("/feedback", {
    method: "POST",
    body: JSON.stringify({
      audit_log_id: auditLogId,
      rating,
      comment: comment || undefined,
      correction: correction || undefined,
    }),
  });
}

export async function getFeedback(
  auditLogId: string,
): Promise<Feedback[]> {
  const result = await authRequest<{ feedback: Feedback[] }>(
    `/feedback/${auditLogId}`,
  );
  return result.feedback;
}

// ==========================================
// API Keys API
// ==========================================

export async function generateApiKey(
  agentId?: string,
): Promise<GeneratedApiKey> {
  return authRequest<GeneratedApiKey>("/apikeys/generate", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function getMyApiKeys(): Promise<ApiKey[]> {
  const result = await authRequest<{ keys: ApiKey[] }>("/apikeys/mine");
  return result.keys;
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await authRequest<{ success: boolean }>(`/apikeys/${keyId}`, {
    method: "DELETE",
  });
}

// ==========================================
// Usage API
// ==========================================

export async function getMyUsage(): Promise<UsageStats> {
  return authRequest<UsageStats>("/usage/me");
}

// ==========================================
// LLM Config API
// ==========================================

export async function saveLLMConfig(
  provider: LLMProvider,
  apiKey: string,
  isDefault: boolean,
): Promise<void> {
  await authRequest("/settings/llm-config", {
    method: "PUT",
    body: JSON.stringify({ provider, api_key: apiKey, is_default: isDefault }),
  });
}

// ==========================================
// Document Upload API
// ==========================================

export async function uploadDocument(
  file: File,
  clientText?: string,
  agentSlug?: string,
): Promise<{
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  extracted_text: string | null;
  status: string;
  error: string | null;
}> {
  const formData = new FormData();
  formData.append("file", file);
  if (clientText) formData.append("client_text", clientText);
  if (agentSlug) formData.append("agent_slug", agentSlug);

  const token = getSessionToken();
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data as { error?: string }).error || "Upload failed");
  return (data as { document: { id: string; file_name: string; file_type: string; file_size: number; extracted_text: string | null; status: string; error: string | null } }).document;
}

// ==========================================
// API Key Validation
// ==========================================

export async function testApiKey(
  provider: LLMProvider,
  apiKey: string,
): Promise<{ valid: boolean; provider: string; model: string; error?: string }> {
  return request<{ valid: boolean; provider: string; model: string; error?: string }>(
    "/playground/test-key",
    {
      method: "POST",
      body: JSON.stringify({ provider, api_key: apiKey }),
    },
    0, // no retries for key testing
  );
}

// ==========================================
// Playground API (SSE Streaming)
// ==========================================

export function executeAgent(
  agentSlug: string,
  input: Record<string, unknown>,
  options?: {
    provider?: LLMProvider;
    model?: string;
    userApiKey?: string;
    documentIds?: string[];
    prompt?: string;
  },
): {
  stream: ReadableStream<string>;
  abort: () => void;
  auditLogId: Promise<string | null>;
} {
  const controller = new AbortController();
  const token = getSessionToken();

  let resolveAuditId: (v: string | null) => void;
  const auditLogId = new Promise<string | null>((r) => {
    resolveAuditId = r;
  });

  const stream = new ReadableStream<string>({
    async start(streamController) {
      try {
        const res = await fetch(`${API_BASE}/playground/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            agent_slug: agentSlug,
            input,
            provider: options?.provider,
            model: options?.model,
            user_api_key: options?.userApiKey,
            document_ids: options?.documentIds,
            prompt: options?.prompt,
          }),
          signal: controller.signal,
        });

        // Capture audit log ID from response header
        resolveAuditId!(res.headers.get("X-Audit-Log-Id"));

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          streamController.enqueue(
            `event: error\ndata: ${JSON.stringify({ error: body.error })}\n\n`,
          );
          streamController.close();
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamController.enqueue(decoder.decode(value, { stream: true }));
        }
        streamController.close();
      } catch (err: unknown) {
        resolveAuditId!(null);
        if ((err as Error).name !== "AbortError") {
          streamController.enqueue(
            `event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`,
          );
        }
        streamController.close();
      }
    },
  });

  return { stream, abort: () => controller.abort(), auditLogId };
}

// ==========================================
// Admin API
// ==========================================

export async function getAdminStats(): Promise<AdminStats> {
  return adminRequest<AdminStats>("/admin/stats");
}

export async function getAdminSignups(
  page = 1,
  limit = 50,
  search = "",
): Promise<{ signups: AdminSignup[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
  });
  return adminRequest<{ signups: AdminSignup[]; total: number }>(
    `/admin/signups?${params}`,
  );
}

export async function contactUser(
  userId: string,
  message: string,
): Promise<void> {
  await adminRequest("/admin/contact", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, message }),
  });
}

export async function extendTrial(
  userId: string,
  days: number,
): Promise<void> {
  await adminRequest("/admin/extend-trial", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, days }),
  });
}

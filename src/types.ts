// ==========================================
// User Types
// ==========================================

export interface User {
  id: string;
  name: string;
  email: string;
  company_name: string;
  company_slug: string;
  chaosbird_username: string | null;
  role: "user" | "admin";
  trial_expires_at: string | null;
  created_at: string;
}

export interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated";
  user: User | null;
}

export interface SignupPayload {
  name: string;
  email: string;
  company_name: string;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

// ==========================================
// Agent Types
// ==========================================

export type AgentCategory = string;

export interface AgentCapability {
  icon: string;
  title: string;
  description: string;
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: AgentCategory;
  icon: string;
  color: string;
  version: string;
  status: "active" | "maintenance" | "coming_soon";
  sample_input: string;
  sample_output: string;
  capabilities: string | null;
  jurisdictions: string | null;
  playground_instructions: string | null;
  featured: number;
  created_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: string;
  changelog: string | null;
  is_active: boolean;
  created_at: string;
}

// ==========================================
// API Key Types
// ==========================================

export interface ApiKey {
  id: string;
  key_prefix: string;
  agent_id: string | null;
  expires_at: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface GeneratedApiKey {
  key: string;
  prefix: string;
  expires_at: string;
}

// ==========================================
// LLM Types
// ==========================================

export type LLMProvider = "zai" | "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  is_default: boolean;
  created_at: string;
}

// ==========================================
// Playground Types
// ==========================================

export interface ExecuteRequest {
  agent_slug: string;
  input: Record<string, unknown>;
  provider?: LLMProvider;
  model?: string;
  user_api_key?: string;
}

export interface VisualBlock {
  type: "text" | "chart" | "table" | "kpi";
  content: string | ChartConfig | TableConfig | KPIConfig;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area" | "radar";
  title: string;
  xKey: string;
  series: Array<{ dataKey: string; name: string; color: string }>;
  data: Array<Record<string, string | number>>;
}

export interface TableConfig {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number>>;
}

export interface KPIConfig {
  metrics: Array<{
    label: string;
    value: string;
    change?: string;
    trend?: "up" | "down" | "stable";
    description?: string;
  }>;
}

// ==========================================
// Feedback & Audit Types
// ==========================================

export interface AuditLog {
  id: string;
  agent_slug: string;
  input_text: string;
  output_text: string | null;
  rag_sources: string | null;
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  audit_log_id: string;
  rating: number;
  comment: string | null;
  correction: string | null;
  created_at: string;
}

// ==========================================
// Document Upload Types
// ==========================================

export interface DocumentUpload {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedText: string | null;
  status: "uploading" | "extracting" | "ready" | "error";
  error?: string;
  clientText?: string;
}

// ==========================================
// Usage Types
// ==========================================

export interface UsageStats {
  total_calls: number;
  calls_today: number;
  calls_by_agent: Array<{ slug: string; name: string; count: number }>;
  api_key: {
    expires_at: string | null;
    calls_remaining: number;
  } | null;
}

// ==========================================
// Admin Types
// ==========================================

export interface AdminStats {
  total_signups: number;
  signups_today: number;
  signups_this_week: number;
  total_api_calls: number;
  calls_today: number;
  active_api_keys: number;
  agent_usage: Array<{ slug: string; name: string; calls: number }>;
  daily_signups: Array<{ date: string; count: number }>;
}

export interface AdminSignup {
  id: string;
  name: string;
  email: string;
  company_name: string;
  company_slug: string;
  chaosbird_username: string | null;
  trial_expires_at: string | null;
  api_calls: number;
  last_active: string | null;
  created_at: string;
  agents_tried: Array<{ agent_slug: string; count: number; last_used: string }>;
  feedback: Array<{ agent_slug: string; rating: number; comment: string | null; correction: string | null; created_at: string }>;
}

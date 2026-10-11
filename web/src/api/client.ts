import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  code: string; field?: string | null; retryable: boolean; status: number; errors: { field: string; message: string }[];
  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? "Something went wrong. Please try again.");
    this.status = status; this.code = body.code ?? "error"; this.field = body.field; this.retryable = !!body.retryable;
    this.errors = body.errors ?? [];
  }
}

const BASE = "/api/v1";
const csrf = () => document.cookie.split("; ").find((c) => c.startsWith("mf_csrf="))?.split("=")[1] ?? "";
let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok).catch(() => false).finally(() => { setTimeout(() => (refreshing = null), 0); });
  return refreshing;
}

export interface ReqOpts { method?: string; body?: unknown; idem?: boolean | string; signal?: AbortSignal }

export async function api<T>(path: string, opts: ReqOpts = {}, retried = false): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf();
  if (opts.idem) headers["Idempotency-Key"] = typeof opts.idem === "string" ? opts.idem : crypto.randomUUID();
  let res: Response;
  try {
    res = await fetch(BASE + path, { method, headers, credentials: "include", signal: opts.signal,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, { code: "network", message: "We couldn't reach the server. Check your connection and try again.", retryable: true });
  }
  if (res.status === 401 && !retried && !path.startsWith("/auth/") && (await refresh())) return api<T>(path, opts, true);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch { /* non-JSON error page */ }
  if (!res.ok) throw new ApiError(res.status, (data as ApiErrorBody) ?? { message: "Something went wrong. Please try again." });
  return data as T;
}

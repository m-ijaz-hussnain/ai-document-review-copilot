export const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";
export function getToken(): string | null { return localStorage.getItem("token"); }
export function setToken(t: string | null) { t ? localStorage.setItem("token", t) : localStorage.removeItem("token"); }
export class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  const tok = getToken(); if (tok) headers["Authorization"] = `Token ${tok}`;
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = j?.error?.message || msg; } catch { /* keep default */ }
    throw new ApiError(res.status, msg);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}
export interface Paged<T> { count: number; results: T[]; }
export interface Doc { id: string; title: string; file_type: string; status: string; page_count: number; created_at: string; error_message?: string; chunk_count?: number; }
export interface Finding { id: string; title: string; description: string; category: string; severity: string; confidence: number; status: string; priority_score: number; requires_human_review: boolean; reasoning_summary: string; recommended_action: string; evidence: { id: string; page_number: number; quoted_text: string }[]; decisions: { id: string; decision: string; comment: string; created_at: string }[]; }
export interface PolicyVersion { id: string; version: string; rules: { requires_phrases?: string[] }; checklist: unknown; }
export interface Policy { id: string; name: string; description: string; versions: PolicyVersion[]; }
export interface Stats { total_documents: number; awaiting_review: number; processing_failures: number; completed: number; total_findings: number; }

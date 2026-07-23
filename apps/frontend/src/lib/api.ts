import { useAuthStore } from "../store/auth";

// Par défaut, le frontend et le backend sont servis sur le même domaine (nginx proxifie /api
// vers le backend) — chemin relatif. VITE_API_URL permet de déployer les deux séparément
// (ex: frontend sur Netlify, backend sur Render), en pointant vers l'URL complète du backend.
const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) return false;
    const data = await res.json();
    useAuthStore.getState().setSession(data.accessToken, data.user);
    return true;
  } catch {
    return false;
  }
}

async function request(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, options, false);
    }
    useAuthStore.getState().clear();
  }
  return res;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await request(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
    throw new ApiError(body.error ?? `Erreur ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

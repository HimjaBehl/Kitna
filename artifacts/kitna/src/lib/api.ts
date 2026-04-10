const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function getToken(): string | null {
  return localStorage.getItem("kitna_token");
}

export function setToken(token: string): void {
  localStorage.setItem("kitna_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("kitna_token");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${BASE}/api${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string> ?? {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = `${BASE}/login`;
  }
  return res;
}

// Normalise the API base URL: ensure it's absolute (with scheme) and has no
// trailing slash. Without a scheme the browser treats it as a RELATIVE path and
// appends it to the current page (e.g. /admin/<host>/api/...) → 405 errors.
const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5008";
const API_URL = (() => {
  let u = String(RAW_API_URL).trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
})();

export const TOKEN_KEY = "presnag_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, isForm = false } = opts;
  const headers: Record<string, string> = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function uploadImage(file: File, folder = "presnag"): Promise<string> {
  const fd = new FormData();
  fd.append("image", file);
  const data = await api<{ url: string }>(`/api/uploads/image?folder=${folder}`, {
    method: "POST",
    body: fd,
    auth: true,
    isForm: true,
  });
  return data.url;
}

export { API_URL };

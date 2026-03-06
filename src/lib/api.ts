type ApiError = { message: string; status?: number };

function getToken() {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem("auth_token");
  else localStorage.setItem("auth_token", token);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let msg = `Request gagal (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    const err: ApiError = { message: msg, status: res.status };
    throw err;
  }
  return (await res.json()) as T;
}


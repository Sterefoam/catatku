export class ApiClientError extends Error {
  status: number;
  details?: Record<string, string>;

  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; details?: Record<string, string> };
    throw new ApiClientError(
      body.error ?? "Terjadi kesalahan. Coba lagi.",
      response.status,
      body.details,
    );
  }

  return payload as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

export function apiPost<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiPut<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "PUT", body: JSON.stringify(body) });
}

export function apiDelete<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "DELETE",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan. Coba lagi.";
}

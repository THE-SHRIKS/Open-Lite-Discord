/* ─── useApi — Typed fetch wrapper ─────────────────────────────────────────── */

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export class ApiException extends Error {
  code: string;
  status: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiException';
    this.code = error.code;
    this.status = error.status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData && init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined ?? {}),
    },
  });

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = `HTTP ${res.status}`;

    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
        code?: string;
        message?: string;
      };
      code = body.error?.code ?? body.code ?? code;
      message = body.error?.message ?? body.message ?? message;
    } catch {
      // ignore parse failures
    }

    throw new ApiException({ code, message, status: res.status });
  }

  if (res.status === 204) return undefined as T;

  const json = (await res.json()) as { data?: T } & T;
  if (json && typeof json === 'object' && 'data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
    }),
};

export default api;

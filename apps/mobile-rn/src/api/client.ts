type FetchImpl = (
  url: string,
  opts: any
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

interface Deps {
  apiBase: string;
  fetchImpl?: FetchImpl;
  getToken: () => string;
  idFactory?: () => string;
}

function defaultId() {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createCloudClient(deps: Deps) {
  const apiBase = (deps.apiBase || "").replace(/\/+$/, "");
  const fetchImpl: FetchImpl = deps.fetchImpl || (globalThis as any).fetch?.bind(globalThis);
  const getToken = deps.getToken;
  const idFactory = deps.idFactory || defaultId;
  if (!fetchImpl) throw new Error("cloud-client: no fetch");

  async function api(path: string, options: any = {}): Promise<any> {
    const headers: any = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body = options.body;
    const method = String(options.method || "GET").toUpperCase();
    const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (mutating && body && typeof body === "object" && !body.clientOpId) {
      body = { ...body, clientOpId: idFactory() };
    }
    const res = await fetchImpl(`${apiBase}${path}`, {
      ...options,
      headers,
      body: body && typeof body !== "string" ? JSON.stringify(body) : body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return { api, apiBase };
}

export type CloudClient = ReturnType<typeof createCloudClient>;

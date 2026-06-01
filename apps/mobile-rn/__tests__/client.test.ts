import { createCloudClient } from "../src/api/client";

test("GET 带 Bearer,无 clientOpId", async () => {
  const calls: any[] = [];
  const fetchImpl = async (url: string, opts: any) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ ok: 1 }) } as any;
  };
  const c = createCloudClient({ apiBase: "https://c.test", fetchImpl, getToken: () => "T" });
  const d = await c.api("/api/me");
  expect(d.ok).toBe(1);
  expect(calls[0].url).toBe("https://c.test/api/me");
  expect(calls[0].opts.headers.Authorization).toBe("Bearer T");
  expect(calls[0].opts.body).toBeUndefined();
});

test("POST 注入 clientOpId 并序列化", async () => {
  let seen: any;
  const fetchImpl = async (_u: string, o: any) => { seen = o; return { ok: true, status: 200, json: async () => ({}) } as any; };
  const c = createCloudClient({ apiBase: "https://c.test", fetchImpl, getToken: () => "", idFactory: () => "op_x" });
  await c.api("/api/x", { method: "POST", body: { a: 1 } });
  expect(JSON.parse(seen.body)).toEqual({ a: 1, clientOpId: "op_x" });
});

test("预置 clientOpId 不被覆盖", async () => {
  let seen: any;
  const fetchImpl = async (_u: string, o: any) => { seen = o; return { ok: true, status: 200, json: async () => ({}) } as any; };
  const c = createCloudClient({ apiBase: "https://c.test", fetchImpl, getToken: () => "", idFactory: () => "op_new" });
  await c.api("/api/x", { method: "PUT", body: { clientOpId: "op_keep" } });
  expect(JSON.parse(seen.body).clientOpId).toBe("op_keep");
});

test("非 2xx 抛 data.error", async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: "no" }) } as any);
  const c = createCloudClient({ apiBase: "https://c.test", fetchImpl, getToken: () => "" });
  await expect(c.api("/api/x")).rejects.toThrow("no");
});

// Unit test for lib/ai-gateway.js (Cloudflare AI Gateway routing + safety switch).
// No network. Run: node --test tests/ai-gateway.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const Anthropic = require("@anthropic-ai/sdk");
const { anthropicGateway, gatewayFetch } = require("../lib/ai-gateway");

const GW = "https://gateway.ai.cloudflare.com/v1/acct/brill-ai/anthropic";
const URL1 = GW + "/v1/messages";
const DIRECT = "https://api.anthropic.com/v1/messages";
const ENV = { AI_GATEWAY_URL: "https://gateway.ai.cloudflare.com/v1/acct/brill-ai/", AI_GATEWAY_TOKEN: "tok" };
const init = () => ({ method: "POST", headers: { "x-api-key": "k", "content-type": "application/json" }, body: "{}" });

function recorder(responses) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, headers: new Headers(opts.headers) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (Array.isArray(next)) return new Response(next[2] || "{}", { status: next[0], headers: next[1] });
    return new Response("{}", { status: next });
  };
  return { calls, f };
}

test("no vars (or only one): direct, no extra client options", () => {
  assert.deepEqual(anthropicGateway("hq-to-do", {}), {});
  assert.deepEqual(anthropicGateway("hq-to-do", { AI_GATEWAY_URL: ENV.AI_GATEWAY_URL }), {});
  assert.deepEqual(anthropicGateway("hq-to-do", { AI_GATEWAY_TOKEN: "tok" }), {});
});

test("vars set: gateway base url, trailing slash trimmed", () => {
  const o = anthropicGateway("hq-to-do", ENV);
  assert.equal(o.baseURL, GW);
  assert.equal(typeof o.fetch, "function");
});

test("200 via gateway carries pass, app tag and provider key", async () => {
  const { calls, f } = recorder([200]);
  const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, init());
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL1);
  assert.equal(calls[0].headers.get("cf-aig-authorization"), "Bearer tok");
  assert.equal(calls[0].headers.get("cf-aig-metadata"), '{"app":"hq-to-do"}');
  assert.equal(calls[0].headers.get("x-api-key"), "k");
});

for (const s of [401, 500, 502, 503]) {
  test(`${s} from gateway (no cf-aig-step) falls back to Anthropic without gateway headers`, async () => {
    const { calls, f } = recorder([s, 200]);
    const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, init());
    assert.equal(r.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url, DIRECT);
    assert.equal(calls[1].headers.get("cf-aig-authorization"), null);
    assert.equal(calls[1].headers.get("cf-aig-metadata"), null);
    assert.equal(calls[1].headers.get("x-api-key"), "k");
  });
}

test("network error falls back", async () => {
  const { calls, f } = recorder([new TypeError("fetch failed"), 200]);
  const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, init());
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, DIRECT);
  assert.equal(calls[1].headers.get("cf-aig-authorization"), null);
});

test("401 sent by Anthropic itself (cf-aig-step present) is returned, not retried", async () => {
  const { calls, f } = recorder([[401, { "cf-aig-step": "0" }]]);
  const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, init());
  assert.equal(r.status, 401);
  assert.equal(calls.length, 1);
});

test("429 (spend or rate limit) and other 4xx are not bypassed", async () => {
  for (const s of [429, 400, 403]) {
    const { calls, f } = recorder([s]);
    const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, init());
    assert.equal(r.status, s);
    assert.equal(calls.length, 1);
  }
});

test("aborted request is not retried", async () => {
  const ac = new AbortController(); ac.abort();
  let { calls, f } = recorder([new Error("aborted")]);
  await assert.rejects(gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, { ...init(), signal: ac.signal }));
  assert.equal(calls.length, 1);
  ({ calls, f } = recorder([503]));
  const r = await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, { ...init(), signal: ac.signal });
  assert.equal(r.status, 503);
  assert.equal(calls.length, 1);
});

test("Bearer key goes to the gateway as x-api-key; direct fallback unchanged", async () => {
  const { calls, f } = recorder([503, 200]);
  await gatewayFetch(GW, "tok", "hq-to-do", f)(URL1, { method: "POST", headers: { authorization: "Bearer k" }, body: "{}" });
  assert.equal(calls[0].headers.get("x-api-key"), "k");
  assert.equal(calls[0].headers.get("authorization"), null);
  assert.equal(calls[1].headers.get("authorization"), "Bearer k");
  assert.equal(calls[1].headers.get("x-api-key"), null);
});

test("real Anthropic SDK client: request lands on the gateway with the right headers", async () => {
  const ok = JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: "hi" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
  const { calls, f } = recorder([[200, { "content-type": "application/json" }, ok]]);
  const client = new Anthropic({ apiKey: "k", maxRetries: 0, baseURL: GW, fetch: gatewayFetch(GW, "tok", "hq-to-do", f) });
  const msg = await client.messages.create({ model: "x", max_tokens: 5, messages: [{ role: "user", content: "hi" }] });
  assert.equal(msg.content[0].text, "hi");
  assert.equal(calls[0].url, URL1);
  assert.equal(calls[0].headers.get("x-api-key"), "k");
  assert.equal(calls[0].headers.get("cf-aig-authorization"), "Bearer tok");
  assert.equal(calls[0].headers.get("cf-aig-metadata"), '{"app":"hq-to-do"}');
});

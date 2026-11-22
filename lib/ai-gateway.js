/* Shared by the Vercel functions: Cloudflare AI Gateway for Claude calls.
 *
 * When AI_GATEWAY_URL (https://gateway.ai.cloudflare.com/v1/<account>/<gateway>)
 * and AI_GATEWAY_TOKEN are both set on the Vercel project, Claude calls go
 * through the gateway: one spend dashboard across apps, per-app limits, logs.
 * Each call is tagged with the app name (cf-aig-metadata) so spend splits per
 * app. When either variable is missing nothing changes: calls go straight to
 * api.anthropic.com as before.
 *
 * Safety switch: if the gateway can't be reached, answers 5xx, or rejects its
 * own pass (a 401 without the cf-aig-step header), the same request is sent
 * straight to Anthropic, so the assistant never stops because of Cloudflare.
 * A 429 (a gateway spend or rate limit) is NOT retried directly: that limit is
 * the point. A 401 that Anthropic itself sent (bad key) is returned as-is.
 *
 *   new Anthropic({ ...opts, ...anthropicGateway("hq-to-do") })
 */

const ANTHROPIC_DIRECT = "https://api.anthropic.com";

function gatewayFetch(gatewayBase, token, app, inner) {
  const f = inner || fetch;
  return async (input, init) => {
    init = init || {};
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const base = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const viaGateway = new Headers(base);
    // The gateway rejects "Authorization: Bearer" for Anthropic; it wants the
    // key in x-api-key. Convert on the gateway leg only.
    const auth = viaGateway.get("authorization") || "";
    if (!viaGateway.has("x-api-key") && auth.startsWith("Bearer ")) {
      viaGateway.set("x-api-key", auth.slice(7));
      viaGateway.delete("authorization");
    }
    viaGateway.set("cf-aig-authorization", `Bearer ${token}`);
    viaGateway.set("cf-aig-metadata", JSON.stringify({ app }));
    const aborted = () => !!(init.signal && init.signal.aborted);
    const direct = () => f(url.replace(gatewayBase, ANTHROPIC_DIRECT), { ...init, headers: base });
    try {
      const r = await f(url, { ...init, headers: viaGateway });
      const providerAnswered = r.headers.get("cf-aig-step") !== null;
      if (r.status < 500 && (r.status !== 401 || providerAnswered)) return r;
      if (aborted()) return r;
      console.error(`ai-gateway: ${r.status} from gateway, calling Anthropic directly`);
      try { if (r.body) await r.body.cancel(); } catch (e) { /* ignore */ }
      return await direct();
    } catch (e) {
      if (aborted()) throw e;
      console.error(`ai-gateway: unreachable (${e && e.message ? e.message : e}), calling Anthropic directly`);
      return await direct();
    }
  };
}

// Extra Anthropic client options: empty (direct, as before) unless both
// gateway variables are set. `env` is for tests only.
function anthropicGateway(app, env) {
  const e = env || process.env;
  const url = String(e.AI_GATEWAY_URL || "").trim().replace(/\/+$/, "");
  const token = String(e.AI_GATEWAY_TOKEN || "").trim();
  if (!url || !token) return {};
  const gatewayBase = `${url}/anthropic`;
  return { baseURL: gatewayBase, fetch: gatewayFetch(gatewayBase, token, app) };
}

module.exports = { anthropicGateway, gatewayFetch, ANTHROPIC_DIRECT };

/* Shared by the Vercel functions: turn the app's Supabase access token into a
 * verified user (or null). Fail closed — any missing config, missing header,
 * network error, or non-user token (e.g. the public anon key replayed as a
 * bearer) yields null and the caller answers 401 with no data.
 *
 * Same check as api/base-tasks.js: GET /auth/v1/user only succeeds for a
 * valid, unexpired *user* access token, and we insist on an actual user id.
 */

function supabaseEnv() {
  const env = process.env;
  return {
    url: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || "",
    anonKey: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "",
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function bearerToken(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function verifyUser(req) {
  const { url, anonKey } = supabaseEnv();
  const token = bearerToken(req);
  if (!url || !anonKey || !token) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user || !user.id) return null;
    return { id: user.id, email: user.email || "" };
  } catch (e) {
    return null;
  }
}

// Vercel parses JSON bodies for us when Content-Type is application/json, but
// be tolerant of a raw string (e.g. a different content type or local dev).
function jsonBody(req) {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch (e) { return {}; } }
  return b;
}

module.exports = { supabaseEnv, bearerToken, verifyUser, jsonBody };

const enc = new TextEncoder();
const COOKIE = "tms_admin";
const TTL = 12 * 60 * 60;

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - s.length % 4) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function key(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
}
export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
}
function getCookie(request) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const [name,...value] = part.trim().split("=");
    if (name === COOKIE) return value.join("=");
  }
  return null;
}
export async function createSessionCookie(secret) {
  const payload = b64url(enc.encode(JSON.stringify({exp:Math.floor(Date.now()/1000)+TTL})));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(payload)));
  return `${COOKIE}=${payload}.${b64url(signature)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
}
export async function isAuthenticated(request, secret) {
  if (!secret || secret.length < 32) return false;
  const token = getCookie(request);
  if (!token) return false;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra) return false;
  try {
    const valid = await crypto.subtle.verify("HMAC", await key(secret), unb64url(sig), enc.encode(payload));
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return Number.isInteger(session.exp) && session.exp > Math.floor(Date.now()/1000);
  } catch { return false; }
}
export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
export async function constantTimeStringEqual(a,b) {
  const da = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(a)));
  const db = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(b)));
  let diff = 0; for (let i=0;i<da.length;i++) diff |= da[i]^db[i];
  return diff === 0;
}

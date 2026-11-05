import {constantTimeStringEqual,createSessionCookie,isSameOrigin,json} from "../../_lib/auth.js";
export async function onRequestPost({request,env}) {
  if (!isSameOrigin(request)) return json({error:"Permintaan tidak diizinkan."},403);
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return json({error:"Konfigurasi keamanan admin belum lengkap."},500);
  let body; try { body=await request.json(); } catch { return json({error:"Format permintaan tidak valid."},400); }
  const password=typeof body.password==="string"?body.password:"";
  if (!password || password.length>256 || !await constantTimeStringEqual(password,env.ADMIN_PASSWORD)) return json({error:"Password tidak cocok."},401);
  return json({ok:true},200,{"Set-Cookie":await createSessionCookie(env.SESSION_SECRET)});
}

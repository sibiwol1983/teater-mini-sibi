import {isAuthenticated,isSameOrigin,json} from "../../_lib/auth.js";
const MAX_BYTES=30*1024*1024*1024;
const MAX_SECONDS=10*60*60;
function decodeMetadata(header) {
  const out={};
  for (const item of (header||"").split(",")) {
    const [rawKey,rawValue]=item.trim().split(/\s+/,2);
    if (!rawKey) continue;
    try { out[rawKey.toLowerCase()]=rawValue===undefined?"":atob(rawValue); }
    catch { throw new Error("Metadata upload tidak valid."); }
  }
  return out;
}
export async function onRequestOptions() {
  return new Response(null,{status:204,headers:{"Tus-Version":"1.0.0","Tus-Extension":"creation,termination,creation-with-upload,checksum","Tus-Max-Size":String(MAX_BYTES),"Cache-Control":"no-store"}});
}
export async function onRequestPost({request,env}) {
  if (!isSameOrigin(request)) return json({error:"Permintaan tidak diizinkan."},403);
  if (!await isAuthenticated(request,env.SESSION_SECRET)) return json({error:"Silakan login sebagai administrator."},401);
  const accountId=env.CLOUDFLARE_ACCOUNT_ID, apiToken=env.CLOUDFLARE_API_TOKEN;
  if (!accountId||!apiToken) return json({error:"Konfigurasi Cloudflare Stream belum lengkap."},500);
  const lengthHeader=request.headers.get("Upload-Length"), length=Number(lengthHeader);
  if (request.headers.get("Tus-Resumable")!=="1.0.0" || !lengthHeader || !Number.isSafeInteger(length) || length<=0 || length>MAX_BYTES) return json({error:"Ukuran file atau versi TUS tidak valid (maksimum 30 GB)."},400);
  let meta; try { meta=decodeMetadata(request.headers.get("Upload-Metadata")); } catch(e) { return json({error:e.message},400); }
  let title=""; try { title=decodeURIComponent(meta.name||"").trim(); } catch { return json({error:"Nama video tidak valid."},400); }
  const seconds=Number(meta.maxdurationseconds), expiry=meta.expiry||"";
  if (!title||title.length>200||!Number.isInteger(seconds)||seconds<1||seconds>MAX_SECONDS) return json({error:"Nama video dan durasi maksimum (1–600 menit) wajib diisi."},400);
  const exp=Date.parse(expiry), now=Date.now();
  if (!Number.isFinite(exp)||exp<=now||exp>now+8*24*60*60*1000) return json({error:"Masa berlaku upload tidak valid. Silakan mulai upload baru."},400);
  const allowedOrigins="teater-mini-sibi.win,teater-mini-sibi.pages.dev";
  const metadata=[`name ${btoa(unescape(encodeURIComponent(title)))}`,`maxDurationSeconds ${btoa(String(seconds))}`,`expiry ${btoa(expiry)}`,`allowedOrigins ${btoa(allowedOrigins)}`].join(",");
  const url=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream?direct_user=true`;
  let upstream;
  try { upstream=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${apiToken}`,"Tus-Resumable":"1.0.0","Upload-Length":String(length),"Upload-Metadata":metadata,"Upload-Creator":"teater-mini-sibi-admin"}}); }
  catch { return json({error:"Tidak dapat menghubungi Cloudflare Stream. Coba lagi."},502); }
  if (!upstream.ok) return json({error:"Cloudflare menolak pembuatan upload. Periksa kapasitas penyimpanan dan izin Stream Write."},502);
  const location=upstream.headers.get("Location");
  if (!location) return json({error:"Cloudflare tidak mengembalikan alamat upload TUS."},502);
  const headers=new Headers({Location:location,"Tus-Resumable":"1.0.0","Cache-Control":"no-store"});
  const mediaId=upstream.headers.get("stream-media-id"); if (mediaId) headers.set("stream-media-id",mediaId);
  return new Response(null,{status:201,headers});
}

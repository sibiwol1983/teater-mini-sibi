import {clearSessionCookie,isSameOrigin,json} from "../../_lib/auth.js";
export async function onRequestPost({request}) {
  if (!isSameOrigin(request)) return json({error:"Permintaan tidak diizinkan."},403);
  return json({ok:true},200,{"Set-Cookie":clearSessionCookie()});
}

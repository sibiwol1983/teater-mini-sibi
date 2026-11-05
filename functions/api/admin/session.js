import {isAuthenticated,json} from "../../_lib/auth.js";
export async function onRequestGet({request,env}) {
  const ok=await isAuthenticated(request,env.SESSION_SECRET);
  return json({authenticated:ok},ok?200:401);
}

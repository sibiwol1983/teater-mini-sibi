
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.BUCKET) {
    return json({ error: "Penyimpanan poster belum terhubung." }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key || !/^posters\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(key)) {
    return json({ error: "Poster tidak ditemukan." }, 404);
  }

  try {
    const object = await env.BUCKET.get(key);

    if (!object) {
      return json({ error: "Poster tidak ditemukan." }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(object.body, {
      headers
    });
  } catch (error) {
    return json({ error: "Gagal mengambil poster." }, 500);
  }
}

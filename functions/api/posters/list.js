
import { json } from "../../_lib/auth.js";

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ error: "Database belum terhubung." }, 500);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT id, title, description, category,
             image_key, telegram_url, created_at
      FROM posters
      WHERE is_published = 1
      ORDER BY created_at DESC
    `).all();

    return json({
      success: true,
      posters: result.results || []
    });
  } catch (error) {
    return json({
      error: "Gagal mengambil daftar poster."
    }, 500);
  }
}


import { isAuthenticated, isSameOrigin, json } from "../../_lib/auth.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


async function sendTelegramAnnouncement(env, data) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHANNEL_ID) {
    return false;
  }

  const caption = [
    "🎬 <b>DRAMA BARU TELAH HADIR!</b>",
    "",
    `📺 <b>${escapeHtml(data.title)}</b>`,
    `🏷️ Kategori: ${escapeHtml(data.category)}`,
    data.description
      ? `📝 ${escapeHtml(data.description)}`
      : "",
    "",
    "🍿 Selamat menonton!",
    "",
    "📌 <b>Teater Mini Sibi</b>"
  ].filter(Boolean).join("\n");

  try {
    const imageObject = await env.BUCKET.get(data.imageKey);

    if (!imageObject) {
      return false;
    }

    const form = new FormData();

    form.append("chat_id", env.TELEGRAM_CHANNEL_ID);
    form.append("photo", imageObject.body, "poster.jpg");
    form.append("caption", caption);
    form.append("parse_mode", "HTML");

    form.append(
      "reply_markup",
      JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "▶ TONTON SEKARANG",
              url: data.telegramUrl
            }
          ]
        ]
      })
    );

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: "POST",
        body: form
      }
    );

    const result = await response.json();

    return response.ok && result.ok === true;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) {
    return json({ error: "Permintaan tidak diizinkan." }, 403);
  }

  if (!await isAuthenticated(request, env.SESSION_SECRET)) {
    return json({ error: "Silakan login sebagai administrator." }, 401);
  }

  const form = await request.formData();

  const file = form.get("image");
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  const category = String(form.get("category") || "").trim();
  const telegramUrl = String(form.get("telegram_url") || "").trim();

  if (!file || typeof file === "string") {
    return json({ error: "Poster wajib dipilih." }, 400);
  }

  if (!title || !category || !telegramUrl) {
    return json({
      error: "Judul, kategori, dan tautan Telegram wajib diisi."
    }, 400);
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    return json({ error: "Ukuran poster maksimal 10 MB." }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return json({
      error: "Format poster harus JPG, PNG, atau WebP."
    }, 400);
  }

  try {
    const url = new URL(telegramUrl);
    if (
      url.protocol !== "https:" ||
      !["t.me", "telegram.me"].includes(url.hostname)
    ) {
      return json({ error: "Tautan Telegram tidak valid." }, 400);
    }
  } catch {
    return json({ error: "Tautan Telegram tidak valid." }, 400);
  }

  if (!env.BUCKET || !env.DB) {
    return json({ error: "Binding R2 atau D1 belum tersedia." }, 500);
  }

  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[file.type];

  const imageKey = `posters/${crypto.randomUUID()}.${extension}`;

  try {
    await env.BUCKET.put(imageKey, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    await env.DB.prepare(`
      INSERT INTO posters
      (title, description, category, image_key, telegram_url, is_published)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(
      title,
      description,
      category,
      imageKey,
      telegramUrl
    ).run();
    
const announcementSent = await sendTelegramAnnouncement(env, {
  title,
  description,
  category,
  telegramUrl,
  imageKey
});

    return json({
      success: true,
      message: announcementSent
        ? "Poster berhasil disimpan dan diumumkan ke Telegram."
        : "Poster berhasil disimpan, tetapi pengumuman Telegram gagal dikirim.",
      telegram_notified: announcementSent,
      image_key: imageKey
    }, 201);

  } catch (error) {
    await env.BUCKET.delete(imageKey).catch(() => {});
    return json({ error: "Gagal menyimpan poster." }, 500);
  }
}

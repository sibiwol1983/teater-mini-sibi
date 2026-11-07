export function onRequest() {
  return new Response(
    JSON.stringify({
      status: "berhasil",
      pesan: "Pages Functions berjalan"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

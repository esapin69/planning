export async function onRequest() {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "API Cloudflare non utilisée. Données via Google Apps Script."
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    }
  );
}

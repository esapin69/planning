export async function onRequest() {
  return new Response(JSON.stringify({
    ok: true,
    page: "stagiaires",
    source: "Google Apps Script"
  }), {
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

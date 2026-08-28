const LEGACY_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbwrhifE-4wl-YvKOjJI8HZ_g_ota7tajTKLY3jvLKEF9AvSPjIbVpqcSkSRcl5OdWV9/exec";

const PLANNING_PAGES = new Set([
  "/",
  "/index.html",
  "/mois.html",
  "/apercu.html"
]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  if (!PLANNING_PAGES.has(url.pathname)) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (!html.includes(LEGACY_GOOGLE_SCRIPT)) return new Response(html, response);

  const supabaseBridge = `${url.origin}/api/ghe-data`;
  const rewritten = html.split(LEGACY_GOOGLE_SCRIPT).join(supabaseBridge);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-store");
  headers.set("x-planning-data-source", "supabase");

  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

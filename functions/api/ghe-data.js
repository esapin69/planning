export async function onRequest(context) {
  return Response.json({ ok: true, mode: new URL(context.request.url).searchParams.get('mode') || 'health' });
}

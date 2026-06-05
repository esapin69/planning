export async function onRequest(context) {
  try {
    const url = context.env.GOOGLE_SCRIPT_FORMATIONS_URL;

    if (!url) {
      return Response.json({
        ok: false,
        error: "GOOGLE_SCRIPT_FORMATIONS_URL manquant"
      }, { status: 500 });
    }

    const response = await fetch(url, {
      cache: "no-store"
    });

    const data = await response.json();

    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store"
      }
    });

  } catch (error) {
    return Response.json({
      ok: false,
      error: "Impossible de charger les formations"
    }, { status: 500 });
  }
}

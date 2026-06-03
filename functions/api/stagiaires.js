const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzqeWZ3fXtxCf5K7At0EQmBaDqsrX2nKi4gsUA7s_kHhlE_ErF-CMCs-Ydj0H09rxnv/exec";

export async function onRequestGet() {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      headers: {
        accept: "application/json"
      }
    });

    const text = await response.text();

    return new Response(text, {
      status: response.ok ? 200 : 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Impossible de joindre Apps Script"
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      }
    );
  }
}

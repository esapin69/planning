export async function onRequestGet(context) {
  const APPS_SCRIPT_URL = context.env.APPS_SCRIPT_URL;

  if (!APPS_SCRIPT_URL) {
    return jsonResponse({
      ok: false,
      message: 'Variable APPS_SCRIPT_URL manquante dans Cloudflare.'
    }, 500);
  }

  const requestUrl = new URL(context.request.url);
  const forceRefresh = requestUrl.searchParams.get('refresh') === '1';

  const cache = caches.default;
  const cacheKey = new Request(`${requestUrl.origin}${requestUrl.pathname}`);

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const upstream = await fetch(APPS_SCRIPT_URL, {
    method: 'GET',
    headers: {
      'accept': 'application/json'
    }
  });

  if (!upstream.ok) {
    return jsonResponse({
      ok: false,
      message: 'Erreur récupération Apps Script.',
      status: upstream.status
    }, 502);
  }

  const body = await upstream.text();

  const response = new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=1800'
    }
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

const DEFAULT_SUPABASE_URL = "https://yzsrmuxghlengnkyphxj.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_QSlIeH5fyNIDT4RWODKx3A_qcFf8a6i";

const SHIFT_HOURS = Object.freeze({
  M: "06:50-14:40",
  J: "08:30-16:20",
  J4: "10:10-18:00",
  S: "13:30-21:00",
  N: "20:50-06:50"
});

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function initials(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] || "") + (parts[1]?.[0] || parts[0][1] || "")).toUpperCase();
}

function avatarUrl(agent) {
  if (agent?.avatar_id) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(agent.avatar_id)}&sz=w320`;
  }
  return agent?.avatar_url || "";
}

function jsonResponse(payload, status = 200, callback = "") {
  const common = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  };
  if (callback && /^[A-Za-z_$][\w$\.]*$/.test(callback)) {
    return new Response(`${callback}(${JSON.stringify(payload)});`, {
      status,
      headers: { ...common, "Content-Type": "application/javascript; charset=utf-8" }
    });
  }
  return Response.json(payload, { status, headers: common });
}

function textResponse(body, contentType) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function addOneDay(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function toIcs(events, title = "Planning GHE") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planning GHE//Supabase//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(title)}`
  ];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@planning.esapin.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addOneDay(event.date).replace(/-/g, "")}`,
      `SUMMARY:${escapeIcs(event.summary || "Planning")}`,
      `DESCRIPTION:${escapeIcs(event.description || "")}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

async function rpc(context, mode, agent = null, type = null) {
  const env = context.env || {};
  const url = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;
  const token = env.GHE_READ_TOKEN;
  if (!token) throw new Error("GHE_READ_TOKEN manquant");

  const response = await fetch(`${url}/rest/v1/rpc/ghe_read`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      p_token: token,
      p_mode: mode,
      p_agent: agent,
      p_type: type
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 180)}`);
  return text ? JSON.parse(text) : null;
}

function mapAgent(agent) {
  const fullName = [agent?.nom, agent?.prenom].filter(Boolean).join(" ").trim();
  const avatar = avatarUrl(agent);
  return {
    agent: agent?.source_key || "",
    key: agent?.source_key || "",
    agent_key: agent?.source_key || "",
    nom: fullName,
    nomComplet: fullName,
    prenom: agent?.prenom || "",
    ghe: agent?.ghe || "",
    role: agent?.role || "",
    equipe: agent?.equipe || "",
    type_planning: agent?.type_planning || "",
    avatar_image_url: avatar,
    avatar_thumb_url: avatar,
    avatar_url: avatar,
    avatar_id: agent?.avatar_id || "",
    avatar_statut: avatar ? "OK" : "ABSENT"
  };
}

function mapAgenda(raw) {
  const avatar = raw?.avatar_url
    ? raw.avatar_url.replace(/\/file\/d\/([^/]+)\/.*/, "/thumbnail?id=$1&sz=w320")
    : "";
  return {
    ok: raw?.ok !== false,
    agent: raw?.agent || "",
    nom: raw?.nom || "",
    ghe: raw?.ghe || "",
    avatar_image_url: avatar,
    avatar_thumb_url: avatar,
    avatar_url: avatar,
    events: Array.isArray(raw?.events) ? raw.events.map(event => ({
      date: String(event.date || "").slice(0, 10),
      horaire: SHIFT_HOURS[String(event.code || "").toUpperCase()] || "",
      titre: event.code || event.source_value || "",
      summary: event.code || event.source_value || "",
      description: event.observation || "",
      shift_code: event.code || event.source_value || "",
      pastille: event.code || event.source_value || "",
      alerte: event.observation || "",
      equipe: event.equipe || ""
    })) : []
  };
}

function mapTrainees(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const trainee = [row.nom, row.prenom].filter(Boolean).join(" ").trim() || "Stagiaire";
    const ref = String(row.referent || "").trim();
    const shift = String(row.horaires || "").trim();
    const code = /^(M|J4|J|S|N)$/i.test(shift) ? shift.toUpperCase() : "";
    return {
      dateKey: String(row.date_debut || "").slice(0, 10),
      dateLabel: String(row.date_debut || "").slice(0, 10),
      stagiaire: { nomPrenom: trainee, nomComplet: trainee, avatar: { url: "" } },
      referent: { nomComplet: ref || "Référent à attribuer", nomPrenom: ref, ghe: "", telephone: "", matricule: "", avatar: { url: "" } },
      stagiaireShift: { code, label: code || shift, horaire: SHIFT_HOURS[code] || shift, icone: "", imageUrl: "" },
      referentShift: {},
      shift: { code, label: code || shift, horaire: SHIFT_HOURS[code] || shift, icone: "", imageUrl: "" },
      anomalies: { stagiaire: [], referent: [], affectation: [] },
      couverture: { minutes: "", pourcentage: "", critique: "" },
      statut: "OK",
      observation: row.observation || ""
    };
  }).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.stagiaire.nomPrenom.localeCompare(b.stagiaire.nomPrenom, "fr"));
}

function mapFormations(rows, agents) {
  const byKey = new Map((agents || []).map(a => [a.source_key, a]));
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const dateKey = String(row.date_debut || "").slice(0, 10);
    if (!dateKey) continue;
    const title = row.intitule || "Formation";
    const hours = row.horaire || "";
    const key = `${dateKey}|${title}|${hours}`;
    if (!groups.has(key)) {
      groups.set(key, {
        dateKey,
        dateLabel: dateKey,
        semaineLabel: "",
        formation: { intitule: title, horaireAffiche: hours || "Journée", typeLabel: "Formation", typeIcone: "🎓" },
        agents: [],
        anomalies: []
      });
    }
    const a = byKey.get(row.agent_source_key) || {};
    const fullName = [a.nom, a.prenom].filter(Boolean).join(" ").trim() || String(row.agent_source_key || "").replace(/_/g, " ");
    groups.get(key).agents.push({
      nomComplet: fullName,
      nom: a.nom || "",
      prenom: a.prenom || "",
      ghe: a.ghe || "",
      telephone: a.telephone || "",
      matricule: "",
      avatar: { url: avatarUrl(a), initiales: initials(fullName) },
      shift: { code: "FO", label: "Formation", horaire: hours, icone: "🎓", imageUrl: "", imageId: "", visuelPrincipal: "", visuelType: "", categorie: "FORMATION" },
      anomalies: row.observation ? [{ niveau: "warning", resume: row.observation, detail: row.observation }] : []
    });
  }
  return [...groups.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.formation.intitule.localeCompare(b.formation.intitule, "fr"));
}

function monthToParam(value) {
  const months = { janvier: "01", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06", juillet: "07", aout: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12" };
  const raw = String(value || "").trim().toLowerCase();
  if (/^\d{2}\.\d{4}$/.test(raw)) return raw;
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mm = months[normalized];
  const year = new Date().getFullYear();
  return mm ? `${mm}.${year}` : "";
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const mode = String(requestUrl.searchParams.get("mode") || "health").toLowerCase();
  const callback = requestUrl.searchParams.get("callback") || "";
  const agent = normalizeKey(requestUrl.searchParams.get("agent") || "");

  try {
    if (mode === "list" || mode === "avatars") {
      const raw = await rpc(context, "list");
      return jsonResponse({ ok: true, agents: (raw?.agents || []).map(mapAgent) }, 200, callback);
    }

    if (mode === "agenda") {
      return jsonResponse(mapAgenda(await rpc(context, "agenda", agent)), 200, callback);
    }

    if (mode === "telephone") {
      const raw = await rpc(context, "telephone", agent);
      if (!raw?.ok) return jsonResponse({ ok: false, agent }, 200, callback);
      const fullName = [raw.nom, raw.prenom].filter(Boolean).join(" ");
      return jsonResponse({
        ok: true,
        agent: raw.agent || agent,
        ghe: raw.ghe || "",
        telephone: raw.telephone || "",
        telephoneDial: digits(raw.telephone || ""),
        avatar: raw.avatar_url ? raw.avatar_url.replace(/\/file\/d\/([^/]+)\/.*/, "/thumbnail?id=$1&sz=w320") : "",
        initiales: initials(fullName)
      }, 200, callback);
    }

    if (mode === "site_stagiaires_formations" || mode === "stagiaires" || mode === "formations") {
      const type = mode === "stagiaires" ? "stagiaires" : mode === "formations" ? "formations" : String(requestUrl.searchParams.get("type") || "stagiaires").toLowerCase();
      if (type.startsWith("stag")) {
        const raw = await rpc(context, "stagiaires");
        return jsonResponse({ ok: true, items: mapTrainees(raw?.items || []) }, 200, callback);
      }
      const [formations, list] = await Promise.all([rpc(context, "formations"), rpc(context, "list")]);
      return jsonResponse({ ok: true, items: mapFormations(formations?.items || [], list?.agents || []) }, 200, callback);
    }

    if (mode === "ics") {
      const agenda = mapAgenda(await rpc(context, "agenda", agent));
      const events = agenda.events.map(event => ({
        date: event.date,
        summary: event.shift_code || "Planning",
        description: [event.horaire, event.description].filter(Boolean).join(" · ")
      }));
      return textResponse(toIcs(events, agenda.nom ? `Planning ${agenda.nom}` : "Planning GHE"), "text/calendar; charset=utf-8");
    }

    if (mode === "ics_collectif") {
      const type = String(requestUrl.searchParams.get("type") || "stagiaires").toLowerCase();
      if (type.startsWith("form")) {
        const raw = await rpc(context, "formations");
        const events = (raw?.items || []).map(row => ({
          date: String(row.date_debut || "").slice(0, 10),
          summary: `🎓 ${row.intitule || "Formation"} — ${String(row.agent_source_key || "").replace(/_/g, " ")}`,
          description: [row.horaire, row.lieu].filter(Boolean).join(" · ")
        }));
        return textResponse(toIcs(events, "Formations GHE"), "text/calendar; charset=utf-8");
      }
      const raw = await rpc(context, "stagiaires");
      const events = (raw?.items || []).map(row => ({
        date: String(row.date_debut || "").slice(0, 10),
        summary: `👶 ${[row.nom, row.prenom].filter(Boolean).join(" ")}`,
        description: [row.horaires, row.referent ? `Référent : ${row.referent}` : ""].filter(Boolean).join(" · ")
      }));
      return textResponse(toIcs(events, "Stagiaires GHE"), "text/calendar; charset=utf-8");
    }

    if (mode === "pdf_agent") {
      const month = monthToParam(requestUrl.searchParams.get("mois") || "");
      const origin = requestUrl.origin || "https://planning.esapin.com";
      const link = `${origin}/apercu.html?type=agent&agent=${encodeURIComponent(agent)}${month ? `&mois=${encodeURIComponent(month)}` : ""}&print=1`;
      return jsonResponse({ ok: true, lien_pdf: link, dynamique: true }, 200, callback);
    }

    if (mode === "health") {
      const raw = await rpc(context, "health");
      return jsonResponse(raw || { ok: false }, 200, callback);
    }

    return jsonResponse({ ok: false, erreur: "Mode inconnu" }, 400, callback);
  } catch (error) {
    console.error("ghe-data", error);
    return jsonResponse({ ok: false, erreur: "Données temporairement indisponibles" }, 500, callback);
  }
}

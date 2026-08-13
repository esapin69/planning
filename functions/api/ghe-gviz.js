const DEFAULT_SUPABASE_URL = "https://yzsrmuxghlengnkyphxj.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_QSlIeH5fyNIDT4RWODKx3A_qcFf8a6i";

const SHIFT_HOURS = Object.freeze({
  M: ["06:50", "14:40"],
  J: ["08:30", "16:20"],
  J4: ["10:10", "18:00"],
  S: ["13:30", "21:00"],
  N: ["20:50", "06:50"]
});

async function rpc(context, mode) {
  const env = context.env || {};
  const url = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const apiKey = env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;
  const token = env.GHE_READ_TOKEN;
  if (!token) throw new Error("GHE_READ_TOKEN manquant");
  const res = await fetch(`${url}/rest/v1/rpc/ghe_read`, {
    method: "POST",
    headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_mode: mode, p_agent: null, p_type: null })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : {};
}

function avatarUrl(agent) {
  return agent?.avatar_id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(agent.avatar_id)}&sz=w320` : (agent?.avatar_url || "");
}

function splitHours(value) {
  const m = String(value || "").match(/(\d{1,2})[:h](\d{2}).*?(\d{1,2})[:h](\d{2})/i);
  return m ? [`${String(m[1]).padStart(2,"0")}:${m[2]}`, `${String(m[3]).padStart(2,"0")}:${m[4]}`] : ["", ""];
}

function gviz(rows) {
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const body = {
    version: "0.6",
    status: "ok",
    table: {
      cols: headers.map((label, i) => ({ id: `C${i}`, label, type: "string" })),
      rows: rows.map(row => ({ c: headers.map(h => ({ v: row[h] == null ? "" : String(row[h]) })) }))
    }
  };
  return `google.visualization.Query.setResponse(${JSON.stringify(body)});`;
}

function formationRows(formations, agents) {
  const map = new Map((agents || []).map(a => [a.source_key, a]));
  return (formations || []).map(row => {
    const a = map.get(row.agent_source_key) || {};
    const name = [a.nom, a.prenom].filter(Boolean).join(" ") || String(row.agent_source_key || "").replace(/_/g," ");
    const hours = splitHours(row.horaire);
    return {
      DATE_ISO: String(row.date_debut || "").slice(0,10),
      DATE_LABEL: String(row.date_debut || "").slice(0,10),
      FORMATION: row.intitule || "Formation",
      HORAIRE_FORMATION: row.horaire || "",
      AGENT: name,
      NOM: a.nom || "",
      "PRÉNOM": a.prenom || "",
      GHE: a.ghe || "",
      "TÉLÉPHONE": a.telephone || "",
      MATRICULE: "",
      STATUT_AGENT: "FO",
      STATUT_AGENT_LIBELLE: "Formation",
      SHIFT_CODE_CANONIQUE: "FO",
      SHIFT_AFFICHAGE: "Formation",
      "HEURE_DÉBUT": hours[0],
      HEURE_FIN: hours[1],
      AVATAR_URL: avatarUrl(a),
      AFFICHER_SITE: "OUI",
      DATE_ACTIVE_SITE: "OUI",
      NIVEAU_ALERTE: row.observation ? "ATTENTION" : "OK",
      ALERTE: row.observation || "",
      STATUT_LIGNE: "OK"
    };
  });
}

function traineeRows(items) {
  return (items || []).map(row => {
    const shiftRaw = String(row.horaires || "").trim().toUpperCase();
    const code = SHIFT_HOURS[shiftRaw] ? shiftRaw : "";
    const hours = code ? SHIFT_HOURS[code] : splitHours(row.horaires);
    return {
      DATE_ISO: String(row.date_debut || "").slice(0,10),
      DATE_LABEL: String(row.date_debut || "").slice(0,10),
      STAGIAIRE: [row.nom, row.prenom].filter(Boolean).join(" "),
      "RÉFÉRENT": row.referent || "",
      STAGIAIRE_POSTE: code,
      "STAGIAIRE_LIBELLÉ_POSTE": code || row.horaires || "",
      "STAGIAIRE_HEURE_DÉBUT": hours[0] || "",
      STAGIAIRE_HEURE_FIN: hours[1] || "",
      "RÉFÉRENT_POSTE": "",
      "RÉFÉRENT_LIBELLÉ_POSTE": "",
      "RÉFÉRENT_HEURE_DÉBUT": "",
      "RÉFÉRENT_HEURE_FIN": "",
      AFFICHER_SITE: "OUI",
      DATE_ACTIVE_SITE: "OUI",
      STATUT_LIGNE: "OK",
      NIVEAU_ALERTE: "OK",
      ALERTE: row.observation || "",
      COUVERTURE_MINUTES: "",
      COUVERTURE_POURCENTAGE: "",
      COUVERTURE_CRITIQUE: ""
    };
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const type = String(url.searchParams.get("type") || "stagiaires").toLowerCase();
  try {
    let rows;
    if (type.startsWith("form")) {
      const [f, a] = await Promise.all([rpc(context,"formations"), rpc(context,"list")]);
      rows = formationRows(f?.items || [], a?.agents || []);
    } else {
      const s = await rpc(context,"stagiaires");
      rows = traineeRows(s?.items || []);
    }
    return new Response(gviz(rows), { headers: { "Content-Type":"application/javascript; charset=utf-8", "Cache-Control":"no-store" } });
  } catch (error) {
    console.error("ghe-gviz", error);
    const failure = { version:"0.6", status:"error", errors:[{ reason:"internal_error", message:"Données indisponibles" }] };
    return new Response(`google.visualization.Query.setResponse(${JSON.stringify(failure)});`, { status:500, headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-store"} });
  }
}

/**
 * SUPABASE_SYNC.gs
 * Nouveau pont unique : Photocopie brute -> Supabase.
 *
 * Ne modifie jamais les fichiers sources ni la Photocopie brute.
 * Une synchronisation est reconstruite en mémoire, envoyée par lots, puis
 * les anciennes lignes ne sont supprimées qu'après réussite complète d'une entité.
 *
 * Propriétés Script requises :
 *   GHE_SYNC_TOKEN  = secret de synchronisation
 * Optionnelles :
 *   GHE_SUPABASE_URL
 *   GHE_SUPABASE_KEY
 */
const GHE_SYNC = Object.freeze({
  RAW_SPREADSHEET_ID: '11SKglt7NgIjLMwUzu-VnsQmtgiN4t7gx1oMnPgsbaH4',
  SUPABASE_URL: 'https://yzsrmuxghlengnkyphxj.supabase.co',
  SUPABASE_KEY: 'sb_publishable_QSlIeH5fyNIDT4RWODKx3A_qcFf8a6i',
  CHUNK_SIZE: 250,
  MIN_AGENTS: 30,
  MIN_PLANNING: 500,
  PREFIX: Object.freeze({
    ACCESS: '09_ACCES_SITE_EMAILS__Adresse mail et accès au site__01_ACCES_SITE',
    PHONE_JOUR: '02_CONTACT_GHE_TEL__Ressource__Jour',
    PHONE_NUIT: '02_CONTACT_GHE_TEL__Ressource__Nuit',
    JOUR: '03_PLANNING_JOUR__',
    NUIT: '04_PLANNING_NUIT__',
    CHEFS: '05_PLANNING_CHEFS__',
    STAGIAIRES: '06_PLANNING_STAGIAIRES__',
    FORMATIONS: '07_PLANNING_FORMATION__'
  })
});

function SYNC_SUPABASE() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: true, skipped: 'LOCKED' };
  try {
    const ss = SpreadsheetApp.openById(GHE_SYNC.RAW_SPREADSHEET_ID);
    assertRawReady_(ss);

    const sourceVersion = rawVersion_(ss);
    const props = PropertiesService.getScriptProperties();
    if (sourceVersion && props.getProperty('GHE_LAST_SYNC_VERSION') === sourceVersion) {
      return { ok: true, skipped: 'UNCHANGED', sourceVersion };
    }

    const batchId = Utilities.getUuid();
    const planningPack = buildPlanning_(ss);
    if (planningPack.rows.length < GHE_SYNC.MIN_PLANNING) {
      throw new Error('Planning anormalement petit : ' + planningPack.rows.length);
    }

    const agents = buildAgents_(ss, planningPack.teamByAgent);
    if (agents.length < GHE_SYNC.MIN_AGENTS) {
      throw new Error('Annuaire anormalement petit : ' + agents.length);
    }

    const formations = buildFormations_(ss);
    const stagiaires = buildStagiaires_(ss);
    const inaptitudes = buildInaptitudes_(ss);

    syncEntity_('agents', agents, batchId, 'source_key');
    syncEntity_('planning', planningPack.rows, batchId, 'agent_source_key,date,equipe');
    if (formations !== null) syncEntity_('formations', formations, batchId, 'source_key');
    if (stagiaires !== null) syncEntity_('stagiaires', stagiaires, batchId, 'source_key');
    if (inaptitudes !== null) syncEntity_('inaptitudes', inaptitudes, batchId, 'source_fingerprint');

    props.setProperty('GHE_LAST_SYNC_VERSION', sourceVersion || new Date().toISOString());
    props.setProperty('GHE_LAST_SYNC_OK', new Date().toISOString());
    props.setProperty('GHE_LAST_SYNC_COUNTS', JSON.stringify({
      agents: agents.length,
      planning: planningPack.rows.length,
      formations: formations === null ? null : formations.length,
      stagiaires: stagiaires === null ? null : stagiaires.length,
      inaptitudes: inaptitudes === null ? null : inaptitudes.length
    }));

    return { ok: true, batchId, sourceVersion, counts: JSON.parse(props.getProperty('GHE_LAST_SYNC_COUNTS')) };
  } finally {
    lock.releaseLock();
  }
}

function INSTALLER_DECLENCHEUR_SYNC_SUPABASE() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'SYNC_SUPABASE')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('SYNC_SUPABASE').timeBased().everyMinutes(5).create();
  return 'OK';
}

function TESTER_SYNC_SUPABASE_SANS_ECRIRE() {
  const ss = SpreadsheetApp.openById(GHE_SYNC.RAW_SPREADSHEET_ID);
  assertRawReady_(ss);
  const p = buildPlanning_(ss);
  const a = buildAgents_(ss, p.teamByAgent);
  const f = buildFormations_(ss);
  const s = buildStagiaires_(ss);
  const i = buildInaptitudes_(ss);
  return {
    ok: a.length >= GHE_SYNC.MIN_AGENTS && p.rows.length >= GHE_SYNC.MIN_PLANNING,
    sourceVersion: rawVersion_(ss),
    counts: { agents:a.length, planning:p.rows.length, formations:f && f.length, stagiaires:s && s.length, inaptitudes:i && i.length }
  };
}

function assertRawReady_(ss) {
  const sh = ss.getSheetByName('Accueil');
  if (!sh) throw new Error('Onglet Accueil absent de la Photocopie brute.');
  const values = sh.getRange(1, 1, Math.min(30, sh.getLastRow()), 3).getDisplayValues();
  const row = values.find(r => clean_(r[0]).toLowerCase() === 'statut global' || clean_(r[1]).toLowerCase() === 'statut global');
  if (row && !row.some(v => clean_(v).toUpperCase() === 'OK')) throw new Error('Photocopie brute non validée.');
}

function rawVersion_(ss) {
  const sh = ss.getSheetByName('Accueil');
  const values = sh.getRange(1, 1, Math.min(30, sh.getLastRow()), 3).getDisplayValues();
  const pick = label => {
    const row = values.find(r => r.some(v => clean_(v).toLowerCase() === label));
    if (!row) return '';
    const idx = row.findIndex(v => clean_(v).toLowerCase() === label);
    return clean_(row[idx + 1] || '');
  };
  return [pick('début'), pick('fin')].filter(Boolean).join('|');
}

function buildAgents_(ss, teamByAgent) {
  const access = ss.getSheetByName(GHE_SYNC.PREFIX.ACCESS);
  if (!access) throw new Error('Annuaire accès absent.');
  const v = access.getDataRange().getDisplayValues();
  const h = indexHeaders_(v[0]);
  const byKey = {};

  v.slice(1).forEach(row => {
    const nom = clean_(cell_(row,h,'NOM')).toUpperCase();
    const prenom = title_(cell_(row,h,'PRENOM'));
    if (!nom) return;
    const sourceKey = clean_(cell_(row,h,'AGENT_KEY')) || key_(nom + ' ' + prenom);
    const avatarId = clean_(cell_(row,h,'AVATAR_ID'));
    byKey[sourceKey] = {
      source_key: sourceKey,
      nom,
      prenom,
      equipe: teamByAgent[sourceKey] || null,
      ghe: clean_(cell_(row,h,'GHE')) || null,
      telephone: null,
      email: clean_(cell_(row,h,'EMAIL')) || null,
      actif: true,
      role: clean_(cell_(row,h,'ROLE')) || null,
      type_planning: clean_(cell_(row,h,'TYPE_PLANNING')) || null,
      avatar_id: avatarId || null,
      avatar_url: avatarId ? 'https://drive.google.com/file/d/' + avatarId + '/view?usp=drivesdk' : (clean_(cell_(row,h,'AVATAR_URL')) || null),
      acces_site: yes_(cell_(row,h,'ACCES_SITE')),
      acces_chefs: yes_(cell_(row,h,'ACCES_CHEFS')),
      afficher_dans_liste: clean_(cell_(row,h,'AFFICHER_DANS_LISTE')).toLowerCase() !== 'non'
    };
  });

  [[GHE_SYNC.PREFIX.PHONE_JOUR,'JOUR'],[GHE_SYNC.PREFIX.PHONE_NUIT,'NUIT']].forEach(pair => {
    const sh = ss.getSheetByName(pair[0]);
    if (!sh) return;
    const rows = sh.getDataRange().getDisplayValues();
    rows.slice(1).forEach(r => {
      const name = clean_(r[1]);
      const tel = clean_(r[2]);
      if (!name || !tel) return;
      const k = key_(name);
      if (byKey[k]) {
        byKey[k].telephone = tel;
        if (!byKey[k].ghe) byKey[k].ghe = clean_(r[0]) || null;
        if (!byKey[k].equipe) byKey[k].equipe = pair[1];
      }
    });
  });
  return Object.keys(byKey).sort().map(k => byKey[k]);
}

function buildPlanning_(ss) {
  const candidates = [];
  const teamVotes = {};
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    let equipe = '';
    if (name.indexOf(GHE_SYNC.PREFIX.JOUR) === 0) equipe = 'JOUR';
    else if (name.indexOf(GHE_SYNC.PREFIX.NUIT) === 0) equipe = 'NUIT';
    else if (name.indexOf(GHE_SYNC.PREFIX.CHEFS) === 0) equipe = 'CHEFS';
    else return;

    const nominalMonth = monthFromText_(name);
    const values = sh.getDataRange().getDisplayValues();
    const headerIndex = values.slice(0, 10).findIndex(r => r.some(c => norm_(c).replace(/\s/g,'') === 'NOM/PRENOM'));
    if (headerIndex < 0) return;
    const header = values[headerIndex];
    const dateCols = {};
    header.forEach((value, c) => {
      const d = parsePlanningDate_(value, nominalMonth);
      if (d) dateCols[c] = d;
    });

    let i = headerIndex + 1;
    while (i < values.length) {
      const row = values[i];
      if (!isAgentRow_(row)) { i++; continue; }
      const parts = splitPlanningName_(row[0]);
      const agentKey = key_(parts.nom + ' ' + parts.prenom);
      const detail = [];
      let j = i + 1;
      while (j < values.length && !isAgentRow_(values[j])) { detail.push(values[j]); j++; }

      Object.keys(dateCols).forEach(k => {
        const c = Number(k);
        const dateIso = dateCols[c];
        const raw = clean_(row[c]);
        const notes = unique_(detail.map(r => clean_(r[c])).filter(Boolean));
        if (!raw && !notes.length) return;
        const actualMonth = Number(dateIso.slice(5,7));
        candidates.push({
          score: nominalMonth === actualMonth ? 2 : 1,
          row: {
            agent_source_key: agentKey,
            date: dateIso,
            equipe,
            code: cleanShiftCode_(raw) || null,
            observation: notes.join(' | ') || null,
            source_sheet: name,
            source_row: i + 1,
            source_column: columnLetter_(c + 1),
            source_value: raw || null
          }
        });
        if (nominalMonth === actualMonth) {
          teamVotes[agentKey] = teamVotes[agentKey] || {};
          teamVotes[agentKey][equipe] = (teamVotes[agentKey][equipe] || 0) + 1;
        }
      });
      i = j;
    }
  });

  const best = {};
  candidates.forEach(item => {
    const r = item.row;
    const k = [r.agent_source_key,r.date,r.equipe].join('|');
    if (!best[k] || item.score > best[k].score) best[k] = item;
  });
  const teamByAgent = {};
  Object.keys(teamVotes).forEach(agent => {
    teamByAgent[agent] = Object.keys(teamVotes[agent]).sort((a,b) => teamVotes[agent][b] - teamVotes[agent][a])[0];
  });
  return { rows:Object.keys(best).map(k => best[k].row), teamByAgent };
}

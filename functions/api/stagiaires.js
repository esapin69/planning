<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Espace stagiaires</title>

<style>
*{box-sizing:border-box}

body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f4efe4;
  color:#171717;
}

.page{
  max-width:760px;
  margin:auto;
  padding:14px;
}

.hero{
  width:100%;
  display:block;
  border:4px solid #171717;
  border-radius:26px;
  box-shadow:8px 8px 0 #171717;
  margin-bottom:22px;
}

.intro{
  background:#fffaf0;
  border:4px solid #171717;
  border-radius:24px;
  padding:18px;
  box-shadow:7px 7px 0 #171717;
  margin-bottom:24px;
}

h1{
  margin:0 0 10px;
  font-size:34px;
  line-height:1;
  text-transform:uppercase;
}

.intro p{
  margin:0;
  font-size:17px;
  font-weight:800;
}

.status{
  text-align:center;
  font-weight:900;
  color:#6b7280;
  margin:24px 0;
}

.day-block{
  background:#fffaf0;
  border:4px solid #171717;
  border-radius:28px;
  padding:16px;
  margin-bottom:30px;
  box-shadow:8px 8px 0 #171717;
}

.day-title{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:31px;
  font-weight:900;
  color:#102f68;
  margin:0 0 18px;
}

.inner-card{
  position:relative;
  border:4px solid #171717;
  border-radius:24px;
  padding:18px 16px 18px 24px;
  margin-bottom:18px;
  background:#fffdf7;
  overflow:hidden;
}

.inner-card:last-child{margin-bottom:0}

.inner-card.stagiaire::before{
  content:"";
  position:absolute;
  left:0;
  top:0;
  bottom:0;
  width:13px;
  background:#f5a000;
}

.inner-card.agent::before{
  content:"";
  position:absolute;
  left:0;
  top:0;
  bottom:0;
  width:13px;
  background:#20c765;
}

.card-title{
  font-size:27px;
  font-weight:900;
  text-transform:uppercase;
  border-bottom:4px dashed #171717;
  padding-bottom:9px;
  margin-bottom:18px;
}

.person{
  padding:12px 0;
  border-bottom:2px dashed #d6cdbd;
}

.person:last-child{border-bottom:0}

.person-name{
  font-size:25px;
  font-weight:900;
  margin-bottom:14px;
}

.agent-head{
  display:flex;
  align-items:center;
  gap:16px;
  margin-bottom:16px;
}

.avatar{
  width:72px;
  height:72px;
  border-radius:50%;
  object-fit:cover;
  border:4px solid #171717;
  background:#eee;
}

.avatar-placeholder{
  width:72px;
  height:72px;
  border-radius:50%;
  border:4px solid #171717;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:32px;
  background:#f1d58a;
}

.info-box{
  background:#f7f7f2;
  border:2px dashed #d8d0bf;
  border-radius:16px;
  padding:12px;
  margin-top:10px;
}

.info-label{
  font-size:14px;
  font-weight:900;
  color:#667085;
  text-transform:uppercase;
  letter-spacing:1px;
  margin-bottom:6px;
}

.info-value{
  font-size:22px;
  font-weight:900;
  color:#171717;
  line-height:1.25;
  word-break:break-word;
}

.empty{
  text-align:center;
  font-size:18px;
  font-weight:900;
  padding:22px;
  border:3px dashed #171717;
  border-radius:18px;
  background:#fffdf7;
}

.back{
  display:block;
  width:100%;
  text-align:center;
  margin:30px auto 10px;
  padding:17px 20px;
  border:4px solid #171717;
  border-radius:20px;
  background:#102f68;
  color:white;
  font-size:22px;
  font-weight:900;
  text-decoration:none;
  box-shadow:6px 6px 0 #171717;
}
</style>
</head>

<body>
<div class="page">

  <img class="hero" src="Image/Autre page/Photo_stagiaire.png" alt="Espace stagiaires">

  <section class="intro">
    <h1>Espace stagiaires</h1>
    <p>Les stagiaires prévus par date, avec leur référent du jour et les infos utiles.</p>
  </section>

  <div id="status" class="status">Chargement…</div>

  <main id="results">
    <div class="empty">Chargement des stagiaires…</div>
  </main>

  <a class="back" href="index.html">🏠 Retour accueil</a>

</div>

<script>
const API_URL = "https://script.google.com/macros/s/AKfycbzZITQIw7jbrJHyPl7xfcFjv8H1zQrq7yF73ekVx3S23Efjo2fWRsZ-YIiWNOMYCs3r/exec";

function clean(value){
  return value && String(value).trim() !== "" ? String(value).trim() : "Non renseigné";
}

function groupByDate(data){
  const groups = {};

  data.forEach(item => {
    const date = clean(item.date);

    if(!groups[date]){
      groups[date] = {
        date,
        stagiaires: [],
        agents: {}
      };
    }

    groups[date].stagiaires.push({
      nom: item.stagiaire_nom,
      horaire: item.stagiaire_horaire
    });

    const agentKey = clean(item.agent_nom);

    groups[date].agents[agentKey] = {
      nom: item.agent_nom,
      horaire: item.agent_horaire,
      telephone: item.agent_telephone,
      avatar: item.agent_avatar
    };
  });

  return Object.values(groups);
}

function render(data, updatedAt){
  const results = document.getElementById("results");
  const status = document.getElementById("status");

  if(!data || data.length === 0){
    status.textContent = "Aucune donnée trouvée.";
    results.innerHTML = `<div class="empty">Aucun stagiaire prévu.</div>`;
    return;
  }

  const groups = groupByDate(data);

  status.textContent = updatedAt
    ? "Dernière mise à jour : " + new Date(updatedAt).toLocaleString("fr-FR")
    : "Données chargées.";

  results.innerHTML = groups.map(group => {
    const stagiairesHtml = group.stagiaires.map(stagiaire => `
      <div class="person">
        <div class="person-name">🎓 ${clean(stagiaire.nom)}</div>

        <div class="info-box">
          <div class="info-label">🕒 Horaire stagiaire</div>
          <div class="info-value">${clean(stagiaire.horaire)}</div>
        </div>
      </div>
    `).join("");

    const agentsHtml = Object.values(group.agents).map(agent => `
      <div class="person">
        <div class="agent-head">
          ${
            agent.avatar
            ? `<img class="avatar" src="${agent.avatar}" alt="${clean(agent.nom)}">`
            : `<div class="avatar-placeholder">👤</div>`
          }
          <div class="person-name">${clean(agent.nom)}</div>
        </div>

        <div class="info-box">
          <div class="info-label">🕒 Horaire référent</div>
          <div class="info-value">${clean(agent.horaire)}</div>
        </div>

        <div class="info-box">
          <div class="info-label">☎️ Contact / GHE</div>
          <div class="info-value">${clean(agent.telephone)}</div>
        </div>
      </div>
    `).join("");

    return `
      <section class="day-block">
        <h2 class="day-title">📅 ${group.date}</h2>

        <div class="inner-card stagiaire">
          <div class="card-title">Stagiaire(s)</div>
          ${stagiairesHtml}
        </div>

        <div class="inner-card agent">
          <div class="card-title">Agent affilié</div>
          ${agentsHtml}
        </div>
      </section>
    `;
  }).join("");
}

function loadWithJsonp(){
  const callbackName = "stagiairesCallback_" + Date.now();

  window[callbackName] = function(payload){
    render(payload.resultats || [], payload.updatedAt);
    delete window[callbackName];
  };

  const script = document.createElement("script");
  script.src = API_URL + "?callback=" + callbackName;

  script.onerror = function(){
    document.getElementById("status").textContent = "Erreur : API inaccessible.";
    document.getElementById("results").innerHTML = `<div class="empty">Impossible de charger les données.</div>`;
  };

  document.body.appendChild(script);
}

loadWithJsonp();
</script>

</body>
</html>

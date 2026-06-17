// Actions de l’affichage différent

(function(){
  var PASSERELLE_AVATARS = "https://script.google.com/macros/s/AKfycbwrhifE-4wl-YvKOjJI8HZ_g_ota7tajTKLY3jvLKEF9AvSPjIbVpqcSkSRcl5OdWV9/exec";
  var agentsPromise = null;

  function norm(v){
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g,"_")
      .replace(/^_+|_+$/g,"");
  }

  function formatPrenom(v){
    v = String(v || "").trim();
    if(!v) return "";

    return v.toLowerCase().replace(/(^|[ \-'])[a-zà-ÿ]/g, function(c){
      return c.toUpperCase();
    });
  }

  function optimiserImagesPage(){
    var imgs = Array.prototype.slice.call(document.querySelectorAll("img"));

    imgs.forEach(function(img, index){
      img.decoding = "async";

      if(index > 1){
        img.loading = "lazy";
      }else{
        img.loading = "eager";
      }
    });
  }

  function estDemo(agent){
    return norm(agent.nom) === "DEMO" && norm(agent.prenom) === "DEMO";
  }

  function estCadreCachee(agent){
    return norm(agent.nom) === "BURTHIER" && norm(agent.prenom) === "VERONIQUE";
  }

  function doitAfficherCarte(session){
    var agent = session.agent || {};

    if(estDemo(agent)) return false;
    if(estCadreCachee(agent)) return false;

    return true;
  }

  function roleSession(session){
    return String((session.droits && session.droits.role) || "").toLowerCase();
  }

  function estAgentOuChef(session){
    return roleSession(session) === "agent" || roleSession(session) === "chef";
  }

  async function chargerAgentsPasserelle(){
    if(agentsPromise) return agentsPromise;

    agentsPromise = fetch(PASSERELLE_AVATARS + "?mode=list&t=" + Date.now(), {
      method:"GET",
      cache:"no-store"
    })
    .then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(data){
      if(!data || !Array.isArray(data.agents)) return [];
      return data.agents;
    })
    .catch(function(){
      return [];
    });

    return agentsPromise;
  }

  function trouverAgentDansListe(session, agents){
    var agent = session.agent || {};
    var key = norm(agent.agent_key || "");
    var nom = norm(agent.nom || "");
    var prenom = norm(agent.prenom || "");

    return agents.find(function(a){
      var akey = norm(a.agent || a.key || a.agent_key || "");
      var anom = norm(a.nom || a.nomComplet || a.nom_complet || a.fullName || "");
      var aprenom = norm(a.prenom || a.prénom || "");

      return (
        (key && akey === key) ||
        (nom && prenom && anom.includes(nom) && anom.includes(prenom)) ||
        (nom && prenom && anom.includes(nom) && aprenom === prenom)
      );
    }) || null;
  }

  function detecterTypeDepuisValeur(v){
    var n = norm(v);
    if(!n) return "";

    if(n.includes("NUIT") || n === "NIGHT" || n === "N") return "nuit";
    if(n.includes("JOUR") || n.includes("JOURNEE") || n === "DAY" || n === "J") return "jour";

    return "";
  }

  function detecterTypeDansObjet(obj){
    if(!obj) return "";

    if(obj.nuit === true || obj.est_nuit === true || obj.isNight === true) return "nuit";
    if(obj.jour === true || obj.est_jour === true || obj.isDay === true) return "jour";

    var keys = [
      "equipe",
      "équipe",
      "type",
      "planning_type",
      "planning",
      "onglet",
      "onglet_planning",
      "service",
      "team",
      "groupe",
      "shift",
      "poste",
      "categorie",
      "catégorie",
      "source",
      "tab",
      "feuille",
      "worksheet"
    ];

    for(var i=0;i<keys.length;i++){
      var t = detecterTypeDepuisValeur(obj[keys[i]]);
      if(t) return t;
    }

    return "";
  }

  async function trouverTypePlanningAgent(session){
    if(roleSession(session) !== "agent") return "";

    var agent = session.agent || {};
    var key = norm(agent.agent_key || "");
    var cacheKey = "ghe_type_planning_" + key;

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached === "jour" || cached === "nuit") return cached;
    }catch(e){}

    var direct = detecterTypeDansObjet(agent);
    if(direct){
      try{ sessionStorage.setItem(cacheKey, direct); }catch(e){}
      return direct;
    }

    var agents = await chargerAgentsPasserelle();
    var trouve = trouverAgentDansListe(session, agents);

    var depuisListe = detecterTypeDansObjet(trouve);
    if(depuisListe){
      try{ sessionStorage.setItem(cacheKey, depuisListe); }catch(e){}
      return depuisListe;
    }

    return "";
  }

  function ajusterPrenom(el){
    if(!el) return;

    var size = parseFloat(window.getComputedStyle(el).fontSize) || 80;

    while(el.scrollWidth > el.clientWidth && size > 48){
      size -= 2;
      el.style.fontSize = size + "px";
    }

    if(el.scrollWidth > el.clientWidth){
      el.classList.add("ghe-prenom-long");
      el.style.fontSize = "";
    }
  }

  async function trouverAvatar(session){
    var agent = session.agent || {};
    var key = norm(agent.agent_key || "");
    var nom = norm(agent.nom || "");
    var prenom = norm(agent.prenom || "");
    var cacheKey = "ghe_avatar_" + (key || nom + "_" + prenom);

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached) return cached;
    }catch(e){}

    var agents = await chargerAgentsPasserelle();
    var trouve = trouverAgentDansListe(session, agents);

    if(!trouve) return "";

    var avatar =
      trouve.avatar_image_url ||
      trouve.avatar_thumb_url ||
      (trouve.avatar && trouve.avatar.avatar_image_url) ||
      (trouve.avatar && trouve.avatar.avatar_thumb_url) ||
      "";

    if(avatar){
      try{ sessionStorage.setItem(cacheKey, avatar); }catch(e){}
    }

    return avatar;
  }

  async function insererCarteProfil(session){
    if(!doitAfficherCarte(session)) return;

    var bloc1 = document.getElementById("planning-officiel");

    if(!bloc1) return;
    if(document.getElementById("ghe-carte-profil")) return;

    var agent = session.agent || {};
    var prenom = formatPrenom(agent.prenom || "");
    if(!prenom) return;

    var avatar = await trouverAvatar(session);
    if(!avatar) return;

    var img = new Image();

    img.alt = "Avatar";
    img.decoding = "async";
    img.loading = "lazy";

    img.onload = function(){
      var currentBloc = document.getElementById("planning-officiel");
      if(!currentBloc) return;
      if(document.getElementById("ghe-carte-profil")) return;

      var section = document.createElement("section");
      section.className = "ghe-carte-profil";
      section.id = "ghe-carte-profil";

      var avatarWrap = document.createElement("div");
      avatarWrap.className = "ghe-avatar-wrap";
      avatarWrap.id = "ghe-avatar-wrap";

      var prenomEl = document.createElement("div");
      prenomEl.className = "ghe-prenom";
      prenomEl.id = "ghe-prenom";
      prenomEl.textContent = prenom;

      avatarWrap.appendChild(img);
      section.appendChild(avatarWrap);
      section.appendChild(prenomEl);

      currentBloc.insertAdjacentElement("beforebegin", section);

      ajusterPrenom(prenomEl);
    };

    img.onerror = function(){
      // Si l'avatar ne charge pas, on n'affiche pas le bloc profil.
    };

    img.src = avatar;
  }

  async function reglerPlanningOfficiel(session){
    var role = roleSession(session);

    if(role !== "agent"){
      return;
    }

    var typePlanning = await trouverTypePlanningAgent(session);

    if(typePlanning !== "jour" && typePlanning !== "nuit"){
      return;
    }

    var bloc = document.getElementById("planning-officiel");
    if(!bloc) return;

    var destination = "mois.html?type=" + encodeURIComponent(typePlanning);

    bloc.querySelectorAll("[data-open]").forEach(function(el){
      if(el.getAttribute("data-open") === "modal-officiel"){
        el.removeAttribute("data-open");

        el.addEventListener("click", function(e){
          e.preventDefault();
          e.stopPropagation();
          window.location.href = destination;
        }, true);
      }
    });
  }

  function rendreMonPlanningDirect(session){
    if(!estAgentOuChef(session)) return;

    var bloc = document.getElementById("mon-planning-personnel");
    if(!bloc) return;

    bloc.querySelectorAll("[data-open]").forEach(function(el){
      if(el.getAttribute("data-open") === "modal-personnel"){
        el.removeAttribute("data-open");

        el.addEventListener("click", function(e){
          e.preventDefault();
          e.stopPropagation();
          window.location.href = "/__ghe/mon-planning";
        }, true);
      }
    });
  }

  function reglerDemandeChangement(session){
    var role = roleSession(session);
    var bloc = document.getElementById("demander-changement");
    if(!bloc) return;

    if(role === "chef"){
      bloc.remove();
      return;
    }

    if(role !== "agent"){
      return;
    }

    var agent = session.agent || {};
    var agentKey = agent.agent_key || "";
    var nom = agent.nom || "";
    var prenom = agent.prenom || "";

    var url = "./demande-changement.html" +
      "?demandeur_agent=" + encodeURIComponent(agentKey) +
      "&demandeur_nom=" + encodeURIComponent(nom) +
      "&demandeur_prenom=" + encodeURIComponent(prenom);

    bloc.querySelectorAll("a[href*='demande-changement.html']").forEach(function(a){
      a.setAttribute("href", url);
    });
  }

  async function main(){
    try{
      optimiserImagesPage();

      var r = await fetch("/__ghe/me", {
        credentials:"same-origin",
        cache:"no-store"
      });

      if(!r.ok) return;

      var data = await r.json();
      if(!data.ok || !data.session) return;

      var session = data.session;

      await insererCarteProfil(session);
      await reglerPlanningOfficiel(session);
      rendreMonPlanningDirect(session);
      reglerDemandeChangement(session);

    }catch(e){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", main);
  }else{
    main();
  }
})();

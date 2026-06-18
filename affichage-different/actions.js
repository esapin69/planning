// Actions de l'affichage différent — v7
// Rôle : personnaliser l'accueil APRÈS connexion Cloudflare.
// - Avatar + prénom en haut
// - Mon planning personnel direct
// - Planning officiel direct JOUR/NUIT pour agents
// - Chef / total gardent le choix
// - Demande changement préremplie pour agents, cachée aux chefs
(function(){
  var PASSERELLE_AVATARS = "https://script.google.com/macros/s/AKfycbwrhifE-4wl-YvKOjJI8HZ_g_ota7tajTKLY3jvLKEF9AvSPjIbVpqcSkSRcl5OdWV9/exec";
  var AVATAR_DEFAUT = "https://drive.google.com/uc?export=view&id=1_B49ks3EwD6g1iABJ9y5A35u8vuegN-g";
  var agentsPromise = null;

  function clean(v){
    return String(v === undefined || v === null ? "" : v).trim();
  }

  function norm(v){
    return clean(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function texte(obj, keys){
    if(!obj) return "";
    for(var i = 0; i < keys.length; i++){
      var k = keys[i];
      if(obj[k] !== undefined && obj[k] !== null && clean(obj[k]) !== ""){
        return clean(obj[k]);
      }
    }
    return "";
  }

  function agentSession(session){
    return session && session.agent ? session.agent : {};
  }

  function droitsSession(session){
    return session && session.droits ? session.droits : {};
  }

  function agentNom(session){
    return texte(agentSession(session), ["nom", "NOM", "lastName", "lastname"]);
  }

  function agentPrenom(session){
    return texte(agentSession(session), ["prenom", "prénom", "PRENOM", "PRÉNOM", "firstName", "firstname"]);
  }

  function agentKey(session){
    return texte(agentSession(session), ["agent_key", "agent", "key", "AGENT_KEY", "AGENT", "agent_uid", "AGENT_UID"]);
  }

  function roleSession(session){
    return clean(droitsSession(session).role || droitsSession(session).ROLE).toLowerCase();
  }

  function formatPrenom(v){
    v = clean(v);
    if(!v) return "";
    return v.toLowerCase().replace(/(^|[ \-'])[a-zà-ÿ]/g, function(c){
      return c.toUpperCase();
    });
  }

  function normaliserUrlImage(url){
    url = clean(url);
    if(!url) return "";

    var m = url.match(/\/file\/d\/([^/]+)/);
    if(m && m[1]){
      return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(m[1]);
    }

    m = url.match(/[?&]id=([^&]+)/);
    if(m && m[1] && url.indexOf("drive.google.com") !== -1){
      return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(m[1]);
    }

    return url;
  }

  function optimiserImagesPage(){
    Array.prototype.slice.call(document.querySelectorAll("img")).forEach(function(img, index){
      img.decoding = "async";
      img.loading = index > 1 ? "lazy" : "eager";
    });
  }

  function estDemo(session){
    return norm(agentNom(session)) === "DEMO" && norm(agentPrenom(session)) === "DEMO";
  }

  function estCadreCachee(session){
    return norm(agentNom(session)) === "BURTHIER" && norm(agentPrenom(session)) === "VERONIQUE";
  }

  function doitAfficherCarte(session){
    if(estDemo(session)) return false;
    if(estCadreCachee(session)) return false;
    return true;
  }

  function utilisateurConnecteAvecRole(session){
    var role = roleSession(session);
    return role === "agent" || role === "chef" || role === "total";
  }

  async function chargerAgentsPasserelle(){
    if(agentsPromise) return agentsPromise;

    agentsPromise = fetch(PASSERELLE_AVATARS + "?mode=list&t=" + Date.now(), {
      method: "GET",
      cache: "no-store"
    })
    .then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function(data){
      if(!data || !Array.isArray(data.agents)) return [];
      return data.agents;
    })
    .catch(function(err){
      console.warn("GHE passerelle agents indisponible", err);
      return [];
    });

    return agentsPromise;
  }

  function nomCompletObjet(a){
    return texte(a, [
      "agent", "AGENT", "nomComplet", "nom_complet", "fullName", "NOM / PRÉNOM", "NOM_PRENOM", "AGENT_AFFICHE"
    ]);
  }

  function trouverAgentDansListe(session, agents){
    var key = norm(agentKey(session));
    var nom = norm(agentNom(session));
    var prenom = norm(agentPrenom(session));
    var nomPrenom = norm(agentNom(session) + " " + agentPrenom(session));
    var prenomNom = norm(agentPrenom(session) + " " + agentNom(session));

    return agents.find(function(a){
      var akey = norm(texte(a, ["agent_key", "AGENT_KEY", "agent_uid", "AGENT_UID", "agent", "AGENT", "key"]));
      var anom = norm(texte(a, ["nom", "NOM"]));
      var aprenom = norm(texte(a, ["prenom", "prénom", "PRENOM", "PRÉNOM"]));
      var complet = norm(nomCompletObjet(a));

      return (
        (key && akey && akey === key) ||
        (nom && prenom && anom === nom && aprenom === prenom) ||
        (nom && prenom && complet && (complet === nomPrenom || complet === prenomNom)) ||
        (nom && prenom && complet && complet.indexOf(nom) !== -1 && complet.indexOf(prenom) !== -1)
      );
    }) || null;
  }

  function detecterTypeDepuisValeur(v){
    var n = norm(v);
    if(!n) return "";

    if(n === "NUIT" || n === "NIGHT" || n === "N" || n.indexOf("TRAVAIL_NUIT") !== -1) return "nuit";
    if(n === "JOUR" || n === "DAY" || n === "J" || n.indexOf("JOURNEE") !== -1) return "jour";
    if(n === "CHEF" || n === "CHEFS" || n === "TOTAL") return "chef";

    if(n.indexOf("NUIT") !== -1) return "nuit";
    if(n.indexOf("JOUR") !== -1) return "jour";
    if(n.indexOf("CHEF") !== -1) return "chef";

    return "";
  }

  function detecterTypeDansObjet(obj){
    if(!obj) return "";

    if(obj.nuit === true || obj.est_nuit === true || obj.isNight === true) return "nuit";
    if(obj.jour === true || obj.est_jour === true || obj.isDay === true) return "jour";

    var keys = [
      "TYPE_PLANNING", "type_planning", "typePlanning", "planningType",
      "PLANNING", "planning", "type", "TYPE", "equipe", "équipe", "EQUIPE", "ÉQUIPE",
      "onglet", "onglet_planning", "feuille", "source", "team", "groupe", "role", "ROLE",
      "shift", "poste", "SHIFT_CODE", "SHIFT_CATEGORIE", "categorie", "catégorie"
    ];

    for(var i = 0; i < keys.length; i++){
      var t = detecterTypeDepuisValeur(obj[keys[i]]);
      if(t) return t;
    }

    return "";
  }

  async function trouverTypePlanningAgent(session){
    var role = roleSession(session);

    // Chef / total : on garde le choix officiel, on ne force pas jour/nuit.
    if(role === "chef" || role === "total") return "chef";
    if(role !== "agent") return "";

    var key = norm(agentKey(session)) || norm(agentNom(session) + "_" + agentPrenom(session));
    var cacheKey = "ghe_type_planning_v7_" + key;

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached === "jour" || cached === "nuit") return cached;
    }catch(e){}

    var direct = detecterTypeDansObjet(agentSession(session));
    if(direct === "jour" || direct === "nuit"){
      try{ sessionStorage.setItem(cacheKey, direct); }catch(e){}
      return direct;
    }

    var agents = await chargerAgentsPasserelle();
    var trouve = trouverAgentDansListe(session, agents);
    var depuisListe = detecterTypeDansObjet(trouve);

    if(depuisListe === "jour" || depuisListe === "nuit"){
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
    var key = norm(agentKey(session)) || norm(agentNom(session) + "_" + agentPrenom(session));
    var cacheKey = "ghe_avatar_v7_" + key;

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached) return cached;
    }catch(e){}

    var direct = normaliserUrlImage(texte(agentSession(session), [
      "avatar_image_url", "avatar_thumb_url", "avatar_url", "avatar", "AVATAR_URL", "AVATAR_IMAGE_URL", "AVATAR_IMAGE", "AVATAR_ID"
    ]));

    if(direct && direct.indexOf("http") === 0){
      try{ sessionStorage.setItem(cacheKey, direct); }catch(e){}
      return direct;
    }

    var agents = await chargerAgentsPasserelle();
    var trouve = trouverAgentDansListe(session, agents);

    if(!trouve) return AVATAR_DEFAUT;

    var avatar = normaliserUrlImage(
      texte(trouve, ["avatar_image_url", "avatar_thumb_url", "avatar_url", "AVATAR_IMAGE_URL", "AVATAR_URL", "AVATAR_IMAGE"]) ||
      (trouve.avatar && texte(trouve.avatar, ["avatar_image_url", "avatar_thumb_url", "avatar_url", "AVATAR_IMAGE_URL", "AVATAR_URL"]))
    );

    if(!avatar && texte(trouve, ["AVATAR_ID", "avatar_id"])){
      avatar = "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(texte(trouve, ["AVATAR_ID", "avatar_id"]));
    }

    if(!avatar) avatar = AVATAR_DEFAUT;

    try{ sessionStorage.setItem(cacheKey, avatar); }catch(e){}
    return avatar;
  }

  function creerCarteProfil(prenom, avatar){
    var premierBloc = document.getElementById("planning-officiel");
    if(!premierBloc) return;

    var ancienne = document.getElementById("ghe-carte-profil");
    if(ancienne) ancienne.remove();

    var section = document.createElement("section");
    section.className = "ghe-carte-profil";
    section.id = "ghe-carte-profil";

    var avatarWrap = document.createElement("div");
    avatarWrap.className = "ghe-avatar-wrap";
    avatarWrap.id = "ghe-avatar-wrap";

    var img = new Image();
    img.alt = "Avatar";
    img.decoding = "async";
    img.loading = "eager";
    img.src = avatar || AVATAR_DEFAUT;
    img.onerror = function(){
      if(img.src !== AVATAR_DEFAUT){
        img.src = AVATAR_DEFAUT;
      }
    };

    var prenomEl = document.createElement("div");
    prenomEl.className = "ghe-prenom";
    prenomEl.id = "ghe-prenom";
    prenomEl.textContent = prenom;

    avatarWrap.appendChild(img);
    section.appendChild(avatarWrap);
    section.appendChild(prenomEl);

    premierBloc.insertAdjacentElement("beforebegin", section);
    ajusterPrenom(prenomEl);
  }

  async function insererCarteProfil(session){
    if(!doitAfficherCarte(session)) return;

    var prenom = formatPrenom(agentPrenom(session));
    if(!prenom) return;

    // On affiche tout de suite quelque chose. L'avatar réel arrive ensuite.
    creerCarteProfil(prenom, AVATAR_DEFAUT);

    var avatar = await trouverAvatar(session);
    var img = document.querySelector("#ghe-avatar-wrap img");
    if(img && avatar){
      img.src = avatar;
    }
  }

  async function reglerPlanningOfficiel(session){
    var role = roleSession(session);
    var bloc = document.getElementById("planning-officiel");
    if(!bloc) return;

    // Chef / total : on ne force rien, ils gardent la modale officielle.
    if(role === "chef" || role === "total") return;
    if(role !== "agent") return;

    var typePlanning = await trouverTypePlanningAgent(session);
    if(typePlanning !== "jour" && typePlanning !== "nuit") return;

    var destination = "mois.html?type=" + encodeURIComponent(typePlanning);

    bloc.querySelectorAll("[data-open]").forEach(function(el){
      if(el.getAttribute("data-open") === "modal-officiel"){
        el.removeAttribute("data-open");
        el.dataset.gheDestination = destination;

        el.addEventListener("click", function(e){
          e.preventDefault();
          e.stopPropagation();
          window.location.href = destination;
        }, true);
      }
    });
  }

  function rendreMonPlanningDirect(session){
    if(!utilisateurConnecteAvecRole(session)) return;

    // Compatible avec les deux noms d'id utilisés sur la page.
    var bloc = document.getElementById("planning-individuel") || document.getElementById("mon-planning-personnel");
    if(!bloc) return;

    bloc.querySelectorAll("[data-open]").forEach(function(el){
      if(el.getAttribute("data-open") === "modal-personnel"){
        el.removeAttribute("data-open");
        el.dataset.gheDestination = "/__ghe/mon-planning";

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

    if(role !== "agent" && role !== "total") return;

    var url = "./demande-changement.html" +
      "?demandeur_agent=" + encodeURIComponent(agentKey(session)) +
      "&demandeur_nom=" + encodeURIComponent(agentNom(session)) +
      "&demandeur_prenom=" + encodeURIComponent(agentPrenom(session));

    bloc.querySelectorAll("a[href*='demande-changement.html']").forEach(function(a){
      a.setAttribute("href", url);
    });
  }

  async function main(){
    optimiserImagesPage();

    try{
      var r = await fetch("/__ghe/me?t=" + Date.now(), {
        credentials: "same-origin",
        cache: "no-store"
      });

      if(!r.ok) return;

      var data = await r.json();
      if(!data || !data.ok || !data.session) return;

      var session = data.session;

      await insererCarteProfil(session);
      await reglerPlanningOfficiel(session);
      rendreMonPlanningDirect(session);
      reglerDemandeChangement(session);

    }catch(e){
      console.error("GHE affichage différent", e);
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", main);
  }else{
    main();
  }
})();

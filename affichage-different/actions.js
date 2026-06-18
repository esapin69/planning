// Actions de l'affichage différent — v11
// Rôle : personnaliser l'accueil APRÈS connexion Cloudflare.
// Corrections v11 : Planning officiel direct JOUR/NUIT plus robuste + demande changement directe agent.
(function(){
  var PASSERELLE_AVATARS = "https://script.google.com/macros/s/AKfycbwrhifE-4wl-YvKOjJI8HZ_g_ota7tajTKLY3jvLKEF9AvSPjIbVpqcSkSRcl5OdWV9/exec";
  var AVATAR_DEFAUT_ID = "1_B49ks3EwD6g1iABJ9y5A35u8vuegN-g";
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

  function uniq(arr){
    var out = [];
    arr.forEach(function(v){
      v = clean(v);
      if(v && out.indexOf(v) === -1) out.push(v);
    });
    return out;
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

  function extraireDriveId(v){
    v = clean(v);
    if(!v) return "";

    var m = v.match(/\/file\/d\/([^/]+)/);
    if(m && m[1]) return m[1];

    m = v.match(/[?&]id=([^&]+)/);
    if(m && m[1]) return decodeURIComponent(m[1]);

    m = v.match(/\/d\/([A-Za-z0-9_-]{20,})/);
    if(m && m[1]) return m[1];

    if(/^[A-Za-z0-9_-]{20,}$/.test(v)) return v;

    return "";
  }

  function urlsDepuisDriveId(id){
    id = clean(id);
    if(!id) return [];

    return [
      "https://drive.google.com/thumbnail?id=" + encodeURIComponent(id) + "&sz=w500",
      "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(id),
      "https://lh3.googleusercontent.com/d/" + encodeURIComponent(id) + "=w500"
    ];
  }

  function urlsImageDepuisValeur(v){
    v = clean(v);
    if(!v) return [];

    var id = extraireDriveId(v);
    if(id) return urlsDepuisDriveId(id);

    if(/^https?:\/\//i.test(v)) return [v];

    return [];
  }

  function urlsAvatarDefaut(){
    return urlsDepuisDriveId(AVATAR_DEFAUT_ID);
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

    if(role === "chef" || role === "total") return "chef";
    if(role !== "agent") return "";

    var key = norm(agentKey(session)) || norm(agentNom(session) + "_" + agentPrenom(session));
    var cacheKey = "ghe_type_planning_v11_" + key;

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached === "jour" || cached === "nuit") return cached;
    }catch(e){}

    var directSession = detecterTypeDansObjet(session);
    if(directSession === "jour" || directSession === "nuit"){
      try{ sessionStorage.setItem(cacheKey, directSession); }catch(e){}
      return directSession;
    }

    var directDroits = detecterTypeDansObjet(droitsSession(session));
    if(directDroits === "jour" || directDroits === "nuit"){
      try{ sessionStorage.setItem(cacheKey, directDroits); }catch(e){}
      return directDroits;
    }

    var directAgent = detecterTypeDansObjet(agentSession(session));
    if(directAgent === "jour" || directAgent === "nuit"){
      try{ sessionStorage.setItem(cacheKey, directAgent); }catch(e){}
      return directAgent;
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

    var size = parseFloat(window.getComputedStyle(el).fontSize) || 68;

    while(el.scrollWidth > el.clientWidth && size > 38){
      size -= 2;
      el.style.fontSize = size + "px";
    }

    if(el.scrollWidth > el.clientWidth){
      el.classList.add("ghe-prenom-long");
      el.style.fontSize = "";
    }
  }

  function urlsAvatarDansObjet(obj){
    if(!obj) return [];

    var vals = [];
    [
      "avatar_image_url", "avatar_thumb_url", "avatar_url", "avatar", "avatar_id",
      "AVATAR_IMAGE_URL", "AVATAR_THUMB_URL", "AVATAR_URL", "AVATAR", "AVATAR_ID", "AVATAR_IMAGE"
    ].forEach(function(k){
      if(obj[k] !== undefined && obj[k] !== null && clean(obj[k]) !== "") vals.push(clean(obj[k]));
    });

    if(obj.avatar){
      ["avatar_image_url", "avatar_thumb_url", "avatar_url", "avatar_id", "AVATAR_IMAGE_URL", "AVATAR_URL", "AVATAR_ID"].forEach(function(k){
        if(obj.avatar[k] !== undefined && obj.avatar[k] !== null && clean(obj.avatar[k]) !== "") vals.push(clean(obj.avatar[k]));
      });
    }

    var urls = [];
    vals.forEach(function(v){
      urls = urls.concat(urlsImageDepuisValeur(v));
    });

    return uniq(urls);
  }

  async function trouverUrlsAvatar(session){
    var key = norm(agentKey(session)) || norm(agentNom(session) + "_" + agentPrenom(session));
    var cacheKey = "ghe_avatar_urls_v11_" + key;

    try{
      var cached = sessionStorage.getItem(cacheKey);
      if(cached){
        var parsed = JSON.parse(cached);
        if(Array.isArray(parsed) && parsed.length) return parsed;
      }
    }catch(e){}

    var direct = urlsAvatarDansObjet(agentSession(session));
    if(direct.length){
      try{ sessionStorage.setItem(cacheKey, JSON.stringify(direct)); }catch(e){}
      return direct;
    }

    var agents = await chargerAgentsPasserelle();
    var trouve = trouverAgentDansListe(session, agents);
    var depuisListe = urlsAvatarDansObjet(trouve);

    if(depuisListe.length){
      try{ sessionStorage.setItem(cacheKey, JSON.stringify(depuisListe)); }catch(e){}
      return depuisListe;
    }

    return urlsAvatarDefaut();
  }

  function appliquerImageSansSecours(img, avatarWrap, candidats){
    candidats = uniq(candidats || []);
    var i = 0;

    function cacherAvatar(){
      img.removeAttribute("src");
      img.style.opacity = "0";
      img.style.display = "block";

      if(avatarWrap){
        avatarWrap.hidden = true;
      }
    }

    function essayerSuivante(){
      if(i >= candidats.length){
        cacherAvatar();
        return;
      }

      if(avatarWrap){
        avatarWrap.hidden = true;
      }

      img.style.opacity = "0";
      img.style.display = "block";
      img.src = candidats[i++];
    }

    img.onload = function(){
      if(avatarWrap){
        avatarWrap.hidden = false;
      }
      img.style.opacity = "1";
    };

    img.onerror = function(){
      essayerSuivante();
    };

    cacherAvatar();
    essayerSuivante();
  }

  function fermerMenuProfil(){
    var menu = document.getElementById("ghe-menu-profil");
    var carte = document.getElementById("ghe-carte-profil");

    if(menu){
      menu.hidden = true;
      menu.classList.remove("is-open");
    }

    if(carte){
      carte.setAttribute("aria-expanded", "false");
    }
  }

  function ouvrirMenuProfil(){
    var menu = document.getElementById("ghe-menu-profil");
    var carte = document.getElementById("ghe-carte-profil");

    if(!menu) return;

    menu.hidden = false;
    menu.classList.add("is-open");

    if(carte){
      carte.setAttribute("aria-expanded", "true");
    }
  }

  function basculerMenuProfil(){
    var menu = document.getElementById("ghe-menu-profil");
    if(!menu) return;

    if(menu.hidden || !menu.classList.contains("is-open")){
      ouvrirMenuProfil();
    }else{
      fermerMenuProfil();
    }
  }

  function installerMenuProfil(carte, prenom){
    if(!carte) return;

    carte.setAttribute("role", "button");
    carte.setAttribute("tabindex", "0");
    carte.setAttribute("aria-haspopup", "dialog");
    carte.setAttribute("aria-expanded", "false");
    carte.setAttribute("aria-label", "Ouvrir le menu du profil");

    var menu = document.createElement("div");
    menu.className = "ghe-menu-profil";
    menu.id = "ghe-menu-profil";
    menu.hidden = true;
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Menu du profil");

    var titre = document.createElement("div");
    titre.className = "ghe-menu-profil-titre";
    titre.textContent = "Connecté en " + (prenom || "agent");

    var lien = document.createElement("a");
    lien.className = "ghe-menu-profil-action";
    lien.href = "/__ghe/logout";
    lien.textContent = "Se déconnecter / changer de compte";

    var annuler = document.createElement("button");
    annuler.type = "button";
    annuler.className = "ghe-menu-profil-annuler";
    annuler.textContent = "Annuler";
    annuler.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
      fermerMenuProfil();
    });

    menu.appendChild(titre);
    menu.appendChild(lien);
    menu.appendChild(annuler);
    carte.appendChild(menu);

    carte.addEventListener("click", function(e){
      if(e.target.closest("#ghe-menu-profil")){
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      basculerMenuProfil();
    });

    carte.addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        basculerMenuProfil();
      }

      if(e.key === "Escape"){
        fermerMenuProfil();
      }
    });

    document.addEventListener("click", function(e){
      if(!e.target.closest("#ghe-carte-profil")){
        fermerMenuProfil();
      }
    });

    document.addEventListener("keydown", function(e){
      if(e.key === "Escape"){
        fermerMenuProfil();
      }
    });
  }

  function creerCarteProfil(prenom, nom, urlsAvatar){
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
    img.alt = "";
    img.decoding = "async";
    img.loading = "eager";
    img.className = "ghe-avatar-img";

    avatarWrap.hidden = true;

    var prenomEl = document.createElement("div");
    prenomEl.className = "ghe-prenom";
    prenomEl.id = "ghe-prenom";
    prenomEl.textContent = prenom;

    avatarWrap.appendChild(img);
    section.appendChild(avatarWrap);
    section.appendChild(prenomEl);

    installerMenuProfil(section, prenom);

    premierBloc.insertAdjacentElement("beforebegin", section);
    if(urlsAvatar && urlsAvatar.length){
      appliquerImageSansSecours(img, avatarWrap, urlsAvatar);
    }
    ajusterPrenom(prenomEl);
  }

  async function insererCarteProfil(session){
    if(!doitAfficherCarte(session)) return;

    var prenom = formatPrenom(agentPrenom(session));
    if(!prenom) return;

    var nom = agentNom(session);

    creerCarteProfil(prenom, nom, []);

    var urlsAvatar = await trouverUrlsAvatar(session);
    var img = document.querySelector("#ghe-avatar-wrap img");
    var avatarWrap = document.getElementById("ghe-avatar-wrap");
    if(img && avatarWrap && urlsAvatar && urlsAvatar.length){
      appliquerImageSansSecours(img, avatarWrap, urlsAvatar);
    }
  }

  async function reglerPlanningOfficiel(session){
    var role = roleSession(session);
    var bloc = document.getElementById("planning-officiel");
    if(!bloc) return;

    /*
      Agent normal :
      - JOUR -> planning officiel jour direct
      - NUIT -> planning officiel nuit direct

      Chef / cadre / démo-total :
      - on ne touche pas au bloc
      - ils gardent le choix Jour / Nuit / Chefs
    */
    if(role === "chef" || role === "total") return;
    if(role !== "agent") return;

    var typePlanning = await trouverTypePlanningAgent(session);
    if(typePlanning !== "jour" && typePlanning !== "nuit") return;

    appliquerLienDirectBloc(bloc, "mois.html?type=" + encodeURIComponent(typePlanning));
  }

  function rendreMonPlanningDirect(session){
    if(roleSession(session) !== "agent") return;

    var bloc = document.getElementById("planning-individuel") || document.getElementById("mon-planning-personnel");
    if(!bloc) return;

    appliquerLienDirectBloc(bloc, "/__ghe/mon-planning");
  }

  function urlDemandeChangementAgent(session){
    var key = agentKey(session);
    var nom = agentNom(session);
    var prenom = agentPrenom(session);

    var params = new URLSearchParams();

    /*
      On met plusieurs noms de paramètres volontairement.
      Comme ça la page demande-changement peut reconnaître l’agent connecté
      même si elle attend "agent", "demandeur", ou "demandeur_agent".
      Ça ne bloque pas le choix des autres agents dans la demande.
    */
    if(key){
      params.set("agent", key);
      params.set("agent_key", key);
      params.set("demandeur", key);
      params.set("demandeur_agent", key);
    }

    if(nom){
      params.set("nom", nom);
      params.set("demandeur_nom", nom);
    }

    if(prenom){
      params.set("prenom", prenom);
      params.set("demandeur_prenom", prenom);
    }

    params.set("source", "accueil");
    params.set("direct", "1");

    return "./demande-changement.html?" + params.toString();
  }

  function appliquerLienDirectBloc(bloc, destination){
    if(!bloc || !destination) return;

    bloc.querySelectorAll("a").forEach(function(a){
      a.setAttribute("href", destination);
    });

    bloc.querySelectorAll("[data-open]").forEach(function(el){
      el.removeAttribute("data-open");
      el.dataset.gheDestination = destination;
    });

    bloc.addEventListener("click", function(e){
      var cibleInteractive = e.target.closest("a, button, .home-card, .block-action, .block-link, .main-btn");
      if(!cibleInteractive || !bloc.contains(cibleInteractive)) return;

      e.preventDefault();
      e.stopPropagation();
      window.location.href = destination;
    }, true);
  }

  function reglerDemandeChangement(session){
    var role = roleSession(session);
    var bloc = document.getElementById("demander-changement");
    if(!bloc) return;

    /*
      Agent normal :
      - bouton direct vers sa page de demande pré-identifiée.

      Chef / cadre / démo-total :
      - on ne touche pas au bouton.
      - ils gardent l’accès général / la liste.
    */
    if(role !== "agent") return;

    appliquerLienDirectBloc(bloc, urlDemandeChangementAgent(session));
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

/* DesignLab : application : thème, routeur par hash, accueil, vue outil, raccourcis.
   Tout se construit depuis le registre (DL.outils) : ajouter un outil ne demande aucune
   modification ici. Chargé en dernier, après tous les js/tools/*.js. */
(function () {
  'use strict';
  var DL = window.DL;
  var $ = function (id) { return document.getElementById(id); };

  var TAILLE_VIGNETTE = 360;    // vignettes de l'accueil (seed fixe)
  var APERCU_MAX = 1100;        // plus grand côté de l'aperçu, en pixels de rendu
  var VIGNETTE_HISTO = 120;     // vignettes de l'historique / favoris

  /* ---------- Thème ---------- */
  function themeCourant() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function majBoutonTheme() {
    var b = $('bouton-theme');
    var sombre = themeCourant() === 'dark';
    b.setAttribute('aria-pressed', String(sombre));
    b.textContent = sombre ? 'Thème clair' : 'Thème sombre';
  }
  $('bouton-theme').addEventListener('click', function () {
    var t = themeCourant() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    DL.stocker('dl:theme', t);
    majBoutonTheme();
  });
  majBoutonTheme();

  /* ---------- Intensité du fond de la bannière ----------
     Le curseur écrit --banniere-intensite sur la bannière elle-même : la valeur l'emporte sur
     celles des thèmes (posées sur :root) et vaut pour les deux thèmes. Choix mémorisé ; sans
     choix, le curseur affiche la valeur par défaut du thème courant. */
  (function () {
    var curseur = $('banniere-intensite'), sortie = $('banniere-valeur');
    var tete = document.querySelector('.accueil-tete');
    if (!curseur || !sortie || !tete) return;
    function afficher(v) { curseur.value = v; sortie.textContent = v; }
    function appliquer(v) {
      tete.style.setProperty('--banniere-intensite', String(v / 100));
      afficher(v);
    }
    var memo = DL.lire('dl:banniere-intensite', null);
    if (typeof memo === 'number' && memo >= 0 && memo <= 100) appliquer(memo);
    // Sans choix mémorisé, on n'écrit rien : chaque thème garde sa propre valeur par défaut.
    else afficher(Math.round(parseFloat(getComputedStyle(tete).getPropertyValue('--banniere-intensite')) * 100) || 28);
    curseur.addEventListener('input', function () {
      var v = Math.round(Number(curseur.value));
      appliquer(v);
      DL.stocker('dl:banniere-intensite', v);
    });
    // Changement de thème sans choix mémorisé : le curseur suit la valeur par défaut du nouveau thème.
    // (Écouteur ajouté après celui du thème : il s'exécute une fois le thème changé.)
    $('bouton-theme').addEventListener('click', function () {
      if (tete.style.getPropertyValue('--banniere-intensite')) return;
      afficher(Math.round(parseFloat(getComputedStyle(tete).getPropertyValue('--banniere-intensite')) * 100) || 28);
    });
    curseur.closest('.banniere-reglage').hidden = false;
  })();

  /* ---------- Icônes (Carbon, IBM, Apache 2.0, embarquées dans vendor/icons/carbon-icons.js) ----------
     DL.icone(nom) renvoie un <svg> décoratif (aria-hidden) : le texte du bouton reste le libellé lu.
     Les chaînes viennent du fichier vendor généré, pas de l'utilisateur : innerHTML sans risque.
     Icône inconnue ou fichier absent → chaîne vide, le bouton garde son texte. */
  DL.icone = function (nom) {
    var dessin = window.DL_ICONES && window.DL_ICONES[nom];
    if (!dessin) return '';
    return '<svg class="icone" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" focusable="false">' + dessin + '</svg>';
  };

  // Une icône par genre, choisie pour évoquer la technique (pas une décoration).
  var ICONES_FAMILLES = {
    tout: 'apps',
    pixel: 'qr-code',
    champ: 'wind-stream',
    degrade: 'gradient',
    motif: 'type-pattern',
    impression: 'printer',
    typo: 'text--font',
    vecteur: 'pen--fountain',
    textile: '3D-print-mesh',
    volume: 'cube'
  };

  // Colonne « Clavier » : une seule icône, devant le titre (les lignes restent en texte seul).
  var titreClavier = document.getElementById('t-raccourcis');
  if (titreClavier) titreClavier.insertAdjacentHTML('afterbegin', DL.icone('keyboard'));

  /* ---------- Accueil ---------- */
  var familleActive = 'tout';
  var accueilConstruit = false;

  function construireAccueil() {
    if (accueilConstruit) return;
    accueilConstruit = true;

    // Boutons de famille (seulement celles qui ont au moins un outil).
    var zone = $('filtre-familles');
    var familles = [['tout', 'Tout']].concat(Object.keys(DL.familles).filter(function (f) {
      return DL.outils.some(function (o) { return o.famille === f; });
    }).map(function (f) { return [f, DL.familles[f]]; }));
    familles.forEach(function (f) {
      var b = DL.el('button', { type: 'button', classe: 'bouton', 'data-famille': f[0], 'aria-pressed': String(f[0] === 'tout') });
      b.innerHTML = DL.icone(ICONES_FAMILLES[f[0]]);
      b.appendChild(DL.el('span', { classe: 'libelle', texte: f[1] }));
      b.addEventListener('click', function () {
        familleActive = f[0];
        zone.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        filtrer();
      });
      zone.appendChild(b);
    });

    // Cartes : vignette rendue en direct à la seed fixe de l'outil.
    var grille = $('grille-outils');
    DL.outils.forEach(function (o) {
      var canvas = DL.el('canvas', { width: TAILLE_VIGNETTE, height: TAILLE_VIGNETTE, role: 'img', 'aria-label': 'Exemple généré par ' + o.nom });
      var li = DL.el('li', { 'data-id': o.id }, [
        DL.el('a', { classe: 'carte', href: '#/' + o.id }, [
          DL.el('div', { classe: 'carte-tete' }, [
            DL.el('span', { classe: 'carte-num', texte: o.numero || '' }),
            DL.el('span', { classe: 'etiquette', texte: DL.familles[o.famille] || o.famille })
          ]),
          DL.el('div', { classe: 'carte-vignette' }, [canvas]),
          DL.el('div', { classe: 'carte-corps' }, [
            DL.el('h2', { classe: 'carte-nom', texte: o.nom }),
            DL.el('p', { classe: 'carte-desc', texte: o.description }),
            DL.el('p', { classe: 'carte-libs', texte: o.libs.join(' · ') }),
            // Formats d'export : affichés en modes Liste et Tableau seulement.
            DL.el('p', { classe: 'carte-export', texte: o.vectoriel ? 'PNG · JPEG · SVG' : 'PNG · JPEG' })
          ])
        ])
      ]);
      grille.appendChild(li);
      observerVignette(canvas, o);
    });

    // Idées à venir : texte seul, pas de lien ni de fausse vignette.
    var liste = $('liste-idees');
    DL.prochainement.forEach(function (idee) {
      liste.appendChild(DL.el('li', {}, [DL.el('strong', { texte: idee[0] }), DL.el('span', { texte: idee[1] })]));
    });

    $('filtre-texte').addEventListener('input', filtrer);
    construireAffichages();
  }

  /* Modes d'affichage de l'accueil. Le balisage des cartes est le même partout : seul
     data-affichage change, et le CSS réorganise les blocs (pas de second rendu des vignettes).
     Le choix est mémorisé pour la prochaine visite. */
  // Modes d'affichage : [id, libellé, icône Carbon].
  var AFFICHAGES = [
    ['mosaique', 'Mosaïque', 'grid'],
    ['planche', 'Planche', 'thumbnail--2'],
    ['liste', 'Liste', 'list--boxes'],
    ['tableau', 'Tableau', 'data-table']
  ];

  function construireAffichages() {
    var zone = $('filtre-affichage');
    var actuel = DL.lire('dl:affichage', 'mosaique');
    if (!AFFICHAGES.some(function (a) { return a[0] === actuel; })) actuel = 'mosaique';
    AFFICHAGES.forEach(function (a) {
      var b = DL.el('button', { type: 'button', classe: 'bouton', 'data-affichage': a[0], 'aria-pressed': String(a[0] === actuel), title: a[1] });
      b.innerHTML = DL.icone(a[2]);
      b.appendChild(DL.el('span', { classe: 'libelle', texte: a[1] }));
      b.addEventListener('click', function () { appliquerAffichage(a[0]); });
      zone.appendChild(b);
    });
    appliquerAffichage(actuel);
  }

  function appliquerAffichage(mode) {
    $('grille-outils').setAttribute('data-affichage', mode);
    document.querySelector('.entete-tableau').classList.toggle('visible', mode === 'tableau');
    $('filtre-affichage').querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-affichage') === mode));
    });
    DL.stocker('dl:affichage', mode);
  }
  $('barre-info').textContent = DL.outils.length + ' générateurs · hors ligne · ' + DL.prochainement.length + ' idées en attente';

  // Vignettes rendues seulement quand elles approchent de l'écran, une à la fois :
  // l'accueil reste réactif même avec beaucoup d'outils.
  var fileVignettes = Promise.resolve();
  var observateur = 'IntersectionObserver' in window ? new IntersectionObserver(function (entrees) {
    entrees.forEach(function (en) {
      if (!en.isIntersecting) return;
      observateur.unobserve(en.target);
      en.target._rendre();
    });
  }, { rootMargin: '300px' }) : null;

  function observerVignette(canvas, outil) {
    canvas._rendre = function () {
      fileVignettes = fileVignettes.then(function () {
        var e = DL.etatParDefaut(outil);
        return DL.rendre(outil, e, TAILLE_VIGNETTE, TAILLE_VIGNETTE, {
          vers: function (c) { canvas.getContext('2d').drawImage(c, 0, 0, TAILLE_VIGNETTE, TAILLE_VIGNETTE); }
        });
      }).catch(function (err) {
        console.error('Vignette ' + outil.id, err);
        canvas.setAttribute('aria-label', 'Vignette indisponible');
      });
    };
    if (observateur) observateur.observe(canvas); else canvas._rendre();
  }

  // Filtre : famille + texte. Pertinence : nom qui commence par la requête > nom qui la contient
  // > description, famille ou bibliothèque qui la contient.
  function filtrer() {
    var q = $('filtre-texte').value.trim().toLowerCase();
    var grille = $('grille-outils');
    var scores = DL.outils.map(function (o, i) {
      if (familleActive !== 'tout' && o.famille !== familleActive) return null;
      if (!q) return { o: o, s: 0, i: i };
      var nom = o.nom.toLowerCase();
      var texte = (o.description + ' ' + (DL.familles[o.famille] || '') + ' ' + o.libs.join(' ') + ' ' + o.numero).toLowerCase();
      var s = nom.indexOf(q) === 0 ? 3 : nom.indexOf(q) > 0 ? 2 : texte.indexOf(q) >= 0 ? 1 : 0;
      return s ? { o: o, s: s, i: i } : null;
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s || a.i - b.i; });

    var visibles = {};
    scores.forEach(function (x) { visibles[x.o.id] = true; });
    Array.prototype.forEach.call(grille.children, function (li) { li.hidden = !visibles[li.getAttribute('data-id')]; });
    // Réordonne selon la pertinence (ordre d'origine si pas de requête).
    scores.forEach(function (x) { grille.appendChild(grille.querySelector('[data-id="' + x.o.id + '"]')); });
    $('grille-vide').hidden = scores.length > 0;
  }

  /* ---------- Vue outil ---------- */
  var V = {
    outil: null, etat: null, controles: null, hist: null,
    verrous: [], rendu: false, sale: false, aEngager: false, jeton: 0,
    taille: { pw: 0, ph: 0 }
  };
  var etatsMemorises = {}; // dernier état de chaque outil pendant la session (retour depuis l'accueil)
  var historiques = {};    // historique de chaque outil pendant la session : survit à un aller-retour par l'accueil
  var verrousMemorises = {};

  /* Lancement « vivant » : ouvrir un outil depuis l'accueil (lien sans réglages) produit
     toujours une nouvelle composition.
     - 1er lancement de la session : réglages par défaut (soignés), seed neuve, palette tirée parmi
       celle de l'outil et les prédéfinies (une sur deux, celle de l'outil : son identité reste visible).
     - Lancements suivants : on garde les réglages et la palette choisis par l'utilisateur, seule la
       seed change : son travail n'est pas écrasé, et l'ancienne image reste dans l'historique.
     Un lien avec réglages (partagé, favori, retour navigateur) redonne toujours l'image exacte. */
  function etatDeLancement(outil) {
    var memo = etatsMemorises[outil.id];
    var e = memo ? DL.copierEtat(memo) : DL.etatParDefaut(outil);
    e.seed = DL.nouvelleSeed();
    if (!memo) {
      var r = DL.rngLibre();
      if (r.chance(0.5)) e.couleurs = DL.palettePour(r.pick(DL.palettesPredefinies).couleurs, outil.nbCouleurs);
    }
    return e;
  }

  function ouvrirOutil(outil, query) {
    var memeOutil = V.outil === outil;
    var lancement = !query;
    var etat = query ? DL.queryVersEtat(outil, query) : etatDeLancement(outil);
    if (memeOutil && V.etat && DL.memeEtat(etat, V.etat)) return;

    V.jeton++;
    if (!memeOutil) {
      V.outil = outil;
      V.hist = historiques[outil.id] || (historiques[outil.id] = DL.creerHistorique(outil.id));
      V.verrous = verrousMemorises[outil.id] || (verrousMemorises[outil.id] = []);
      majHistoriqueUI();
      $('outil-num').textContent = outil.numero || '';
      $('outil-nom').textContent = outil.nom;
      $('outil-desc').textContent = outil.description;
      var libs = outil.libs.slice();
      if (outil.moteur === 'webgl' && !DL.webglDisponible()) libs.push('WebGL indisponible : rendu de repli 2D');
      $('outil-libs').textContent = libs.join(' · ');
      document.title = outil.nom + ' · Lab Design';
      V.controles = DL.construireControles($('ctl-params'), outil, etat, surParam);
      $('c-transparent').disabled = !outil.fondTransparent;
      $('c-transparent').parentNode.title = outil.fondTransparent ? '' : 'Cet outil remplit toujours tout le cadre.';
      construirePalettesPredefinies();
    }
    V.etat = etat;
    etatsMemorises[outil.id] = DL.copierEtat(etat);
    synchroniserUI();
    dimensionner();
    majURL(); // la seed tirée apparaît aussi dans l'adresse : l'image reste partageable
    V.aEngager = true;
    if (lancement) V.reveler = true;
    demanderRendu();
  }

  // Met tous les champs du panneau à jour depuis V.etat.
  function synchroniserUI() {
    var e = V.etat, o = V.outil;
    V.controles.maj(e);
    $('seed').value = e.seed;
    $('c-transparent').checked = e.transparent && o.fondTransparent;
    construireNuancier();
    majFormatUI();
    majFavoriUI();
  }

  function etatChange(engager) {
    etatsMemorises[V.outil.id] = DL.copierEtat(V.etat);
    majURL();
    if (engager) V.aEngager = true;
    demanderRendu();
  }

  function surParam(cle, valeur, termine) {
    var def = V.outil.params.find(function (d) { return d.cle === cle; });
    V.etat.params[cle] = DL.validerParam(def, valeur);
    etatChange(termine);
  }

  // URL : replaceState (pas de nouvelle entrée d'historique navigateur à chaque réglage),
  // retardée pour ne pas écrire l'URL 60 fois par seconde pendant un glissement.
  var minuterieURL = 0;
  function majURL() {
    clearTimeout(minuterieURL);
    minuterieURL = setTimeout(function () {
      if (!V.outil) return;
      history.replaceState(null, '', '#/' + V.outil.id + '?' + DL.etatVersQuery(V.etat));
    }, 150);
  }

  /* Taille de l'aperçu : on cadre le format choisi dans la place disponible, puis on rend
     à la résolution d'affichage (plafonnée) ; l'export, lui, re-rend à la taille réelle. */
  function dimensionner() {
    if (!V.outil) return;
    var scene = $('scene'), cadre = $('scene-cadre'), canvas = $('apercu');
    var st = getComputedStyle(scene);
    var pad = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
    var bord = 2 * (parseFloat(getComputedStyle(cadre).borderLeftWidth) || 0);
    var mobile = window.matchMedia('(max-width: 900px)').matches;
    var dispoW = Math.max(120, scene.clientWidth - pad - bord - 8);
    var dispoH = Math.max(120, window.innerHeight * (mobile ? 0.78 : 0.86) - pad - bord - 32);
    var fw = V.etat.format.w, fh = V.etat.format.h;
    var echelle = Math.min(dispoW / fw, dispoH / fh);
    var cssW = Math.floor(fw * echelle), cssH = Math.floor(fh * echelle);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var k = Math.min(APERCU_MAX / Math.max(fw, fh), echelle * dpr);
    V.taille = { pw: Math.max(1, Math.round(fw * k)), ph: Math.max(1, Math.round(fh * k)) };
  }

  // Rendu de l'aperçu, coalescé sur requestAnimationFrame : pendant un glissement de slider,
  // au plus un rendu par image, et jamais deux rendus en parallèle.
  var rafEnAttente = false;
  function demanderRendu() {
    if (rafEnAttente) return;
    rafEnAttente = true;
    // Repli setTimeout : requestAnimationFrame est suspendu dans un onglet masqué.
    var fait = false;
    var go = function () { if (fait) return; fait = true; rafEnAttente = false; rendreApercu(); };
    requestAnimationFrame(go);
    setTimeout(go, 100);
  }

  async function rendreApercu() {
    if (!V.outil) return;
    if (V.rendu) { V.sale = true; return; }
    V.rendu = true;
    var jeton = V.jeton;
    try {
      do {
        V.sale = false;
        var e = DL.copierEtat(V.etat), t0 = performance.now();
        var pw = V.taille.pw, ph = V.taille.ph;
        await DL.rendre(V.outil, e, pw, ph, {
          vers: function (c) {
            if (jeton !== V.jeton) return;
            var cv = $('apercu');
            if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
            var ctx = cv.getContext('2d');
            ctx.clearRect(0, 0, pw, ph);
            ctx.drawImage(c, 0, 0);
          }
        });
        if (jeton !== V.jeton) return;
        // Révélation au lancement : on relance l'animation CSS (retrait, reflow, ajout).
        if (V.reveler) {
          V.reveler = false;
          var cadre = $('scene-cadre');
          cadre.classList.remove('revele');
          void cadre.offsetWidth;
          cadre.classList.add('revele');
        }
        $('apercu').setAttribute('aria-label', V.outil.nom + ', seed ' + e.seed + ', format ' + e.format.w + ' × ' + e.format.h);
        $('scene-etat').textContent = 'Aperçu ' + pw + ' × ' + ph + ' · ' + Math.round(performance.now() - t0) + ' ms · export ' + e.format.w + ' × ' + e.format.h;
      } while (V.sale);
      if (V.aEngager) { V.aEngager = false; engager(); }
    } catch (err) {
      console.error(err);
      $('scene-etat').textContent = 'Erreur de rendu : ' + err.message;
    } finally {
      V.rendu = false;
    }
  }

  // Petite copie de l'aperçu pour l'historique et les favoris.
  function vignetteApercu() {
    var src = $('apercu'), c = document.createElement('canvas');
    var k = VIGNETTE_HISTO / Math.max(src.width, src.height);
    c.width = Math.max(1, Math.round(src.width * k));
    c.height = Math.max(1, Math.round(src.height * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return V.etat.transparent ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.8);
  }

  function engager() {
    if (V.hist.pousser(V.etat, vignetteApercu())) majHistoriqueUI();
    majFavoriUI();
  }

  function majHistoriqueUI() {
    var ol = $('historique');
    ol.textContent = '';
    var entrees = V.hist.entrees(), cur = V.hist.curseur();
    // Plus récent en premier.
    for (var i = entrees.length - 1; i >= 0; i--) {
      (function (i) {
        var en = entrees[i];
        var b = DL.el('button', { type: 'button', classe: 'vignette', 'aria-label': 'Génération ' + (i + 1) + ', seed ' + en.etat.seed, 'aria-current': String(i === cur) }, [
          DL.el('img', { src: en.vignette, alt: '' })
        ]);
        b.addEventListener('click', function () { restaurer(V.hist.aller(i)); });
        ol.appendChild(DL.el('li', {}, [b]));
      })(i);
    }
  }

  function majFavoriUI() {
    var fav = V.hist.estFavori(V.etat);
    var b = $('b-favori');
    b.setAttribute('aria-pressed', String(fav));
    b.firstChild.textContent = fav ? '★ Favori ' : '☆ Favori ';
    var ol = $('favoris');
    ol.textContent = '';
    V.hist.favoris().forEach(function (f) {
      var b2 = DL.el('button', { type: 'button', classe: 'vignette', 'aria-label': 'Favori, seed ' + f.etat.seed }, [DL.el('img', { src: f.vignette, alt: '' })]);
      b2.addEventListener('click', function () {
        // Copie validée : un favori enregistré avant une évolution de l'outil reste lisible.
        restaurer(DL.queryVersEtat(V.outil, f.cle), true);
      });
      var x = DL.el('button', { type: 'button', classe: 'retirer', 'aria-label': 'Retirer ce favori', texte: '×' });
      x.addEventListener('click', function () { V.hist.retirerFavori(f.cle); majFavoriUI(); });
      ol.appendChild(DL.el('li', {}, [b2, x]));
    });
    $('favoris-vide').hidden = V.hist.favoris().length > 0;
  }

  function restaurer(etat, engagerApres) {
    if (!etat) return;
    var formatAvant = V.etat.format.w + 'x' + V.etat.format.h;
    V.etat = etat;
    synchroniserUI();
    if (formatAvant !== etat.format.w + 'x' + etat.format.h) dimensionner();
    etatChange(!!engagerApres);
    majHistoriqueUI();
  }

  /* ---------- Actions ---------- */
  function regenerer() {
    V.etat.seed = DL.nouvelleSeed();
    $('seed').value = V.etat.seed;
    etatChange(true);
  }
  function paletteHasard() {
    V.etat.couleurs = DL.paletteAuHasard(V.outil.nbCouleurs, V.etat.couleurs, V.verrous);
    construireNuancier();
    etatChange(true);
  }
  function toutHasard() {
    V.etat.params = DL.paramsAuHasard(V.outil, V.etat.params);
    V.etat.couleurs = DL.paletteAuHasard(V.outil.nbCouleurs, V.etat.couleurs, V.verrous);
    V.etat.seed = DL.nouvelleSeed();
    synchroniserUI();
    etatChange(true);
  }
  function precedent() {
    var cur = V.hist.curseur();
    if (cur > 0) restaurer(V.hist.aller(cur - 1));
  }
  function basculerFavori() {
    V.hist.basculerFavori(V.etat, vignetteApercu());
    majFavoriUI();
  }

  $('b-regenerer').addEventListener('click', regenerer);
  $('b-hasard').addEventListener('click', toutHasard);
  $('b-export').addEventListener('click', function () { DL.ouvrirExport(); });
  $('b-palette').addEventListener('click', paletteHasard);
  $('b-precedent').addEventListener('click', precedent);
  $('b-favori').addEventListener('click', basculerFavori);
  $('b-inverser').addEventListener('click', function () {
    V.etat.couleurs = DL.inverserPalette(V.etat.couleurs);
    construireNuancier();
    etatChange(true);
  });
  $('c-transparent').addEventListener('change', function () {
    V.etat.transparent = this.checked && V.outil.fondTransparent;
    etatChange(true);
  });

  // Seed saisie : appliquée à la validation (Entrée ou perte du focus).
  $('seed').addEventListener('change', function () {
    V.etat.seed = DL.nettoyerSeed(this.value);
    this.value = V.etat.seed;
    etatChange(true);
  });

  // Copie : API Clipboard si disponible, sinon sélection + execCommand (navigateurs anciens).
  function copier(texte, bouton) {
    var fini = function () {
      var avant = bouton.textContent;
      bouton.textContent = 'Copié';
      setTimeout(function () { bouton.textContent = avant; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(fini, function () { copierRepli(texte); fini(); });
    } else { copierRepli(texte); fini(); }
  }
  function copierRepli(texte) {
    var t = DL.el('textarea', {});
    t.value = texte;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); } catch (e) { /* rien de plus à tenter */ }
    t.remove();
  }
  $('b-copier-seed').addEventListener('click', function () { copier(V.etat.seed, this); });
  $('b-copier-lien').addEventListener('click', function () {
    var base = location.href.split('#')[0];
    copier(base + '#/' + V.outil.id + '?' + DL.etatVersQuery(V.etat), this);
  });

  /* ---------- Palette ---------- */
  function construireNuancier() {
    var zone = $('nuancier'), o = V.outil;
    zone.textContent = '';
    zone.style.gridTemplateColumns = 'repeat(' + Math.max(3, o.nbCouleurs) + ', minmax(0, 1fr))';
    V.etat.couleurs.forEach(function (c, i) {
      var role = i === 0 ? 'Fond' : 'Encre ' + i;
      var input = DL.el('input', { type: 'color', value: c.toLowerCase(), 'aria-label': role + ', ' + c });
      input.addEventListener('input', function () {
        V.etat.couleurs[i] = input.value.toUpperCase();
        input.setAttribute('aria-label', role + ', ' + V.etat.couleurs[i]);
        etatChange(false);
      });
      input.addEventListener('change', function () { etatChange(true); });
      var verrou = DL.el('button', { type: 'button', classe: 'bouton bouton-petit', 'aria-pressed': String(!!V.verrous[i]), 'aria-label': 'Verrouiller ' + role.toLowerCase() + ' pendant les tirages', texte: V.verrous[i] ? 'Fixe' : 'Libre' });
      verrou.addEventListener('click', function () {
        V.verrous[i] = !V.verrous[i];
        verrou.setAttribute('aria-pressed', String(V.verrous[i]));
        verrou.textContent = V.verrous[i] ? 'Fixe' : 'Libre';
      });
      zone.appendChild(DL.el('div', { classe: 'nuance' }, [input, DL.el('span', { classe: 'nuance-role', texte: i === 0 ? 'Fond' : String(i) }), verrou]));
    });
  }

  function construirePalettesPredefinies() {
    var s = $('s-palettes');
    s.textContent = '';
    s.appendChild(DL.el('option', { value: '', texte: 'Choisir une palette…' }));
    DL.palettesPredefinies.forEach(function (p, i) { s.appendChild(DL.el('option', { value: i, texte: p.nom })); });
  }
  $('s-palettes').addEventListener('change', function () {
    if (this.value === '') return;
    var nouvelle = DL.palettePour(DL.palettesPredefinies[+this.value].couleurs, V.outil.nbCouleurs);
    // Les couleurs verrouillées restent en place, comme pour un tirage.
    V.etat.couleurs = nouvelle.map(function (c, i) { return V.verrous[i] ? V.etat.couleurs[i] : c; });
    this.value = '';
    construireNuancier();
    etatChange(true);
  });

  /* ---------- Format ---------- */
  (function () {
    var s = $('s-format');
    DL.formats.forEach(function (f) { s.appendChild(DL.el('option', { value: f.id, texte: f.label })); });
    s.appendChild(DL.el('option', { value: 'perso', texte: 'Personnalisé…' }));
  })();

  function majFormatUI() {
    var f = V.etat.format;
    var connu = DL.formats.find(function (x) { return x.w === f.w && x.h === f.h; });
    $('s-format').value = connu ? connu.id : 'perso';
    $('format-perso').hidden = !!connu;
    $('perso-w').value = f.w;
    $('perso-h').value = f.h;
    $('format-valeur').textContent = f.w + ' × ' + f.h;
    var alerte = DL.alerteTaille(f.w, f.h);
    $('format-alerte').hidden = !alerte;
    $('format-alerte').textContent = alerte;
  }
  function appliquerFormat(w, h) {
    w = DL.clamp(Math.round(w) || 1000, 16, DL.TAILLE_MAX);
    h = DL.clamp(Math.round(h) || 1000, 16, DL.TAILLE_MAX);
    V.etat.format = { w: w, h: h };
    majFormatUI();
    dimensionner();
    etatChange(true);
  }
  $('s-format').addEventListener('change', function () {
    if (this.value === 'perso') { $('format-perso').hidden = false; $('perso-w').focus(); return; }
    var f = DL.formats.find(function (x) { return x.id === this.value; }, this);
    appliquerFormat(f.w, f.h);
  });
  $('b-perso').addEventListener('click', function () { appliquerFormat(+$('perso-w').value, +$('perso-h').value); });
  ['perso-w', 'perso-h'].forEach(function (id) {
    $(id).addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('b-perso').click(); } });
  });

  var minuterieTaille = 0;
  window.addEventListener('resize', function () {
    clearTimeout(minuterieTaille);
    minuterieTaille = setTimeout(function () {
      if (!V.outil || $('vue-outil').hidden) return;
      var avant = V.taille.pw + 'x' + V.taille.ph;
      dimensionner();
      if (avant !== V.taille.pw + 'x' + V.taille.ph) demanderRendu();
    }, 150);
  });

  DL.initExport(function () { return V.outil ? { outil: V.outil, etat: V.etat } : null; });

  /* ---------- Routeur ---------- */
  function router() {
    var h = location.hash.replace(/^#\/?/, '');
    var i = h.indexOf('?');
    var id = i >= 0 ? h.slice(0, i) : h;
    var query = i >= 0 ? h.slice(i + 1) : '';
    var outil = id && DL.parId[id];
    var dlg = $('dlg-export');
    if (dlg.open) dlg.close();

    if (outil) {
      var dejaOuvert = !$('vue-outil').hidden;
      $('vue-accueil').hidden = true;
      $('vue-outil').hidden = false;
      ouvrirOutil(outil, query);
      if (!dejaOuvert) {
        window.scrollTo(0, 0);
        $('outil-nom').setAttribute('tabindex', '-1');
        $('outil-nom').focus({ preventScroll: true });
      }
    } else {
      // Lien inconnu : on revient à l'accueil plutôt que d'afficher une page vide.
      if (id) history.replaceState(null, '', '#/');
      V.jeton++;
      V.outil = null;
      document.title = 'Lab Design · ' + DL.outils.length + ' générateurs visuels, par gappy';
      $('vue-outil').hidden = true;
      $('vue-accueil').hidden = false;
      construireAccueil();
    }
  }
  window.addEventListener('hashchange', router);

  /* ---------- Raccourcis ---------- */
  function estChampTexte(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
    if (t.tagName === 'INPUT') return ['range', 'checkbox', 'radio', 'color', 'button'].indexOf(t.type) < 0;
    return false;
  }

  document.addEventListener('keydown', function (ev) {
    // Ctrl/Cmd+K : filtre de l'accueil, depuis n'importe où.
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (location.hash.replace(/^#\/?/, '') !== '') location.hash = '#/';
      setTimeout(function () { $('filtre-texte').focus(); $('filtre-texte').select(); }, 0);
      return;
    }
    if ($('dlg-export').open) return; // la modale gère Échap nativement
    var t = ev.target;

    if (ev.key === 'Escape') {
      if (t === $('filtre-texte') && t.value) { t.value = ''; filtrer(); return; }
      if (V.outil) { location.hash = '#/'; }
      return;
    }
    if (!V.outil || ev.altKey || estChampTexte(t)) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); precedent(); allumerRaccourci('z'); return; }
    if (ev.ctrlKey || ev.metaKey) return;

    // Espace sur un bouton, une case ou un radio garde son rôle natif (activer l'élément).
    if (ev.key === ' ' && t.tagName !== 'INPUT' && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'SUMMARY')) return;
    if (ev.key === ' ' && t.tagName === 'INPUT' && t.type !== 'range') return;

    switch (ev.key.toLowerCase()) {
      case ' ': ev.preventDefault(); regenerer(); break;
      case 'p': paletteHasard(); break;
      case 'r': toutHasard(); break;
      case 'e': DL.ouvrirExport(); break;
      case 'z': precedent(); break;
      case 'f': basculerFavori(); break;
      default: return;
    }
    allumerRaccourci(ev.key.toLowerCase());
  });

  // Retour visuel : la ligne du raccourci utilisé s'allume un instant dans la colonne « Clavier »,
  // ce qui apprend les touches sans avoir à lire la liste.
  function allumerRaccourci(touche) {
    var ligne = document.querySelector('.raccourcis-liste [data-touche="' + touche + '"]');
    if (!ligne) return;
    ligne.classList.add('actif');
    clearTimeout(ligne._minuterie);
    ligne._minuterie = setTimeout(function () { ligne.classList.remove('actif'); }, 260);
  }

  router();
})();

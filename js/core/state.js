/* DesignLab : état d'un outil, URL, historique et favoris.
   État = { seed, params, couleurs, transparent, format: { w, h } }.
   L'URL encode tout l'état : copier l'adresse suffit à retrouver exactement une image.
   Exemple : #/oddgrid?s=K7Q2XM&f=2000x2000&p=colonnes:10,profondeur:2&c=EDEBE4-141414-FF3B00&t=1 */
(function () {
  'use strict';
  var DL = window.DL;

  // Formats proposés. Le format fait partie de l'état : il change la composition (cadrage).
  DL.formats = [
    { id: '1000', label: '1000 × 1000', w: 1000, h: 1000 },
    { id: '2000', label: '2000 × 2000', w: 2000, h: 2000 },
    { id: '3000', label: '3000 × 3000', w: 3000, h: 3000 },
    { id: '4000', label: '4000 × 4000', w: 4000, h: 4000 },
    { id: 'a4', label: 'A4 portrait · 2480 × 3508', w: 2480, h: 3508 },
    { id: '169', label: '16:9 · 3840 × 2160', w: 3840, h: 2160 },
    { id: '45', label: '4:5 · 2400 × 3000', w: 2400, h: 3000 },
    { id: '916', label: '9:16 · 2160 × 3840', w: 2160, h: 3840 }
  ];
  DL.TAILLE_MAX = 8000;      // plafond de sécurité par côté
  DL.PIXELS_ALERTE = 16.7e6; // au-delà : avertissement mémoire (limite de canvas sur Safari/iOS)

  var HISTORIQUE_MAX = 20;
  var FAVORIS_MAX = 40;

  function stocker(cle, valeur) {
    try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible : on continue sans */ }
  }
  function lire(cle, defaut) {
    try { var v = localStorage.getItem(cle); return v ? JSON.parse(v) : defaut; } catch (e) { return defaut; }
  }
  DL.stocker = stocker;
  DL.lire = lire;

  // Ramène une valeur de param dans son domaine : une URL éditée à la main ne casse pas l'outil.
  function valider(def, v) {
    if (v === undefined || v === null || v === '') return def.defaut;
    if (def.type === 'range') {
      var n = parseFloat(v);
      if (!isFinite(n)) return def.defaut;
      n = DL.clamp(n, def.min, def.max);
      var pas = def.pas || 1;
      n = Math.round((n - def.min) / pas) * pas + def.min;
      return parseFloat(n.toFixed(6));
    }
    if (def.type === 'toggle') return v === true || v === '1' || v === 1 || v === 'true';
    if (def.type === 'select') {
      var vals = def.options.map(function (o) { return String(typeof o === 'object' ? o.valeur : o); });
      return vals.indexOf(String(v)) >= 0 ? String(v) : def.defaut;
    }
    if (def.type === 'texte') return String(v).slice(0, def.max || 40);
    return def.defaut;
  }
  DL.validerParam = valider;

  DL.etatParDefaut = function (outil) {
    return {
      seed: outil.seedVignette || 'DL' + (outil.numero || '00'),
      params: DL.paramsParDefaut(outil),
      couleurs: DL.palettePour(outil.palette, outil.nbCouleurs),
      transparent: false,
      format: { w: 2000, h: 2000 }
    };
  };

  DL.copierEtat = function (e) {
    return {
      seed: e.seed,
      params: Object.assign({}, e.params),
      couleurs: e.couleurs.slice(),
      transparent: !!e.transparent,
      format: { w: e.format.w, h: e.format.h }
    };
  };

  DL.memeEtat = function (a, b) { return DL.etatVersQuery(a) === DL.etatVersQuery(b); };

  // État → partie « query » du hash.
  DL.etatVersQuery = function (e) {
    var p = Object.keys(e.params).map(function (k) {
      var v = e.params[k];
      if (typeof v === 'boolean') v = v ? 1 : 0;
      return k + ':' + encodeURIComponent(String(v)).replace(/,/g, '%2C');
    }).join(',');
    return 's=' + encodeURIComponent(e.seed) +
      '&f=' + e.format.w + 'x' + e.format.h +
      '&p=' + p +
      '&c=' + e.couleurs.map(function (c) { return c.replace('#', ''); }).join('-') +
      (e.transparent ? '&t=1' : '');
  };

  // Query → état, en partant des valeurs par défaut de l'outil (champ absent = défaut).
  DL.queryVersEtat = function (outil, query) {
    var e = DL.etatParDefaut(outil);
    if (!query) return e;
    var q = {};
    query.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (q.s) e.seed = DL.nettoyerSeed(decodeURIComponent(q.s));
    if (q.f) {
      var m = /^(\d+)x(\d+)$/.exec(q.f);
      if (m) e.format = { w: DL.clamp(+m[1], 16, DL.TAILLE_MAX), h: DL.clamp(+m[2], 16, DL.TAILLE_MAX) };
    }
    if (q.p) {
      var brut = {};
      q.p.split(',').forEach(function (kv) {
        var i = kv.indexOf(':');
        if (i > 0) brut[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
      });
      outil.params.forEach(function (d) { e.params[d.cle] = valider(d, brut[d.cle]); });
    }
    if (q.c) {
      var cs = q.c.split('-').filter(function (c) { return /^[0-9a-fA-F]{6}$/.test(c); }).map(function (c) { return '#' + c.toUpperCase(); });
      for (var k = 0; k < outil.nbCouleurs && k < cs.length; k++) e.couleurs[k] = cs[k];
    }
    e.transparent = q.t === '1' && outil.fondTransparent;
    return e;
  };

  /* Historique de session (20 dernières générations, en mémoire) et favoris (persistés).
     Les vignettes sont des copies réduites de l'aperçu : pas de re-rendu à la consultation. */
  DL.creerHistorique = function (outilId) {
    var entrees = [];  // { etat, vignette, cle }
    var curseur = -1;  // position de l'état affiché
    var favoris = lire('dl:favoris:' + outilId, []);

    return {
      entrees: function () { return entrees; },
      favoris: function () { return favoris; },
      curseur: function () { return curseur; },
      // Ajoute une génération si elle diffère de la courante.
      pousser: function (etat, vignette) {
        var cle = DL.etatVersQuery(etat);
        if (curseur >= 0 && entrees[curseur].cle === cle) { entrees[curseur].vignette = vignette; return false; }
        entrees.splice(curseur + 1); // une nouvelle action après un retour arrière remplace la suite
        entrees.push({ etat: DL.copierEtat(etat), vignette: vignette, cle: cle });
        if (entrees.length > HISTORIQUE_MAX) entrees.shift();
        curseur = entrees.length - 1;
        return true;
      },
      aller: function (i) {
        if (i < 0 || i >= entrees.length) return null;
        curseur = i;
        return DL.copierEtat(entrees[i].etat);
      },
      estFavori: function (etat) {
        var cle = DL.etatVersQuery(etat);
        return favoris.some(function (f) { return f.cle === cle; });
      },
      basculerFavori: function (etat, vignette) {
        var cle = DL.etatVersQuery(etat);
        var i = favoris.findIndex(function (f) { return f.cle === cle; });
        if (i >= 0) favoris.splice(i, 1);
        else {
          favoris.unshift({ etat: DL.copierEtat(etat), vignette: vignette, cle: cle });
          if (favoris.length > FAVORIS_MAX) favoris.pop();
        }
        stocker('dl:favoris:' + outilId, favoris);
        return i < 0;
      },
      retirerFavori: function (cle) {
        favoris = favoris.filter(function (f) { return f.cle !== cle; });
        stocker('dl:favoris:' + outilId, favoris);
      }
    };
  };
})();

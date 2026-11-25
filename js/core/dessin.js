/* DesignLab : dessin à la main sur l'image (aujourd'hui Girih).
   Un outil qui déclare outil.dessin et un param { type: 'dessin' } reçoit :
   - une boîte de pinceaux dans le panneau Réglages (touches 1 à 9), une taille, « Tout effacer » ;
   - le tracé à la souris, au stylet ou au doigt sur l'aperçu, avec son reflet en direct ;
   - le rangement des traits dans la valeur du param, donc dans l'URL, l'historique et les favoris.

   Les traits sont stockés dans le repère de l'outil (coordonnées « locales », sans unité, bornées
   à ±1,5), jamais en pixels : l'export HD redonne le même dessin. Format texte compact :
   traits séparés par « . », chacun = lettre du pinceau + taille (1 à 9) + points, chaque
   coordonnée sur deux caractères en base 36 (1296 niveaux). Exemple : « t5a0b1c2d3.o3k2k2 ».

   Contrat côté outil (outil.dessin) :
   - pinceaux : [{ id: 't', nom, icone, saisie: 'trait' | 'segment' | 'point' | 'gomme' }]
   - cellule(x, y, w, h, params) : le repère sous un point de l'aperçu,
     { versLocal([x, y]), versEcran([u, v]), pxParUnite, axes: [[x1, y1, x2, y2], ...] }
   - copies(points, params) : les copies symétriques d'un trait, en coordonnées locales
   - epaisseur(taille, params) : largeur d'un trait en unités locales (pour l'aperçu du geste) */
(function () {
  'use strict';
  var DL = window.DL;

  var BORNE = 1.5;          // coordonnées locales gardées dans [-1,5 ; 1,5]
  var NIVEAUX = 1295;       // 36² - 1 : deux caractères en base 36
  var MAX_POINTS = 48;      // par trait, après simplification
  var MAX_CARACTERES = 9000; // longueur maximale de la valeur (l'URL reste raisonnable)
  var TRAIT_VALIDE = /^([a-z])([1-9])((?:[0-9a-z]{4})+)$/;

  /* ---------- Codage ---------- */
  function q(u) { return Math.round((DL.clamp(u, -BORNE, BORNE) + BORNE) / (2 * BORNE) * NIVEAUX); }
  function dq(n) { return n / NIVEAUX * 2 * BORNE - BORNE; }
  function b36(n) { return ('0' + n.toString(36)).slice(-2); }

  DL.decoderTraits = function (s) {
    if (!s) return [];
    return String(s).split('.').map(function (brut) {
      var m = TRAIT_VALIDE.exec(brut);
      if (!m) return null;
      var pts = [];
      for (var i = 0; i < m[3].length; i += 4) {
        pts.push([dq(parseInt(m[3].substr(i, 2), 36)), dq(parseInt(m[3].substr(i + 2, 2), 36))]);
      }
      return { p: m[1], e: +m[2], pts: pts };
    }).filter(Boolean);
  };

  DL.encoderTraits = function (traits) {
    return traits.map(function (t) {
      return t.p + DL.clamp(Math.round(t.e), 1, 9) + t.pts.map(function (pt) { return b36(q(pt[0])) + b36(q(pt[1])); }).join('');
    }).join('.');
  };

  // Valeur venue d'une URL : on ne garde que les traits lisibles, et pas plus que la longueur permise.
  DL.validerTraits = function (v, max) {
    var traits = DL.decoderTraits(v), lim = max || MAX_CARACTERES;
    var s = DL.encoderTraits(traits);
    while (s.length > lim && traits.length) { traits.pop(); s = DL.encoderTraits(traits); }
    return s;
  };

  // Douglas-Peucker : un geste à la souris donne des centaines de points presque alignés.
  function simplifier(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var garde = new Uint8Array(pts.length);
    garde[0] = garde[pts.length - 1] = 1;
    (function rec(a, b) {
      var ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay;
      var l2 = dx * dx + dy * dy, dmax = 0, imax = -1;
      for (var i = a + 1; i < b; i++) {
        var t = l2 ? DL.clamp(((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2, 0, 1) : 0;
        var ex = pts[i][0] - ax - t * dx, ey = pts[i][1] - ay - t * dy, d = ex * ex + ey * ey;
        if (d > dmax) { dmax = d; imax = i; }
      }
      if (imax > 0 && dmax > eps * eps) { garde[imax] = 1; rec(a, imax); rec(imax, b); }
    })(0, pts.length - 1);
    return pts.filter(function (p, i) { return garde[i]; });
  }

  function distSegment(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    var t = l2 ? DL.clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  function distTrait(p, pts) {
    if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]);
    var d = Infinity;
    for (var i = 1; i < pts.length; i++) d = Math.min(d, distSegment(p, pts[i - 1], pts[i]));
    return d;
  }

  /* ---------- Boîte de pinceaux (panneau Réglages) ---------- */
  var choix = { index: 0, taille: 5 };   // pinceau et taille en cours : réglages d'atelier, pas d'image
  var boite = null;                      // { boutons, maj } de l'outil ouvert

  DL.choisirPinceau = function (i) {
    if (!boite || i < 0 || i >= boite.boutons.length) return false;
    choix.index = i;
    boite.boutons.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
    return true;
  };

  // Contrôle du param « dessin » : appelé par controls.js à la construction du panneau.
  DL.controleDessin = function (def, dessin, id, surChangement) {
    var el = DL.el;
    var outils = el('div', { classe: 'pinceaux', role: 'toolbar', 'aria-label': 'Pinceaux', id: id });
    var boutons = dessin.pinceaux.map(function (p, i) {
      var b = el('button', { type: 'button', classe: 'bouton bouton-petit pinceau', 'aria-pressed': 'false', 'aria-keyshortcuts': String(i + 1), title: p.nom + ' (' + (i + 1) + ')' });
      b.innerHTML = DL.icone ? DL.icone(p.icone) : '';
      b.appendChild(el('span', { texte: p.nom }));
      b.appendChild(el('kbd', { texte: String(i + 1) }));
      b.addEventListener('click', function () { DL.choisirPinceau(i); });
      outils.appendChild(b);
      return b;
    });

    var tailleId = id + '-taille';
    var curseur = el('input', { type: 'range', id: tailleId, min: 1, max: 9, step: 1 });
    var sortie = el('output', { classe: 'ctl-valeur', for: tailleId });
    curseur.value = choix.taille;
    sortie.textContent = choix.taille;
    DL.majRempli(curseur);
    curseur.addEventListener('input', function () {
      choix.taille = +curseur.value;
      sortie.textContent = choix.taille;
      DL.majRempli(curseur);
    });

    var compte = el('span', { classe: 'ctl-valeur' });
    var effacer = el('button', { type: 'button', classe: 'bouton bouton-petit bouton-fantome' });
    effacer.innerHTML = DL.icone ? DL.icone('trash-can') : '';
    effacer.appendChild(document.createTextNode('Tout effacer'));
    effacer.addEventListener('click', function () { surChangement(def.cle, '', true); });

    var corps = el('div', { classe: 'dessin-champ' }, [
      outils,
      el('div', { classe: 'ctl-entete' }, [el('label', { for: tailleId, texte: 'Taille du pinceau' }), sortie]),
      curseur,
      el('div', { classe: 'dessin-ligne' }, [compte, effacer]),
      def.aide ? el('p', { classe: 'ctl-note', texte: def.aide }) : null
    ]);

    function afficher(v) {
      var n = DL.decoderTraits(v).length;
      compte.textContent = n === 0 ? 'Aucun trait' : n === 1 ? '1 trait' : n + ' traits';
      effacer.disabled = n === 0;
    }

    boite = { boutons: boutons };
    DL.choisirPinceau(Math.min(choix.index, boutons.length - 1));
    return { corps: corps, afficher: afficher };
  };

  /* ---------- Tracé sur l'aperçu ----------
     acces : { outil(), etat(), taille() → { pw, ph }, changer(valeur, termine), statut(texte) } */
  DL.initDessin = function (acces) {
    var cv = document.getElementById('apercu');
    var svg = document.getElementById('apercu-zones');
    if (!cv || !svg) return;
    var NS = 'http://www.w3.org/2000/svg';
    var calque = document.createElementNS(NS, 'g');
    calque.setAttribute('class', 'apercu-dessin');
    svg.appendChild(calque);

    var geste = null;   // { pinceau, cellule, pts (locaux), ecran (pixels d'aperçu), traits (gomme), efface }

    function actif() {
      var o = acces.outil();
      return o && o.dessin ? o : null;
    }
    function cleDessin(o) {
      var d = o.params.find(function (p) { return p.type === 'dessin'; });
      return d ? d.cle : null;
    }
    function pointImage(ev) {
      var r = cv.getBoundingClientRect(), t = acces.taille();
      return [(ev.clientX - r.left) / r.width * t.pw, (ev.clientY - r.top) / r.height * t.ph];
    }
    // Pixels de l'aperçu par pixel CSS (les seuils du geste se pensent à l'écran).
    function ratio() { var r = cv.getBoundingClientRect(); return r.width ? acces.taille().pw / r.width : 1; }

    function vider() { while (calque.firstChild) calque.removeChild(calque.firstChild); }
    function ajouter(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      calque.appendChild(n);
      return n;
    }

    function dessinerAxes(cel) {
      cel.axes.forEach(function (a) {
        ajouter('line', { x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: a[2].toFixed(1), y2: a[3].toFixed(1), 'class': 'axe' });
      });
    }

    // Reflet du geste en cours : toutes les copies symétriques, à l'épaisseur du pinceau.
    function dessinerGeste() {
      var o = actif();
      vider();
      if (!o || !geste) return;
      var cel = geste.cellule, P = acces.etat().params;
      dessinerAxes(cel);
      if (geste.pinceau.saisie === 'gomme') return;
      var larg = o.dessin.epaisseur(choix.taille, P) * cel.pxParUnite;
      var pts = geste.pinceau.saisie === 'segment' ? [geste.pts[0], geste.pts[geste.pts.length - 1]] : geste.pts;
      o.dessin.copies(pts, P).forEach(function (copie) {
        var e = copie.map(cel.versEcran);
        if (geste.pinceau.saisie === 'point') {
          var r = e.length > 1 && Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) > 6 * ratio()
            ? Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1]) : larg * 0.75;
          ajouter('circle', { cx: e[0][0].toFixed(1), cy: e[0][1].toFixed(1), r: r.toFixed(1), 'class': 'trace' });
        } else {
          ajouter('polyline', { points: e.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), 'class': 'trace', 'stroke-width': Math.max(1, larg).toFixed(1) });
        }
      });
    }

    // Gomme : retire le trait le plus récent dont une copie passe sous le pointeur.
    function gommer(p) {
      var o = actif(), P = acces.etat().params, cel = geste.cellule;
      var loc = cel.versLocal(p), tol = 10 * ratio() / cel.pxParUnite;
      for (var i = geste.traits.length - 1; i >= 0; i--) {
        var t = geste.traits[i], marge = tol + o.dessin.epaisseur(t.e, P) / 2;
        var touche = o.dessin.copies(t.pts, P).some(function (c) { return distTrait(loc, c) < marge; });
        if (touche) {
          geste.traits.splice(i, 1);
          geste.efface = true;
          acces.changer(DL.encoderTraits(geste.traits), false);
          return;
        }
      }
    }

    function terminer(ev) {
      if (!geste) return;
      var g = geste, o = actif();
      geste = null;
      if (cv.hasPointerCapture && cv.hasPointerCapture(ev.pointerId)) cv.releasePointerCapture(ev.pointerId);
      if (!o) { vider(); return; }
      if (g.pinceau.saisie === 'gomme') {
        vider();
        if (g.efface) acces.changer(DL.encoderTraits(g.traits), true);
        return;
      }
      var px = g.cellule.pxParUnite, k = ratio();
      var pts = g.pts, premier = pts[0], dernier = pts[pts.length - 1];
      var ecart = Math.hypot(dernier[0] - premier[0], dernier[1] - premier[1]) * px / k; // en pixels CSS
      var garde;
      if (g.pinceau.saisie === 'point') garde = ecart > 6 ? [premier, dernier] : [premier];
      else if (g.pinceau.saisie === 'segment') garde = ecart > 6 ? [premier, dernier] : null;
      else {
        var eps = 1.2 * k / px;
        garde = simplifier(pts, eps);
        while (garde.length > MAX_POINTS) { eps *= 1.5; garde = simplifier(pts, eps); }
        var long = 0;
        for (var i = 1; i < garde.length; i++) long += Math.hypot(garde[i][0] - garde[i - 1][0], garde[i][1] - garde[i - 1][1]);
        if (garde.length < 2 || long * px / k < 6) garde = null;
      }
      if (!garde) { vider(); return; }
      var cle = cleDessin(o);
      var traits = DL.decoderTraits(acces.etat().params[cle]);
      traits.push({ p: g.pinceau.id, e: choix.taille, pts: garde });
      var valeur = DL.encoderTraits(traits);
      var def = o.params.find(function (d) { return d.cle === cle; });
      if (valeur.length > (def.max || MAX_CARACTERES)) {
        vider();
        acces.statut('Dessin trop chargé pour tenir dans le lien : efface quelques traits avant d\'en ajouter.');
        return;
      }
      // Le reflet reste affiché jusqu'au rendu suivant (DL.dessinRendu), sans clignotement.
      acces.changer(valeur, true);
    }

    cv.addEventListener('pointerdown', function (ev) {
      var o = actif();
      if (!o || ev.button !== 0 || !boite) return;
      ev.preventDefault();
      var p = pointImage(ev), t = acces.taille(), P = acces.etat().params;
      var pinceau = o.dessin.pinceaux[choix.index] || o.dessin.pinceaux[0];
      var cel = o.dessin.cellule(p[0], p[1], t.pw, t.ph, P);
      if (cv.setPointerCapture) cv.setPointerCapture(ev.pointerId);
      geste = { pinceau: pinceau, cellule: cel, pts: [cel.versLocal(p)], dernier: p };
      if (pinceau.saisie === 'gomme') {
        geste.traits = DL.decoderTraits(P[cleDessin(o)]);
        gommer(p);
      }
      dessinerGeste();
    });

    cv.addEventListener('pointermove', function (ev) {
      var o = actif();
      if (!o) return;
      var p = pointImage(ev);
      if (!geste) {
        // Survol : les axes de symétrie de l'ornement sous le pointeur.
        if (ev.pointerType === 'touch') return;
        var t = acces.taille();
        vider();
        dessinerAxes(o.dessin.cellule(p[0], p[1], t.pw, t.ph, acces.etat().params));
        return;
      }
      if (Math.hypot(p[0] - geste.dernier[0], p[1] - geste.dernier[1]) < 2 * ratio()) return;
      geste.dernier = p;
      if (geste.pinceau.saisie === 'gomme') { gommer(p); return; }
      geste.pts.push(geste.cellule.versLocal(p));
      dessinerGeste();
    });

    cv.addEventListener('pointerup', terminer);
    cv.addEventListener('pointercancel', terminer);
    cv.addEventListener('pointerleave', function () { if (!geste) vider(); });

    // Après chaque rendu : le reflet provisoire du dernier geste est maintenant dans l'image.
    DL.dessinRendu = function () { if (!geste) vider(); };

    // À l'ouverture d'un outil : curseur de dessin et geste tactile réservé au tracé.
    DL.preparerDessin = function (o) {
      geste = null;
      vider();
      cv.classList.toggle('dessinable', !!(o && o.dessin));
      if (!o || !o.dessin) boite = null;
    };
  };
})();

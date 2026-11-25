/* 43 Girih : ornements en miroir que l'on dessine soi-même (Paper.js, export SVG).
   L'ordre : chaque trait est reflété en miroir puis répété autour du centre (symétrie en
   3, 4, 6 ou 8 sens), comme sur les fresques et les moucharabiehs. L'infini : l'ornement se
   répète en pavage sans couture que le cadre coupe, avec une étoile de liaison dans chaque
   creux entre les ornements.

   Construction : tout se fait dans un repère local où le rayon de l'ornement vaut U = 1000
   (les opérations booléennes de Paper sont réglées pour des coordonnées de l'ordre du pixel,
   pas pour des fractions). Les traits (pinceaux) deviennent des formes pleines, leurs copies
   symétriques sont fusionnées en une seule silhouette (la découpe retire de la matière).
   La silhouette devient un symbole posé dans chaque cellule du pavage : un seul tracé dans
   le SVG, des <use> pour les répétitions. Toute longueur vient du petit côté de l'image. */
(function () {
  'use strict';
  var DL = window.DL;
  var U = 1000;
  var TAU = Math.PI * 2;

  // Pinceaux, dans l'ordre des touches 1 à 6.
  var PINCEAUX = [
    { id: 't', nom: 'Trait', icone: 'paint-brush', saisie: 'trait' },
    { id: 'v', nom: 'Volute', icone: 'rotate--counterclockwise', saisie: 'trait' },
    { id: 'p', nom: 'Pétale', icone: 'sprout', saisie: 'segment' },
    { id: 'o', nom: 'Pastille', icone: 'circle--filled', saisie: 'point' },
    { id: 'd', nom: 'Découpe', icone: 'cut', saisie: 'trait' },
    { id: 'g', nom: 'Gomme', icone: 'erase', saisie: 'gomme' }
  ];

  // Demi-largeur d'un trait de taille e (1 à 9), en unités locales (rayon de l'ornement = 1).
  function demiLargeur(e, P) { return 0.009 * e * P.graisse; }

  /* ---------- Réseau : où se posent les ornements ----------
     Symétrie en 3 ou 6 sens : réseau triangulaire (les ornements se touchent par six) ;
     en 4 ou 8 sens : réseau carré. « Alterné » tourne un ornement sur deux d'un demi-secteur. */
  function reseau(w, h, P) {
    var m = Math.min(w, h), n = +P.sens, hex = n === 3 || n === 6;
    if (P.repetition === 'seul') return { R: m * 0.4, centres: [{ x: w / 2, y: h / 2, rot: 0 }], liens: [], rLien: 0, hex: hex };
    var s = m / P.echelle, R = s / 2, alterne = P.repetition === 'alterne';
    var centres = [], liens = [], i, j;
    var dedans = function (x, y, marge) { return x > -marge && x < w + marge && y > -marge && y < h + marge; };
    if (!hex) {
      var nx = Math.ceil(w / 2 / s) + 2, ny = Math.ceil(h / 2 / s) + 2;
      for (j = -ny; j <= ny; j++) for (i = -nx; i <= nx; i++) {
        var x = w / 2 + i * s, y = h / 2 + j * s;
        if (dedans(x, y, R * 1.6)) centres.push({ x: x, y: y, rot: alterne && ((i + j) & 1) ? Math.PI / n : 0 });
        if (dedans(x + s / 2, y + s / 2, s)) liens.push({ x: x + s / 2, y: y + s / 2 });
      }
      return { R: R, centres: centres, liens: liens, rLien: s * 0.16, hex: false };
    }
    var dy = s * Math.sqrt(3) / 2, mx = Math.ceil(w / 2 / s) + 2, my = Math.ceil(h / 2 / dy) + 2;
    for (j = -my; j <= my; j++) for (i = -mx; i <= mx; i++) {
      var hx = w / 2 + i * s + ((j & 1) ? s / 2 : 0), hy = h / 2 + j * dy;
      if (dedans(hx, hy, R * 1.6)) centres.push({ x: hx, y: hy, rot: alterne && (j & 1) ? Math.PI / n : 0 });
      // Creux du réseau triangulaire : centres des triangles « pointe en haut » et « pointe en bas ».
      if (dedans(hx + s / 2, hy + dy / 3, s)) liens.push({ x: hx + s / 2, y: hy + dy / 3 });
      if (dedans(hx + s, hy + 2 * dy / 3, s)) liens.push({ x: hx + s, y: hy + 2 * dy / 3 });
    }
    return { R: R, centres: centres, liens: liens, rLien: s * 0.075, hex: true };
  }

  function plusProche(res, x, y) {
    var best = res.centres[0], d = Infinity;
    res.centres.forEach(function (c) {
      var dd = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
      if (dd < d) { d = dd; best = c; }
    });
    return best;
  }

  /* ---------- Symétrie ----------
     Groupe diédral : n rotations, et n miroirs (le premier axe est vertical). */
  function copiesPoints(pts, n) {
    var out = [];
    for (var k = 0; k < n; k++) {
      var a = TAU * k / n, c = Math.cos(a), s = Math.sin(a);
      [1, -1].forEach(function (sx) {
        out.push(pts.map(function (p) { var u = p[0] * sx, v = p[1]; return [u * c - v * s, u * s + v * c]; }));
      });
    }
    return out;
  }

  /* ---------- Motif de départ (seed) ----------
     Quelques traits dans un demi-secteur (entre l'axe vertical et l'angle π/n), sur le modèle
     des fresques : un bras sur l'axe (tige, pointe en fleur de lys flanquée de volutes), un bras
     plus court sur la bissectrice, une volute basse entre les deux. Une fois reflétés, ils
     forment un ornement complet, avec du vide entre les bras (sinon tout se fond en un pâté).
     Les largeurs baissent quand le secteur se resserre (6 et 8 sens). */
  function polaire(r, a) { return [r * Math.sin(a), -r * Math.cos(a)]; }

  function motifDepart(rng, n, coeur) {
    var r = rng.fork('depart'), A = Math.PI / n, t = [];
    var eT = n <= 4 ? 4 : 3, eV = n <= 4 ? 3 : 2;
    var rc = coeur === 'aucun' ? 0.08 : 0.22;
    var rP = r.range(0.58, 0.68), rTip = Math.min(1, rP + r.range(0.26, 0.34));
    t.push({ p: 't', e: eT, pts: [polaire(rc, 0), polaire(rP + 0.04, 0)] });
    t.push({ p: 'p', e: r.int(4, 5), pts: [polaire(rP, 0), polaire(rTip, 0)] });
    // Volutes de part et d'autre de la pointe : la fleur de lys.
    var rb = rP - r.range(0, 0.06);
    t.push({ p: 'v', e: eV, pts: [polaire(rb, 0.01), polaire(rb + 0.07, A * 0.3), polaire(rb + r.range(0.08, 0.12), A * r.range(0.5, 0.6))] });
    // Bras secondaire sur la bissectrice, terminé par une pastille ou une petite pointe.
    if (r.chance(0.75)) {
      var rS = r.range(0.46, 0.58);
      t.push({ p: 't', e: eT - 1, pts: [polaire(rc + 0.02, A), polaire(rS, A)] });
      if (r.chance(0.5)) t.push({ p: 'o', e: 4, pts: [polaire(rS + 0.05, A)] });
      else t.push({ p: 'p', e: 4, pts: [polaire(rS - 0.02, A), polaire(rS + r.range(0.14, 0.2), A)] });
    }
    // Volute basse, de la tige vers la bissectrice.
    if (r.chance(0.65)) {
      var rv = r.range(0.36, 0.46);
      t.push({ p: 'v', e: eV, pts: [polaire(rv, 0.01), polaire(rv + 0.05, A * 0.4), polaire(rv + r.range(0.04, 0.08), A * r.range(0.6, 0.75))] });
    }
    // Jour dans la pointe.
    if (r.chance(0.5)) t.push({ p: 'd', e: 1, pts: [polaire(rP + 0.05, 0), polaire(rP + 0.14, 0)] });
    return t;
  }

  /* ---------- Formes ---------- */
  // Ligne centrale lissée (Catmull-Rom), échantillonnée finement, en unités U.
  function lisser(pts) {
    var P = pts.map(function (p) { return [p[0] * U, p[1] * U]; });
    if (P.length < 2) return P;
    var out = [P[0]];
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      var n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 12));
      for (var k = 1; k <= n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(function (c) {
          return 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
        }));
      }
    }
    return out;
  }

  function longueurs(L) {
    var acc = [0];
    for (var i = 1; i < L.length; i++) acc.push(acc[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
    return acc;
  }

  // Contour d'un trait : la ligne décalée des deux côtés selon une demi-largeur variable hw(s, longueur).
  function contour(L, hw) {
    var acc = longueurs(L), tot = acc[acc.length - 1] || 1, g = [], d = [];
    for (var i = 0; i < L.length; i++) {
      var a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      var nx = -ty / l, ny = tx / l, e = hw(acc[i], tot);
      g.push([L[i][0] + nx * e, L[i][1] + ny * e]);
      d.push([L[i][0] - nx * e, L[i][1] - ny * e]);
    }
    return g.concat(d.reverse());
  }

  function chemin(S, pts) {
    var p = new S.Path({ segments: pts, closed: true, insert: false });
    p.simplify(2.5);
    return p;
  }

  // Trait (et découpe) : effilé aux deux bouts, comme un coup de calame.
  function formeTrait(S, t, P) {
    var L = lisser(t.pts), HW = demiLargeur(t.e, P) * U;
    if (L.length < 2) return null;
    return chemin(S, contour(L, function (s, tot) {
      return HW * Math.max(0.05, Math.pow(Math.sin(Math.PI * DL.clamp(s / tot, 0, 1)), 0.55));
    }));
  }

  // Volute : la tige continue en spirale qui se resserre, terminée par une boule.
  function formeVolute(S, t, P) {
    var L = lisser(t.pts), HW = demiLargeur(t.e, P) * U;
    if (L.length < 2) return null;
    var fin = L[L.length - 1], avant = L[Math.max(0, L.length - 4)];
    var cap = Math.atan2(fin[1] - avant[1], fin[0] - avant[0]);
    // Sens d'enroulement : celui de la courbure du geste ; geste presque droit : vers le centre.
    var tour = 0;
    for (var i = 2; i < L.length; i++) {
      var ax = L[i - 1][0] - L[i - 2][0], ay = L[i - 1][1] - L[i - 2][1], bx = L[i][0] - L[i - 1][0], by = L[i][1] - L[i - 1][1];
      tour += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    }
    var sens = Math.abs(tour) > 0.35 ? Math.sign(tour) : (Math.cos(cap) * fin[1] - Math.sin(cap) * fin[0] > 0 ? -1 : 1);
    var acc = longueurs(L), tige = acc[acc.length - 1];
    var r0 = DL.clamp(tige * 0.3, HW * 3.2, U * 0.22), TH = 1.5 * Math.PI, dth = 0.08;
    var x = fin[0], y = fin[1], th = 0;
    while (th < TH) {
      var rr = r0 * (1 - 0.5 * th / TH);
      x += Math.cos(cap) * rr * dth; y += Math.sin(cap) * rr * dth;
      cap += sens * dth; th += dth;
      L.push([x, y]);
    }
    var forme = chemin(S, contour(L, function (s, tot) {
      if (s <= tige) return HW * Math.max(0.08, Math.pow(Math.sin(Math.PI / 2 * Math.min(1, s / (tige * 0.3 || 1))), 0.6));
      return HW * (1 - 0.4 * (s - tige) / (tot - tige || 1));
    }));
    var boule = new S.Path.Circle({ center: [x, y], radius: HW * 0.85, insert: false });
    var r = forme.unite(boule, { insert: false });
    return r;
  }

  // Pétale : base arrondie, pointe en accolade (profil en ogive), de A vers B.
  function formePetale(S, t, P, largeur) {
    var A = [t.pts[0][0] * U, t.pts[0][1] * U], B = [t.pts[1][0] * U, t.pts[1][1] * U];
    var dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    if (L < 1) return null;
    var ux = dx / L, uy = dy / L, HW = largeur || L * (0.13 + 0.022 * t.e) * Math.sqrt(P.graisse);
    var g = [], d = [], N = 40;
    for (var k = 0; k <= N; k++) {
      var s = Math.pow(k / N, 1.6);                         // plus de points vers la base arrondie
      var f = Math.pow(1 - s, 1.6) * Math.sqrt(s) / 0.316;  // maximum ≈ 1 vers le quart
      var cx = A[0] + ux * s * L, cy = A[1] + uy * s * L;
      g.push([cx - uy * f * HW, cy + ux * f * HW]);
      d.push([cx + uy * f * HW, cy - ux * f * HW]);
    }
    return chemin(S, g.concat(d.reverse().slice(1, -1)));
  }

  function formePastille(S, t, P) {
    var c = [t.pts[0][0] * U, t.pts[0][1] * U];
    var r = t.pts.length > 1 ? Math.hypot(t.pts[1][0] * U - c[0], t.pts[1][1] * U - c[1]) : 0.016 * t.e * P.graisse * U;
    return new S.Path.Circle({ center: c, radius: Math.max(4, r), insert: false });
  }

  var FORMES = { t: formeTrait, d: formeTrait, v: formeVolute, p: formePetale, o: formePastille };

  // Copies symétriques d'une forme, fusionnées.
  function symetriser(S, forme, n) {
    var tout = null;
    for (var k = 0; k < n; k++) {
      [1, -1].forEach(function (sx) {
        var c = forme.clone({ insert: false });
        if (sx < 0) c.scale(-1, 1, new S.Point(0, 0));
        if (k) c.rotate(360 * k / n, new S.Point(0, 0));
        tout = tout ? tout.unite(c, { insert: false }) : c;
      });
    }
    return tout;
  }

  // Cœur : un disque d'où l'on retire des pétales (fleur) ou une étoile de girih.
  function formeCoeur(S, coeur, n) {
    if (coeur === 'aucun') return null;
    var rc = 0.26 * U, np = n <= 4 ? 2 * n : n, o = new S.Point(0, 0);
    var disque = new S.Path.Circle({ center: o, radius: rc, insert: false });
    var trou;
    if (coeur === 'fleur') {
      var HW = rc * Math.min(0.3, 1.9 / np), petales = null;
      for (var k = 0; k < np; k++) {
        var a = TAU * k / np, A = polaire(0.2 * rc / U, a), B = polaire(0.88 * rc / U, a);
        // Largeur imposée par le nombre de pétales, pas par le pinceau.
        var pt = formePetale(S, { pts: [A, B], e: 5 }, { graisse: 1 }, HW);
        petales = petales ? petales.unite(pt, { insert: false }) : pt;
      }
      trou = petales;
    } else {
      var etoile = [];
      for (var e = 0; e < 2 * np; e++) {
        var rr = e % 2 ? rc * 0.42 : rc * 0.86, aa = Math.PI * e / np;
        etoile.push(polaire(rr / U, aa).map(function (v) { return v * U; }));
      }
      trou = new S.Path({ segments: etoile, closed: true, insert: false });
    }
    var r = disque.subtract(trou, { insert: false });
    return r.unite(new S.Path.Circle({ center: o, radius: rc * (coeur === 'fleur' ? 0.15 : 0.2), insert: false }), { insert: false });
  }

  /* Silhouette complète, en pathData (unités U). Mémo de fonction pure : la clé contient tout
     ce qui change la forme (traits de départ déjà tirés, traits dessinés, sens, cœur, graisse) ;
     l'aperçu et l'export HD la partagent. */
  var memo = { cle: null, d: null };
  function silhouette(S, traits, P) {
    var n = +P.sens;
    var cle = [DL.encoderTraits(traits), n, P.coeur, P.graisse].join('|');
    if (memo.cle === cle) return memo.d;
    var acc = formeCoeur(S, P.coeur, n);
    traits.forEach(function (t) {
      var f = FORMES[t.p];
      if (!f) return;
      if ((t.p === 'p' || t.p === 'o') ? !t.pts.length : t.pts.length < 2) return;
      var forme = f(S, t, P);
      if (!forme) return;
      var sym = symetriser(S, forme, n);
      if (t.p === 'd') { if (acc) acc = acc.subtract(sym, { insert: false }); }
      else acc = acc ? acc.unite(sym, { insert: false }) : sym;
    });
    memo = { cle: cle, d: acc && !acc.isEmpty() ? acc.pathData : null };
    return memo.d;
  }

  // Étoile de liaison (creux du pavage) : étoile à 8 ou 6 branches percée d'un rond.
  function formeLien(S, hex) {
    var np = hex ? 6 : 8, pts = [];
    for (var e = 0; e < 2 * np; e++) {
      var rr = e % 2 ? U * 0.45 : U, aa = Math.PI * e / np + (hex ? 0 : Math.PI / 8);
      pts.push([Math.sin(aa) * rr, -Math.cos(aa) * rr]);
    }
    var etoile = new S.Path({ segments: pts, closed: true, insert: false });
    return etoile.subtract(new S.Path.Circle({ center: [0, 0], radius: U * 0.22, insert: false }), { insert: false });
  }

  function styler(item, P, couleur) {
    if (P.rendu === 'contour') {
      item.fillColor = null;
      item.strokeColor = couleur;
      item.strokeWidth = U * 0.016 * P.graisse;
      item.strokeJoin = 'round';
    } else item.fillColor = couleur;
  }

  function poser(S, def, x, y, k, rot) {
    var it = new S.SymbolItem(def), o = new S.Point(0, 0);
    it.scale(k, o);
    if (rot) it.rotate(rot * 180 / Math.PI, o);
    it.translate(new S.Point(x, y));
    return it;
  }

  DL.enregistrer({
    id: 'girih',
    numero: '43',
    nom: 'Girih',
    famille: 'motif',
    description: 'Ornements en miroir que tu dessines : chaque trait est reflété en 3, 4, 6 ou 8 sens et répété à l\'infini, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 3,
    palette: ['#F3EEE4', '#1C3FD6', '#1C3FD6'],
    params: [
      { cle: 'traits', label: 'Dessin', type: 'dessin', defaut: '', max: 9000, hasard: false,
        aide: 'Dessine sur l\'image : chaque trait est reflété dans tous les sens de l\'ornement. La gomme retire tes traits ; le motif de départ s\'enlève avec son interrupteur.' },
      { cle: 'sens', label: 'Symétrie', type: 'select', defaut: '4', options: [
        { valeur: '3', label: '3 sens' }, { valeur: '4', label: '4 sens' }, { valeur: '6', label: '6 sens' }, { valeur: '8', label: '8 sens' }] },
      { cle: 'depart', label: 'Motif de départ', type: 'toggle', defaut: true },
      { cle: 'coeur', label: 'Cœur', type: 'select', defaut: 'fleur', options: [
        { valeur: 'aucun', label: 'Aucun' }, { valeur: 'fleur', label: 'Fleur' }, { valeur: 'etoile', label: 'Étoile' }] },
      { cle: 'graisse', label: 'Graisse', type: 'range', min: 0.5, max: 1.8, pas: 0.05, defaut: 1 },
      { cle: 'rendu', label: 'Rendu', type: 'select', defaut: 'aplat', options: [
        { valeur: 'aplat', label: 'Aplat' }, { valeur: 'contour', label: 'Contour' }] },
      { cle: 'repetition', label: 'Répétition', type: 'select', defaut: 'grille', options: [
        { valeur: 'seul', label: 'Seul' }, { valeur: 'grille', label: 'Pavage' }, { valeur: 'alterne', label: 'Alterné' }] },
      { cle: 'echelle', label: 'Ornements par côté', type: 'range', min: 1, max: 8, pas: 0.5, defaut: 2.5,
        visible: function (p) { return p.repetition !== 'seul'; } }
    ],

    dessin: {
      pinceaux: PINCEAUX,
      cellule: function (x, y, w, h, P) {
        var res = reseau(w, h, P), c = plusProche(res, x, y), R = res.R;
        var cs = Math.cos(c.rot), sn = Math.sin(c.rot), n = +P.sens, axes = [];
        for (var k = 0; k < n; k++) {
          var a = c.rot + Math.PI * k / n, dx = Math.sin(a) * R * 1.25, dy = -Math.cos(a) * R * 1.25;
          axes.push([c.x - dx, c.y - dy, c.x + dx, c.y + dy]);
        }
        return {
          versLocal: function (p) {
            var dx = (p[0] - c.x) / R, dy = (p[1] - c.y) / R;
            return [dx * cs + dy * sn, -dx * sn + dy * cs];
          },
          versEcran: function (q) { return [c.x + R * (q[0] * cs - q[1] * sn), c.y + R * (q[0] * sn + q[1] * cs)]; },
          pxParUnite: R,
          axes: axes
        };
      },
      copies: function (pts, P) { return copiesPoints(pts, +P.sens); },
      epaisseur: function (e, P) { return 2 * demiLargeur(e, P); }
    },

    render: function (S, w, h, P, rng, pal) {
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var n = +P.sens;
      var traits = (P.depart ? motifDepart(rng, n, P.coeur) : []).concat(DL.decoderTraits(P.traits));
      var d = silhouette(S, traits, P);
      var res = reseau(w, h, P);

      if (res.liens.length) {
        var lien = formeLien(S, res.hex);
        styler(lien, P, pal[2]);
        var defL = new S.SymbolDefinition(lien, true);
        res.liens.forEach(function (l) { poser(S, defL, l.x, l.y, res.rLien / U, 0); });
      }
      if (!d) return;
      var forme = new S.CompoundPath({ pathData: d, insert: false });
      forme.fillRule = 'nonzero';
      styler(forme, P, pal[1]);
      var def = new S.SymbolDefinition(forme, true);
      res.centres.forEach(function (c) { poser(S, def, c.x, c.y, res.R / U, c.rot); });
    }
  });
})();

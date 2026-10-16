/* 24 Tokens : jeux de badges géométriques (Paper.js, export SVG).
   Une planche de jetons de jeu de société : chaque jeton empile une silhouette extérieure
   (disque, polygone, étoile, roue dentée), des anneaux, un disque central et un symbole
   (flèche, croix, point, triangle, barres, demi-disque, étoile). Les jetons d'une même
   planche partagent une famille de formes, ce qui fait « jeu » plutôt que « catalogue ».
   Ombre dure décalée en option : on peut découper chaque jeton dans le SVG pour une composition. */
(function () {
  'use strict';
  var DL = window.DL;

  var SILHOUETTES = {
    tout: ['disque', 'poly', 'etoile', 'roue'],
    ronds: ['disque', 'roue'],
    anguleux: ['poly', 'etoile']
  };
  var SYMBOLES = ['point', 'croix', 'fleche', 'triangle', 'barres', 'demi', 'etoile', 'anneau'];

  // Polygone en rayon variable : f(k) donne le rayon du k-ième sommet sur n.
  function polaire(c, n, rot, f) {
    var pts = [];
    for (var k = 0; k < n; k++) {
      var a = rot + k * 2 * Math.PI / n, r = f(k);
      pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
    return pts;
  }

  // Silhouette d'un jeton à l'échelle s (1 = rayon complet).
  function silhouette(S, j, c, R, s, props) {
    var r = R * s, path;
    if (j.forme === 'disque') path = new S.Path.Circle({ center: c, radius: r });
    else if (j.forme === 'poly') path = new S.Path({ segments: polaire(c, j.cotes, j.rot, function () { return r; }), closed: true });
    else if (j.forme === 'etoile') path = new S.Path({ segments: polaire(c, j.cotes * 2, j.rot, function (k) { return k % 2 ? r * j.creux : r; }), closed: true });
    else {
      // Roue dentée : 4 sommets par dent (haut de dent, haut de dent, pied, pied).
      var n = j.cotes * 4, prof = j.dent;
      path = new S.Path({ segments: polaire(c, n, j.rot, function (k) { return (k % 4 < 2) ? r : r * (1 - prof); }), closed: true });
    }
    path.set(props);
    return path;
  }

  function symbole(S, type, c, r, rot, couleur) {
    var x = c[0], y = c[1], props = { fillColor: couleur }, pts;
    function tourner(p) {
      var dx = p[0], dy = p[1], cs = Math.cos(rot), sn = Math.sin(rot);
      return [x + dx * cs - dy * sn, y + dx * sn + dy * cs];
    }
    if (type === 'point') return new S.Path.Circle({ center: c, radius: r * 0.38, fillColor: couleur });
    if (type === 'anneau') {
      return new S.CompoundPath({ children: [new S.Path.Circle({ center: c, radius: r * 0.62 }), new S.Path.Circle({ center: c, radius: r * 0.36 })],
        fillColor: couleur, fillRule: 'evenodd' });
    }
    if (type === 'croix') {
      var e = r * 0.2, l = r * 0.68;
      pts = [[-e, -l], [e, -l], [e, -e], [l, -e], [l, e], [e, e], [e, l], [-e, l], [-e, e], [-l, e], [-l, -e], [-e, -e]];
    } else if (type === 'fleche') {
      pts = [[0, -r * 0.7], [r * 0.6, 0], [r * 0.22, 0], [r * 0.22, r * 0.62], [-r * 0.22, r * 0.62], [-r * 0.22, 0], [-r * 0.6, 0]];
    } else if (type === 'triangle') {
      pts = [[0, -r * 0.66], [r * 0.6, r * 0.42], [-r * 0.6, r * 0.42]];
    } else if (type === 'demi') {
      pts = [];
      for (var k = 0; k <= 24; k++) { var a = Math.PI + k * Math.PI / 24; pts.push([r * 0.62 * Math.cos(a), r * 0.62 * Math.sin(a) + r * 0.2]); }
    } else if (type === 'etoile') {
      pts = polaire([0, 0], 10, -Math.PI / 2, function (k) { return k % 2 ? r * 0.27 : r * 0.68; });
    } else {
      // Barres : trois traits horizontaux, renvoyés groupés.
      var g = new S.Group();
      for (var b = -1; b <= 1; b++) {
        var bar = [[-r * 0.55, b * r * 0.36 - r * 0.1], [r * 0.55, b * r * 0.36 - r * 0.1], [r * 0.55, b * r * 0.36 + r * 0.1], [-r * 0.55, b * r * 0.36 + r * 0.1]];
        g.addChild(new S.Path({ segments: bar.map(tourner), closed: true, fillColor: couleur }));
      }
      return g;
    }
    props.segments = pts.map(tourner);
    props.closed = true;
    return new S.Path(props);
  }

  DL.enregistrer({
    id: 'tokens',
    numero: '24',
    nom: 'Tokens',
    famille: 'motif',
    description: 'Jeux de badges géométriques : jetons à silhouette, anneaux et symbole, en planche ou en vrac, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF', '#FFC800', '#F7F4EC'],
    params: [
      { cle: 'colonnes', label: 'Jetons par ligne', type: 'range', min: 1, max: 10, pas: 1, defaut: 4 },
      { cle: 'disposition', label: 'Disposition', type: 'select', defaut: 'planche', options: [
        { valeur: 'planche', label: 'Planche alignée' }, { valeur: 'vrac', label: 'En vrac' }] },
      { cle: 'formes', label: 'Silhouettes', type: 'select', defaut: 'tout', options: [
        { valeur: 'tout', label: 'Toutes' }, { valeur: 'ronds', label: 'Rondes' }, { valeur: 'anguleux', label: 'Anguleuses' }] },
      { cle: 'anneaux', label: 'Anneaux', type: 'range', min: 0, max: 4, pas: 1, defaut: 2 },
      { cle: 'variete', label: 'Variété', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'contour', label: 'Contour', type: 'toggle', defaut: true },
      { cle: 'ombre', label: 'Ombre dure', type: 'range', min: 0, max: 0.06, pas: 0.001, defaut: 0.015 }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h), encres = pal.slice(1), contour = pal[1];
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var faces = encres.slice(1).length ? encres.slice(1) : encres;

      // Famille commune de la planche ; la variété décide combien chaque jeton s'en écarte.
      var rf = rng.fork('famille');
      var base = {
        forme: rf.pick(SILHOUETTES[P.formes] || SILHOUETTES.tout),
        cotes: rf.int(5, 9), creux: rf.range(0.72, 0.86), dent: rf.range(0.08, 0.16), rot: -Math.PI / 2
      };

      var C = P.colonnes, L = Math.max(1, Math.round(C * h / w));
      var cell = Math.min(w / C, h / L), R = cell * 0.4;
      var places = [];
      if (P.disposition === 'planche') {
        var ox = (w - C * cell) / 2, oy = (h - L * cell) / 2;
        for (var l = 0; l < L; l++) for (var c = 0; c < C; c++) places.push({ c: [ox + (c + 0.5) * cell, oy + (l + 0.5) * cell], R: R });
      } else {
        var rv = rng.fork('vrac');
        for (var v = 0; v < C * L; v++) places.push({ c: [rv.range(0.08, 0.92) * w, rv.range(0.08, 0.92) * h], R: R * rv.range(0.7, 1.5) });
        // Les plus petits par-dessus.
        places.sort(function (a, b) { return b.R - a.R; });
      }

      var trait = Math.max(0.5, m * 0.004), decal = P.ombre * m;
      places.forEach(function (pl, idx) {
        var r = rng.fork('jeton' + idx);
        var j = {
          forme: r.chance(P.variete) ? r.pick(SILHOUETTES[P.formes] || SILHOUETTES.tout) : base.forme,
          cotes: r.chance(P.variete) ? r.int(5, 12) : base.cotes,
          creux: base.creux, dent: base.dent,
          rot: base.rot + (P.disposition === 'vrac' ? r.range(-0.6, 0.6) : 0)
        };
        var cols = r.shuffle(faces);
        var bord = { strokeColor: P.contour ? contour : null, strokeWidth: trait, strokeJoin: 'round' };
        if (decal > 0) silhouette(S, j, [pl.c[0] + decal, pl.c[1] + decal], pl.R, 1, { fillColor: contour });
        silhouette(S, j, pl.c, pl.R, 1, Object.assign({ fillColor: cols[0] }, bord));

        // Anneaux : disques concentriques alternés, le dernier porte le symbole.
        var s = 0.84, pasA = 0.1;
        for (var a = 0; a < P.anneaux; a++) {
          var face = cols[(a + 1) % cols.length];
          new S.Path.Circle({ center: pl.c, radius: pl.R * s, fillColor: face, strokeColor: bord.strokeColor, strokeWidth: trait });
          s -= pasA;
        }
        var centre = cols[(P.anneaux + 1) % cols.length];
        var rc = pl.R * Math.max(0.35, s - 0.04);
        new S.Path.Circle({ center: pl.c, radius: rc, fillColor: centre, strokeColor: bord.strokeColor, strokeWidth: trait });
        var cs = r.pick(faces.concat([contour]).filter(function (x) { return x !== centre; })) || contour;
        symbole(S, r.pick(SYMBOLES), pl.c, rc, r.int(0, 3) * Math.PI / 2, cs);
      });
    }
  });
})();

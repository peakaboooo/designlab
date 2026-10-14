/* 09 Vein : marbrures de papier découpé, en vectoriel (Paper.js + d3-delaunay).
   Le plan est découpé en cellules de Voronoi (relaxées par Lloyd pour des tailles régulières).
   Chaque cellule est une pièce de papier marbré : des bandes ondulées parallèles, déformées
   par du bruit, découpées par la forme de la cellule (groupe de détourage = clipPath en SVG).
   Tout est vectoriel : l'export SVG est exactement l'image affichée. */
(function () {
  'use strict';
  var DL = window.DL;

  // Relaxation de Lloyd : chaque point va au centroïde de sa cellule, ce qui régularise le pavage.
  function relaxer(points, w, h, iterations) {
    for (var it = 0; it < iterations; it++) {
      var vor = d3.Delaunay.from(points).voronoi([0, 0, w, h]);
      points = points.map(function (p, i) {
        var poly = vor.cellPolygon(i);
        return poly ? centroide(poly) : p;
      });
    }
    return points;
  }

  function centroide(poly) {
    var a = 0, cx = 0, cy = 0;
    for (var i = 0; i < poly.length - 1; i++) {
      var f = poly[i][0] * poly[i + 1][1] - poly[i + 1][0] * poly[i][1];
      a += f; cx += (poly[i][0] + poly[i + 1][0]) * f; cy += (poly[i][1] + poly[i + 1][1]) * f;
    }
    if (Math.abs(a) < 1e-9) return poly[0];
    return [cx / (3 * a), cy / (3 * a)];
  }

  DL.enregistrer({
    id: 'vein',
    numero: '09',
    nom: 'Vein',
    famille: 'vecteur',
    description: 'Marbrures de papier découpé : cellules de Voronoi remplies de veines ondulées, export SVG.',
    libs: ['Paper.js', 'd3-delaunay'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#F6F1E7', '#1C2541', '#B23A48', '#E3B23C', '#5B8E7D'],
    params: [
      { cle: 'cellules', label: 'Cellules', type: 'range', min: 1, max: 80, pas: 1, defaut: 16 },
      { cle: 'relaxation', label: 'Régularité', type: 'range', min: 0, max: 5, pas: 1, defaut: 2 },
      { cle: 'bandes', label: 'Veines par cellule', type: 'range', min: 2, max: 40, pas: 1, defaut: 11 },
      { cle: 'ondulation', label: 'Ondulation', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'remous', label: 'Remous', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'variation', label: "Variation d'angle", type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.6 },
      { cle: 'gouttiere', label: 'Gouttière', type: 'range', min: 0, max: 0.04, pas: 0.001, defaut: 0.008 },
      { cle: 'lissage', label: 'Coins arrondis', type: 'toggle', defaut: true }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      var bruit = DL.creerBruit(rng.fork('bruit'));
      var encres = pal.slice(1);

      if (!pal.transparent) {
        new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      }

      var pts = [];
      for (var i = 0; i < P.cellules; i++) pts.push([rng.range(0, w), rng.range(0, h)]);
      if (P.cellules === 1) pts = [[w / 2, h / 2]];
      pts = relaxer(pts, w, h, P.relaxation);
      var vor = d3.Delaunay.from(pts).voronoi([0, 0, w, h]);
      var angleBase = rng.range(0, Math.PI);
      var gap = P.gouttiere * m;

      for (var c = 0; c < pts.length; c++) {
        var poly = vor.cellPolygon(c);
        if (!poly) continue;
        var ctr = centroide(poly);
        var aire = 0;
        for (var k = 0; k < poly.length - 1; k++) aire += poly[k][0] * poly[k + 1][1] - poly[k + 1][0] * poly[k][1];
        var rayon = Math.sqrt(Math.abs(aire) / 2 / Math.PI);
        // Gouttière : on réduit la pièce autour de son centroïde (plus simple qu'un vrai offset,
        // et visuellement équivalent pour des cellules à peu près convexes).
        var f = Math.max(0.2, 1 - gap / Math.max(rayon, 1));
        var forme = new S.Path({
          segments: poly.slice(0, -1).map(function (p) { return [ctr[0] + (p[0] - ctr[0]) * f, ctr[1] + (p[1] - ctr[1]) * f]; }),
          closed: true,
          insert: false
        });
        if (P.lissage) forme.smooth({ type: 'catmull-rom', factor: 0.5 });

        // Deux couleurs alternées par pièce + une troisième en fine veine, tirées dans les encres.
        var ordre = rng.shuffle(encres);
        var base = forme.clone({ insert: true });
        base.fillColor = ordre[0];

        var bb = forme.bounds;
        var diag = Math.sqrt(bb.width * bb.width + bb.height * bb.height);
        var theta = angleBase + (rng() - 0.5) * Math.PI * P.variation;
        var dir = [Math.cos(theta), Math.sin(theta)], nrm = [-dir[1], dir[0]];
        var pas = diag / P.bandes;
        var amp = P.ondulation * pas * 1.6;
        var freq = rng.range(1.5, 4) * Math.PI * 2 / diag;
        var phase = rng.range(0, 6.28);
        var echelleBruit = 2.2 / m;
        var nbPts = 48;

        // Point de la veine numéro t (décalage normal) à l'abscisse s.
        function point(s, t) {
          var bx = ctr[0] + dir[0] * s + nrm[0] * t, by = ctr[1] + dir[1] * s + nrm[1] * t;
          var dec = amp * Math.sin(s * freq + phase + t * 0.004) +
            P.remous * pas * 2.4 * bruit.fbm2(bx * echelleBruit, by * echelleBruit, 3);
          return [bx + nrm[0] * dec, by + nrm[1] * dec];
        }

        var groupe = new S.Group({ insert: true });
        groupe.addChild(forme);
        for (var b = 0; b < P.bandes + 2; b += 2) {
          var t0 = -diag / 2 + b * pas, t1 = t0 + pas * rng.range(0.55, 1);
          var haut = [], bas = [];
          for (var j = 0; j <= nbPts; j++) {
            var s = -diag / 2 + diag * j / nbPts;
            haut.push(point(s, t0));
            bas.unshift(point(s, t1));
          }
          groupe.addChild(new S.Path({ segments: haut.concat(bas), closed: true, fillColor: ordre[1 % ordre.length], insert: false }));
          // Veine fine dans une bande sur trois : le marbré gagne en profondeur.
          if (ordre.length > 2 && rng.chance(0.35)) {
            var v = [];
            for (var j2 = 0; j2 <= nbPts; j2++) v.push(point(-diag / 2 + diag * j2 / nbPts, t1 + pas * 0.2));
            groupe.addChild(new S.Path({ segments: v, strokeColor: ordre[2], strokeWidth: Math.max(0.6, pas * 0.12), insert: false }));
          }
        }
        // Le premier enfant (la forme) sert de masque.
        groupe.clipped = true;
      }
    }
  });
})();

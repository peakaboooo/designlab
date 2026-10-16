/* 27 Planche : planche d'autocollants (Paper.js, export SVG).
   Des stickers prédécoupés : étoiles, éclats, éclairs, flèches, cœurs, bulles, fleurs,
   pilules et blobs, chacun avec sa marge de découpe blanche et son ombre dure.
   La marge de découpe est un simple trait épais (jointures rondes) posé sous la forme :
   pas d'opération booléenne, donc un SVG léger où chaque sticker est un groupe séparé,
   prêt à être extrait et replacé dans une autre composition. */
(function () {
  'use strict';
  var DL = window.DL;

  var FAMILLES = {
    tout: ['etoile', 'eclat', 'eclair', 'fleche', 'coeur', 'bulle', 'fleur', 'pilule', 'blob'],
    pointus: ['etoile', 'eclat', 'eclair', 'fleche'],
    doux: ['coeur', 'bulle', 'fleur', 'pilule', 'blob']
  };

  // Contour d'une forme, centré en (0, 0), rayon ~1. Renvoie une liste de points
  // (ou { lisse: true, pts } quand la forme doit être arrondie par Paper).
  function contour(type, r) {
    var pts = [], k, a, n;
    if (type === 'etoile' || type === 'eclat') {
      n = type === 'etoile' ? r.int(4, 8) : r.int(12, 22);
      var creux = type === 'etoile' ? r.range(0.38, 0.55) : r.range(0.7, 0.82);
      for (k = 0; k < n * 2; k++) {
        a = -Math.PI / 2 + k * Math.PI / n;
        var rr = k % 2 ? creux : (type === 'eclat' ? r.range(0.9, 1.05) : 1);
        pts.push([rr * Math.cos(a), rr * Math.sin(a)]);
      }
      return { pts: pts };
    }
    if (type === 'eclair') return { pts: [[0.15, -1], [0.7, -1], [0.25, -0.15], [0.62, -0.15], [-0.35, 1], [-0.05, 0.12], [-0.45, 0.12]] };
    if (type === 'fleche') return { pts: [[-1, -0.28], [0.15, -0.28], [0.15, -0.7], [1, 0], [0.15, 0.7], [0.15, 0.28], [-1, 0.28]] };
    if (type === 'pilule') return { pilule: true };
    if (type === 'coeur') {
      for (k = 0; k < 64; k++) {
        a = k / 64 * 2 * Math.PI;
        var x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        pts.push([x / 17, y / 17 + 0.08]);
      }
      return { pts: pts };
    }
    if (type === 'bulle') {
      // Ellipse avec une queue : on remplace un petit arc par une pointe.
      var queue = r.range(0.55, 0.95) * Math.PI, posee = false;
      for (k = 0; k < 48; k++) {
        a = k / 48 * 2 * Math.PI;
        if (Math.abs(a - queue) < 0.2) {
          if (!posee) { pts.push([1.3 * Math.cos(queue), 1.15 * Math.sin(queue)]); posee = true; }
          continue;
        }
        pts.push([Math.cos(a), 0.72 * Math.sin(a)]);
      }
      return { pts: pts };
    }
    if (type === 'fleur') {
      var p = r.int(5, 9);
      for (k = 0; k < 96; k++) {
        a = k / 96 * 2 * Math.PI;
        var rf = 0.62 + 0.38 * Math.abs(Math.cos(a * p / 2));
        pts.push([rf * Math.cos(a), rf * Math.sin(a)]);
      }
      return { pts: pts, lisse: true };
    }
    // Blob : cercle déformé par quelques harmoniques seedées.
    var h1 = r.range(0.08, 0.2), h2 = r.range(0.04, 0.12), f1 = r.range(0, 6), f2 = r.range(0, 6);
    for (k = 0; k < 14; k++) {
      a = k / 14 * 2 * Math.PI;
      var rb = 1 + h1 * Math.sin(2 * a + f1) + h2 * Math.sin(3 * a + f2);
      pts.push([rb * Math.cos(a), rb * Math.sin(a)]);
    }
    return { pts: pts, lisse: true };
  }

  DL.enregistrer({
    id: 'planche',
    numero: '27',
    nom: 'Planche',
    famille: 'vecteur',
    description: "Planche d'autocollants : étoiles, éclairs, cœurs, bulles et blobs avec marge de découpe, un groupe SVG par sticker.",
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#D9D4C7', '#FFFFFF', '#141414', '#FF3B00', '#1F4BFF', '#FFC800'],
    params: [
      { cle: 'nombre', label: 'Stickers', type: 'range', min: 1, max: 48, pas: 1, defaut: 12 },
      { cle: 'disposition', label: 'Disposition', type: 'select', defaut: 'planche', options: [
        { valeur: 'planche', label: 'Planche rangée' }, { valeur: 'vrac', label: 'En vrac' }] },
      { cle: 'formes', label: 'Formes', type: 'select', defaut: 'tout', options: [
        { valeur: 'tout', label: 'Toutes' }, { valeur: 'pointus', label: 'Pointues' }, { valeur: 'doux', label: 'Douces' }] },
      { cle: 'taille', label: 'Taille', type: 'range', min: 0.3, max: 1.4, pas: 0.01, defaut: 0.85 },
      { cle: 'bordure', label: 'Marge de découpe', type: 'range', min: 0, max: 0.2, pas: 0.005, defaut: 0.07 },
      { cle: 'ombre', label: 'Ombre dure', type: 'range', min: 0, max: 0.05, pas: 0.001, defaut: 0.012 },
      { cle: 'rotation', label: 'Rotation', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.25 },
      { cle: 'details', label: 'Détails intérieurs', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var papier = pal[1], encre = pal[2] || pal[1], faces = pal.slice(3).length ? pal.slice(3) : [encre];

      var N = P.nombre, C = Math.max(1, Math.round(Math.sqrt(N * w / h))), L = Math.ceil(N / C);
      var cell = Math.min(w / C, h / L), R = cell * 0.4 * P.taille;
      var places = [];
      for (var i = 0; i < N; i++) {
        var rp = rng.fork('place' + i);
        if (P.disposition === 'planche') {
          var c = i % C, l = Math.floor(i / C);
          places.push({ x: (w - C * cell) / 2 + (c + 0.5) * cell, y: (h - L * cell) / 2 + (l + 0.5) * cell, R: R, r: rp });
        } else {
          places.push({ x: rp.range(0.1, 0.9) * w, y: rp.range(0.1, 0.9) * h, R: R * rp.range(0.7, 1.6), r: rp });
        }
      }
      if (P.disposition === 'vrac') places.sort(function (a, b) { return b.R - a.R; });

      var types = FAMILLES[P.formes] || FAMILLES.tout;
      places.forEach(function (pl) {
        var r = pl.r, type = r.pick(types), forme = contour(type, r);
        var rot = (r() - 0.5) * 2 * P.rotation * (P.disposition === 'vrac' ? 180 : 40);
        var etire = type === 'pilule' || type === 'fleche' || type === 'eclair' ? 1 : r.range(0.85, 1.15);
        var groupe = new S.Group();

        function trace() {
          var p;
          if (forme.pilule) p = new S.Path.Rectangle({ point: [-1, -0.42], size: [2, 0.84], radius: 0.42 });
          else { p = new S.Path({ segments: forme.pts, closed: true }); if (forme.lisse) p.smooth({ type: 'catmull-rom' }); }
          p.scale(pl.R * etire, pl.R, [0, 0]);
          p.rotate(rot, [0, 0]);
          p.translate([pl.x, pl.y]);
          return p;
        }
        var bord = P.bordure * pl.R * 2;
        if (P.ombre > 0) {
          var om = trace();
          om.set({ fillColor: encre, strokeColor: encre, strokeWidth: bord, strokeJoin: 'round' });
          om.translate([P.ombre * m, P.ombre * m]);
          groupe.addChild(om);
        }
        if (bord > 0) { var b = trace(); b.set({ fillColor: papier, strokeColor: papier, strokeWidth: bord, strokeJoin: 'round' }); groupe.addChild(b); }
        var cols = r.shuffle(faces), face = trace();
        face.fillColor = cols[0];
        groupe.addChild(face);

        // Détails : réplique intérieure, rayures dans la forme, ou petits yeux pour les formes douces.
        if (r.chance(P.details)) {
          var d = r.int(0, 2), autre = cols[1] || encre;
          if (d === 0) {
            var inner = trace(); inner.scale(0.55, [pl.x, pl.y]); inner.fillColor = autre; groupe.addChild(inner);
          } else if (d === 1) {
            var masque = trace(), rayures = new S.Group([masque]);
            var nbR = r.int(3, 6), pasR = pl.R * 2.4 / (nbR * 2);
            for (var k = 0; k < nbR; k++) {
              var bande = new S.Path.Rectangle({ point: [pl.x - pl.R * 1.3, pl.y - pl.R * 1.2 + (2 * k + 0.5) * pasR], size: [pl.R * 2.6, pasR], fillColor: autre });
              bande.rotate(rot + 30, [pl.x, pl.y]);
              rayures.addChild(bande);
            }
            rayures.clipped = true;
            groupe.addChild(rayures);
          } else {
            var oeil = pl.R * 0.11;
            [-1, 1].forEach(function (s) {
              groupe.addChild(new S.Path.Circle({ center: [pl.x + s * pl.R * 0.25, pl.y - pl.R * 0.08], radius: oeil, fillColor: encre }));
            });
          }
        }
      });
    }
  });
})();

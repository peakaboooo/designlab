/* 01 Oddgrid : compositions pixel génératives (p5.js, mode instance).
   Une grille de cellules, subdivisées récursivement ; chaque feuille reçoit un motif
   « pixellisé » : une fonction (u, v) → plein/vide échantillonnée sur une petite matrice.
   La taille des pixels est liée à la cellule, pas à l'écran : l'export HD garde la même trame. */
(function () {
  'use strict';
  var DL = window.DL;

  // Motifs : (u, v) dans [0,1]², k = variante tirée par feuille. Vrai = pixel d'encre.
  var MOTIFS = [
    function plein() { return true; },
    function escalier(u, v) { return u + v < 1; },
    function disque(u, v) { var x = u - 0.5, y = v - 0.5; return x * x + y * y < 0.2; },
    function carres(u, v, k) { return Math.floor(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2 * k) % 2 === 0; },
    function damier(u, v, k) { return (Math.floor(u * k) + Math.floor(v * k)) % 2 === 0; },
    function rayures(u, v, k) { return Math.floor(u * k * 2) % 2 === 0; },
    function croix(u, v) { return Math.abs(u - 0.5) < 0.17 || Math.abs(v - 0.5) < 0.17; },
    function quart(u, v) { return u * u + v * v < 1; },
    function fleche(u, v) { return Math.abs(v - 0.5) < u * 0.5 && u < 0.9; }
  ];

  // Rotation par quart de tour : un même motif sert dans 4 orientations.
  function tourner(u, v, r) {
    if (r === 1) return [1 - v, u];
    if (r === 2) return [1 - u, 1 - v];
    if (r === 3) return [v, 1 - u];
    return [u, v];
  }

  DL.enregistrer({
    id: 'oddgrid',
    numero: '01',
    nom: 'Oddgrid',
    famille: 'pixel',
    description: 'Compositions pixel génératives : grille subdivisée, motifs tramés cellule par cellule.',
    libs: ['p5.js'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF', '#FFC700'],
    params: [
      { cle: 'colonnes', label: 'Colonnes', type: 'range', min: 2, max: 24, pas: 1, defaut: 6 },
      { cle: 'profondeur', label: 'Subdivisions', type: 'range', min: 0, max: 4, pas: 1, defaut: 2 },
      { cle: 'division', label: 'Probabilité de découpe', type: 'range', min: 0, max: 1, pas: 0.05, defaut: 0.5 },
      { cle: 'resolution', label: 'Pixels par cellule', type: 'range', min: 3, max: 24, pas: 1, defaut: 10 },
      { cle: 'densite', label: 'Densité', type: 'range', min: 0.1, max: 1, pas: 0.05, defaut: 0.9 },
      { cle: 'gouttiere', label: 'Gouttière', type: 'range', min: 0, max: 0.4, pas: 0.01, defaut: 0.06 },
      { cle: 'variete', label: 'Variété de motifs', type: 'range', min: 1, max: 9, pas: 1, defaut: 9 },
      { cle: 'fondCellule', label: 'Fonds de cellule colorés', type: 'toggle', defaut: true }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext;
      if (!pal.transparent) p.background(pal[0]);
      var encres = pal.slice(1);
      var cw = w / P.colonnes;
      var lignes = Math.max(1, Math.round(h / cw));
      var ch = h / lignes;
      // Ordre des motifs tiré une fois : « variété 3 » = 3 motifs différents selon la seed.
      var motifs = rng.shuffle(MOTIFS.map(function (_, i) { return i; })).slice(0, P.variete);
      if (P.variete >= 1 && motifs.indexOf(0) < 0 && rng.chance(0.3)) motifs[0] = 0;

      function feuille(x, y, fw, fh) {
        if (!rng.chance(P.densite)) return;
        var g = P.gouttiere * Math.min(fw, fh) * 0.5;
        var x0 = x + g, y0 = y + g, lw = fw - 2 * g, lh = fh - 2 * g;
        if (lw <= 0 || lh <= 0) return;
        var ci = rng.int(0, encres.length - 1);
        var avant = encres[ci];
        var fond = null;
        if (P.fondCellule && rng.chance(0.55)) {
          fond = encres[(ci + rng.int(1, encres.length - 1)) % encres.length];
        }
        var m = MOTIFS[rng.pick(motifs)], rot = rng.int(0, 3), k = rng.int(2, 4);
        // Résolution proportionnelle à la taille de la feuille : même taille de pixel partout.
        var n = Math.max(2, Math.round(P.resolution * Math.min(fw / cw, fh / ch)));
        if (fond) { ctx.fillStyle = fond; ctx.fillRect(Math.round(x0), Math.round(y0), Math.round(x0 + lw) - Math.round(x0), Math.round(y0 + lh) - Math.round(y0)); }
        ctx.fillStyle = avant;
        // Bords arrondis à l'entier : pas de liseré entre pixels voisins.
        for (var j = 0; j < n; j++) {
          var ya = Math.round(y0 + lh * j / n), yb = Math.round(y0 + lh * (j + 1) / n);
          for (var i = 0; i < n; i++) {
            var uv = tourner((i + 0.5) / n, (j + 0.5) / n, rot);
            if (m(uv[0], uv[1], k)) {
              var xa = Math.round(x0 + lw * i / n), xb = Math.round(x0 + lw * (i + 1) / n);
              ctx.fillRect(xa, ya, xb - xa, yb - ya);
            }
          }
        }
      }

      function diviser(x, y, fw, fh, d) {
        if (d < P.profondeur && rng.chance(P.division)) {
          var mw = fw / 2, mh = fh / 2;
          diviser(x, y, mw, mh, d + 1);
          diviser(x + mw, y, mw, mh, d + 1);
          diviser(x, y + mh, mw, mh, d + 1);
          diviser(x + mw, y + mh, mw, mh, d + 1);
        } else feuille(x, y, fw, fh);
      }

      for (var r = 0; r < lignes; r++) {
        for (var c = 0; c < P.colonnes; c++) diviser(c * cw, r * ch, cw, ch, 0);
      }
    }
  });
})();

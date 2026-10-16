/* 23 Cipher : grilles de glyphes inventés (Paper.js, export SVG).
   Un alphabet imaginaire est tiré de la seed : chaque glyphe est une marche sur une petite
   grille de nœuds (3×3 à 4×5), faite de traits droits, de diagonales et de quarts de cercle.
   L'alphabet compte peu de signes, que l'on répète sur toute la grille : la répétition donne
   l'illusion d'une vraie écriture. Quelques glyphes ressortent en couleur ou en cartouche inversé. */
(function () {
  'use strict';
  var DL = window.DL;

  var NOEUDS = { '3x3': [3, 3], '3x4': [3, 4], '4x4': [4, 4], '4x5': [4, 5] };
  // Quart de cercle en Bézier cubique : poignées à 0,5523 du rayon (approximation standard).
  var K = 0.5523;

  // Un glyphe = liste de traits, chaque trait = suite de nœuds { i, j, courbe }.
  function creerGlyphe(r, nx, ny, longueur, courbes) {
    var traits = [], vus = {};
    var nbTraits = r.chance(0.35) ? 2 : 1;
    for (var t = 0; t < nbTraits; t++) {
      var i = r.int(0, nx - 1), j = r.int(0, ny - 1), trait = [{ i: i, j: j }];
      var n = Math.max(1, Math.round(longueur / nbTraits * r.range(0.7, 1.3)));
      for (var s = 0; s < n; s++) {
        // Voisins (8 directions) dont l'arête n'a pas encore été tracée.
        var options = [];
        for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          var ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          var cle = Math.min(i * 9 + j, ni * 9 + nj) + '-' + Math.max(i * 9 + j, ni * 9 + nj);
          if (!vus[cle]) options.push([ni, nj, cle, di && dj]);
        }
        if (!options.length) break;
        var o = r.pick(options);
        vus[o[2]] = true;
        i = o[0]; j = o[1];
        // Une diagonale peut devenir un quart de cercle (le coin est tiré au sort).
        trait.push({ i: i, j: j, courbe: o[3] && r.chance(courbes) ? (r.chance(0.5) ? 1 : 2) : 0 });
      }
      traits.push(trait);
    }
    // Point diacritique : un sur quatre.
    var point = r.chance(0.25) ? { i: r.int(0, nx - 1), j: r.chance(0.5) ? -0.8 : ny - 0.2 } : null;
    return { traits: traits, point: point };
  }

  DL.enregistrer({
    id: 'cipher',
    numero: '23',
    nom: 'Cipher',
    famille: 'typo',
    description: 'Grilles de glyphes inventés : un alphabet imaginaire tiré de la seed, répété comme une écriture, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 4,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF'],
    params: [
      { cle: 'colonnes', label: 'Glyphes par ligne', type: 'range', min: 2, max: 30, pas: 1, defaut: 9 },
      { cle: 'noeuds', label: 'Grille du glyphe', type: 'select', defaut: '3x4', options: [
        { valeur: '3x3', label: '3 × 3' }, { valeur: '3x4', label: '3 × 4' }, { valeur: '4x4', label: '4 × 4' }, { valeur: '4x5', label: '4 × 5' }] },
      { cle: 'alphabet', label: "Taille de l'alphabet", type: 'range', min: 2, max: 40, pas: 1, defaut: 14 },
      { cle: 'longueur', label: 'Traits par glyphe', type: 'range', min: 2, max: 12, pas: 1, defaut: 5 },
      { cle: 'courbes', label: 'Courbes', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.4 },
      { cle: 'epaisseur', label: 'Épaisseur', type: 'range', min: 0.04, max: 0.45, pas: 0.01, defaut: 0.16 },
      { cle: 'terminaison', label: 'Terminaisons', type: 'select', defaut: 'carre', options: [
        { valeur: 'carre', label: 'Carrées' }, { valeur: 'rond', label: 'Rondes' }] },
      { cle: 'accents', label: 'Glyphes en couleur', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.12 }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var nn = NOEUDS[P.noeuds] || NOEUDS['3x4'], nx = nn[0], ny = nn[1];

      var ra = rng.fork('alphabet'), alphabet = [];
      for (var a = 0; a < P.alphabet; a++) alphabet.push(creerGlyphe(ra, nx, ny, P.longueur, P.courbes));

      // Cellule : largeur du glyphe + interlettrage ; ligne : hauteur + interligne.
      var marge = m * 0.07;
      var cellW = (w - 2 * marge) / P.colonnes;
      var gw = cellW * 0.72, pasN = gw / (nx - 1), gh = pasN * (ny - 1);
      var ligneH = gh * 1.7;
      var lignes = Math.max(1, Math.floor((h - 2 * marge + (ligneH - gh)) / ligneH));
      var y0 = (h - (lignes * ligneH - (ligneH - gh))) / 2;
      var ep = pasN * P.epaisseur * 2.2;
      var cap = P.terminaison === 'rond' ? 'round' : 'square', join = P.terminaison === 'rond' ? 'round' : 'miter';
      var rp = rng.fork('texte');

      for (var l = 0; l < lignes; l++) {
        for (var c = 0; c < P.colonnes; c++) {
          // Espaces entre « mots » : la fin de ligne reste parfois vide, comme un texte en drapeau.
          if (rp.chance(0.14) || (c > P.colonnes * 0.6 && l === lignes - 1 && rp.chance(0.5))) continue;
          var gl = rp.pick(alphabet);
          var ox = marge + c * cellW + (cellW - gw) / 2, oy = y0 + l * ligneH;
          var couleur = pal[1];
          var tirage = rp();
          if (tirage < P.accents * 0.5 && pal.length > 3) {
            // Cartouche : glyphe en réserve dans un bloc plein.
            var pad = ep * 1.1;
            new S.Path.Rectangle({ point: [ox - pad, oy - pad], size: [gw + 2 * pad, gh + 2 * pad], fillColor: pal[3] });
            couleur = pal[0];
          } else if (tirage < P.accents) couleur = pal[2] || pal[1];

          gl.traits.forEach(function (tr) {
            var path = new S.Path({ strokeColor: couleur, strokeWidth: ep, strokeCap: cap, strokeJoin: join });
            path.moveTo([ox + tr[0].i * pasN, oy + tr[0].j * pasN]);
            for (var k = 1; k < tr.length; k++) {
              var p0 = [ox + tr[k - 1].i * pasN, oy + tr[k - 1].j * pasN], p1 = [ox + tr[k].i * pasN, oy + tr[k].j * pasN];
              if (!tr[k].courbe) { path.lineTo(p1); continue; }
              var coin = tr[k].courbe === 1 ? [p1[0], p0[1]] : [p0[0], p1[1]];
              path.cubicCurveTo(
                [p0[0] + (coin[0] - p0[0]) * K, p0[1] + (coin[1] - p0[1]) * K],
                [p1[0] + (coin[0] - p1[0]) * K, p1[1] + (coin[1] - p1[1]) * K], p1);
            }
            if (tr.length === 1) path.lineTo([ox + tr[0].i * pasN + 0.01, oy + tr[0].j * pasN]);
          });
          if (gl.point) {
            var pr = ep * 0.75;
            var pp = [ox + gl.point.i * pasN, oy + gl.point.j * pasN];
            if (cap === 'round') new S.Path.Circle({ center: pp, radius: pr, fillColor: couleur });
            else new S.Path.Rectangle({ point: [pp[0] - pr, pp[1] - pr], size: [2 * pr, 2 * pr], fillColor: couleur });
          }
        }
      }
    }
  });
})();

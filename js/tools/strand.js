/* 38 Strand : tiges ramifiées perlées, en vectoriel (Paper.js, export SVG).
   Des tiges partent du sol, du centre ou des bords. Chaque segment se courbe un peu, porte des
   perles enfilées à intervalles réguliers, puis se divise en deux (parfois une ou trois) tiges
   plus courtes et plus fines, jusqu'à la profondeur choisie, où il finit en bourgeon ou en
   feuille. La croissance se fait en largeur (génération par génération) avec un budget de
   segments : la profondeur maximale ne peut pas faire exploser le SVG. Longueurs et
   épaisseurs sont relatives au petit côté : l'export HD redonne la même plante. */
(function () {
  'use strict';
  var DL = window.DL;

  // Plafonds : l'aperçu reste rapide bien au-delà, mais l'export SVG de Paper.js coûte près
  // d'une milliseconde par élément (3 000 éléments ≈ 2,5 s).
  var BUDGET = 1200;      // segments au plus
  var PERLES_MAX = 2500;  // perles au plus
  var DECROIT = 0.74;     // longueur d'une génération à la suivante, en moyenne

  DL.enregistrer({
    id: 'strand',
    numero: '38',
    nom: 'Strand',
    famille: 'vecteur',
    description: 'Tiges ramifiées et perlées : des chaînes qui poussent, se divisent et finissent en bourgeons, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#F1EDE4', '#2D3B2F', '#C8553D', '#E9B44C', '#7A9E7E', '#3E5C76'],
    params: [
      { cle: 'tiges', label: 'Tiges', type: 'range', min: 1, max: 12, pas: 1, defaut: 5 },
      { cle: 'profondeur', label: 'Ramifications', type: 'range', min: 2, max: 9, pas: 1, defaut: 6 },
      { cle: 'ecartement', label: 'Écartement', type: 'range', min: 5, max: 80, pas: 1, defaut: 30, unite: '°' },
      { cle: 'courbure', label: 'Courbure', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'perles', label: 'Perles', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'epaisseur', label: 'Épaisseur', type: 'range', min: 0.3, max: 2, pas: 0.05, defaut: 1 },
      { cle: 'depart', label: 'Départ', type: 'select', defaut: 'sol', options: [
        { valeur: 'sol', label: 'Sol' }, { valeur: 'centre', label: 'Centre' }, { valeur: 'bords', label: 'Bords' }] },
      { cle: 'bouts', label: 'Extrémités', type: 'select', defaut: 'bourgeon', options: [
        { valeur: 'bourgeon', label: 'Bourgeon' }, { valeur: 'feuille', label: 'Feuille' }, { valeur: 'aucun', label: 'Aucune' }] }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var tige = pal[1], encres = pal.length > 2 ? pal.slice(2) : [pal[1]];
      var ecart = P.ecartement * Math.PI / 180;
      var portee = { sol: 0.8, centre: 0.42, bords: 0.5 }[P.depart] * m;
      // Longueur du premier segment : la somme des générations atteint à peu près la portée.
      var L0 = portee * (1 - DECROIT) / (1 - Math.pow(DECROIT, P.profondeur + 1));
      var ep0 = m * 0.008 * P.epaisseur;

      // Calques : tiges dessous, perles et extrémités dessus.
      var calqueTiges = new S.Group(), calquePerles = new S.Group();

      var file = [];
      for (var t = 0; t < P.tiges; t++) {
        var r = rng.fork('tige' + t), x, y, a;
        if (P.depart === 'sol') {
          x = w * (P.tiges === 1 ? 0.5 : (t + 0.5 + r.range(-0.3, 0.3)) / P.tiges);
          y = h + ep0; a = -Math.PI / 2 + r.range(-0.22, 0.22);
        } else if (P.depart === 'centre') {
          a = t / P.tiges * Math.PI * 2 + r.range(-0.25, 0.25);
          x = w / 2 + Math.cos(a) * m * 0.02; y = h / 2 + Math.sin(a) * m * 0.02;
        } else {
          var cote = r.int(0, 3), u = r.range(0.12, 0.88);
          x = cote < 2 ? u * w : (cote === 2 ? -ep0 : w + ep0);
          y = cote < 2 ? (cote === 0 ? -ep0 : h + ep0) : u * h;
          a = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][cote] + r.range(-0.35, 0.35);
        }
        file.push({ x: x, y: y, a: a, L: L0 * r.range(0.85, 1.15), ep: ep0, prof: P.profondeur, r: r, g: 0 });
      }
      // Cercles en Shape (et non en Path) : plus légers à créer et à dessiner, exportés en
      // simples <circle> dans le SVG.
      function rond(x, y, r, couleur, calque) {
        return new S.Shape.Circle({ center: [x, y], radius: r, fillColor: couleur, parent: calque });
      }
      if (P.depart === 'centre') rond(w / 2, h / 2, ep0 * 3.2, encres[0], calquePerles);
      var perlesPosees = 0;

      function bout(x, y, a, s) {
        var c = encres[(s.g + Math.floor(s.r() * encres.length)) % encres.length];
        if (P.bouts === 'bourgeon') {
          rond(x, y, Math.max(s.ep * 2.2, m * 0.0035), c, calquePerles);
        } else if (P.bouts === 'feuille') {
          var lg = Math.max(s.L * 0.55, m * 0.012), feuille = new S.Path.Ellipse({
            center: [x + Math.cos(a) * lg / 2, y + Math.sin(a) * lg / 2], radius: [lg / 2, lg * 0.21], fillColor: c, parent: calquePerles
          });
          feuille.rotate(a * 180 / Math.PI, new S.Point(x + Math.cos(a) * lg / 2, y + Math.sin(a) * lg / 2));
        }
      }

      for (var i = 0; i < file.length; i++) {
        var s = file[i], rs = s.r;
        // Segment courbe : virage réparti sur quelques points, lissé en courbe de Bézier.
        var virage = (rs() - 0.5) * 2 * P.courbure * 1.1, n = 6;
        var pts = [[s.x, s.y]], ang = s.a, px = s.x, py = s.y;
        for (var k = 1; k <= n; k++) {
          ang += virage / n;
          px += Math.cos(ang) * s.L / n; py += Math.sin(ang) * s.L / n;
          pts.push([px, py]);
        }
        var chemin = new S.Path({ segments: pts, strokeColor: tige, strokeWidth: s.ep, strokeCap: 'round', strokeJoin: 'round', parent: calqueTiges });
        chemin.smooth({ type: 'catmull-rom', factor: 0.5 });

        // Perles enfilées à espacement régulier, placées sur la ligne brisée du segment (calcul
        // direct : chercher les points sur la courbe Paper coûtait des dizaines de secondes).
        if (P.perles > 0 && perlesPosees < PERLES_MAX) {
          var rb = Math.max(s.ep * 1.3, m * 0.0016), pasPerle = rb * 2 * (1 + (1 - P.perles) * 3);
          var cumul = [0];
          for (k = 1; k <= n; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
          var nbPerles = Math.floor(cumul[n] / pasPerle), seg = 1;
          for (var j = 1; j < nbPerles && perlesPosees < PERLES_MAX; j++) {
            if (!rs.chance(0.35 + 0.65 * P.perles)) continue;
            var dist = j * pasPerle;
            while (seg < n && cumul[seg] < dist) seg++;
            var f = (dist - cumul[seg - 1]) / Math.max(1e-9, cumul[seg] - cumul[seg - 1]);
            rond(pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * f, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * f,
              rb * rs.range(0.8, 1.15), encres[(j + s.g) % encres.length], calquePerles);
            perlesPosees++;
          }
        }

        // Fin de branche : profondeur atteinte, segment trop court ou budget épuisé.
        if (s.prof <= 0 || s.L < m * 0.01 || file.length >= BUDGET) { bout(px, py, ang, s); continue; }
        // Pas de nœud dessiné à la jointure : les bouts de tige arrondis la cachent déjà.
        var nb = rs.chance(0.16) ? 3 : rs.chance(0.12) ? 1 : 2;
        for (var c = 0; c < nb; c++) {
          var dec = nb === 1 ? rs.range(-0.3, 0.3) * ecart : (c / (nb - 1) - 0.5) * 2 * ecart * rs.range(0.7, 1.2);
          file.push({ x: px, y: py, a: ang + dec, L: s.L * rs.range(0.66, 0.84), ep: Math.max(s.ep * 0.74, m * 0.0008), prof: s.prof - 1, r: rs.fork('c' + c), g: s.g + 1 });
        }
      }
    }
  });
})();

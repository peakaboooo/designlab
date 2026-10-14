/* 17 Relief : blocs isométriques (canvas 2D).
   Une grille N×N de colonnes dont la hauteur vient d'un bruit, quantifiée en paliers, avec des
   trous. Projection isométrique dessinée de l'arrière vers l'avant (ordre i + j croissant) :
   chaque colonne a trois faces (dessus clair, gauche moyenne, droite sombre), ce qui suffit à
   lire le volume sans moteur 3D. Le tout est cadré automatiquement dans l'image. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'relief',
    numero: '17',
    nom: 'Relief',
    famille: 'volume',
    description: 'Blocs isométriques : colonnes en paliers, trous et faces ombrées, cadrées automatiquement.',
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF', '#FFC700', '#00A86B'],
    params: [
      { cle: 'grille', label: 'Colonnes par côté', type: 'range', min: 3, max: 40, pas: 1, defaut: 12 },
      { cle: 'hauteur', label: 'Hauteur', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.55 },
      { cle: 'paliers', label: 'Paliers', type: 'range', min: 1, max: 16, pas: 1, defaut: 7 },
      { cle: 'echelle', label: 'Échelle du relief', type: 'range', min: 0.3, max: 5, pas: 0.1, defaut: 1.4 },
      { cle: 'vides', label: 'Trous', type: 'range', min: 0, max: 0.6, pas: 0.01, defaut: 0.08 },
      { cle: 'couleur', label: 'Couleurs', type: 'select', defaut: 'hauteur', options: [
        { valeur: 'hauteur', label: 'Par palier' }, { valeur: 'hasard', label: 'Au hasard' }, { valeur: 'damier', label: 'En damier' }] },
      { cle: 'contraste', label: 'Contraste des faces', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.6 },
      { cle: 'contour', label: 'Arêtes', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var N = P.grille, bruit = DL.creerBruit(rng.fork('hauteur'));
      var ox = rng.range(0, 50), oy = rng.range(0, 50);
      var niv = [];
      for (var i = 0; i < N; i++) {
        niv.push([]);
        for (var j = 0; j < N; j++) {
          var v = bruit.fbm2(i / N * P.echelle + ox, j / N * P.echelle + oy, 3) * 0.5 + 0.5;
          niv[i].push(rng.chance(P.vides) ? -1 : Math.round(DL.clamp(v, 0, 1) * P.paliers));
        }
      }
      // Cadrage : largeur du losange = N * tw ; hauteur = N * tw/2 + hauteur max des colonnes.
      var hu = P.hauteur * 0.45;  // hauteur d'un palier en fraction de tw
      var socle = 0.25;           // épaisseur du sol, en fraction de tw
      var tw = Math.min(w * 0.88 / N, h * 0.88 / (N / 2 + (P.paliers * hu + socle)));
      var th = tw / 2, uh = hu * tw;
      var hautTotal = N * th + P.paliers * uh + socle * tw;
      var x0 = w / 2, y0 = (h - hautTotal) / 2 + P.paliers * uh;

      // Trois tons par encre (dessus, gauche, droite), calculés une fois.
      var encres = pal.slice(2);
      var tons = encres.map(function (c) {
        var k = P.contraste;
        return [chroma(c).brighten(0.6 * k).hex(), c, chroma(c).darken(1.2 * k).hex()];
      });
      var ordre = rng.shuffle(encres.map(function (_, i) { return i; }));
      var hasard = [];
      for (i = 0; i < N * N; i++) hasard.push(rng.int(0, encres.length - 1));

      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal[1];
      ctx.lineWidth = Math.max(0.6, tw * 0.025);
      function face(pts, couleur) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.fillStyle = couleur;
        ctx.fill();
        if (P.contour) ctx.stroke();
      }

      // De l'arrière vers l'avant : une colonne ne masque que celles dessinées avant elle.
      for (var s = 0; s <= 2 * (N - 1); s++) {
        for (i = Math.max(0, s - N + 1); i <= Math.min(s, N - 1); i++) {
          j = s - i;
          var n = niv[i][j];
          if (n < 0) continue;
          var cx = x0 + (i - j) * tw / 2, cy = y0 + (i + j) * th / 2 + th / 2;
          var z = n * uh, zb = -socle * tw;
          var ci = P.couleur === 'hauteur' ? ordre[n % encres.length] : P.couleur === 'damier' ? ordre[(i + j) % encres.length] : hasard[i * N + j];
          var t = tons[ci];
          var haut = [cx, cy - th / 2 - z], droite = [cx + tw / 2, cy - z], bas = [cx, cy + th / 2 - z], gauche = [cx - tw / 2, cy - z];
          face([gauche, bas, [bas[0], cy + th / 2 - zb], [gauche[0], cy - zb]], t[1]);
          face([bas, droite, [droite[0], cy - zb], [bas[0], cy + th / 2 - zb]], t[2]);
          face([haut, droite, bas, gauche], t[0]);
        }
      }
    }
  });
})();

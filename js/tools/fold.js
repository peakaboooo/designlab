/* 10 Fold : pixel art en kaléidoscope (p5.js).
   On tire du bruit dans un domaine fondamental (moitié, quart ou huitième du carré),
   on le replie par symétrie sur toute la tuile, puis un automate cellulaire lisse les formes.
   L'automate (voisinage de Moore, règle isotrope) préserve les symétries miroir : le résultat
   reste parfaitement symétrique. Les couleurs viennent d'un second champ, replié de même. */
(function () {
  'use strict';
  var DL = window.DL;

  // Ramène (i, j) dans le domaine fondamental de la symétrie choisie.
  function replier(i, j, N, sym) {
    var a = i, b = j;
    if (sym === '2') { a = Math.min(i, N - 1 - i); }
    else if (sym === '4' || sym === '8') {
      a = Math.min(i, N - 1 - i); b = Math.min(j, N - 1 - j);
      if (sym === '8' && a > b) { var t = a; a = b; b = t; }
    } else if (sym === 'rot4') {
      // Moulinet : rotation d'un quart de tour autour du centre, sans miroir.
      // N est pair : les coordonnées centrées sont des demi-entiers, jamais nulles, et chaque
      // quart de tour fait passer au quadrant suivant ; au plus 3 rotations suffisent.
      var h = N / 2, x = i - h + 0.5, y = j - h + 0.5;
      for (var r = 0; r < 4 && !(x < 0 && y < 0); r++) { var nx = -y; y = x; x = nx; }
      a = Math.round(x + h - 0.5); b = Math.round(y + h - 0.5);
    }
    return [a, b];
  }

  DL.enregistrer({
    id: 'fold',
    numero: '10',
    nom: 'Fold',
    famille: 'pixel',
    description: 'Pixel art en kaléidoscope : un motif tiré au hasard, replié en symétries miroir ou en moulinet.',
    libs: ['p5.js'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#FAF3E3', '#2B2B2B', '#FF5E5B', '#00CECB', '#FFED66', '#8B80F9'],
    params: [
      { cle: 'pixels', label: 'Pixels par tuile', type: 'range', min: 8, max: 72, pas: 2, defaut: 28 },
      { cle: 'symetrie', label: 'Symétrie', type: 'select', defaut: '8', options: [
        { valeur: '2', label: 'Miroir simple' }, { valeur: '4', label: 'Miroir double' }, { valeur: '8', label: 'Kaléidoscope (8)' }, { valeur: 'rot4', label: 'Moulinet (rotation 4)' }] },
      { cle: 'repetitions', label: 'Répétitions', type: 'range', min: 1, max: 5, pas: 1, defaut: 1 },
      { cle: 'densite', label: 'Densité', type: 'range', min: 0.2, max: 0.8, pas: 0.01, defaut: 0.5 },
      { cle: 'lissage', label: 'Lissage', type: 'range', min: 0, max: 6, pas: 1, defaut: 2 },
      { cle: 'couleurs', label: 'Couleurs utilisées', type: 'range', min: 1, max: 4, pas: 1, defaut: 4 },
      { cle: 'contour', label: 'Contour', type: 'toggle', defaut: true }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      if (!pal.transparent) p.background(pal[0]);
      var N = P.pixels, sym = P.symetrie;
      var bruit = DL.creerBruit(rng.fork('couleurs'));
      var fond = new Float32Array(N * N);
      for (var k = 0; k < fond.length; k++) fond[k] = rng();

      // 1. Valeurs tirées dans le domaine fondamental puis repliées.
      var g = new Uint8Array(N * N), cIdx = new Uint8Array(N * N);
      var encres = pal.slice(2, 2 + P.couleurs);
      if (!encres.length) encres = [pal[1]];
      for (var j = 0; j < N; j++) {
        for (var i = 0; i < N; i++) {
          var f = replier(i, j, N, sym), fi = f[0], fj = f[1];
          g[j * N + i] = fond[fj * N + fi] < P.densite ? 1 : 0;
          var c = bruit.n2(fi / N * 3.2, fj / N * 3.2) * 0.5 + 0.5;
          cIdx[j * N + i] = Math.min(encres.length - 1, Math.floor(c * encres.length));
        }
      }

      // 2. Automate cellulaire : comble les trous, efface les pixels isolés.
      for (var it = 0; it < P.lissage; it++) {
        var g2 = new Uint8Array(N * N);
        for (j = 0; j < N; j++) {
          for (i = 0; i < N; i++) {
            var v = 0;
            for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
              if (!di && !dj) continue;
              var x = i + di, y = j + dj;
              if (x >= 0 && y >= 0 && x < N && y < N) v += g[y * N + x];
            }
            g2[j * N + i] = v >= 5 || (g[j * N + i] && v >= 4) ? 1 : 0;
          }
        }
        g = g2;
      }

      // 3. Contour : pixel vide touchant un pixel plein (4-voisinage) → encre de trait.
      var contour = new Uint8Array(N * N);
      if (P.contour) {
        for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
          if (g[j * N + i]) continue;
          if ((i > 0 && g[j * N + i - 1]) || (i < N - 1 && g[j * N + i + 1]) || (j > 0 && g[(j - 1) * N + i]) || (j < N - 1 && g[(j + 1) * N + i])) contour[j * N + i] = 1;
        }
      }

      // 4. Pavage : tuiles carrées de côté m / répétitions, centrées ; une sur deux en miroir
      // pour que les bords se raccordent.
      var T = m / P.repetitions;
      var nx = Math.ceil(w / T / 2) * 2 + 1, ny = Math.ceil(h / T / 2) * 2 + 1;
      var ox = (w - nx * T) / 2, oy = (h - ny * T) / 2;
      for (var ty = 0; ty < ny; ty++) {
        for (var tx = 0; tx < nx; tx++) {
          var X = ox + tx * T, Y = oy + ty * T;
          if (X > w || Y > h || X + T < 0 || Y + T < 0) continue;
          var mx = (tx - (nx - 1) / 2) % 2 !== 0, my = (ty - (ny - 1) / 2) % 2 !== 0;
          for (j = 0; j < N; j++) {
            var ya = Math.round(Y + T * j / N), yb = Math.round(Y + T * (j + 1) / N);
            for (i = 0; i < N; i++) {
              var si = mx ? N - 1 - i : i, sj = my ? N - 1 - j : j, q = sj * N + si;
              var col = g[q] ? encres[cIdx[q]] : contour[q] ? pal[1] : null;
              if (!col) continue;
              var xa = Math.round(X + T * i / N), xb = Math.round(X + T * (i + 1) / N);
              ctx.fillStyle = col;
              ctx.fillRect(xa, ya, xb - xa, yb - ya);
            }
          }
        }
      }
    }
  });
})();

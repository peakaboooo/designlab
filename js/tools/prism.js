/* 34 Prism : fonds d'aurore en pixels (canvas 2D).
   Un ciel nocturne parcouru de rideaux d'aurore boréale, calculé sur une grille de gros pixels.
   Chaque rideau a une ligne de base ondulante (bruit) : la lumière y est vive puis monte en
   s'éteignant, striée de rayons verticaux, et s'interrompt par endroits. L'intensité obtenue est
   ramenée aux seules couleurs de la palette par une trame ordonnée (matrice de Bayer) : les
   dégradés deviennent des motifs de pixels réguliers, comme sur un vieil écran à palette fixe.
   La grille est dessinée dans un petit canvas puis agrandie sans lissage : rapide à toute taille. */
(function () {
  'use strict';
  var DL = window.DL;

  // Matrices de Bayer normalisées (seuils dans [0,1)).
  function bayer(n) {
    var m = [[0]];
    while (m.length < n) {
      var t = m.length, nm = [];
      for (var y = 0; y < 2 * t; y++) {
        nm.push([]);
        for (var x = 0; x < 2 * t; x++) {
          var b = m[y % t][x % t] * 4;
          nm[y].push(b + [0, 2, 3, 1][(y >= t ? 2 : 0) + (x >= t ? 1 : 0)]);
        }
      }
      m = nm;
    }
    var nn = n * n;
    return m.map(function (l) { return l.map(function (v) { return (v + 0.5) / nn; }); });
  }
  var BAYER = { bayer4: bayer(4), bayer8: bayer(8) };

  DL.enregistrer({
    id: 'prism',
    numero: '34',
    nom: 'Prism',
    famille: 'pixel',
    description: 'Aurores boréales en gros pixels : rideaux de lumière striés, tramés avec la palette comme sur un vieil écran.',
    libs: ['Canvas 2D', 'chroma.js'],
    moteur: 'canvas2d',
    fondTransparent: false,
    nbCouleurs: 6,
    palette: ['#070B1A', '#16324F', '#1F7A6D', '#35D49A', '#B8F28B', '#F2E9FF'],
    params: [
      { cle: 'pixels', label: 'Pixels (petit côté)', type: 'range', min: 32, max: 256, pas: 4, defaut: 96 },
      { cle: 'rideaux', label: 'Rideaux', type: 'range', min: 1, max: 5, pas: 1, defaut: 3 },
      { cle: 'ondulation', label: 'Ondulation', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.55 },
      { cle: 'hauteur', label: 'Hauteur de la lueur', type: 'range', min: 0.1, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'rayons', label: 'Rayons', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.65 },
      { cle: 'etoiles', label: 'Étoiles', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.4 },
      { cle: 'trame', label: 'Trame', type: 'select', defaut: 'bayer4', options: [
        { valeur: 'bayer4', label: 'Bayer 4' }, { valeur: 'bayer8', label: 'Bayer 8' }, { valeur: 'aucune', label: 'Aucune' }] },
      { cle: 'horizon', label: 'Montagnes', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      var cel = m / P.pixels;
      var GW = Math.ceil(w / cel), GH = Math.ceil(h / cel);
      var W = GW / P.pixels, H = GH / P.pixels; // taille de la grille en unités « petit côté »

      // Rampe de couleurs : du fond vers l'encre la plus contrastée. Avec une palette tirée au
      // hasard (encres dans le désordre), l'aurore reste lisible : la lumière va toujours du
      // fond vers le plus contrasté.
      var rampe = [pal[0]].concat(pal.slice(1).sort(function (a, b) {
        return chroma.contrast(pal[0], a) - chroma.contrast(pal[0], b);
      }));
      var rgb = rampe.map(function (c) { return chroma(c).rgb(); });
      var N = rampe.length;

      var bruit = DL.creerBruit(rng.fork('bruit'));
      var rideaux = [];
      for (var k = 0; k < P.rideaux; k++) {
        var r = rng.fork('rideau' + k);
        rideaux.push({
          base: H * (0.3 + 0.38 * (P.rideaux > 1 ? k / (P.rideaux - 1) : 0.5) + r.range(-0.06, 0.06)),
          dx: r.range(0, 100), dy: r.range(0, 100),
          force: r.range(0.75, 1.15),
          largeur: r.range(0.7, 1.4)
        });
      }
      var ligneMontagne = [];
      var rm = rng.fork('montagnes'), mx = rm.range(0, 50);
      for (var gx = 0; gx < GW; gx++) {
        var X = (gx + 0.5) / P.pixels;
        ligneMontagne.push(H * (1 - 0.09 - 0.13 * (0.5 + 0.5 * bruit.fbm2(X * 2.4 + mx, 7.7, 4))));
      }

      var seuils = BAYER[P.trame];
      var petit = document.createElement('canvas');
      petit.width = GW; petit.height = GH;
      var pc = petit.getContext('2d');
      var img = pc.createImageData(GW, GH), d = img.data;
      var graine = DL.hacher(String(rng.seed) + 'etoiles');
      var silhouette = chroma(pal[0]).darken(1.1).rgb();

      for (var gy = 0; gy < GH; gy++) {
        var Y = (gy + 0.5) / P.pixels;
        for (gx = 0; gx < GW; gx++) {
          X = (gx + 0.5) / P.pixels;
          var o = (gy * GW + gx) * 4;
          if (P.horizon && Y > ligneMontagne[gx]) {
            d[o] = silhouette[0]; d[o + 1] = silhouette[1]; d[o + 2] = silhouette[2]; d[o + 3] = 255;
            continue;
          }
          // Ciel : presque uni, à peine plus clair vers l'horizon (le tramage reste discret).
          var I = 0.035 * Math.pow(Y / H, 2);
          var somme = 0;
          for (k = 0; k < rideaux.length; k++) {
            var rd = rideaux[k];
            var base = rd.base + P.ondulation * 0.16 * bruit.fbm2(X * 0.9 + rd.dx, rd.dy, 3);
            var dy = base - Y, profil;
            // Au-dessus de la base : liseré vif puis lueur qui s'éteint en montant ;
            // en dessous : bord net.
            if (dy >= 0) profil = (Math.exp(-dy / (P.hauteur * 0.3 * rd.largeur)) + 0.6 * Math.exp(-dy / 0.018)) * (1 - Math.exp(-dy / 0.008));
            else profil = Math.exp(-(dy * dy) / 0.0003);
            if (profil < 0.002) continue;
            // Le rideau s'allume et s'éteint le long de l'horizon.
            var env = DL.smooth(-0.25, 0.45, bruit.n2(X * 0.75 + rd.dx * 3, rd.dy + 4));
            // Rayons : bruit très étiré à la verticale, contrasté (puissance) pour des raies nettes.
            var raie = Math.pow(0.5 + 0.5 * bruit.n2(X * 30 + rd.dx, Y * 0.6 + rd.dy), 1.6);
            somme += rd.force * env * profil * ((1 - P.rayons) + P.rayons * (0.1 + 1.5 * raie));
          }
          I += 1 - Math.exp(-1.8 * somme);
          I = DL.clamp(I, 0, 1);

          // Étoiles : pixels isolés là où le ciel est sombre.
          var idx;
          if (I < 0.2 && DL.hash2(gx, gy, graine) < P.etoiles * 0.012) idx = N - 1;
          else {
            var t = I * (N - 1);
            idx = seuils ? Math.floor(t + seuils[gy % seuils.length][gx % seuils.length]) : Math.round(t);
            idx = DL.clamp(idx, 0, N - 1);
          }
          var c = rgb[idx];
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      pc.putImageData(img, 0, 0);

      // Agrandissement sans lissage, grille centrée : chaque pixel de grille = cel pixels d'image.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(petit, (w - GW * cel) / 2, (h - GH * cel) / 2, GW * cel, GH * cel);
      ctx.imageSmoothingEnabled = true;
      petit.width = petit.height = 0;
    }
  });
})();

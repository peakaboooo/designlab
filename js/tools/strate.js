/* 12 Strate : coupes géologiques : couches plissées, failles et surface érodée (canvas 2D).
   Vue en coupe (pas de dessus comme Terrain) : chaque couche a une épaisseur qui varie avec
   du bruit, l'ensemble est plissé et incliné, puis cassé par des failles obliques qui décalent
   le bloc de droite. La surface du sol, tirée indépendamment, tranche les couches comme
   l'érosion. Certaines couches reçoivent une texture (lits, grains, briques).
   Tout est calculé en coordonnées relatives au petit côté : l'export HD redonne la même coupe. */
(function () {
  'use strict';
  var DL = window.DL;
  var TEXTURES = ['lits', 'grains', 'briques'];

  DL.enregistrer({
    id: 'strate',
    numero: '12',
    nom: 'Strate',
    famille: 'champ',
    description: 'Coupes géologiques : couches plissées, failles décalées et surface érodée, avec textures de roche.',
    libs: ['Canvas 2D', 'bruit simplex'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#E9E4D8', '#2B2118', '#C7793B', '#E3C08D', '#8C5A3C', '#6B7F6A'],
    params: [
      { cle: 'couches', label: 'Couches', type: 'range', min: 4, max: 40, pas: 1, defaut: 16 },
      { cle: 'plis', label: 'Plis', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'inclinaison', label: 'Pendage', type: 'range', min: -30, max: 30, pas: 1, defaut: 6, unite: '°' },
      { cle: 'failles', label: 'Failles', type: 'range', min: 0, max: 6, pas: 1, defaut: 2 },
      { cle: 'rejet', label: 'Rejet des failles', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.4 },
      { cle: 'relief', label: 'Relief de surface', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'textures', label: 'Couches texturées', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.55 },
      { cle: 'contours', label: 'Contours des couches', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h), W = w / m, Hh = h / m;
      var bruit = DL.creerBruit(rng.fork('bruit'));
      var L = P.couches;
      var T = Hh * 1.25 / L;                 // épaisseur moyenne d'une couche
      var Y0 = -0.15 * Hh;                   // les couches commencent au-dessus du cadre
      var pente = Math.tan(P.inclinaison * Math.PI / 180);
      var freqPli = rng.range(1.2, 3.2), phPli = rng.range(0, 6.28);

      // Couches : poids d'épaisseur, couleur, texture.
      var encres = pal.slice(2), couches = [];
      for (var k = 0; k < L; k++) {
        var a = rng.pick(encres), b = rng.pick(encres);
        var c = chroma.mix(a, b, rng() * 0.5, 'lab').brighten((rng() - 0.5) * 0.5);
        couches.push({
          poids: 0.4 + 1.2 * rng(),
          rgb: c.rgb(),
          sombre: c.darken(0.9).rgb(),
          texture: rng.chance(P.textures) ? rng.pick(TEXTURES) : null
        });
      }

      // Failles : abscisse à Y=0, angle proche de la verticale, décalage vertical.
      var failles = [];
      for (var f = 0; f < P.failles; f++) {
        failles.push({
          x: rng.range(0.1, 0.9) * W,
          tan: Math.tan(rng.range(-0.45, 0.45)),
          dec: (rng.chance(0.5) ? 1 : -1) * P.rejet * T * rng.range(0.8, 3.5)
        });
      }

      // Limites des couches par colonne (coordonnées relatives), avant faille.
      var limites = new Float32Array((L + 1) * w);
      for (var x = 0; x < w; x++) {
        var X = (x + 0.5) / m;
        var pli = P.plis * (0.18 * Math.sin(X * freqPli + phPli) + 0.1 * bruit.fbm2(X * 1.3, 4.2, 3));
        var y = Y0 + pli + pente * (X - W / 2);
        limites[x * (L + 1)] = y;
        for (k = 0; k < L; k++) {
          y += T * couches[k].poids * (1 + 0.5 * bruit.n2(X * 1.5, k * 0.7 + 11));
          limites[x * (L + 1) + k + 1] = y;
        }
      }

      // Surface du sol : au-dessus, le ciel (fond).
      var surface = new Float32Array(w);
      for (x = 0; x < w; x++) {
        var Xs = (x + 0.5) / m;
        surface[x] = 0.16 * Hh + P.relief * (0.12 * Hh * bruit.fbm2(Xs * 1.8 + 30, 1.7, 4) + 0.05 * Math.sin(Xs * 2.1 + phPli));
      }

      var img = ctx.createImageData(w, h), d = img.data;
      var fond = DL.rgb255(pal[0]), encre = DL.rgb255(pal[1]);
      var trait = 0.0013, pasLit = 0.006, pasGrain = 0.009;
      var s = DL.hacher(String(rng.seed));
      for (var py = 0; py < h; py++) {
        var Y = (py + 0.5) / m;
        for (x = 0; x < w; x++) {
          var o = (py * w + x) * 4;
          if (Y < surface[x]) {
            if (!pal.transparent) { d[o] = fond[0]; d[o + 1] = fond[1]; d[o + 2] = fond[2]; d[o + 3] = 255; }
            continue;
          }
          // Décalage cumulé des failles situées à gauche du pixel.
          var Xp = (x + 0.5) / m, Yp = Y;
          for (f = 0; f < failles.length; f++) {
            if (Xp > failles[f].x + Y * failles[f].tan) Yp -= failles[f].dec;
          }
          // Recherche dichotomique de la couche.
          var base = x * (L + 1), lo = 0, hi = L;
          if (Yp < limites[base]) lo = -1;
          else if (Yp >= limites[base + L]) lo = L - 1;
          else {
            while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (Yp >= limites[base + mid]) lo = mid; else hi = mid; }
          }
          var ck = couches[Math.max(0, lo)], col = ck.rgb;
          var haut = limites[base + Math.max(0, lo)], bas = limites[base + Math.max(0, lo) + 1];
          if (P.contours && lo >= 0 && (Yp - haut < trait || bas - Yp < trait)) col = encre;
          else if (ck.texture === 'lits') {
            if (((Yp - haut) / pasLit) % 1 < 0.3) col = ck.sombre;
          } else if (ck.texture === 'grains') {
            var gx = Math.floor(Xp / pasGrain), gy = Math.floor(Yp / pasGrain);
            var hx = DL.hash2(gx, gy, s), hy = DL.hash2(gy, gx, s + 7);
            var dx = Xp / pasGrain - gx - 0.2 - hx * 0.6, dy = Yp / pasGrain - gy - 0.2 - hy * 0.6;
            if (dx * dx + dy * dy < 0.045) col = ck.sombre;
          } else if (ck.texture === 'briques') {
            var rang = Math.floor((Yp - haut) / (pasLit * 2.2));
            var u = ((Xp / (pasLit * 5)) + (rang & 1) * 0.5) % 1;
            if (((Yp - haut) / (pasLit * 2.2)) % 1 < 0.14 || u < 0.06) col = ck.sombre;
          }
          d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Traits par-dessus : ligne de surface et failles (sous la surface seulement).
      ctx.strokeStyle = pal[1];
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, m * 0.0035);
      ctx.beginPath();
      for (x = 0; x < w; x += Math.max(1, Math.floor(w / 600))) {
        if (x === 0) ctx.moveTo(x, surface[x] * m); else ctx.lineTo(x, surface[x] * m);
      }
      ctx.lineTo(w, surface[w - 1] * m);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, m * 0.0028);
      failles.forEach(function (fa) {
        ctx.beginPath();
        var debut = false;
        for (var yy = 0; yy <= h; yy += Math.max(2, h / 200)) {
          var xx = (fa.x + (yy / m) * fa.tan) * m;
          var xi = Math.round(DL.clamp(xx, 0, w - 1));
          if (yy / m < surface[xi]) continue;
          if (!debut) { ctx.moveTo(xx, yy); debut = true; } else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      });
    }
  });
})();

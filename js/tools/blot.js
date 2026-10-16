/* 29 Blot : taches d'encre en miroir, façon test de Rorschach (canvas 2D).
   Chaque couche d'encre est un champ (relief fbm déformé + bosse centrale + éclaboussures)
   replié en miroir sur un axe, puis seuillé. Les couches se superposent en « produit »
   comme des encres transparentes, avec un léger défaut de repérage entre elles.
   Le champ est calculé sur une grille fixe (relative à min(w, h)) puis interpolé et seuillé
   à chaque pixel : bords nets à toute résolution, même tache à l'aperçu et à l'export. */
(function () {
  'use strict';
  var DL = window.DL;

  var GRILLE = 520; // nœuds du champ sur le petit côté

  DL.enregistrer({
    id: 'blot',
    numero: '29',
    nom: 'Blot',
    famille: 'impression',
    description: "Taches d'encre en miroir façon Rorschach : couches transparentes, éclaboussures, défaut de repérage.",
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#F1ECE0', '#3255A4', '#FF48B0', '#FFD800', '#00A99D'],
    params: [
      { cle: 'symetrie', label: 'Symétrie', type: 'select', defaut: 'verticale', options: [
        { valeur: 'verticale', label: 'Axe vertical' }, { valeur: 'horizontale', label: 'Axe horizontal' }, { valeur: 'double', label: 'Deux axes' }] },
      { cle: 'couches', label: "Couches d'encre", type: 'range', min: 1, max: 4, pas: 1, defaut: 2 },
      { cle: 'etendue', label: 'Étendue', type: 'range', min: 0.2, max: 1.2, pas: 0.01, defaut: 0.62 },
      { cle: 'detail', label: 'Détail', type: 'range', min: 1, max: 8, pas: 0.1, defaut: 3 },
      { cle: 'fluidite', label: 'Fluidité', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'eclaboussures', label: 'Éclaboussures', type: 'range', min: 0, max: 80, pas: 1, defaut: 16 },
      { cle: 'decalage', label: 'Défaut de repérage', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.25 },
      { cle: 'grain', label: 'Grain du papier', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.25 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h), encres = pal.slice(1);
      var gs = m / GRILLE, gw = Math.ceil(w / gs) + 2, gh = Math.ceil(h / gs) + 2;
      var miroirX = P.symetrie !== 'horizontale', miroirY = P.symetrie !== 'verticale';

      // Un champ par couche, sur la grille ; valeur > 0 = encre.
      var champs = [];
      for (var c = 0; c < P.couches; c++) {
        var r = rng.fork('couche' + c), bruit = DL.creerBruit(r);
        var etendue = P.etendue * (1 - c * 0.24), sx = r.range(-40, 40), sy = r.range(-40, 40);
        var gouttes = [], glisse = c ? r.range(-0.12, 0.12) : 0;
        for (var g = 0; g < P.eclaboussures; g++) {
          // Éclaboussures : surtout près de la tache, quelques-unes projetées loin.
          var d = r.chance(0.7) ? r.range(0.15, 0.5) : r.range(0.45, 0.9), an = r.range(0, Math.PI * 2);
          gouttes.push([Math.abs(Math.cos(an)) * d * etendue * 0.9, Math.sin(an) * d * etendue * 0.9, r.range(0.004, 0.022)]);
        }
        var F = new Float32Array(gw * gh);
        for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
          // Chaque couche glisse un peu le long de l'axe : les encres ne s'empilent pas toutes au centre.
          var u = (i * gs - w / 2) / m - (miroirX ? 0 : glisse), v = (j * gs - h / 2) / m - (miroirY ? 0 : glisse);
          if (miroirX) u = Math.abs(u);
          if (miroirY) v = Math.abs(v);
          // Déformation du domaine : les bords deviennent des coulures plutôt que des bosses rondes.
          var wu = u + P.fluidite * 0.25 * bruit.fbm2(u * 2 + sx, v * 2 + sy, 3);
          var wv = v + P.fluidite * 0.25 * bruit.fbm2(u * 2 - sy, v * 2 + sx, 3);
          var rr = Math.hypot(wu / 0.75, wv) / (0.5 * etendue);
          // Bosse centrale faible + bruit fort : un contour dentelé plutôt qu'un ovale. Les couches
          // suivantes ont un seuil plus haut : elles n'apparaissent que par fragments sur la première.
          var val = (1 - rr * rr) * 0.55 + 0.9 * bruit.fbm2(wu * P.detail + sx, wv * P.detail + sy, 5) - 0.08 - c * 0.16;
          for (var q = 0; q < gouttes.length; q++) {
            var gx = miroirX ? gouttes[q][0] : (q % 2 ? -1 : 1) * gouttes[q][0];
            var gy = miroirY ? Math.abs(gouttes[q][1]) : gouttes[q][1], dx = u - gx, dy = v - gy;
            val += gouttes[q][2] * gouttes[q][2] / (dx * dx + dy * dy + 1e-6) * 0.6;
          }
          F[j * gw + i] = val;
        }
        // Défaut de repérage : décalage relatif, différent par couche.
        champs.push({ F: F, dx: r.range(-1, 1) * P.decalage * m * 0.012, dy: r.range(-1, 1) * P.decalage * m * 0.012,
          rgb: chroma(encres[c % encres.length]).rgb() });
      }

      var img = ctx.createImageData(w, h), d8 = img.data;
      var fond = chroma(pal[0]).rgb(), s = DL.hacher(String(rng.seed)), raideur = m * 0.3;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var R = 255, G = 255, B = 255, encre = 0;
          for (var k = 0; k < champs.length; k++) {
            var ch = champs[k];
            var fx = (x - ch.dx) / gs, fy = (y - ch.dy) / gs;
            var ix = fx | 0, iy = fy | 0;
            if (ix < 0 || iy < 0 || ix >= gw - 1 || iy >= gh - 1) continue;
            var tx = fx - ix, ty = fy - iy, o = iy * gw + ix, Fk = ch.F;
            var val2 = (Fk[o] * (1 - tx) + Fk[o + 1] * tx) * (1 - ty) + (Fk[o + gw] * (1 - tx) + Fk[o + gw + 1] * tx) * ty;
            // Bord antialiasé sur environ un pixel, quelle que soit la taille de la grille.
            var cov = DL.clamp(0.5 + val2 * raideur, 0, 1);
            if (cov <= 0) continue;
            // Mélange « produit » : chaque encre filtre la lumière comme une encre transparente.
            // Encre à 85 % : les superpositions foncent sans tourner au noir.
            var a8 = cov * 0.85;
            R *= 1 - a8 + a8 * ch.rgb[0] / 255; G *= 1 - a8 + a8 * ch.rgb[1] / 255; B *= 1 - a8 + a8 * ch.rgb[2] / 255;
            if (cov > encre) encre = cov;
          }
          var n = P.grain > 0 ? (DL.hash2(x, y, s) - 0.5) * 50 * P.grain : 0, p = (y * w + x) * 4;
          if (pal.transparent) {
            // Fond transparent : seule l'encre reste, avec son alpha.
            d8[p] = R + n; d8[p + 1] = G + n; d8[p + 2] = B + n; d8[p + 3] = encre * 255;
          } else {
            d8[p] = fond[0] * R / 255 + n; d8[p + 1] = fond[1] * G / 255 + n; d8[p + 2] = fond[2] * B / 255 + n; d8[p + 3] = 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  });
})();

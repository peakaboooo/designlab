/* 20 Static : pixels glitchés (canvas 2D).
   Une image de base propre (mire de barres, dégradés ou formes) est corrompue étape par étape,
   toutes seedées : pixelisation, tranches horizontales décalées, blocs copiés au mauvais endroit,
   séparation des canaux rouge / bleu, tri de pixels par luminosité le long des lignes, puis
   lignes de balayage et bruit. Les tailles (tranches, blocs, décalages) sont relatives à
   l'image : l'export HD garde la même composition, simplement plus fine. */
(function () {
  'use strict';
  var DL = window.DL;

  function base(ctx, w, h, P, rng, pal) {
    var m = Math.min(w, h), encres = pal.slice(1);
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, w, h);
    if (P.base === 'mire') {
      // Mire : barres verticales, rampe de gris, cercle et croix de centrage.
      var barres = rng.shuffle(encres.concat(encres)).slice(0, 7);
      for (var b = 0; b < barres.length; b++) {
        ctx.fillStyle = barres[b];
        ctx.fillRect(Math.floor(b * w / barres.length), 0, Math.ceil(w / barres.length) + 1, h * 0.68);
      }
      var g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.68, w, h * 0.12);
      ctx.fillStyle = encres[0];
      ctx.fillRect(0, h * 0.8, w, h * 0.2);
      ctx.strokeStyle = pal[0];
      ctx.lineWidth = m * 0.012;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, m * 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - m * 0.4); ctx.lineTo(w / 2, h / 2 + m * 0.4);
      ctx.moveTo(w / 2 - m * 0.4, h / 2); ctx.lineTo(w / 2 + m * 0.4, h / 2); ctx.stroke();
    } else if (P.base === 'degrade') {
      var bandes = rng.int(4, 9), echelle = chroma.scale(pal.slice()).mode('lab');
      for (var k = 0; k < bandes; k++) {
        var gr = ctx.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, echelle(rng()).hex()); gr.addColorStop(1, echelle(rng()).hex());
        ctx.fillStyle = gr;
        ctx.fillRect(0, Math.floor(k * h / bandes), w, Math.ceil(h / bandes) + 1);
      }
    } else {
      for (var f = 0; f < 18; f++) {
        ctx.fillStyle = rng.pick(encres);
        var x = rng() * w, y = rng() * h, s = m * rng.range(0.05, 0.4);
        if (rng.chance(0.5)) ctx.fillRect(x - s / 2, y - s / 2, s, s * rng.range(0.3, 1.5));
        else { ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }

  DL.enregistrer({
    id: 'static',
    numero: '20',
    nom: 'Static',
    famille: 'pixel',
    description: 'Pixels glitchés : tranches décalées, blocs corrompus, canaux séparés et tri de pixels.',
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: false,
    nbCouleurs: 5,
    palette: ['#0D0D0D', '#FF2E88', '#00E5FF', '#C6FF00', '#F2F2F2'],
    params: [
      { cle: 'base', label: 'Image de base', type: 'select', defaut: 'mire', options: [
        { valeur: 'mire', label: 'Mire de barres' }, { valeur: 'degrade', label: 'Bandes dégradées' }, { valeur: 'formes', label: 'Formes' }] },
      { cle: 'pixel', label: 'Pixelisation', type: 'range', min: 1, max: 30, pas: 1, defaut: 1 },
      { cle: 'tranches', label: 'Tranches décalées', type: 'range', min: 0, max: 60, pas: 1, defaut: 14 },
      { cle: 'decalage', label: 'Amplitude du décalage', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'blocs', label: 'Blocs corrompus', type: 'range', min: 0, max: 40, pas: 1, defaut: 6 },
      { cle: 'separation', label: 'Séparation RVB', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'tri', label: 'Tri de pixels', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.25 },
      { cle: 'bruit', label: 'Balayage et bruit', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      base(ctx, w, h, P, rng.fork('base'), pal);
      var copie = document.createElement('canvas');
      copie.width = w; copie.height = h;
      var cc = copie.getContext('2d');
      function photographier() { cc.clearRect(0, 0, w, h); cc.drawImage(ctx.canvas, 0, 0); }

      // 1. Pixelisation : réduction puis agrandissement sans lissage (taille relative).
      if (P.pixel > 1) {
        var bloc = Math.max(1, Math.round(P.pixel * m / 600));
        var pw = Math.max(1, Math.round(w / bloc)), ph = Math.max(1, Math.round(h / bloc));
        cc.imageSmoothingEnabled = false;
        cc.clearRect(0, 0, w, h);
        cc.drawImage(ctx.canvas, 0, 0, pw, ph);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(copie, 0, 0, pw, ph, 0, 0, w, h);
        ctx.imageSmoothingEnabled = true;
      }

      // 2. Tranches horizontales décalées (avec retour de l'autre côté).
      var r = rng.fork('tranches');
      if (P.tranches > 0 && P.decalage > 0) {
        photographier();
        for (var t = 0; t < P.tranches; t++) {
          var y = Math.floor(r() * h), ht = Math.max(1, Math.round(h * r.range(0.004, 0.06)));
          var dx = Math.round((r() - 0.5) * 2 * P.decalage * w * 0.3);
          ctx.drawImage(copie, 0, y, w, ht, dx, y, w, ht);
          ctx.drawImage(copie, 0, y, w, ht, dx - Math.sign(dx || 1) * w, y, w, ht);
        }
      }

      // 3. Blocs copiés ailleurs ; un sur trois en « différence » (couleurs inversées).
      var rb = rng.fork('blocs');
      if (P.blocs > 0) {
        photographier();
        for (var b = 0; b < P.blocs; b++) {
          var bw = Math.round(m * rb.range(0.03, 0.25)), bh = Math.round(m * rb.range(0.01, 0.1));
          var sx = rb() * (w - bw), sy = rb() * (h - bh), tx = rb() * (w - bw), ty = rb() * (h - bh);
          ctx.globalCompositeOperation = rb.chance(0.33) ? 'difference' : 'source-over';
          ctx.drawImage(copie, sx, sy, bw, bh, tx, ty, bw, bh);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      copie.width = copie.height = 0;

      var img = ctx.getImageData(0, 0, w, h), d = img.data;

      // 4. Séparation des canaux : rouge décalé à droite, bleu à gauche.
      if (P.separation > 0) {
        var dec = Math.max(1, Math.round(P.separation * m * 0.015));
        var src = new Uint8ClampedArray(d);
        for (var py = 0; py < h; py++) {
          var ligne = py * w;
          for (var px = 0; px < w; px++) {
            var o = (ligne + px) * 4;
            var xr = px - dec, xb = px + dec;
            if (xr >= 0) d[o] = src[(ligne + xr) * 4];
            if (xb < w) d[o + 2] = src[(ligne + xb) * 4 + 2];
          }
        }
      }

      // 5. Tri de pixels : sur certaines bandes de lignes, chaque plage plus claire qu'un seuil
      // est triée par luminosité (traînées caractéristiques). Bandes de hauteur relative.
      if (P.tri > 0) {
        var u32 = new Uint32Array(d.buffer), rt = rng.fork('tri');
        var bandeH = Math.max(1, Math.round(m / 300)), seuil = rt.range(70, 150);
        var lum = function (o4) { return d[o4] * 0.3 + d[o4 + 1] * 0.59 + d[o4 + 2] * 0.11; };
        for (var bY = 0; bY < h; bY += bandeH) {
          if (!rt.chance(P.tri)) continue;
          for (var yy = bY; yy < Math.min(h, bY + bandeH); yy++) {
            var debut = -1;
            for (var xx = 0; xx <= w; xx++) {
              var clair = xx < w && lum((yy * w + xx) * 4) > seuil;
              if (clair && debut < 0) debut = xx;
              if (!clair && debut >= 0) {
                if (xx - debut > 2) {
                  var plage = Array.prototype.slice.call(u32.subarray(yy * w + debut, yy * w + xx));
                  var cles = plage.map(function (v, i) { return [lum((yy * w + debut + i) * 4), v]; });
                  cles.sort(function (a, b2) { return a[0] - b2[0]; });
                  for (var q = 0; q < cles.length; q++) u32[yy * w + debut + q] = cles[q][1];
                }
                debut = -1;
              }
            }
          }
        }
      }

      // 6. Lignes de balayage (période relative) et bruit par pixel (hash, sans état).
      if (P.bruit > 0) {
        var periode = Math.max(2, Math.round(m / 250)), s = DL.hacher(String(rng.seed));
        for (var y2 = 0; y2 < h; y2++) {
          var sombre = (Math.floor(y2 / (periode / 2)) & 1) ? 1 - 0.35 * P.bruit : 1;
          for (var x2 = 0; x2 < w; x2++) {
            var o2 = (y2 * w + x2) * 4;
            var n = (DL.hash2(x2, y2, s) - 0.5) * 90 * P.bruit;
            d[o2] = d[o2] * sombre + n; d[o2 + 1] = d[o2 + 1] * sombre + n; d[o2 + 2] = d[o2 + 2] * sombre + n;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  });
})();

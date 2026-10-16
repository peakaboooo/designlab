/* 25 Sonar : masses terrestres tramées (canvas 2D).
   Une carte imaginaire (relief fbm seedé, seuillé au niveau de la mer) est gravée en trame :
   lignes horizontales dont l'épaisseur suit l'altitude, anneaux concentriques autour d'un
   émetteur sonar, ou points de demi-teinte. La mer reste en trait fin (ou vide), la terre
   s'épaissit vers les sommets. Option « relief » : les lignes se soulèvent avec l'altitude,
   façon relevé topographique. Tout est relatif à min(w, h) : l'export garde le même nombre de lignes. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'sonar',
    numero: '25',
    nom: 'Sonar',
    famille: 'impression',
    description: 'Masses terrestres tramées : une carte imaginaire gravée en lignes, anneaux sonar ou points.',
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 4,
    palette: ['#0F1A2B', '#E8E2D0', '#3C6E8F', '#FF5A36'],
    params: [
      { cle: 'mode', label: 'Trame', type: 'select', defaut: 'lignes', options: [
        { valeur: 'lignes', label: 'Lignes' }, { valeur: 'anneaux', label: 'Anneaux sonar' }, { valeur: 'points', label: 'Points' }] },
      { cle: 'lignes', label: 'Densité de trame', type: 'range', min: 20, max: 200, pas: 1, defaut: 80 },
      { cle: 'echelle', label: 'Taille des continents', type: 'range', min: 0.5, max: 5, pas: 0.05, defaut: 1.6 },
      { cle: 'niveau', label: 'Niveau de la mer', type: 'range', min: -0.5, max: 0.5, pas: 0.01, defaut: 0.05 },
      { cle: 'contraste', label: 'Épaisseur sur la terre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'relief', label: 'Relief', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0 },
      { cle: 'mer', label: 'Tracer la mer', type: 'toggle', defaut: true },
      { cle: 'cotes', label: 'Côtes en couleur', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var bruit = DL.creerBruit(rng.fork('relief'));
      var ox = rng.range(-50, 50), oy = rng.range(-50, 50);
      var terre = pal[1], mer = pal[2] || pal[1], cote = pal[3] || pal[1];

      // Altitude au point (x, y) en pixels : fbm + léger renfort au centre pour éviter les cartes vides.
      function alt(x, y) {
        var u = (x - w / 2) / m, v = (y - h / 2) / m;
        var a = bruit.fbm2(u * P.echelle + ox, v * P.echelle + oy, 5, 2, 0.5);
        return a + 0.15 * (1 - Math.min(1, Math.hypot(u, v) * 1.6)) - P.niveau;
      }
      var pasL = m / P.lignes, epMax = pasL * (0.15 + 0.8 * P.contraste), epMer = pasL * 0.08;
      function epaisseur(a) { return a > 0 ? epMer + (epMax - epMer) * DL.clamp(a * 2.2 + 0.15, 0, 1) : (P.mer ? epMer : 0); }
      function couleur(a) { return a > 0 ? (P.cotes && a < 0.035 ? cote : terre) : mer; }
      var levee = P.relief * pasL * 6;

      // Trace un ruban le long d'une courbe : on coupe le ruban à chaque changement de couleur.
      function ruban(pts) {
        var debut = 0;
        for (var k = 1; k <= pts.length; k++) {
          if (k < pts.length && pts[k].c === pts[debut].c) continue;
          var seg = pts.slice(debut, Math.min(k + 1, pts.length));
          if (seg[0].e > 0 || seg[seg.length - 1].e > 0) {
            ctx.fillStyle = seg[0].c;
            ctx.beginPath();
            seg.forEach(function (p, i) { var x = p.x + p.nx * p.e / 2, y = p.y + p.ny * p.e / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            for (var i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i].x - seg[i].nx * seg[i].e / 2, seg[i].y - seg[i].ny * seg[i].e / 2);
            ctx.closePath();
            ctx.fill();
          }
          debut = k;
        }
      }

      var pas = Math.max(1, m / 500);
      if (P.mode === 'lignes') {
        for (var y = pasL / 2; y < h + levee; y += pasL) {
          var pts = [];
          for (var x = 0; x <= w + pas; x += pas) {
            var a = alt(x, y);
            pts.push({ x: x, y: y - Math.max(0, a) * levee, nx: 0, ny: 1, e: epaisseur(a), c: couleur(a) });
          }
          ruban(pts);
        }
      } else if (P.mode === 'anneaux') {
        // Émetteur décentré : les anneaux balaient la carte comme un écran radar.
        var cx = rng.range(0.3, 0.7) * w, cy = rng.range(0.3, 0.7) * h;
        var Rmax = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
        for (var R = pasL; R < Rmax; R += pasL) {
          var n = Math.ceil(2 * Math.PI * R / pas), pa = [];
          for (var k = 0; k <= n; k++) {
            var t = k / n * 2 * Math.PI, nx = Math.cos(t), ny = Math.sin(t);
            var px = cx + R * nx, py = cy + R * ny, a2 = alt(px, py);
            var Rl = R + Math.max(0, a2) * levee;
            pa.push({ x: cx + Rl * nx, y: cy + Rl * ny, nx: nx, ny: ny, e: epaisseur(a2), c: couleur(a2) });
          }
          ruban(pa);
        }
        ctx.fillStyle = cote;
        ctx.beginPath(); ctx.arc(cx, cy, pasL * 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        // Points en quinconce : rayon proportionnel à l'épaisseur de trait.
        for (var j = 0, yy = pasL / 2; yy < h + pasL; yy += pasL * 0.87, j++) {
          for (var xx = (j % 2) * pasL / 2; xx < w + pasL; xx += pasL) {
            var a3 = alt(xx, yy), e = epaisseur(a3);
            if (e <= 0) continue;
            ctx.fillStyle = couleur(a3);
            ctx.beginPath(); ctx.arc(xx, yy - Math.max(0, a3) * levee, e * 0.62, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
  });
})();

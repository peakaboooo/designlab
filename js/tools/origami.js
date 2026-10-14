/* 14 Origami : papier plié en facettes (p5.js + d3-delaunay).
   Un semis de points (de la grille régulière au hasard complet) est triangulé (Delaunay).
   Chaque sommet reçoit une altitude : relief doux (bruit) + plis francs (ondes triangulaires
   le long de trois directions, comme des plis montagne/vallée). Chaque facette est éclairée
   par une lumière rasante (produit scalaire normale · lumière) : le papier semble plié
   alors que tout est plat. La couleur de base vient de zones de bruit. */
(function () {
  'use strict';
  var DL = window.DL;

  // Onde triangulaire dans [-1, 1] : arête vive, comme un pli marqué.
  function tri(x) { var f = x - Math.floor(x); return 1 - 4 * Math.abs(f - 0.5); }

  DL.enregistrer({
    id: 'origami',
    numero: '14',
    nom: 'Origami',
    famille: 'volume',
    description: 'Papier plié en facettes : triangulation, plis montagne et vallée, éclairage rasant.',
    libs: ['p5.js', 'd3-delaunay'],
    moteur: 'p5',
    fondTransparent: false,
    nbCouleurs: 6,
    palette: ['#F5F0E6', '#E4572E', '#29335C', '#F3A712', '#A8C686', '#669BBC'],
    params: [
      { cle: 'points', label: 'Facettes (points)', type: 'range', min: 40, max: 3000, pas: 20, defaut: 520 },
      { cle: 'regularite', label: 'Régularité', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'plis', label: 'Plis', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.7 },
      { cle: 'relief', label: 'Relief doux', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'lumiere', label: 'Angle de lumière', type: 'range', min: 0, max: 360, pas: 1, defaut: 135, unite: '°' },
      { cle: 'contraste', label: 'Contraste', type: 'range', min: 0, max: 1.5, pas: 0.01, defaut: 0.9 },
      { cle: 'zones', label: 'Zones de couleur', type: 'range', min: 1, max: 5, pas: 1, defaut: 3 },
      { cle: 'aretes', label: 'Arêtes visibles', type: 'toggle', defaut: true }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      var bruit = DL.creerBruit(rng.fork('relief')), bruitZ = DL.creerBruit(rng.fork('zones'));

      // Semis : grille légèrement désordonnée + points sur le bord (la triangulation couvre tout).
      var cols = Math.max(2, Math.round(Math.sqrt(P.points * w / h))), rows = Math.max(2, Math.round(P.points / cols));
      var cw = w / cols, ch = h / rows, pts = [];
      var jit = 1 - P.regularite;
      for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
        pts.push([(i + 0.5 + (rng() - 0.5) * jit * 1.6) * cw, (j + 0.5 + (rng() - 0.5) * jit * 1.6) * ch]);
      }
      for (i = 0; i <= cols; i++) { pts.push([i * cw, 0]); pts.push([i * cw, h]); }
      for (j = 1; j < rows; j++) { pts.push([0, j * ch]); pts.push([w, j * ch]); }

      // Trois familles de plis : direction, fréquence, phase, sens (montagne / vallée).
      var plis = [];
      for (var k = 0; k < 3; k++) {
        var a = rng.range(0, Math.PI);
        plis.push({ dx: Math.cos(a), dy: Math.sin(a), f: rng.range(0.8, 3.2), ph: rng.range(0, 1), s: rng.chance(0.5) ? 1 : -1 });
      }
      var z = pts.map(function (q) {
        var X = q[0] / m, Y = q[1] / m;
        var v = P.relief * 0.5 * bruit.fbm2(X * 1.6, Y * 1.6, 3);
        for (var c = 0; c < plis.length; c++) {
          var pl = plis[c];
          v += P.plis * 0.22 * pl.s * tri((X * pl.dx + Y * pl.dy) * pl.f + pl.ph) / (c + 1);
        }
        return v;
      });

      var la = P.lumiere * Math.PI / 180, el = 0.75;
      var Lx = Math.cos(la) * Math.cos(el), Ly = Math.sin(la) * Math.cos(el), Lz = Math.sin(el);
      var encres = pal.slice(1);
      var nz = Math.min(P.zones, encres.length);
      var bases = encres.slice(0, nz).map(DL.rgb255);
      var del = d3.Delaunay.from(pts), T = del.triangles;
      var trait = Math.max(0.5, m / 1600);

      ctx.lineJoin = 'round';
      for (var t = 0; t < T.length; t += 3) {
        var A = pts[T[t]], B = pts[T[t + 1]], C = pts[T[t + 2]];
        var za = z[T[t]] * m, zb = z[T[t + 1]] * m, zc = z[T[t + 2]] * m;
        // Normale de la facette (altitudes exprimées dans la même unité que x et y).
        var ux = B[0] - A[0], uy = B[1] - A[1], uz = zb - za;
        var vx = C[0] - A[0], vy = C[1] - A[1], vz = zc - za;
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzv = ux * vy - uy * vx;
        var nl = Math.sqrt(nx * nx + ny * ny + nzv * nzv) || 1;
        if (nzv < 0) { nx = -nx; ny = -ny; nzv = -nzv; }
        var lum = (nx * Lx + ny * Ly + nzv * Lz) / nl;          // 1 = face à la lumière
        // Plancher à 0,35 : une facette à l'ombre reste colorée (pas de trou noir).
        var f = Math.max(0.35, 1 + (lum - Lz) * 1.3 * P.contraste);
        var gx = (A[0] + B[0] + C[0]) / 3 / m, gy = (A[1] + B[1] + C[1]) / 3 / m;
        var zi = Math.min(nz - 1, Math.floor((bruitZ.n2(gx * 1.4, gy * 1.4) * 0.5 + 0.5) * nz));
        var b = bases[zi], col;
        // Éclaircir = aller vers le blanc ; assombrir = multiplier (pas de teinte boueuse).
        if (f >= 1) col = b.map(function (v) { return Math.round(v + (255 - v) * Math.min(1, f - 1)); });
        else col = b.map(function (v) { return Math.round(v * Math.max(0, f)); });
        var css = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
        ctx.fillStyle = css;
        ctx.strokeStyle = css; // même couleur en trait fin : pas de fil de jour entre facettes
        ctx.lineWidth = trait;
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (P.aretes) {
        ctx.strokeStyle = pal[0];
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = Math.max(0.5, m / 1300);
        ctx.beginPath();
        for (t = 0; t < T.length; t += 3) {
          var a1 = pts[T[t]], b1 = pts[T[t + 1]], c1 = pts[T[t + 2]];
          ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(c1[0], c1[1]); ctx.closePath();
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  });
})();

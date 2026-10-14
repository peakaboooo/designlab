/* 06 Riso : collage de papier déchiré, aplats superposés façon risographie (p5.js + d3-delaunay).
   Chaque encre est une couche : des morceaux (cellules de Voronoi ou bandes) aux bords déchirés
   par du bruit fractal, imprimés en aplat. Comme en riso, chaque couche a son propre décalage
   de repérage et un grain d'encre irrégulier ; en surimpression les couches se multiplient.
   Sans surimpression, c'est un collage opaque : le bord déchiré laisse voir la fibre blanche. */
(function () {
  'use strict';
  var DL = window.DL;

  // Bord déchiré : on subdivise chaque arête et on déplace les points perpendiculairement
  // avec du bruit fractal (fréquence élevée = fibres, basse = arrachement irrégulier).
  function dechirer(poly, bruit, amp, pasSub, graine) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1e-6) continue;
      var nx = -dy / L, ny = dx / L, n = Math.max(1, Math.ceil(L / pasSub));
      for (var k = 0; k < n; k++) {
        var t = k / n, x = a[0] + dx * t, y = a[1] + dy * t;
        // Amplitude nulle aux sommets : les coins restent à leur place, pas de chevauchement absurde.
        var env = Math.sin(Math.PI * t) * 0.7 + 0.3;
        var d = bruit.fbm2(x / (pasSub * 9) + graine, y / (pasSub * 9), 5, 2.1, 0.55) * amp * env;
        out.push([x + nx * d, y + ny * d]);
      }
    }
    return out;
  }

  function tracer(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function agrandir(poly, f) {
    var cx = 0, cy = 0;
    poly.forEach(function (p) { cx += p[0]; cy += p[1]; });
    cx /= poly.length; cy /= poly.length;
    return poly.map(function (p) { return [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]; });
  }

  // Tuile de grain : trous dans l'encre (encre qui n'a pas pris), tirés par le rng.
  function tuileGrain(rng, force) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var g = c.getContext('2d'), img = g.createImageData(256, 256), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var r = rng();
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = r < force * 0.3 ? Math.round(255 * (0.4 + 0.6 * rng())) : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  DL.enregistrer({
    id: 'riso',
    numero: '06',
    nom: 'Riso',
    famille: 'impression',
    description: 'Collage de papier déchiré : aplats superposés, repérage décalé et grain d’encre façon risographie.',
    libs: ['p5.js', 'd3-delaunay'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#F4EFE3', '#FF48B0', '#0078BF', '#FFE800', '#00A95C'],
    params: [
      { cle: 'morceaux', label: 'Morceaux par couche', type: 'range', min: 1, max: 30, pas: 1, defaut: 5 },
      { cle: 'couches', label: 'Couches d’encre', type: 'range', min: 1, max: 4, pas: 1, defaut: 3 },
      { cle: 'forme', label: 'Forme des morceaux', type: 'select', defaut: 'mixte', options: [
        { valeur: 'cellules', label: 'Cellules' }, { valeur: 'bandes', label: 'Bandes' }, { valeur: 'mixte', label: 'Mixte' }] },
      { cle: 'echelle', label: 'Taille des morceaux', type: 'range', min: 0.5, max: 1.8, pas: 0.05, defaut: 0.9 },
      { cle: 'dechirure', label: 'Déchirure', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'reperage', label: 'Décalage de repérage', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'grain', label: 'Grain d’encre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'surimpression', label: 'Surimpression (multiply)', type: 'toggle', defaut: true }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      if (!pal.transparent) p.background(pal[0]);
      var bruit = DL.creerBruit(rng.fork('bruit'));
      var encres = pal.slice(1, 1 + Math.min(P.couches, pal.length - 1));
      // Une seule couche hors écran, réutilisée : 4 couches 4000² coûteraient 256 Mo.
      var couche = document.createElement('canvas');
      couche.width = w; couche.height = h;
      var cc = couche.getContext('2d');
      var grain = P.grain > 0 ? tuileGrain(rng.fork('grain'), P.grain) : null;
      var echGrain = Math.max(1, m / 500);
      var pasSub = m / 260;
      var blanc = '#FFFFFF';

      encres.forEach(function (encre, li) {
        var r = rng.fork('couche' + li);
        cc.setTransform(1, 0, 0, 1, 0, 0);
        cc.globalCompositeOperation = 'source-over';
        cc.clearRect(0, 0, w, h);

        // Morceaux : cellules d'un Voronoi propre à la couche, ou bandes inclinées.
        var pts = [];
        var nb = Math.max(P.morceaux * 2, 6);
        for (var i = 0; i < nb; i++) pts.push([r.range(-0.1 * w, 1.1 * w), r.range(-0.1 * h, 1.1 * h)]);
        var vor = d3.Delaunay.from(pts).voronoi([-0.15 * w, -0.15 * h, 1.15 * w, 1.15 * h]);
        var choisis = r.shuffle(pts.map(function (_, i) { return i; })).slice(0, P.morceaux);

        choisis.forEach(function (idx, k) {
          var poly;
          var bande = P.forme === 'bandes' || (P.forme === 'mixte' && r.chance(0.4));
          if (bande) {
            var cx = r.range(0, w), cy = r.range(0, h), a = r.range(-0.6, 0.6) + (r.chance(0.5) ? 0 : Math.PI / 2);
            var lg = m * r.range(0.5, 1.3) * P.echelle, ep = m * r.range(0.05, 0.16) * P.echelle;
            var ca = Math.cos(a), sa = Math.sin(a);
            poly = [[-lg, -ep], [lg, -ep], [lg, ep], [-lg, ep]].map(function (q) {
              return [cx + q[0] * ca - q[1] * sa, cy + q[0] * sa + q[1] * ca];
            });
          } else {
            poly = vor.cellPolygon(idx);
            if (!poly) return;
            poly = agrandir(poly.slice(0, -1), P.echelle);
          }
          var amp = P.dechirure * m * 0.03;
          var bord = dechirer(poly, bruit, amp, pasSub, li * 31 + k * 7);
          // Fibre blanche : la même forme un peu plus grande, déchirée autrement, sous l'aplat.
          if (!P.surimpression && amp > 0) {
            cc.fillStyle = blanc;
            tracer(cc, dechirer(agrandir(poly, 1.012), bruit, amp * 1.25, pasSub * 0.7, li * 31 + k * 7 + 3.3));
            cc.fill();
          }
          cc.fillStyle = encre;
          tracer(cc, bord);
          cc.fill();
        });

        // Grain : on retire de l'encre (destination-out) selon la tuile, mise à l'échelle de l'image.
        if (grain) {
          var motif = cc.createPattern(grain, 'repeat');
          cc.globalCompositeOperation = 'destination-out';
          cc.setTransform(echGrain, 0, 0, echGrain, r.range(0, 256), r.range(0, 256));
          cc.fillStyle = motif;
          cc.fillRect(-256, -256, w / echGrain + 512, h / echGrain + 512);
          cc.setTransform(1, 0, 0, 1, 0, 0);
          cc.globalCompositeOperation = 'source-over';
        }

        var dx = r.gauss(0, 1) * P.reperage * m * 0.012, dy = r.gauss(0, 1) * P.reperage * m * 0.012;
        ctx.save();
        ctx.globalCompositeOperation = P.surimpression ? 'multiply' : 'source-over';
        ctx.drawImage(couche, dx, dy);
        ctx.restore();
      });
      couche.width = couche.height = 0;
    }
  });
})();

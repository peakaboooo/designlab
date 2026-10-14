/* 18 Rise : arcs de rayures radiales, en vectoriel (Paper.js, export SVG).
   Des « soleils levants » : bandes concentriques (arcs-en-ciel) posées sur un bord, dans un
   coin ou librement, dont certaines bandes sont rayées de secteurs rayonnants.
   Peinture par empilement : pour chaque bande, de l'extérieur vers l'intérieur, on pose un
   secteur plein, ses rayons éventuels, puis le fond de l'écart suivant, et la bande suivante,
   plus petite, recouvre le centre. Pas d'opération booléenne, donc un SVG léger et propre. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'rise',
    numero: '18',
    nom: 'Rise',
    famille: 'vecteur',
    description: 'Arcs de rayures radiales : soleils levants en bandes concentriques et rayons, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: false,
    nbCouleurs: 5,
    palette: ['#F4ECDD', '#E4572E', '#F3A712', '#29335C', '#669BBC'],
    params: [
      { cle: 'soleils', label: 'Soleils', type: 'range', min: 1, max: 6, pas: 1, defaut: 2 },
      { cle: 'position', label: 'Position', type: 'select', defaut: 'bas', options: [
        { valeur: 'bas', label: 'Posés sur le bas' }, { valeur: 'coins', label: 'Dans les coins' }, { valeur: 'libre', label: 'Libres (cercles entiers)' }] },
      { cle: 'bandes', label: 'Bandes', type: 'range', min: 2, max: 24, pas: 1, defaut: 9 },
      { cle: 'ecart', label: 'Écart entre bandes', type: 'range', min: 0, max: 0.6, pas: 0.01, defaut: 0.15 },
      { cle: 'variation', label: "Variation d'épaisseur", type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'rayons', label: 'Rayons par bande', type: 'range', min: 0, max: 60, pas: 2, defaut: 18 },
      { cle: 'proportion', label: 'Bandes rayonnantes', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h), pasArc = m * 0.01;
      new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var encres = pal.slice(1);

      // Secteur [a0, a1] de rayon r (cercle entier si l'écart couvre 2π).
      function secteur(c, r, a0, a1, couleur) {
        if (r <= 0) return;
        if (a1 - a0 >= Math.PI * 2 - 1e-6) { new S.Path.Circle({ center: c, radius: r, fillColor: couleur }); return; }
        var n = Math.max(6, Math.ceil((a1 - a0) * r / pasArc)), pts = [c];
        for (var k = 0; k <= n; k++) {
          var a = a0 + (a1 - a0) * k / n;
          pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
        }
        new S.Path({ segments: pts, closed: true, fillColor: couleur });
      }

      // Soleils : centre, rayon, plage d'angles selon la position (repère écran, y vers le bas).
      var coins = rng.shuffle([[0, h, 1.5, 2], [w, h, 1, 1.5], [0, 0, 0, 0.5], [w, 0, 0.5, 1]]);
      var soleils = [];
      for (var s = 0; s < P.soleils; s++) {
        var r = rng.fork('soleil' + s), so;
        if (P.position === 'bas') {
          so = { c: [w * (P.soleils === 1 ? 0.5 : r.range(0.1, 0.9)), h], R: m * r.range(0.45, 0.95), a0: Math.PI, a1: 2 * Math.PI };
        } else if (P.position === 'coins') {
          var co = coins[s % 4];
          so = { c: [co[0], co[1]], R: m * r.range(0.55, 1.15), a0: co[2] * Math.PI, a1: co[3] * Math.PI };
        } else {
          so = { c: [r.range(0.15, 0.85) * w, r.range(0.15, 0.85) * h], R: m * r.range(0.18, 0.45) / Math.sqrt(P.soleils) * 1.4, a0: 0, a1: 2 * Math.PI };
        }
        so.r = r;
        soleils.push(so);
      }
      // Les plus grands d'abord : les petits soleils se posent par-dessus.
      soleils.sort(function (a, b) { return b.R - a.R; });

      soleils.forEach(function (so) {
        var r = so.r, B = P.bandes;
        var poids = [], total = 0;
        for (var k = 0; k < B; k++) { var v = 1 + (r() - 0.5) * 2 * P.variation; poids.push(v); total += v; }
        // Somme des épaisseurs + écarts = rayon du soleil ; l'écart est relatif à l'épaisseur moyenne.
        var moyenne = so.R / (B * (1 + P.ecart));
        var ecart = moyenne * P.ecart;
        var cols = r.shuffle(encres);
        var rr = so.R;
        for (k = 0; k < B; k++) {
          var ep = moyenne * B * poids[k] / total;
          var c1 = cols[k % cols.length];
          secteur(so.c, rr, so.a0, so.a1, c1);
          if (P.rayons > 0 && r.chance(P.proportion)) {
            var c2 = cols[(k + 1 + r.int(0, cols.length - 2)) % cols.length];
            var n = P.rayons, da = (so.a1 - so.a0) / n;
            for (var q = 0; q < n; q += 2) secteur(so.c, rr, so.a0 + q * da, so.a0 + (q + 1) * da, c2);
          }
          rr -= ep;
          if (ecart > 0 && rr > 0) { secteur(so.c, rr, so.a0, so.a1, pal[0]); rr -= ecart; }
          if (rr <= 0) break;
        }
      });
    }
  });
})();

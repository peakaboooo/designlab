/* 19 Dahlia : explosions de chrysanthèmes (p5.js).
   Chaque fleur est une gerbe de pétales disposés en couronnes : les couronnes extérieures sont
   longues et posées en premier, les intérieures, plus courtes, se superposent. Un pétale est un
   fuseau effilé qui suit une courbe légèrement enroulée (comme un feu d'artifice qui retombe),
   avec un dégradé du cœur vers la pointe. Les plus grandes fleurs sont peintes en premier. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'dahlia',
    numero: '19',
    nom: 'Dahlia',
    famille: 'motif',
    description: 'Explosions de chrysanthèmes : couronnes de pétales effilés, enroulés, en dégradé du cœur à la pointe.',
    libs: ['p5.js'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#1B1A2E', '#FF6B9A', '#FFD166', '#06D6A0', '#F8F4E3'],
    params: [
      { cle: 'fleurs', label: 'Fleurs', type: 'range', min: 1, max: 9, pas: 1, defaut: 3 },
      { cle: 'petales', label: 'Pétales par fleur', type: 'range', min: 20, max: 400, pas: 10, defaut: 150 },
      { cle: 'couronnes', label: 'Couronnes', type: 'range', min: 1, max: 6, pas: 1, defaut: 3 },
      { cle: 'longueur', label: 'Taille', type: 'range', min: 0.2, max: 1, pas: 0.01, defaut: 0.65 },
      { cle: 'courbure', label: 'Enroulement', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'finesse', label: 'Largeur des pétales', type: 'range', min: 0.1, max: 1, pas: 0.01, defaut: 0.65 },
      { cle: 'dispersion', label: 'Dispersion', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.7 },
      { cle: 'pointes', label: 'Pointes lumineuses', type: 'toggle', defaut: true }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      if (!pal.transparent) p.background(pal[0]);
      var encres = pal.slice(1);
      var fleurs = [];
      for (var f = 0; f < P.fleurs; f++) {
        var r = rng.fork('fleur' + f);
        fleurs.push({
          r: r,
          x: w / 2 + (r() - 0.5) * w * P.dispersion * (f ? 1 : 0.4),
          y: h / 2 + (r() - 0.5) * h * P.dispersion * (f ? 1 : 0.4),
          R: m * P.longueur * r.range(0.45, 0.8) / Math.pow(P.fleurs, 0.35)
        });
      }
      fleurs.sort(function (a, b) { return b.R - a.R; });

      fleurs.forEach(function (fl) {
        var r = fl.r;
        var c = r.shuffle(encres);
        var coeur = c[0], pointe = c[1 % c.length], milieu = c[2 % c.length];
        var degr = chroma.scale([coeur, milieu, pointe]).mode('lab');
        var sens = r.chance(0.5) ? 1 : -1, rot = r.range(0, Math.PI * 2);
        // Couronnes de l'extérieur vers l'intérieur.
        for (var k = 0; k < P.couronnes; k++) {
          var part = P.couronnes === 1 ? 1 : 1 - k / P.couronnes * 0.75;
          var n = Math.max(6, Math.round(P.petales * (0.55 + 0.45 * part) / P.couronnes * (P.couronnes === 1 ? 1 : 1.4)));
          var L = fl.R * part;
          var larg = P.finesse * 2 * Math.PI * L / n * 0.55;
          var cTete = degr(0.35 + 0.65 * part).hex(), cPied = degr(0.15 * part).hex();
          for (var q = 0; q < n; q++) {
            var a0 = rot + (q + k * 0.5) * 2 * Math.PI / n + (r() - 0.5) * 0.15;
            var len = L * r.range(0.8, 1.05);
            var curl = P.courbure * sens * r.range(0.6, 1.3);
            // Ligne médiane du pétale : angle qui s'enroule avec la distance.
            var gauche = [], droite = [], seg = 10, bout;
            for (var s = 0; s <= seg; s++) {
              var t = s / seg, ang = a0 + curl * t * t * 1.4, rad = fl.R * 0.04 + len * t;
              var x = fl.x + rad * Math.cos(ang), y = fl.y + rad * Math.sin(ang);
              var wd = larg * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) * (1 - 0.35 * t);
              var nx = -Math.sin(ang), ny = Math.cos(ang);
              gauche.push([x + nx * wd / 2, y + ny * wd / 2]);
              droite.unshift([x - nx * wd / 2, y - ny * wd / 2]);
              bout = [x, y];
            }
            var g = ctx.createLinearGradient(fl.x, fl.y, bout[0], bout[1]);
            g.addColorStop(0, cPied);
            g.addColorStop(1, cTete);
            ctx.fillStyle = g;
            ctx.beginPath();
            var pts = gauche.concat(droite);
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var e = 1; e < pts.length; e++) ctx.lineTo(pts[e][0], pts[e][1]);
            ctx.closePath();
            ctx.fill();
            if (P.pointes && k === 0) {
              ctx.fillStyle = pal[pal.length - 1];
              ctx.beginPath();
              ctx.arc(bout[0], bout[1], Math.max(0.6, larg * 0.22), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        // Cœur : petites graines en spirale de Fibonacci.
        var nG = 60, ga = Math.PI * (3 - Math.sqrt(5));
        ctx.fillStyle = degr(0).hex();
        for (var gI = 0; gI < nG; gI++) {
          var rr = fl.R * 0.07 * Math.sqrt(gI / nG), aa = gI * ga;
          ctx.beginPath();
          ctx.arc(fl.x + rr * Math.cos(aa), fl.y + rr * Math.sin(aa), fl.R * 0.008, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  });
})();

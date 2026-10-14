/* 03 Filament : champs de fils fluides (flow field, p5.js + bruit seedé).
   Un champ d'angles est tiré du bruit ; chaque fil part d'un point et suit le champ pas à pas.
   Le nombre de fils, la longueur et le pas sont relatifs au petit côté : l'export HD trace
   exactement les mêmes trajectoires, plus finement. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'filament',
    numero: '03',
    nom: 'Filament',
    famille: 'champ',
    description: 'Champs de fils fluides : des milliers de trajectoires qui suivent un flow field seedé.',
    libs: ['p5.js', 'bruit simplex'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#111111', '#C6FF00', '#FF2E88', '#00E5FF', '#FFFFFF'],
    params: [
      { cle: 'fils', label: 'Nombre de fils', type: 'range', min: 50, max: 5000, pas: 50, defaut: 1400 },
      { cle: 'longueur', label: 'Longueur', type: 'range', min: 10, max: 600, pas: 10, defaut: 180 },
      { cle: 'echelle', label: 'Échelle du champ', type: 'range', min: 0.3, max: 6, pas: 0.1, defaut: 1.6 },
      { cle: 'courbure', label: 'Courbure', type: 'range', min: 0.3, max: 6, pas: 0.1, defaut: 2.2 },
      { cle: 'turbulence', label: 'Turbulence', type: 'range', min: 1, max: 5, pas: 1, defaut: 2 },
      { cle: 'epaisseur', label: 'Épaisseur', type: 'range', min: 0.2, max: 8, pas: 0.1, defaut: 1.2 },
      { cle: 'opacite', label: 'Opacité', type: 'range', min: 0.05, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'couleur', label: 'Répartition des couleurs', type: 'select', defaut: 'zones', options: [
        { valeur: 'zones', label: 'Par zones' }, { valeur: 'hasard', label: 'Au hasard' }, { valeur: 'direction', label: 'Par direction' }] }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      if (!pal.transparent) p.background(pal[0]);
      var bruit = DL.creerBruit(rng.fork('champ'));
      var bruitZones = DL.creerBruit(rng.fork('zones'));
      var encres = pal.slice(1);
      var pas = m * 0.0025;
      var base = rng.range(0, Math.PI * 2);
      var marge = m * 0.05;

      ctx.lineWidth = P.epaisseur * m / 1000;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = P.opacite;

      // On regroupe les fils par couleur pour ne changer de style que quelques fois.
      var chemins = encres.map(function () { return []; });

      for (var f = 0; f < P.fils; f++) {
        var x = rng.range(-marge, w + marge), y = rng.range(-marge, h + marge);
        var pts = [x, y];
        var angle0 = 0;
        for (var s = 0; s < P.longueur; s++) {
          var a = base + bruit.fbm2(x / m * P.echelle, y / m * P.echelle, P.turbulence) * Math.PI * P.courbure;
          if (s === 0) angle0 = a;
          x += Math.cos(a) * pas;
          y += Math.sin(a) * pas;
          if (x < -marge * 2 || x > w + marge * 2 || y < -marge * 2 || y > h + marge * 2) break;
          pts.push(x, y);
        }
        if (pts.length < 4) continue;
        var ci;
        if (P.couleur === 'hasard') ci = rng.int(0, encres.length - 1);
        else if (P.couleur === 'direction') ci = Math.floor(((angle0 % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * encres.length);
        else ci = Math.floor((bruitZones.n2(pts[0] / m * 1.3, pts[1] / m * 1.3) * 0.5 + 0.5) * encres.length);
        chemins[DL.clamp(ci, 0, encres.length - 1)].push(pts);
      }

      chemins.forEach(function (liste, ci) {
        ctx.strokeStyle = encres[ci];
        ctx.beginPath();
        liste.forEach(function (pts) {
          ctx.moveTo(pts[0], pts[1]);
          for (var k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  });
})();

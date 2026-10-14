/* 07 Benday : champs thermiques en points de trame (p5.js).
   Un champ « thermique » (somme de sources gaussiennes + turbulence) est lu sur une trame
   tournée, comme en photogravure : chaque point a une taille proportionnelle à la chaleur.
   Trois modes : couleur (dégradé thermique), quadri (trois encres à angles différents,
   surimprimées en multiply) et mono (une seule encre). */
(function () {
  'use strict';
  var DL = window.DL;

  // Champ normalisé dans [0,1], fonction de coordonnées relatives au petit côté.
  function creerChamp(P, rng, w, h) {
    var m = Math.min(w, h), bruit = DL.creerBruit(rng.fork('turb'));
    var src = [];
    for (var i = 0; i < P.sources; i++) {
      src.push({ x: rng.range(0, w / m), y: rng.range(0, h / m), a: rng.range(0.5, 1), r: P.etalement * rng.range(0.5, 1.4) });
    }
    return function (x, y) {
      var v = 0;
      for (var k = 0; k < src.length; k++) {
        var dx = x - src[k].x, dy = y - src[k].y;
        v += src[k].a * Math.exp(-(dx * dx + dy * dy) / (src[k].r * src[k].r));
      }
      v = v / (1 + v * 0.35); // compression douce : plusieurs sources proches ne saturent pas tout
      v += P.turbulence * 0.35 * bruit.fbm2(x * 3, y * 3, 3);
      return Math.pow(DL.clamp(v, 0, 1), P.contraste);
    };
  }

  function point(ctx, forme, x, y, r) {
    if (r <= 0) return;
    if (forme === 'carre') { ctx.rect(x - r, y - r, 2 * r, 2 * r); return; }
    if (forme === 'losange') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.3, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r * 1.3, y); ctx.closePath(); return; }
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  // Parcourt une trame d'angle a et de pas cs couvrant toute l'image.
  function trame(w, h, cs, a, rappel) {
    var c = Math.cos(a), s = Math.sin(a), R = Math.sqrt(w * w + h * h) / 2, n = Math.ceil(R / cs) + 1;
    for (var j = -n; j <= n; j++) {
      for (var i = -n; i <= n; i++) {
        var x = w / 2 + (i * c - j * s) * cs, y = h / 2 + (i * s + j * c) * cs;
        if (x < -cs || y < -cs || x > w + cs || y > h + cs) continue;
        rappel(x, y);
      }
    }
  }

  DL.enregistrer({
    id: 'benday',
    numero: '07',
    nom: 'Benday',
    famille: 'impression',
    description: 'Champs thermiques en points de trame : sources de chaleur lues par une trame de photogravure.',
    libs: ['p5.js'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#F3EEE3', '#2B2DFF', '#E0007A', '#FF6A00', '#FFD400'],
    params: [
      { cle: 'trame', label: 'Points par côté', type: 'range', min: 15, max: 220, pas: 1, defaut: 72 },
      { cle: 'angle', label: 'Angle de trame', type: 'range', min: 0, max: 90, pas: 1, defaut: 15, unite: '°' },
      { cle: 'sources', label: 'Sources de chaleur', type: 'range', min: 1, max: 14, pas: 1, defaut: 5 },
      { cle: 'etalement', label: 'Étalement', type: 'range', min: 0.08, max: 1, pas: 0.01, defaut: 0.32 },
      { cle: 'turbulence', label: 'Turbulence', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'contraste', label: 'Contraste', type: 'range', min: 0.4, max: 3, pas: 0.05, defaut: 1.1 },
      { cle: 'mode', label: 'Mode', type: 'select', defaut: 'couleur', options: [
        { valeur: 'couleur', label: 'Dégradé thermique' }, { valeur: 'quadri', label: 'Trois encres (quadri)' }, { valeur: 'mono', label: 'Une encre' }] },
      { cle: 'forme', label: 'Forme du point', type: 'select', defaut: 'rond', options: [
        { valeur: 'rond', label: 'Rond' }, { valeur: 'carre', label: 'Carré' }, { valeur: 'losange', label: 'Losange' }] }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      if (!pal.transparent) p.background(pal[0]);
      var champ = creerChamp(P, rng, w, h);
      var cs = m / P.trame, a = P.angle * Math.PI / 180;
      // Rayon max > demi-pas : à pleine chaleur les points se touchent et ferment la trame.
      var rmax = cs * 0.72;
      var encres = pal.slice(1);

      if (P.mode === 'couleur') {
        // On groupe les points par couleur quantifiée (24 teintes) pour limiter les changements de style.
        var echelle = chroma.scale(encres).mode('lab');
        var Q = 24, groupes = [];
        for (var q = 0; q < Q; q++) groupes.push([]);
        trame(w, h, cs, a, function (x, y) {
          var v = champ(x / m, y / m);
          if (v < 0.02) return;
          groupes[Math.min(Q - 1, Math.floor(v * Q))].push(x, y, Math.sqrt(v) * rmax);
        });
        groupes.forEach(function (g, q) {
          if (!g.length) return;
          ctx.fillStyle = echelle((q + 0.5) / Q).hex();
          ctx.beginPath();
          for (var i = 0; i < g.length; i += 3) point(ctx, P.forme, g[i], g[i + 1], g[i + 2]);
          ctx.fill();
        });
      } else if (P.mode === 'quadri') {
        // Froid, tiède, chaud : chaque encre couvre une plage de température, à son propre angle.
        var plages = [
          function (v) { return 1 - DL.smooth(0.05, 0.55, v); },
          function (v) { return 1 - Math.min(1, Math.abs(v - 0.5) * 2.2); },
          function (v) { return DL.smooth(0.45, 0.95, v); }
        ];
        var angles = [a + 0.26, a + 0.79, a + 1.31];
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        for (var k = 0; k < 3; k++) {
          ctx.fillStyle = encres[k % encres.length];
          ctx.beginPath();
          trame(w, h, cs, angles[k], function (x, y) {
            var t = plages[k](champ(x / m, y / m));
            if (t > 0.02) point(ctx, P.forme, x, y, Math.sqrt(t) * rmax);
          });
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = DL.encrePrincipale(pal);
        ctx.beginPath();
        trame(w, h, cs, a, function (x, y) {
          var v = champ(x / m, y / m);
          if (v > 0.02) point(ctx, P.forme, x, y, Math.sqrt(v) * rmax);
        });
        ctx.fill();
      }
    }
  });
})();

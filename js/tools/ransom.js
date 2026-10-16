/* 30 Ransom : lettre de rançon (canvas 2D, polices de vendor/fonts).
   Chaque lettre du texte est « découpée dans un magazine » : sa propre police, sa casse, son
   corps, sa couleur, posée sur un bout de papier rectangulaire ou déchiré, légèrement tourné,
   parfois inversé, parfois barré d'un morceau de scotch. La couleur de la lettre est choisie
   pour contraster avec son papier (chroma.contrast). « / » passe à la ligne.
   La mise en page est mesurée une fois puis mise à l'échelle pour remplir le cadre. */
(function () {
  'use strict';
  var DL = window.DL;

  var POLICES = [
    { css: '"Archivo Black"', graisse: '400', style: 'normal' },
    { css: '"Dela Gothic One"', graisse: '400', style: 'normal' },
    { css: '"Space Grotesk"', graisse: '700', style: 'normal' },
    { css: '"Space Grotesk"', graisse: '400', style: 'normal' },
    { css: '"Space Mono"', graisse: '700', style: 'normal' },
    { css: '"Instrument Serif"', graisse: '400', style: 'italic' },
    { css: '"Instrument Serif"', graisse: '400', style: 'normal' }
  ];
  function fonte(p, t) { return p.style + ' ' + p.graisse + ' ' + Math.max(1, t).toFixed(2) + 'px ' + p.css; }

  DL.enregistrer({
    id: 'ransom',
    numero: '30',
    nom: 'Ransom',
    famille: 'typo',
    description: 'Lettre de rançon : chaque lettre découpée dans une police, un papier et une couleur différents.',
    libs: ['Canvas 2D', 'polices locales', 'chroma.js'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#2A2A2A', '#F4F0E6', '#141414', '#FF3B00', '#FFD23F', '#3A7BFF'],
    params: [
      { cle: 'texte', label: 'Texte (/ = ligne)', type: 'texte', max: 60, defaut: 'TOUT/EST/POSSIBLE' },
      { cle: 'casse', label: 'Casse', type: 'select', defaut: 'melange', options: [
        { valeur: 'melange', label: 'Mélangée' }, { valeur: 'capitales', label: 'Capitales' }, { valeur: 'telle', label: 'Telle que saisie' }] },
      { cle: 'papier', label: 'Découpe', type: 'select', defaut: 'mixte', options: [
        { valeur: 'droite', label: 'Aux ciseaux' }, { valeur: 'dechire', label: 'Déchirée' }, { valeur: 'mixte', label: 'Mélange' }] },
      { cle: 'desordre', label: 'Désordre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'corps', label: 'Écarts de corps', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'scotch', label: 'Scotch', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.12 },
      { cle: 'ombre', label: 'Ombre dure', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var papiers = pal.slice(1), encres = pal.slice(1);
      var lignes = String(P.texte || '').split('/').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lignes.length) lignes = ['RANSOM'];

      // 1. Mesure à corps 100 : une « coupure » par lettre, espaces conservés comme vides.
      ctx.textBaseline = 'alphabetic';
      var plan = [], larg = 0, haut = 0;
      lignes.forEach(function (ligne, li) {
        var coupures = [], x = 0, hl = 0;
        for (var i = 0; i < ligne.length; i++) {
          var r = rng.fork('l' + li + 'c' + i), ch = ligne.charAt(i);
          if (ch === ' ') { x += 45; continue; }
          if (P.casse === 'capitales') ch = ch.toUpperCase();
          else if (P.casse === 'melange') ch = r.chance(0.6) ? ch.toUpperCase() : ch.toLowerCase();
          var pol = r.pick(POLICES), corps = 100 * (1 + (r() - 0.5) * 1.1 * P.corps);
          ctx.font = fonte(pol, corps);
          var mes = ctx.measureText(ch);
          var asc = mes.actualBoundingBoxAscent || corps * 0.72, desc = mes.actualBoundingBoxDescent || 0;
          var lw = Math.max(mes.width, (mes.actualBoundingBoxRight || 0) + (mes.actualBoundingBoxLeft || 0));
          var pad = corps * r.range(0.1, 0.22);
          var bw = lw + 2 * pad, bh = asc + desc + 2 * pad;
          coupures.push({ ch: ch, pol: pol, corps: corps, asc: asc, desc: desc, pad: pad, x: x, w: bw, h: bh, r: r,
            bx: mes.actualBoundingBoxLeft || 0 });
          x += bw + 6;
          if (bh > hl) hl = bh;
        }
        plan.push({ coupures: coupures, w: x, h: hl });
        if (x > larg) larg = x;
        haut += hl + 14;
      });

      // 2. Échelle qui fait tenir le bloc dans 86 % du cadre.
      var k = Math.min(w * 0.86 / Math.max(1, larg), h * 0.86 / Math.max(1, haut));
      var y = (h - haut * k) / 2, ombre = m * 0.008;

      plan.forEach(function (ligne) {
        var ox = (w - ligne.w * k) / 2;
        ligne.coupures.forEach(function (c) {
          var r = c.r, cw = c.w * k, chh = c.h * k;
          var cx = ox + (c.x + c.w / 2) * k, cy = y + ligne.h * k / 2 + (r() - 0.5) * P.desordre * chh * 0.35;
          var papier = r.pick(papiers);
          // Encre la plus contrastée avec le papier, parmi deux tirées (garde de la variété).
          var e1 = r.pick(encres), e2 = r.pick(encres);
          var encre = chroma.contrast(papier, e1) >= chroma.contrast(papier, e2) ? e1 : e2;
          if (chroma.contrast(papier, encre) < 2.2) encre = chroma.contrast(papier, '#000') > chroma.contrast(papier, '#fff') ? '#111111' : '#FFFFFF';

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate((r() - 0.5) * P.desordre * 0.5);
          // Contour du papier : rectangle net ou bords déchirés (petites dents irrégulières).
          var dechire = P.papier === 'dechire' || (P.papier === 'mixte' && r.chance(0.5));
          ctx.beginPath();
          if (!dechire) ctx.rect(-cw / 2, -chh / 2, cw, chh);
          else {
            var dents = function (x0, y0, x1, y1, n) {
              for (var q = 0; q <= n; q++) {
                var t = q / n, j = (q > 0 && q < n) ? (r() - 0.5) * m * 0.006 : 0;
                var nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1;
                ctx.lineTo(x0 + (x1 - x0) * t + nx / L * j, y0 + (y1 - y0) * t + ny / L * j);
              }
            };
            var nd = Math.max(4, Math.round(cw / (m * 0.012))), ndv = Math.max(4, Math.round(chh / (m * 0.012)));
            ctx.moveTo(-cw / 2, -chh / 2);
            dents(-cw / 2, -chh / 2, cw / 2, -chh / 2, nd);
            dents(cw / 2, -chh / 2, cw / 2, chh / 2, ndv);
            dents(cw / 2, chh / 2, -cw / 2, chh / 2, nd);
            dents(-cw / 2, chh / 2, -cw / 2, -chh / 2, ndv);
            ctx.closePath();
          }
          if (P.ombre) { ctx.save(); ctx.translate(ombre, ombre); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.restore(); }
          ctx.fillStyle = papier;
          ctx.fill();

          // Lettre : centrée sur sa boîte d'encre réelle.
          ctx.font = fonte(c.pol, c.corps * k);
          ctx.fillStyle = encre;
          ctx.textAlign = 'left';
          var lx = -cw / 2 + c.pad * k + c.bx * k, ly = -chh / 2 + (c.pad + c.asc) * k;
          ctx.fillText(c.ch, lx, ly);

          // Scotch : bande translucide en travers du haut de la coupure.
          if (r.chance(P.scotch)) {
            ctx.rotate((r() - 0.5) * 0.6);
            ctx.fillStyle = 'rgba(255,255,240,0.55)';
            ctx.fillRect(-cw * 0.6, -chh / 2 - chh * 0.08, cw * 1.2, chh * 0.2);
          }
          ctx.restore();
        });
        y += (ligne.h + 14) * k;
      });
    }
  });
})();

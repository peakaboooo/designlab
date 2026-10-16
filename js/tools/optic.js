/* 22 Optic : rayures à contre-changement (canvas 2D).
   Un champ de rayures couvre l'image ; à l'intérieur de formes posées par-dessus, les
   rayures changent : décalées d'une demi-période (le noir devient blanc), pivotées d'un
   quart de tour ou resserrées. Les formes sont réunies dans un seul tracé découpé en
   règle « pair-impair » : là où deux formes se superposent, on revient au motif d'origine,
   ce qui donne les jeux d'imbrication typiques de l'op-art. */
(function () {
  'use strict';
  var DL = window.DL;

  // Rayures parallèles d'angle a, période p (px), proportion d'encre e, phase en fraction de période.
  // Avec ondulation, les bords des bandes deviennent des sinusoïdes (période relative à l'image).
  function rayures(ctx, w, h, m, a, p, e, phase, fond, encre, onde) {
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(a);
    var D = Math.hypot(w, h) / 2 + p, pas = Math.max(2, m / 200);
    var amp = onde * p * 1.2, freq = 2 * Math.PI / (m * 0.18);
    ctx.fillStyle = encre;
    ctx.beginPath();
    for (var y = -D + (phase % 1) * p - p; y < D; y += p) {
      if (onde <= 0) { ctx.rect(-D, y, 2 * D, p * e); continue; }
      var x;
      ctx.moveTo(-D, y + amp * Math.sin(-D * freq));
      for (x = -D; x <= D; x += pas) ctx.lineTo(x, y + amp * Math.sin(x * freq));
      for (x = D; x >= -D; x -= pas) ctx.lineTo(x, y + p * e + amp * Math.sin(x * freq));
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  DL.enregistrer({
    id: 'optic',
    numero: '22',
    nom: 'Optic',
    famille: 'motif',
    description: 'Rayures à contre-changement : les bandes s’inversent, pivotent ou se resserrent dans des formes imbriquées.',
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: false,
    nbCouleurs: 3,
    palette: ['#F2EEE3', '#141414', '#FF3B00'],
    params: [
      { cle: 'periode', label: 'Nombre de rayures', type: 'range', min: 4, max: 90, pas: 1, defaut: 26 },
      { cle: 'angle', label: 'Angle', type: 'range', min: 0, max: 180, pas: 1, defaut: 0 },
      { cle: 'encre', label: "Part d'encre", type: 'range', min: 0.1, max: 0.9, pas: 0.01, defaut: 0.5 },
      { cle: 'formes', label: 'Formes', type: 'select', defaut: 'mixte', options: [
        { valeur: 'cercles', label: 'Cercles' }, { valeur: 'anneaux', label: 'Anneaux' }, { valeur: 'carres', label: 'Carrés' },
        { valeur: 'bandes', label: 'Bandes' }, { valeur: 'mixte', label: 'Mélange' }] },
      { cle: 'nombre', label: 'Nombre de formes', type: 'range', min: 1, max: 24, pas: 1, defaut: 5 },
      { cle: 'taille', label: 'Taille des formes', type: 'range', min: 0.05, max: 0.7, pas: 0.01, defaut: 0.32 },
      { cle: 'mode', label: 'Dans les formes', type: 'select', defaut: 'inverse', options: [
        { valeur: 'inverse', label: 'Inversées' }, { valeur: 'pivote', label: 'Pivotées' }, { valeur: 'serre', label: 'Resserrées' }] },
      { cle: 'onde', label: 'Ondulation', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h), p = m / P.periode, a = P.angle * Math.PI / 180;
      var encreDedans = pal[2] || pal[1];
      rayures(ctx, w, h, m, a, p, P.encre, 0, pal[0], pal[1], P.onde);

      // Formes réunies dans un seul tracé : la règle pair-impair fait le contre-changement des recouvrements.
      var types = P.formes === 'mixte' ? ['cercles', 'anneaux', 'carres', 'bandes'] : [P.formes];
      ctx.save();
      ctx.beginPath();
      for (var i = 0; i < P.nombre; i++) {
        var r = rng.fork('forme' + i), t = r.pick(types);
        var cx = r.range(0.1, 0.9) * w, cy = r.range(0.1, 0.9) * h;
        var s = m * P.taille * r.range(0.5, 1.2) / 2;
        if (t === 'cercles' || t === 'anneaux') {
          ctx.moveTo(cx + s, cy); ctx.arc(cx, cy, s, 0, Math.PI * 2);
          // Anneau : un second cercle intérieur, que la règle pair-impair évide.
          if (t === 'anneaux') { var si = s * r.range(0.35, 0.7); ctx.moveTo(cx + si, cy); ctx.arc(cx, cy, si, 0, Math.PI * 2); }
        } else if (t === 'carres') {
          var rot = r.chance(0.4) ? Math.PI / 4 : 0;
          for (var k = 0; k < 4; k++) {
            var ang = rot + Math.PI / 4 + k * Math.PI / 2, rr = s * Math.SQRT2;
            if (k === 0) ctx.moveTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang));
            else ctx.lineTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang));
          }
          ctx.closePath();
        } else {
          // Bande traversante, perpendiculaire ou parallèle aux rayures.
          var ep = s * 0.8;
          if (r.chance(0.5)) ctx.rect(cx - ep / 2, -1, ep, h + 2); else ctx.rect(-1, cy - ep / 2, w + 2, ep);
        }
      }
      ctx.clip('evenodd');
      if (P.mode === 'inverse') rayures(ctx, w, h, m, a, p, P.encre, 0.5, pal[0], encreDedans, P.onde);
      else if (P.mode === 'pivote') rayures(ctx, w, h, m, a + Math.PI / 2, p, P.encre, 0, pal[0], encreDedans, P.onde);
      else rayures(ctx, w, h, m, a, p / 2, P.encre, 0.25, pal[0], encreDedans, P.onde);
      ctx.restore();
    }
  });
})();

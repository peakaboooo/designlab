/* 28 Smear : un mot étiré le long d'une trajectoire (canvas 2D, polices de vendor/fonts).
   Le mot est tamponné des centaines de fois le long d'une courbe (vague, spirale, boucle,
   chute) : la traînée forme un volume extrudé façon chrome des années 2000, découpé en
   bandes de couleur, et la dernière empreinte, nette, se pose par-dessus avec un liseré.
   Les empreintes sont réparties à longueur d'arc constante, donc la traînée reste régulière
   même là où la courbe accélère. Tailles relatives à l'image : l'export garde la composition. */
(function () {
  'use strict';
  var DL = window.DL;

  var POLICES = {
    archivo: { nom: 'Archivo Black', css: '400 100px "Archivo Black"' },
    dela: { nom: 'Dela Gothic One', css: '400 100px "Dela Gothic One"' },
    grotesk: { nom: 'Space Grotesk', css: '700 100px "Space Grotesk"' },
    serif: { nom: 'Instrument Serif', css: 'italic 400 100px "Instrument Serif"' },
    mono: { nom: 'Space Mono', css: '700 100px "Space Mono"' }
  };

  // Trajectoire en coordonnées normalisées [0,1]², paramétrée par t ∈ [0,1].
  function trajectoire(type, r) {
    var ph = r.range(0, Math.PI * 2), a = r.range(0.18, 0.32), f = r.range(1.2, 2.4);
    if (type === 'spirale') {
      var tours = r.range(1.2, 2.2), sens = r.chance(0.5) ? 1 : -1;
      return function (t) { var ang = ph + sens * t * tours * 2 * Math.PI, rr = 0.42 * (1 - t * 0.85); return [0.5 + rr * Math.cos(ang), 0.5 + rr * Math.sin(ang)]; };
    }
    if (type === 'boucle') {
      var A = r.int(1, 3), B = r.int(2, 4);
      return function (t) { var u = t * 2 * Math.PI; return [0.5 + 0.36 * Math.sin(A * u + ph), 0.5 + 0.34 * Math.sin(B * u)]; };
    }
    if (type === 'chute') {
      return function (t) { return [0.15 + 0.7 * t + 0.08 * Math.sin(t * 9 + ph), 0.1 + 0.8 * t * t]; };
    }
    return function (t) { return [0.08 + 0.84 * t, 0.5 + a * Math.sin(t * f * 2 * Math.PI + ph)]; };
  }

  DL.enregistrer({
    id: 'smear',
    numero: '28',
    nom: 'Smear',
    famille: 'typo',
    description: 'Un mot tamponné le long d’une trajectoire : traînée extrudée en bandes de couleur, empreinte nette par-dessus.',
    libs: ['Canvas 2D', 'polices locales'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#141414', '#F2F2F2', '#FF2E88', '#FFB800', '#00C2FF', '#7B2BFF'],
    params: [
      { cle: 'texte', label: 'Mot', type: 'texte', max: 16, defaut: 'SMEAR' },
      { cle: 'police', label: 'Police', type: 'select', defaut: 'archivo', options: Object.keys(POLICES).map(function (k) { return { valeur: k, label: POLICES[k].nom }; }) },
      { cle: 'trajectoire', label: 'Trajectoire', type: 'select', defaut: 'vague', options: [
        { valeur: 'vague', label: 'Vague' }, { valeur: 'spirale', label: 'Spirale' }, { valeur: 'boucle', label: 'Boucle' }, { valeur: 'chute', label: 'Chute' }] },
      { cle: 'taille', label: 'Taille du mot', type: 'range', min: 0.1, max: 0.8, pas: 0.01, defaut: 0.38 },
      { cle: 'longueur', label: 'Longueur de traînée', type: 'range', min: 0.05, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'empreintes', label: 'Empreintes', type: 'range', min: 10, max: 600, pas: 1, defaut: 240 },
      { cle: 'effilement', label: 'Effilement', type: 'range', min: 0, max: 0.95, pas: 0.01, defaut: 0.55 },
      { cle: 'bandes', label: 'Bandes de couleur', type: 'range', min: 1, max: 30, pas: 1, defaut: 7 },
      { cle: 'suivre', label: 'Suivre la courbe', type: 'toggle', defaut: false }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var mot = String(P.texte || '').trim() || 'SMEAR';
      var pol = POLICES[P.police] || POLICES.archivo;
      var face = pal[1], traine = pal.slice(2).length ? pal.slice(2) : [pal[1]];

      // Corps : le mot mesure « taille » × largeur de l'image, sans dépasser 40 % de la hauteur.
      ctx.font = pol.css;
      var lw = ctx.measureText(mot).width || 1;
      var corps = Math.min(100 * P.taille * w / lw, h * 0.4) / 100;

      // Courbe échantillonnée puis abscisse curviligne cumulée.
      var f = trajectoire(P.trajectoire, rng.fork('trajet'));
      // La trajectoire est ramenée dans un cadre réduit d'une demi-largeur de mot : l'empreinte
      // finale, la plus grande, reste entière dans l'image.
      var mx = Math.min(w * 0.45, lw * corps / 2 + m * 0.03), my = Math.min(h * 0.45, corps * 45 + m * 0.03);
      var N = 1200, pts = [], cum = [0];
      for (var i = 0; i <= N; i++) { var q = f(i / N); pts.push([mx + q[0] * (w - 2 * mx), my + q[1] * (h - 2 * my)]); }
      for (i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      var total = cum[N], debutL = total * (1 - P.longueur), idx = 0;
      function surCourbe(s) {
        while (idx < N - 1 && cum[idx + 1] < s) idx++;
        var t = (s - cum[idx]) / Math.max(1e-9, cum[idx + 1] - cum[idx]);
        var a = pts[idx], b = pts[idx + 1];
        return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var E = P.empreintes, lis = Math.max(1, m * 0.004);
      function tampon(p, echelle, couleur, lisere) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (P.suivre) ctx.rotate(p.ang);
        ctx.scale(corps * echelle, corps * echelle);
        ctx.font = pol.css;
        if (lisere) {
          ctx.lineJoin = 'round';
          ctx.lineWidth = lis * 2 / (corps * echelle);
          ctx.strokeStyle = lisere;
          ctx.strokeText(mot, 0, 0);
        }
        ctx.fillStyle = couleur;
        ctx.fillText(mot, 0, 0);
        ctx.restore();
      }

      // Traînée : de la plus ancienne (petite) à la plus récente ; couleur par bande.
      for (var k = 0; k < E; k++) {
        var t = k / Math.max(1, E - 1);
        var p = surCourbe(debutL + (total - debutL) * t);
        var bande = Math.min(P.bandes - 1, Math.floor(t * P.bandes));
        tampon(p, 1 - P.effilement * (1 - t), traine[bande % traine.length], null);
      }
      // Empreinte finale : face claire et liseré sombre, posée au bout de la trajectoire.
      tampon(surCourbe(total), 1, face, pal[0]);
    }
  });
})();

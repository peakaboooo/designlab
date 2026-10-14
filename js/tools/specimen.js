/* 08 Specimen : affiches de spécimens typographiques (canvas 2D, polices de vendor/fonts).
   Une affiche sur grille de 6 colonnes : un glyphe héros géant, le nom de la police,
   l'alphabet, une cascade de corps et des blocs d'aplat alignés sur la grille.
   Les polices sont chargées avant le rendu (outil.polices) : l'aperçu et l'export utilisent
   exactement la même fonte, sans police de repli au premier affichage. */
(function () {
  'use strict';
  var DL = window.DL;

  var POLICES = {
    archivo: { nom: 'Archivo Black', css: '"Archivo Black"', graisse: '400', style: 'normal', info: 'Grotesque · 400' },
    grotesk: { nom: 'Space Grotesk', css: '"Space Grotesk"', graisse: '700', style: 'normal', info: 'Grotesque · 700' },
    mono: { nom: 'Space Mono', css: '"Space Mono"', graisse: '700', style: 'normal', info: 'Monospace · 700' },
    serif: { nom: 'Instrument Serif', css: '"Instrument Serif"', graisse: '400', style: 'italic', info: 'Serif · 400 italique' },
    dela: { nom: 'Dela Gothic One', css: '"Dela Gothic One"', graisse: '400', style: 'normal', info: 'Display · 400' }
  };
  var MONO = '"Space Mono", monospace';
  var GLYPHES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&?!@#%';

  function fonte(pol, taille) { return pol.style + ' ' + pol.graisse + ' ' + Math.max(1, taille).toFixed(2) + 'px ' + pol.css; }

  function casse(t, mode) {
    if (mode === 'capitales') return t.toUpperCase();
    if (mode === 'minuscules') return t.toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  // Taille qui fait tenir le texte dans une largeur donnée (sans dépasser un plafond).
  function ajuster(ctx, pol, texte, largeur, plafond) {
    ctx.font = fonte(pol, 100);
    var lw = ctx.measureText(texte).width || 1;
    return Math.min(plafond, 100 * largeur / lw);
  }

  DL.enregistrer({
    id: 'specimen',
    numero: '08',
    nom: 'Specimen',
    famille: 'typo',
    description: 'Affiches de spécimens typographiques : glyphe géant, alphabet, cascade de corps, grille visible.',
    libs: ['Canvas 2D', 'polices locales'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 4,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF'],
    params: [
      { cle: 'police', label: 'Police', type: 'select', defaut: 'archivo', options: Object.keys(POLICES).map(function (k) { return { valeur: k, label: POLICES[k].nom }; }) },
      { cle: 'texte', label: 'Mot', type: 'texte', max: 24, defaut: 'Specimen' },
      { cle: 'mise', label: 'Mise en page', type: 'select', defaut: 'mixte', options: [
        { valeur: 'geant', label: 'Glyphe géant' }, { valeur: 'cascade', label: 'Cascade de corps' }, { valeur: 'glyphes', label: 'Grille de glyphes' }, { valeur: 'mixte', label: 'Mixte' }] },
      { cle: 'casse', label: 'Casse', type: 'select', defaut: 'capitales', options: [
        { valeur: 'capitales', label: 'Capitales' }, { valeur: 'minuscules', label: 'Minuscules' }, { valeur: 'titre', label: 'Initiale' }] },
      { cle: 'heros', label: 'Taille du héros', type: 'range', min: 0.3, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'blocs', label: "Blocs d'aplat", type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'grille', label: 'Grille visible', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var pol = POLICES[P.police] || POLICES.archivo;
      var m = Math.min(w, h), marge = m * 0.045;
      var encre = pal[1], ac = pal.slice(2);
      var mot = casse((P.texte || '').trim() || 'Specimen', P.casse);
      var cols = 6, lignes = Math.max(6, Math.round(6 * h / w * 1.3));
      var X0 = marge, Y0 = marge, W = w - 2 * marge, H = h - 2 * marge;
      var cw = W / cols, ch = H / lignes;
      var trait = Math.max(1, m * 0.0022);

      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      ctx.textBaseline = 'alphabetic';

      // Blocs d'aplat alignés sur la grille : la couleur structure l'affiche.
      var occupe = {};
      var nb = Math.round(P.blocs * cols * lignes * 0.22);
      for (var b = 0; b < nb; b++) {
        var bc = rng.int(0, cols - 1), bl = rng.int(0, lignes - 1);
        var bw = rng.int(1, Math.min(3, cols - bc)), bh = rng.int(1, Math.min(3, lignes - bl));
        ctx.fillStyle = rng.pick(ac.length ? ac : [encre]);
        ctx.fillRect(X0 + bc * cw, Y0 + bl * ch, bw * cw, bh * ch);
        occupe[bc + ',' + bl] = true;
      }

      if (P.grille) {
        ctx.strokeStyle = encre;
        ctx.lineWidth = trait;
        ctx.beginPath();
        for (var c = 0; c <= cols; c++) { ctx.moveTo(X0 + c * cw, Y0); ctx.lineTo(X0 + c * cw, Y0 + H); }
        for (var l = 0; l <= lignes; l++) { ctx.moveTo(X0, Y0 + l * ch); ctx.lineTo(X0 + W, Y0 + l * ch); }
        ctx.stroke();
      }

      // Bandeau d'en-tête : nom de la police + métadonnées réelles, en mono.
      ctx.fillStyle = encre;
      var tNom = ajuster(ctx, pol, pol.nom.toUpperCase(), W * 0.62, ch * 0.62);
      ctx.font = fonte(pol, tNom);
      ctx.fillText(pol.nom.toUpperCase(), X0 + cw * 0.08, Y0 + ch * 0.72);
      ctx.font = '400 ' + (m * 0.014).toFixed(2) + 'px ' + MONO;
      ctx.textAlign = 'right';
      ctx.fillText(pol.info.toUpperCase(), X0 + W - cw * 0.08, Y0 + ch * 0.4);
      ctx.fillText('N° ' + String(rng.seed).toUpperCase(), X0 + W - cw * 0.08, Y0 + ch * 0.72);
      ctx.textAlign = 'left';

      var mise = P.mise === 'mixte' ? rng.pick(['geant', 'cascade', 'glyphes']) : P.mise;
      var zoneY = Y0 + ch, zoneH = H - ch * 3; // entre l'en-tête et le pied (alphabet)

      if (mise === 'geant') {
        // Deux glyphes « Aa » tirés du mot (ou du jeu complet) : le héros de l'affiche.
        var source = mot.replace(/\s/g, '') || 'Aa';
        var g1 = source.charAt(rng.int(0, source.length - 1));
        var hero = g1.toUpperCase() + g1.toLowerCase();
        if (hero.charAt(0) === hero.charAt(1)) hero = g1;
        var tH = ajuster(ctx, pol, hero, W * 0.92, zoneH * 1.15 * P.heros);
        ctx.font = fonte(pol, tH);
        // Héros toujours à l'encre : posé sur un bloc d'aplat de couleur, il reste lisible.
        ctx.fillStyle = encre;
        ctx.fillText(hero, X0 + cw * 0.06, zoneY + zoneH * 0.5 + tH * 0.36);
        ctx.fillStyle = encre;
        var tM = ajuster(ctx, pol, mot, W * 0.9, ch * 0.8);
        ctx.font = fonte(pol, tM);
        ctx.fillText(mot, X0 + cw * 0.08, zoneY + zoneH - ch * 0.15);
      } else if (mise === 'cascade') {
        // Cascade : le mot répété à des corps décroissants, chaque ligne étiquetée.
        var y = zoneY;
        var tMax = ajuster(ctx, pol, mot, W * 0.86, zoneH * 0.36 * P.heros + ch * 0.4);
        var t = tMax;
        while (y + t * 0.9 < zoneY + zoneH && t > m * 0.012) {
          y += t * 0.95;
          ctx.font = fonte(pol, t);
          ctx.fillStyle = encre;
          ctx.fillText(mot, X0 + cw * 0.08, y);
          ctx.font = '400 ' + (m * 0.012).toFixed(2) + 'px ' + MONO;
          ctx.textAlign = 'right';
          ctx.fillText(Math.round(t / m * 1000) + ' / 1000', X0 + W - cw * 0.08, y);
          ctx.textAlign = 'left';
          y += t * 0.18;
          t *= 0.66;
        }
      } else {
        // Grille de glyphes : une lettre par cellule, certaines inversées.
        var gl = rng.shuffle(GLYPHES.split(''));
        var n = 0;
        var tG = Math.min(cw, ch) * 0.78 * (0.6 + 0.4 * P.heros);
        for (var gj = 1; gj < lignes - 2; gj++) {
          for (var gi = 0; gi < cols; gi++) {
            var x = X0 + gi * cw, yy = Y0 + gj * ch;
            var inv = rng.chance(0.18);
            if (inv) { ctx.fillStyle = encre; ctx.fillRect(x, yy, cw, ch); }
            var glyphe = gl[n++ % gl.length];
            ctx.font = fonte(pol, tG);
            ctx.fillStyle = inv ? pal[0] : (occupe[gi + ',' + gj] ? pal[0] : encre);
            ctx.textAlign = 'center';
            ctx.fillText(glyphe, x + cw / 2, yy + ch * 0.5 + tG * 0.35);
            ctx.textAlign = 'left';
          }
        }
      }

      // Pied : alphabet et chiffres sur deux lignes.
      ctx.fillStyle = encre;
      var lignesAlpha = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz 0123456789'];
      lignesAlpha.forEach(function (txt, i) {
        var t = ajuster(ctx, pol, txt, W * 0.94, ch * 0.62);
        ctx.font = fonte(pol, t);
        ctx.fillText(txt, X0 + cw * 0.06, Y0 + H - ch * (1.25 - i) + t * 0.3);
      });
    }
  });
})();

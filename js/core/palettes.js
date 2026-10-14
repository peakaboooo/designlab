/* DesignLab : palettes.
   Convention partout : palette[0] = fond, palette[1..] = encres par ordre d'importance.
   Les palettes prédéfinies ont 6 couleurs ; un outil n'en prend que nbCouleurs (les premières). */
(function () {
  'use strict';
  var DL = window.DL;

  DL.palettesPredefinies = [
    { nom: 'Atelier', couleurs: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF', '#FFC700', '#00A86B'] },
    { nom: 'Riso', couleurs: ['#F4EFE3', '#FF48B0', '#0078BF', '#FFE800', '#00A95C', '#765BA7'] },
    { nom: 'Thermique', couleurs: ['#0B0B2A', '#3A0CA3', '#D7263D', '#FF7A00', '#FFD23F', '#FFF7E0'] },
    { nom: 'Bauhaus', couleurs: ['#F1E9D2', '#1A1A1A', '#D62828', '#003F88', '#F7B801', '#6B705C'] },
    { nom: 'Marbre', couleurs: ['#F6F1E7', '#1C2541', '#B23A48', '#E3B23C', '#5B8E7D', '#8C6A5D'] },
    { nom: 'Acide', couleurs: ['#111111', '#C6FF00', '#FF2E88', '#00E5FF', '#FFFFFF', '#7A00FF'] },
    { nom: 'Argile', couleurs: ['#E9DCC9', '#3B2F2F', '#C1502E', '#E08E45', '#7A9E7E', '#F2C14E'] },
    { nom: 'Signal', couleurs: ['#FFFFFF', '#000000', '#FF0000', '#0000FF', '#FFFF00', '#00FF66'] },
    { nom: 'Lagune', couleurs: ['#E6F2EF', '#0D3B4C', '#1B998B', '#F46036', '#2E294E', '#C5D86D'] },
    { nom: 'Nuit', couleurs: ['#141414', '#EDEBE4', '#FF5E5B', '#00CECB', '#FFED66', '#8B80F9'] },
    { nom: 'Papier kraft', couleurs: ['#C9A97B', '#1E1B18', '#F2EDE4', '#B33F40', '#2F4858', '#E3B505'] },
    { nom: 'Pastel dur', couleurs: ['#FAF3E3', '#2B2B2B', '#FFB4A2', '#9AD1D4', '#C3B1E1', '#FFE66D'] }
  ];

  // Prend les n premières couleurs d'une palette prédéfinie, en copie.
  DL.palettePour = function (couleurs, n) {
    var out = couleurs.slice(0, n);
    while (out.length < n) out.push(couleurs[out.length % couleurs.length]);
    return out;
  };

  // Tirage d'une palette cohérente : une teinte de base, un schéma d'harmonie, un fond très clair
  // ou très sombre. Un tirage purement uniforme donne des palettes boueuses ; ici on contrôle
  // la luminosité du fond pour garder du contraste avec les encres.
  DL.paletteAuHasard = function (n, actuelle, verrous) {
    var r = DL.rngLibre();
    var base = r.range(0, 360);
    var schemas = {
      analogue: [0, 25, -25, 50, -50],
      complementaire: [0, 180, 20, 200, -20],
      triade: [0, 120, 240, 60, 180],
      tetrade: [0, 90, 180, 270, 45],
      eclate: [0, 150, 210, 75, 285]
    };
    var decal = schemas[r.pick(Object.keys(schemas))];
    var fondSombre = r.chance(0.35);
    var fond = fondSombre
      ? chroma.hsl(base + r.range(-20, 20), r.range(0.05, 0.3), r.range(0.05, 0.12))
      : chroma.hsl(base + r.range(-20, 20), r.range(0.1, 0.35), r.range(0.88, 0.95));
    var out = [fond.hex().toUpperCase()];
    for (var i = 1; i < n; i++) {
      var h = (base + decal[(i - 1) % decal.length] + r.range(-8, 8) + 360) % 360;
      // Première encre très contrastée (noir/blanc teinté) une fois sur deux : structure lisible.
      var c = i === 1 && r.chance(0.5)
        ? chroma.hsl(h, r.range(0.1, 0.4), fondSombre ? 0.92 : 0.1)
        : chroma.hsl(h, r.range(0.6, 1), r.range(0.42, 0.62));
      out.push(c.hex().toUpperCase());
    }
    // Les couleurs verrouillées restent en place.
    if (actuelle && verrous) {
      for (var k = 0; k < n; k++) if (verrous[k] && actuelle[k]) out[k] = actuelle[k];
    }
    return out;
  };

  // Inversion = négatif de chaque couleur (fond clair ↔ sombre, teintes complémentaires).
  DL.inverserPalette = function (pal) {
    return pal.map(function (c) {
      var rgb = chroma(c).rgb();
      return chroma(255 - rgb[0], 255 - rgb[1], 255 - rgb[2]).hex().toUpperCase();
    });
  };

  // Construit l'objet palette reçu par render() : tableau + drapeau de transparence.
  DL.objetPalette = function (couleurs, transparent) {
    var p = couleurs.slice();
    p.transparent = !!transparent;
    return p;
  };

  // Couleur hex → [r, g, b] en 0..1 (pour les shaders) ou 0..255.
  DL.rgb01 = function (c) { var v = chroma(c).rgb(); return [v[0] / 255, v[1] / 255, v[2] / 255]; };
  DL.rgb255 = function (c) { return chroma(c).rgb(); };

  // Encre la plus contrastée avec le fond, parmi les encres : utile pour les traits et le texte.
  DL.encrePrincipale = function (pal) {
    var meilleure = pal[1] || '#000', ecart = -1;
    for (var i = 1; i < pal.length; i++) {
      var d = chroma.contrast(pal[0], pal[i]);
      if (d > ecart) { ecart = d; meilleure = pal[i]; }
    }
    return meilleure;
  };
})();

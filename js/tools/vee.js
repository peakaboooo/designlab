/* 33 Vee : chevrons emboîtés en miroir, en vectoriel (Paper.js, export SVG).
   Le cadre est découpé en grandes tuiles carrées. Chaque tuile contient des chevrons emboîtés
   (des V parallèles, pointe au milieu d'un côté) ; la disposition oriente les tuiles les unes
   par rapport aux autres : en miroir d'une rangée à l'autre, deux tuiles forment un losange
   (pointes vers l'extérieur) ou un sablier (pointes qui se touchent) ; « vers le centre », toutes
   les pointes convergent. Les couleurs peuvent se décaler d'une tuile à l'autre, ce qui fait
   courir des diagonales de couleur sur toute l'image, à la manière des graphismes des années 70.
   Chaque chevron est un trait épais détouré par sa tuile (clipPath en SVG). */
(function () {
  'use strict';
  var DL = window.DL;

  // Directions : angle de rotation de la tuile (la pointe du modèle est en haut).
  var HAUT = 0, DROITE = 90, BAS = 180, GAUCHE = 270;

  function direction(disposition, sens, i, j, cx, cy, w, h) {
    var vertical = sens === 'vertical';
    if (disposition === 'fleches') return vertical ? HAUT : DROITE;
    if (disposition === 'losanges') return vertical ? (j % 2 ? BAS : HAUT) : (i % 2 ? DROITE : GAUCHE);
    if (disposition === 'sabliers') return vertical ? (j % 2 ? HAUT : BAS) : (i % 2 ? GAUCHE : DROITE);
    // Vers le centre : la pointe de chaque tuile regarde le centre du cadre.
    var dx = w / 2 - cx, dy = h / 2 - cy;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return vertical ? HAUT : DROITE;
    if (Math.abs(dx) > Math.abs(dy) + 1e-6) return dx > 0 ? DROITE : GAUCHE;
    return dy > 0 ? BAS : HAUT;
  }

  DL.enregistrer({
    id: 'vee',
    numero: '33',
    nom: 'Vee',
    famille: 'motif',
    description: 'Chevrons emboîtés en miroir : losanges, sabliers et flèches façon années 70, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#F1E6D0', '#3B2A20', '#C8553D', '#E59500', '#8C9A5B', '#2F5D62'],
    params: [
      { cle: 'tuiles', label: 'Tuiles (petit côté)', type: 'range', min: 1, max: 6, pas: 1, defaut: 2 },
      { cle: 'chevrons', label: 'Chevrons par tuile', type: 'range', min: 2, max: 20, pas: 1, defaut: 8 },
      { cle: 'ouverture', label: 'Pente des branches', type: 'range', min: 15, max: 70, pas: 1, defaut: 40, unite: '°' },
      { cle: 'disposition', label: 'Disposition', type: 'select', defaut: 'losanges', options: [
        { valeur: 'losanges', label: 'Losanges' }, { valeur: 'sabliers', label: 'Sabliers' },
        { valeur: 'fleches', label: 'Flèches' }, { valeur: 'centre', label: 'Vers le centre' }] },
      { cle: 'sens', label: 'Axe des pointes', type: 'select', defaut: 'vertical', options: [
        { valeur: 'vertical', label: 'Vertical' }, { valeur: 'horizontal', label: 'Latéral' }] },
      { cle: 'ecart', label: 'Écart entre chevrons', type: 'range', min: 0, max: 0.8, pas: 0.01, defaut: 0.3 },
      { cle: 'couleurs', label: 'Couleurs', type: 'select', defaut: 'decalees', options: [
        { valeur: 'bandes', label: 'Bandes' }, { valeur: 'tuiles', label: 'Tuiles' }, { valeur: 'decalees', label: 'Décalées' }] },
      { cle: 'arrondi', label: 'Pointes arrondies', type: 'toggle', defaut: false }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var encres = rng.shuffle(pal.slice(1));
      var L = encres.length;

      // Grille de tuiles centrée : le centre du cadre tombe sur un bord ou un milieu de tuile,
      // ce qui garde les dispositions en miroir équilibrées.
      var T = m / P.tuiles;
      var nx = Math.ceil(w / T - 1e-6), ny = Math.ceil(h / T - 1e-6);
      var ox = (w - nx * T) / 2, oy = (h - ny * T) / 2;

      var alpha = P.ouverture * Math.PI / 180;
      var k = P.chevrons, sp = T / k;
      // Épaisseur mesurée perpendiculairement aux branches : bandes régulières quelle que soit la pente.
      var ep = sp * Math.cos(alpha) * (1 - P.ecart);
      var ext = T * 0.6; // les branches débordent de la tuile, le détourage les coupe

      for (var j = 0; j < ny; j++) {
        for (var i = 0; i < nx; i++) {
          var x0 = ox + i * T, y0 = oy + j * T, cx = x0 + T / 2, cy = y0 + T / 2;
          var dir = direction(P.disposition, P.sens, i, j, cx, cy, w, h);
          var tuile = new S.Group({ insert: false });
          // Deux tuiles en miroir (losange, sablier) forment une seule figure : elles partagent
          // leur décalage de couleurs, sinon les anneaux changeraient de couleur à la jointure.
          var miroir = P.disposition === 'losanges' || P.disposition === 'sabliers';
          var gi = miroir && P.sens !== 'vertical' ? Math.floor(i / 2) : i;
          var gj = miroir && P.sens === 'vertical' ? Math.floor(j / 2) : j;
          // Paire de couleurs propre à la figure (mode « Tuiles »).
          var c1 = encres[(gi + 2 * gj) % L], c2 = encres[(gi + 2 * gj + 1 + Math.floor(L / 2)) % L];
          for (var q = 0; q < k; q++) {
            var yq = y0 + (q + 0.5) * sp, chute = (T / 2 + ext) * Math.tan(alpha);
            var couleur = P.couleurs === 'bandes' ? encres[q % L]
              : P.couleurs === 'tuiles' ? (q % 2 ? c2 : c1)
              : encres[(q + gi + gj) % L];
            tuile.addChild(new S.Path({
              segments: [[x0 - ext, yq + chute], [cx, yq], [x0 + T + ext, yq + chute]],
              strokeColor: couleur,
              strokeWidth: ep,
              strokeJoin: P.arrondi ? 'round' : 'miter',
              strokeCap: 'butt',
              miterLimit: 12,
              insert: false
            }));
          }
          tuile.rotate(dir, new S.Point(cx, cy));
          var masque = new S.Path.Rectangle({ point: [x0, y0], size: [T, T], insert: false });
          var detour = new S.Group([masque, tuile]);
          detour.clipped = true;
        }
      }
    }
  });
})();

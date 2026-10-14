/* 13 Moiré : interférences de trames superposées, en vectoriel (Paper.js, export SVG).
   Deux ou trois couches d'une même trame régulière (cercles, lignes, rayons ou spirale),
   légèrement décalées, tournées ou ondulées. Aucune n'est « dessinée » comme motif final :
   les franges de moiré naissent uniquement de la superposition. Chaque trait est un vrai
   tracé : le SVG exporté reproduit l'effet à n'importe quelle taille. */
(function () {
  'use strict';
  var DL = window.DL;

  DL.enregistrer({
    id: 'moire',
    numero: '13',
    nom: 'Moiré',
    famille: 'motif',
    description: 'Interférences de trames superposées : cercles, lignes, rayons ou spirales légèrement décalés, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 4,
    palette: ['#EDEBE4', '#141414', '#1F4BFF', '#FF3B00'],
    params: [
      { cle: 'motif', label: 'Trame', type: 'select', defaut: 'cercles', options: [
        { valeur: 'cercles', label: 'Cercles concentriques' }, { valeur: 'lignes', label: 'Lignes parallèles' },
        { valeur: 'rayons', label: 'Rayons' }, { valeur: 'spirale', label: 'Spirale' }] },
      { cle: 'couches', label: 'Couches', type: 'range', min: 2, max: 3, pas: 1, defaut: 2 },
      { cle: 'densite', label: 'Densité', type: 'range', min: 16, max: 200, pas: 2, defaut: 70 },
      { cle: 'epaisseur', label: 'Épaisseur du trait', type: 'range', min: 0.1, max: 0.9, pas: 0.01, defaut: 0.45 },
      { cle: 'decalage', label: 'Décalage', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'rotation', label: 'Rotation', type: 'range', min: 0, max: 12, pas: 0.1, defaut: 2.5, unite: '°' },
      { cle: 'ondulation', label: 'Ondulation', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.15 },
      { cle: 'surimpression', label: 'Surimpression (multiply)', type: 'toggle', defaut: true }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h), cx = w / 2, cy = h / 2;
      var R = Math.sqrt(w * w + h * h) / 2 * 1.08;
      var pasPoint = m * 0.012; // finesse des tracés ondulés : relative, donc identique à toute taille
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });

      for (var l = 0; l < P.couches; l++) {
        var r = rng.fork('couche' + l);
        var couleur = pal[1 + (l % (pal.length - 1))];
        // La couche 0 sert de référence ; les suivantes sont décalées et tournées.
        var dx = l ? (r() - 0.5) * P.decalage * m * 0.25 : 0;
        var dy = l ? (r() - 0.5) * P.decalage * m * 0.25 : 0;
        var rot = l * P.rotation * Math.PI / 180 * (r.chance(0.5) ? 1 : -1);
        var echelle = l ? 1 + (r() - 0.5) * 0.05 * P.decalage : 1;
        var ox = cx + dx, oy = cy + dy;
        var kOnde = r.int(3, 9), phOnde = r.range(0, 6.28), lgOnde = m * r.range(0.15, 0.4);
        var groupe = new S.Group();
        if (P.surimpression && l > 0) groupe.blendMode = 'multiply';
        var cr = Math.cos(rot), sr = Math.sin(rot);
        // Repère de la couche : rotation + échelle autour de son centre.
        var T = function (x, y) { return [ox + (x * cr - y * sr) * echelle, oy + (x * sr + y * cr) * echelle]; };

        if (P.motif === 'cercles') {
          var pas = R / P.densite, amp = P.ondulation * pas * 1.5;
          for (var i = 1; i <= P.densite; i++) {
            var rr = i * pas, chemin;
            if (amp === 0) chemin = new S.Path.Circle({ center: T(0, 0), radius: rr * echelle });
            else {
              var nP = Math.max(48, Math.ceil(2 * Math.PI * rr / pasPoint)), pts = [];
              for (var k = 0; k < nP; k++) {
                var a = 2 * Math.PI * k / nP, rad = rr + amp * Math.sin(kOnde * a + phOnde);
                pts.push(T(rad * Math.cos(a), rad * Math.sin(a)));
              }
              chemin = new S.Path({ segments: pts, closed: true });
            }
            chemin.strokeColor = couleur;
            chemin.strokeWidth = pas * P.epaisseur;
            groupe.addChild(chemin);
          }
        } else if (P.motif === 'lignes') {
          var pasL = 2 * R / P.densite, ampL = P.ondulation * pasL * 2;
          for (var j = -P.densite / 2; j <= P.densite / 2; j++) {
            var off = j * pasL, ptsL = [];
            var nL = ampL === 0 ? 1 : Math.ceil(2 * R / pasPoint);
            for (var q = 0; q <= nL; q++) {
              var t = -R + 2 * R * q / nL;
              ptsL.push(T(t, off + ampL * Math.sin(t / lgOnde * 2 * Math.PI + phOnde)));
            }
            groupe.addChild(new S.Path({ segments: ptsL, strokeColor: couleur, strokeWidth: pasL * P.epaisseur }));
          }
        } else if (P.motif === 'rayons') {
          // Rayons = secteurs fins pleins ; l'ondulation les courbe en fonction du rayon.
          var n = Math.round(P.densite * 2), dA = 2 * Math.PI / n, demi = dA * P.epaisseur / 2;
          var nR = P.ondulation === 0 ? 1 : 40;
          for (var s = 0; s < n; s++) {
            var a0 = s * dA, gauche = [], droite = [];
            for (var z = 0; z <= nR; z++) {
              var rz = R * 1.2 * z / nR, courbe = P.ondulation * 0.6 * Math.sin(rz / lgOnde * 2 * Math.PI + phOnde);
              gauche.push(T(rz * Math.cos(a0 - demi + courbe), rz * Math.sin(a0 - demi + courbe)));
              droite.unshift(T(rz * Math.cos(a0 + demi + courbe), rz * Math.sin(a0 + demi + courbe)));
            }
            groupe.addChild(new S.Path({ segments: gauche.concat(droite), closed: true, fillColor: couleur }));
          }
        } else {
          // Spirale d'Archimède : l'écart entre spires joue le rôle du pas de trame.
          var pasS = R / (P.densite / 2), tours = R / pasS, ptsS = [];
          var ampS = P.ondulation * pasS;
          var sens = l % 2 ? -1 : 1, th = 0, thMax = tours * 2 * Math.PI;
          while (th <= thMax) {
            var rs = pasS * th / (2 * Math.PI) + ampS * Math.sin(kOnde * th / 6 + phOnde);
            ptsS.push(T(rs * Math.cos(sens * th), rs * Math.sin(sens * th)));
            th += Math.max(0.02, pasPoint / Math.max(rs, pasPoint));
          }
          groupe.addChild(new S.Path({ segments: ptsS, strokeColor: couleur, strokeWidth: pasS * P.epaisseur }));
        }
      }
    }
  });
})();

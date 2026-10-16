/* 26 Gloop : formes liquides en métaballes (Paper.js, export SVG).
   Des gouttes invisibles émettent chacune un champ à portée limitée (noyau (1 - d²/4r²)²) ; le contour où ce champ
   atteint un seuil est extrait par « marching squares », puis lissé en courbes de Bézier.
   Les gouttes proches fusionnent comme du mercure. Plusieurs niveaux du champ donnent des
   contours imbriqués (goo topographique), plusieurs couches empilent des flaques de couleurs.
   La grille de calcul est fixe en nombre de cases par min(w, h) : le SVG ne dépend pas de la taille. */
(function () {
  'use strict';
  var DL = window.DL;

  var CASES = 170; // résolution du champ sur le petit côté

  // Contours iso d'un champ échantillonné (nx × ny nœuds, pas en px) au seuil T.
  // Renvoie des boucles fermées de points [x, y] (les bords du champ sont forcés à 0).
  function isoContours(F, nx, ny, pas, ox, oy, T) {
    var segs = [];
    function v(i, j) { return F[j * nx + i]; }
    // Point sur l'arête entre deux nœuds, par interpolation linéaire. Clé = arête unique.
    function pt(i0, j0, i1, j1) {
      var a = v(i0, j0), b = v(i1, j1), t = (T - a) / (b - a);
      return { x: ox + (i0 + (i1 - i0) * t) * pas, y: oy + (j0 + (j1 - j0) * t) * pas,
        k: (i0 === i1 ? 'v' : 'h') + Math.min(i0, i1) + '_' + Math.min(j0, j1) };
    }
    for (var j = 0; j < ny - 1; j++) for (var i = 0; i < nx - 1; i++) {
      var c = (v(i, j) > T ? 8 : 0) | (v(i + 1, j) > T ? 4 : 0) | (v(i + 1, j + 1) > T ? 2 : 0) | (v(i, j + 1) > T ? 1 : 0);
      if (c === 0 || c === 15) continue;
      var haut = function () { return pt(i, j, i + 1, j); }, droite = function () { return pt(i + 1, j, i + 1, j + 1); };
      var bas = function () { return pt(i, j + 1, i + 1, j + 1); }, gauche = function () { return pt(i, j, i, j + 1); };
      var centre = (v(i, j) + v(i + 1, j) + v(i + 1, j + 1) + v(i, j + 1)) / 4 > T;
      switch (c) {
        case 1: case 14: segs.push([gauche(), bas()]); break;
        case 2: case 13: segs.push([bas(), droite()]); break;
        case 3: case 12: segs.push([gauche(), droite()]); break;
        case 4: case 11: segs.push([haut(), droite()]); break;
        case 6: case 9: segs.push([haut(), bas()]); break;
        case 7: case 8: segs.push([gauche(), haut()]); break;
        // Cas ambigus : le centre de la case décide si les deux coins se rejoignent.
        case 5: if (centre) { segs.push([gauche(), haut()]); segs.push([bas(), droite()]); } else { segs.push([gauche(), bas()]); segs.push([haut(), droite()]); } break;
        case 10: if (centre) { segs.push([haut(), droite()]); segs.push([gauche(), bas()]); } else { segs.push([gauche(), haut()]); segs.push([bas(), droite()]); } break;
      }
    }
    // Chaînage des segments par leurs arêtes communes.
    var parCle = {};
    segs.forEach(function (s, idx) { [s[0].k, s[1].k].forEach(function (k) { (parCle[k] = parCle[k] || []).push(idx); }); });
    var pris = new Uint8Array(segs.length), boucles = [];
    for (var s0 = 0; s0 < segs.length; s0++) {
      if (pris[s0]) continue;
      pris[s0] = 1;
      var boucle = [segs[s0][0], segs[s0][1]], fin = segs[s0][1].k;
      for (var garde = 0; garde < segs.length; garde++) {
        var suite = (parCle[fin] || []).filter(function (x) { return !pris[x]; })[0];
        if (suite === undefined) break;
        pris[suite] = 1;
        var sg = segs[suite], prochain = sg[0].k === fin ? sg[1] : sg[0];
        fin = prochain.k;
        if (fin === boucle[0].k) break;
        boucle.push(prochain);
      }
      if (boucle.length > 3) boucles.push(boucle);
    }
    return boucles;
  }

  DL.enregistrer({
    id: 'gloop',
    numero: '26',
    nom: 'Gloop',
    famille: 'vecteur',
    description: 'Formes liquides en métaballes : gouttes qui fusionnent, coulures et contours imbriqués, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#EDEBE4', '#141414', '#C6FF00', '#FF4FA3', '#2E5BFF'],
    params: [
      { cle: 'mode', label: 'Disposition', type: 'select', defaut: 'flaque', options: [
        { valeur: 'flaque', label: 'Flaques' }, { valeur: 'coulure', label: 'Coulures' }, { valeur: 'chaine', label: 'Chaîne' }] },
      { cle: 'gouttes', label: 'Gouttes', type: 'range', min: 3, max: 60, pas: 1, defaut: 16 },
      { cle: 'taille', label: 'Taille', type: 'range', min: 0.02, max: 0.25, pas: 0.005, defaut: 0.065 },
      { cle: 'fusion', label: 'Fusion', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'contours', label: 'Contours imbriqués', type: 'range', min: 1, max: 6, pas: 1, defaut: 2 },
      { cle: 'couches', label: 'Couches', type: 'range', min: 1, max: 3, pas: 1, defaut: 2 },
      { cle: 'ombre', label: 'Ombre dure', type: 'toggle', defaut: true },
      { cle: 'reflets', label: 'Reflets', type: 'toggle', defaut: true }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h), encres = pal.slice(2).length ? pal.slice(2) : pal.slice(1);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var pas = m / CASES, marge = pas * 2;
      var nx = Math.ceil((w + 2 * marge) / pas) + 1, ny = Math.ceil((h + 2 * marge) / pas) + 1;
      // Seuil : une goutte seule a un contour de rayon ~r à 0,56 ; plus de fusion = seuil bas = ponts plus épais.
      var T = 0.75 - P.fusion * 0.45;
      var tol = m * 0.0012;

      for (var c = 0; c < P.couches; c++) {
        var r = rng.fork('couche' + c), balles = [];
        var R0 = m * P.taille / Math.sqrt(1 + c * 0.6);
        if (P.mode === 'flaque') {
          // Amas : quelques centres, gouttes dispersées autour.
          var amas = [];
          for (var a = 0, na = r.int(2, 5); a < na; a++) amas.push([r.range(0.2, 0.8) * w, r.range(0.2, 0.8) * h]);
          for (var g = 0; g < P.gouttes; g++) {
            var cen = r.pick(amas);
            balles.push([cen[0] + r.gauss(0, m * 0.13), cen[1] + r.gauss(0, m * 0.13), R0 * r.range(0.5, 1.4)]);
          }
        } else if (P.mode === 'coulure') {
          // Coulures : une ligne de gouttes en haut, chaque goutte file vers le bas en s'amincissant.
          var filets = Math.max(2, Math.round(P.gouttes / 5));
          for (var f = 0; f < filets; f++) {
            var fx = (f + 0.5 + r.range(-0.3, 0.3)) / filets * w, L = r.range(0.25, 0.95) * h;
            balles.push([fx, -R0 * 0.5, R0 * 1.6]);
            var n = Math.max(3, Math.round(L / (R0 * 0.6)));
            for (var k = 0; k < n; k++) {
              var t = k / n;
              balles.push([fx + Math.sin(t * 6 + f) * R0 * 0.15, t * L, R0 * (0.85 - 0.45 * t)]);
            }
            balles.push([fx, L + R0 * 0.4, R0 * 0.9]); // goutte pendante au bout
          }
        } else {
          // Chaîne : gouttes le long d'une courbe de Lissajous, tailles en vague.
          var A = r.int(1, 3), B = r.int(1, 4), ph = r.range(0, Math.PI);
          for (var q = 0; q < P.gouttes; q++) {
            var u = q / P.gouttes * 2 * Math.PI;
            balles.push([w / 2 + Math.sin(A * u + ph) * w * 0.36, h / 2 + Math.sin(B * u) * h * 0.36, R0 * (0.7 + 0.5 * Math.sin(u * 3 + ph))]);
          }
        }

        var F = new Float32Array(nx * ny);
        for (var j = 1; j < ny - 1; j++) for (var i = 1; i < nx - 1; i++) {
          var x = -marge + i * pas, y = -marge + j * pas, s = 0;
          for (var b = 0; b < balles.length; b++) {
            var dx = x - balles[b][0], dy = y - balles[b][1];
            // Noyau à support borné (portée 2r) : les gouttes éloignées ne s’influencent pas.
            var k = 1 - (dx * dx + dy * dy) / (4 * balles[b][2] * balles[b][2]);
            if (k > 0) s += k * k;
          }
          F[j * nx + i] = s;
        }

        var cols = r.shuffle(encres);
        for (var lv = 0; lv < P.contours; lv++) {
          var boucles = isoContours(F, nx, ny, pas, -marge, -marge, T + (0.97 - T) * lv / P.contours);
          if (!boucles.length) break;
          var forme = new S.CompoundPath({
            children: boucles.map(function (bl) {
              var p = new S.Path({ segments: bl.map(function (o) { return [o.x, o.y]; }), closed: true });
              p.simplify(tol);
              return p;
            }),
            fillRule: 'evenodd', fillColor: cols[(lv + c) % cols.length]
          });
          if (lv === 0 && P.ombre) {
            var om = forme.clone();
            om.fillColor = pal[1];
            om.translate([m * 0.012, m * 0.012]);
            om.insertBelow(forme);
          }
        }
        // Reflets : petits traits clairs en haut à gauche des grosses gouttes de la dernière couche.
        // Seulement les trois plus grosses : au-delà, les reflets ressemblent à des confettis.
        if (P.reflets && c === P.couches - 1) {
          balles.slice().sort(function (p, q) { return q[2] - p[2]; }).slice(0, 3).forEach(function (bl) {
            var e = new S.Path.Ellipse({ center: [bl[0] - bl[2] * 0.42, bl[1] - bl[2] * 0.42], radius: [bl[2] * 0.34, bl[2] * 0.12], fillColor: pal[0] });
            e.rotate(-45);
            new S.Path.Circle({ center: [bl[0] - bl[2] * 0.02, bl[1] - bl[2] * 0.72], radius: bl[2] * 0.07, fillColor: pal[0] });
          });
        }
      }
    }
  });
})();

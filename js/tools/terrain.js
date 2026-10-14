/* 02 Terrain : paysages en courbes de niveau superposées (p5.js + bruit seedé).
   Un relief fbm (avec légère déformation de domaine) est échantillonné sur une grille de
   résolution fixe relative à l'image, puis :
   - les aplats sont calculés par pixel en interpolant la grille (bords lisses à toute taille) ;
   - chaque palier projette une ombre dure sur le palier inférieur, comme des feuilles découpées
     empilées ;
   - les courbes de niveau sont tracées par marching squares sur la même grille. */
(function () {
  'use strict';
  var DL = window.DL;
  var RESOLUTION = 420; // cellules de grille sur le petit côté, indépendant de la taille d'export

  DL.enregistrer({
    id: 'terrain',
    numero: '02',
    nom: 'Terrain',
    famille: 'champ',
    description: 'Paysages en courbes de niveau superposées : paliers découpés, ombres portées, lignes topographiques.',
    libs: ['p5.js', 'bruit simplex'],
    moteur: 'p5',
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#E9DCC9', '#3B2F2F', '#C1502E', '#E08E45', '#7A9E7E'],
    params: [
      { cle: 'echelle', label: 'Échelle du relief', type: 'range', min: 0.5, max: 8, pas: 0.1, defaut: 2.2 },
      { cle: 'niveaux', label: 'Niveaux', type: 'range', min: 3, max: 32, pas: 1, defaut: 12 },
      { cle: 'octaves', label: 'Complexité', type: 'range', min: 1, max: 7, pas: 1, defaut: 5 },
      { cle: 'deformation', label: 'Déformation', type: 'range', min: 0, max: 1.5, pas: 0.05, defaut: 0.4 },
      { cle: 'contraste', label: 'Contraste', type: 'range', min: 0.4, max: 2.5, pas: 0.05, defaut: 1 },
      { cle: 'ombre', label: 'Ombre portée', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'angle', label: 'Angle de lumière', type: 'range', min: 0, max: 360, pas: 1, defaut: 135, unite: '°' },
      { cle: 'trait', label: 'Épaisseur des courbes', type: 'range', min: 0, max: 6, pas: 0.1, defaut: 1.2 }
    ],

    render: function (p, w, h, P, rng, pal) {
      var ctx = p.drawingContext, m = Math.min(w, h);
      var bruit = DL.creerBruit(rng);
      var L = P.niveaux;
      var pas = m / RESOLUTION;
      var gw = Math.ceil(w / pas) + 2, gh = Math.ceil(h / pas) + 2;
      var grille = new Float32Array(gw * gh);
      var ox = rng.range(-50, 50), oy = rng.range(-50, 50);

      // Champ d'altitude dans [0,1], en coordonnées relatives au petit côté.
      for (var j = 0; j < gh; j++) {
        for (var i = 0; i < gw; i++) {
          var x = (i * pas) / m * P.echelle + ox, y = (j * pas) / m * P.echelle + oy;
          var wx = bruit.n2(x * 0.7 + 3.1, y * 0.7) * P.deformation, wy = bruit.n2(x * 0.7, y * 0.7 + 7.7) * P.deformation;
          var v = bruit.fbm2(x + wx, y + wy, P.octaves, 2, 0.5) * 0.5 + 0.5;
          v = DL.clamp((v - 0.5) * P.contraste * 1.5 + 0.5, 0, 0.9999);
          grille[j * gw + i] = v;
        }
      }

      function alt(px, py) {
        var gx = px / pas, gy = py / pas;
        var i0 = gx | 0, j0 = gy | 0;
        if (i0 < 0) i0 = 0; if (j0 < 0) j0 = 0;
        if (i0 > gw - 2) i0 = gw - 2; if (j0 > gh - 2) j0 = gh - 2;
        var fx = gx - i0, fy = gy - j0, k = j0 * gw + i0;
        var a = grille[k], b = grille[k + 1], c = grille[k + gw], d = grille[k + gw + 1];
        return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
      }

      // Couleur par palier : interpolation Lab du fond vers les encres (pas de teintes boueuses).
      var cols = chroma.scale(pal.slice()).mode('lab').colors(L, 'rgb');
      var ombreF = 1 - 0.32 * Math.min(1, P.ombre * 2);
      var a = P.angle * Math.PI / 180, dist = P.ombre * m * 0.014;
      var sx = Math.cos(a) * dist, sy = Math.sin(a) * dist;

      var img = ctx.createImageData(w, h), d = img.data;
      for (var y2 = 0; y2 < h; y2++) {
        for (var x2 = 0; x2 < w; x2++) {
          var niv = (alt(x2 + 0.5, y2 + 0.5) * L) | 0;
          var c3 = cols[niv], f = 1;
          // Ombre : le palier « en amont de la lumière » est plus haut → on est dans son ombre.
          if (dist > 0) {
            var nivS = (alt(x2 + 0.5 - sx, y2 + 0.5 - sy) * L) | 0;
            if (nivS > niv) f = ombreF;
          }
          var o = (y2 * w + x2) * 4;
          d[o] = c3[0] * f; d[o + 1] = c3[1] * f; d[o + 2] = c3[2] * f;
          d[o + 3] = pal.transparent && niv === 0 ? 0 : 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Courbes de niveau : marching squares, un seul chemin par niveau.
      if (P.trait > 0) {
        ctx.strokeStyle = DL.encrePrincipale(pal);
        ctx.lineWidth = P.trait * m / 1000;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (var n = 1; n < L; n++) {
          var t = n / L;
          ctx.beginPath();
          for (var gj = 0; gj < gh - 1; gj++) {
            for (var gi = 0; gi < gw - 1; gi++) {
              var k = gj * gw + gi;
              var v0 = grille[k], v1 = grille[k + 1], v2 = grille[k + gw + 1], v3 = grille[k + gw];
              var cas = (v0 > t ? 8 : 0) | (v1 > t ? 4 : 0) | (v2 > t ? 2 : 0) | (v3 > t ? 1 : 0);
              if (cas === 0 || cas === 15) continue;
              var X = gi * pas, Y = gj * pas;
              // Points d'intersection sur les 4 arêtes (haut, droite, bas, gauche).
              var hx = X + pas * (t - v0) / (v1 - v0), hy = Y;
              var dx = X + pas, dy = Y + pas * (t - v1) / (v2 - v1);
              var bx = X + pas * (t - v3) / (v2 - v3), by = Y + pas;
              var lx = X, ly = Y + pas * (t - v0) / (v3 - v0);
              switch (cas) {
                case 1: case 14: ctx.moveTo(lx, ly); ctx.lineTo(bx, by); break;
                case 2: case 13: ctx.moveTo(bx, by); ctx.lineTo(dx, dy); break;
                case 3: case 12: ctx.moveTo(lx, ly); ctx.lineTo(dx, dy); break;
                case 4: case 11: ctx.moveTo(hx, hy); ctx.lineTo(dx, dy); break;
                case 5: ctx.moveTo(lx, ly); ctx.lineTo(hx, hy); ctx.moveTo(bx, by); ctx.lineTo(dx, dy); break;
                case 6: case 9: ctx.moveTo(hx, hy); ctx.lineTo(bx, by); break;
                case 7: case 8: ctx.moveTo(lx, ly); ctx.lineTo(hx, hy); break;
                case 10: ctx.moveTo(hx, hy); ctx.lineTo(dx, dy); ctx.moveTo(lx, ly); ctx.lineTo(bx, by); break;
              }
            }
          }
          ctx.stroke();
        }
      }
    }
  });
})();

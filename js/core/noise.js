/* DesignLab : bruit simplex seedé (2D et 3D) et fbm.
   Pourquoi maison : p5.noise() partage un seul état entre toutes les instances p5 de la page
   (aperçu, vignettes, export), et simplex-noise 4.x n'existe qu'en module ES (interdit en file://).
   Ici chaque appel à DL.creerBruit(rng) a sa propre table de permutation, tirée du rng du rendu. */
(function () {
  'use strict';
  var DL = window.DL;

  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  var F3 = 1 / 3, G3 = 1 / 6;
  // 12 directions de gradient (milieux des arêtes d'un cube) : réparties uniformément, pas d'axe privilégié.
  var GRAD = new Float32Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);

  DL.creerBruit = function (rng) {
    var p = new Uint8Array(256), perm = new Uint8Array(512), perm12 = new Uint8Array(512);
    for (var i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; perm12[i] = perm[i] % 12; }

    // Simplex 2D : renvoie environ [-1, 1].
    function n2(x, y) {
      var s = (x + y) * F2;
      var i = Math.floor(x + s), j = Math.floor(y + s);
      var t = (i + j) * G2;
      var x0 = x - (i - t), y0 = y - (j - t);
      var i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      var ii = i & 255, jj = j & 255, n = 0, g, tt;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = perm12[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = perm12[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = perm12[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2); }
      return 70 * n;
    }

    // Simplex 3D : la 3e dimension sert de « temps » ou de décalage entre couches.
    function n3(x, y, z) {
      var s = (x + y + z) * F3;
      var i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      var t = (i + j + k) * G3;
      var x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
      var i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      var x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, g, tt;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { g = perm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x0 + GRAD[g + 1] * y0 + GRAD[g + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { g = perm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x1 + GRAD[g + 1] * y1 + GRAD[g + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { g = perm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x2 + GRAD[g + 1] * y2 + GRAD[g + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { g = perm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (GRAD[g] * x3 + GRAD[g + 1] * y3 + GRAD[g + 2] * z3); }
      return 32 * n;
    }

    // Somme d'octaves normalisée dans [-1, 1] : grandes formes + détails.
    function fbm2(x, y, octaves, lacunarite, gain) {
      octaves = octaves || 4; lacunarite = lacunarite || 2; gain = gain || 0.5;
      var somme = 0, amp = 1, norme = 0, f = 1;
      for (var o = 0; o < octaves; o++) {
        // Décalage par octave : évite que toutes les octaves aient un « nœud » commun à l'origine.
        somme += amp * n2(x * f + o * 17.3, y * f - o * 9.1);
        norme += amp; amp *= gain; f *= lacunarite;
      }
      return somme / norme;
    }

    function fbm3(x, y, z, octaves, lacunarite, gain) {
      octaves = octaves || 4; lacunarite = lacunarite || 2; gain = gain || 0.5;
      var somme = 0, amp = 1, norme = 0, f = 1;
      for (var o = 0; o < octaves; o++) {
        somme += amp * n3(x * f + o * 17.3, y * f - o * 9.1, z * f + o * 3.7);
        norme += amp; amp *= gain; f *= lacunarite;
      }
      return somme / norme;
    }

    return { n2: n2, n3: n3, fbm2: fbm2, fbm3: fbm3 };
  };

  // Utilitaires numériques partagés par les outils.
  DL.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  DL.lerp = function (a, b, t) { return a + (b - a) * t; };
  DL.smooth = function (a, b, v) { var t = DL.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Hash entier → [0,1) sans état : grain par pixel identique quelle que soit la découpe en tuiles.
  DL.hash2 = function (x, y, s) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
})();

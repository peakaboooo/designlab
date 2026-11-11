/* 35 Totem : mâts de créatures en pixels, symétriques (canvas 2D).
   Chaque colonne est une pile de modules : un sommet (cornes ou tête), des têtes, des ailes,
   des corps, et un socle. Un module est tiré dans une demi-grille sous un gabarit propre à son
   genre (ovale pour une tête, plumes en escalier pour des ailes…), lissé par un automate
   cellulaire comme dans Fold, puis reflété autour de l'axe : la symétrie suffit à donner des
   créatures. Yeux, bouches, rayures et contour sont posés ensuite. Grille de pixels de taille
   relative au cadre : l'export HD redonne la même image, en plus net. */
(function () {
  'use strict';
  var DL = window.DL;

  // Valeurs de cellule : 0 vide, 1 corps, 2 motif, 3 blanc de l'œil, 4 pupille ou bouche.
  // Gabarits : demi-largeur maximale (0 à 1) selon la hauteur relative t (0 en haut, 1 en bas).
  var GABARITS = {
    cornes: function (t, x) {
      // Deux pointes vers l'extérieur sur une couronne.
      if (t > 0.55) return x < 0.75;
      var pointe = 0.55 + 0.3 * (1 - t / 0.55);
      return Math.abs(x - pointe) < 0.16 + 0.2 * (t / 0.55) || x < 0.18 * (t / 0.55);
    },
    tete: function (t, x) {
      var e = 2 * t - 1;
      return x < 0.12 + 0.82 * Math.sqrt(Math.max(0, 1 - e * e * e * e));
    },
    ailes: function (t, x) {
      // Plumes : rangées de longueurs inégales, plus longues en haut.
      var rang = Math.floor(t * 6);
      return x < 0.35 + (0.65 - 0.1 * rang) * (rang % 2 ? 0.82 : 1) && t < 0.92;
    },
    corps: function (t, x) {
      return x < 0.5 + 0.12 * Math.sin(t * Math.PI);
    },
    socle: function (t, x) {
      return x < 0.42 + 0.5 * t;
    }
  };

  function voisins(g, W, H, i, j) {
    var v = 0;
    for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      var x = i + di, y = j + dj;
      if (x >= 0 && y >= 0 && x < W && y < H && g[y * W + x]) v++;
    }
    return v;
  }

  /* Un module de hauteur hm et de demi-largeur hw (colonne 0 = axe), renvoyé sous forme de
     demi-grille de valeurs (voir plus haut). La colonne de l'axe est pleine au centre du module :
     la pile reste d'un seul tenant. */
  function module(genre, hw, hm, r, P) {
    var g = new Uint8Array(hw * hm), gab = GABARITS[genre];
    for (var j = 0; j < hm; j++) {
      var t = hm > 1 ? j / (hm - 1) : 0.5;
      for (var i = 0; i < hw; i++) {
        var x = (i + 0.5) / hw;
        if (!gab(t, x)) continue;
        g[j * hw + i] = i === 0 && t > 0.15 && t < 0.85 ? 1 : (r() < P.densite ? 1 : 0);
      }
    }
    // Lissage : bouche les trous, retire les pixels isolés. Le bord de l'axe compte comme miroir.
    for (var it = 0; it < P.lissage; it++) {
      var g2 = new Uint8Array(hw * hm);
      for (j = 0; j < hm; j++) for (i = 0; i < hw; i++) {
        var n = voisins(g, hw, hm, i, j);
        if (i === 0) n += (j > 0 ? g[(j - 1) * hw] : 0) + g[j * hw] + (j < hm - 1 ? g[(j + 1) * hw] : 0);
        var t2 = hm > 1 ? j / (hm - 1) : 0.5;
        g2[j * hw + i] = gab(t2, (i + 0.5) / hw) && (n >= 5 || (g[j * hw + i] && n >= 4)) ? 1 : 0;
      }
      g = g2;
    }
    // Motif sur le corps : rayures, damier ou bord intérieur.
    var motif = r.pick(['rayures', 'damier', 'bord', 'aucun']);
    for (j = 0; j < hm; j++) for (i = 0; i < hw; i++) {
      if (!g[j * hw + i]) continue;
      var bord = voisins(g, hw, hm, i, j) < 8 && i > 0;
      if ((motif === 'rayures' && j % 3 === 1) || (motif === 'damier' && (i + j) % 2 === 0 && i % 3 !== 0) || (motif === 'bord' && bord)) {
        g[j * hw + i] = 2;
      }
    }
    // Yeux (blanc + pupille) et bouche.
    var chanceYeux = genre === 'tete' ? Math.min(1, P.yeux * 1.6) : P.yeux * 0.5;
    // L'œil se pose seulement sur des pixels pleins : jamais d'œil qui flotte à côté du corps.
    if (genre !== 'socle' && hw >= 3 && hm >= 4 && r.chance(chanceYeux)) {
      var ey = Math.max(1, Math.round(hm * r.range(0.25, 0.45)));
      var taille = hw >= 6 && hm >= 7 && r.chance(0.5) ? 2 : 1;
      var places = [];
      for (var xx = 1; xx + taille <= hw; xx++) {
        var plein = true;
        for (var yy = ey; yy < ey + taille; yy++) for (var x2 = xx; x2 < xx + taille; x2++) {
          if (yy >= hm || !g[yy * hw + x2]) plein = false;
        }
        if (plein) places.push(xx);
      }
      if (places.length) {
        var ex = r.pick(places);
        for (yy = ey; yy < ey + taille; yy++) for (xx = ex; xx < ex + taille; xx++) g[yy * hw + xx] = 3;
        g[(ey + taille - 1) * hw + ex] = 4; // pupille en bas, côté axe : regard vers le centre
        if (genre === 'tete' && hm >= 6) {
          var by = Math.min(hm - 2, ey + taille + r.int(1, 2)), bl = r.int(1, Math.max(1, hw - 2));
          var dents = r.chance(0.4);
          for (xx = 0; xx <= bl; xx++) if (g[by * hw + xx]) g[by * hw + xx] = dents && xx % 2 ? 3 : 4;
        }
      }
    }
    return g;
  }

  // Pile de genres d'une colonne : sommet, milieu varié (au moins une tête), socle.
  function pile(n, r) {
    if (n <= 1) return ['tete'];
    var genres = [r.chance(0.55) ? 'cornes' : 'tete'];
    var milieu = ['tete', 'ailes', 'corps', 'corps', 'ailes'];
    for (var k = 1; k < n - 1; k++) genres.push(r.pick(milieu));
    if (genres.indexOf('tete') < 0) genres[Math.min(genres.length - 1, 1)] = 'tete';
    genres.push('socle');
    return genres;
  }
  var POIDS = { cornes: 0.7, tete: 1.1, ailes: 0.9, corps: 1.15, socle: 0.6 };

  DL.enregistrer({
    id: 'totem',
    numero: '35',
    nom: 'Totem',
    famille: 'pixel',
    description: 'Mâts de créatures en pixels : modules symétriques empilés, avec yeux, ailes et cornes.',
    libs: ['Canvas 2D', 'chroma.js'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#1D1A2F', '#0B0A12', '#F25C54', '#F7B267', '#4ECDC4', '#C7F464'],
    params: [
      { cle: 'colonnes', label: 'Colonnes', type: 'range', min: 1, max: 6, pas: 1, defaut: 3 },
      { cle: 'resolution', label: 'Pixels (petit côté)', type: 'range', min: 32, max: 128, pas: 2, defaut: 64 },
      { cle: 'modules', label: 'Modules par colonne', type: 'range', min: 2, max: 8, pas: 1, defaut: 5 },
      { cle: 'densite', label: 'Densité', type: 'range', min: 0.3, max: 0.8, pas: 0.01, defaut: 0.56 },
      { cle: 'lissage', label: 'Lissage', type: 'range', min: 0, max: 4, pas: 1, defaut: 1 },
      { cle: 'yeux', label: 'Yeux', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.65 },
      { cle: 'miroir', label: 'Symétrie', type: 'select', defaut: 'simple', options: [
        { valeur: 'simple', label: 'Miroir' }, { valeur: 'quatre', label: 'Quatre' }] },
      { cle: 'contour', label: 'Contour', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h), cel = m / P.resolution;
      var GW = Math.ceil(w / cel), GH = Math.ceil(h / cel);
      var grille = new Uint8Array(GW * GH).fill(255); // 255 = vide
      var C = P.colonnes, ecart = 2, marge = 2;
      var largeurCol = Math.floor((GW - (C + 1) * ecart) / C);
      var hw = Math.max(2, Math.floor((largeurCol - 1) / 2)); // largeur pleine = 2 hw − 1 (+ contour)
      var dispo = GH - 2 * marge;
      var corps = pal.slice(2).map(function (_, i) { return i + 2; });
      if (!corps.length) corps = [1];
      // Blanc de l'œil : la couleur la plus claire de la palette (le fond peut être sombre).
      var blanc = 0;
      pal.forEach(function (c, i) { if (chroma(c).luminance() > chroma(pal[blanc]).luminance()) blanc = i; });

      for (var c = 0; c < C; c++) {
        var r = rng.fork('colonne' + c);
        var genres = pile(Math.max(1, Math.min(P.modules, Math.floor(dispo / 4))), r);
        // Hauteurs : poids par genre, un peu de variété, arrondis puis ajustés pour remplir.
        var poids = genres.map(function (g) { return POIDS[g] * r.range(0.75, 1.3); });
        var total = poids.reduce(function (a, b) { return a + b; }, 0);
        var hauteurs = poids.map(function (p) { return Math.max(4, Math.floor(dispo * p / total)); });
        var reste = dispo - hauteurs.reduce(function (a, b) { return a + b; }, 0);
        for (var q = 0; reste > 0; q = (q + 1) % hauteurs.length, reste--) hauteurs[q]++;
        var x0 = Math.round((GW - (C * largeurCol + (C - 1) * ecart)) / 2) + c * (largeurCol + ecart);
        var axe = x0 + Math.floor(largeurCol / 2);
        var y = marge;
        genres.forEach(function (genre, k) {
          var hm = hauteurs[k], rm = r.fork('m' + k);
          var largeurModule = genre === 'ailes' ? hw : genre === 'corps' ? Math.max(2, Math.round(hw * 0.75)) : Math.max(2, Math.round(hw * rm.range(0.7, 0.95)));
          var g = module(genre, largeurModule, hm, rm, P);
          var principale = rm.pick(corps), motif = rm.pick(corps.length > 1 ? corps.filter(function (x) { return x !== principale; }) : corps);
          for (var j = 0; j < hm; j++) {
            // Symétrie « quatre » : le module est aussi reflété de haut en bas.
            var sj = P.miroir === 'quatre' ? Math.min(j, hm - 1 - j) : j;
            for (var i = 0; i < largeurModule; i++) {
              var v = g[sj * largeurModule + i];
              if (!v) continue;
              var couleur = v === 1 ? principale : v === 2 ? motif : v === 3 ? blanc : 1;
              var gy = y + j;
              if (gy < 0 || gy >= GH) continue;
              [axe + i, axe - i].forEach(function (gx) { if (gx >= 0 && gx < GW) grille[gy * GW + gx] = couleur; });
            }
          }
          y += hm;
        });
      }

      // Contour : pixel vide qui touche un pixel plein (voisinage de 4) → encre de trait.
      if (P.contour) {
        var contour = [];
        for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) {
          if (grille[gy * GW + gx] !== 255) continue;
          if ((gx > 0 && grille[gy * GW + gx - 1] !== 255) || (gx < GW - 1 && grille[gy * GW + gx + 1] !== 255) ||
            (gy > 0 && grille[(gy - 1) * GW + gx] !== 255) || (gy < GH - 1 && grille[(gy + 1) * GW + gx] !== 255)) contour.push(gy * GW + gx);
        }
        contour.forEach(function (o) { grille[o] = 1; });
      }

      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      // Dessin par plages de même couleur, grille centrée.
      var ox = (w - GW * cel) / 2, oy = (h - GH * cel) / 2;
      for (gy = 0; gy < GH; gy++) {
        var ya = Math.round(oy + gy * cel), yb = Math.round(oy + (gy + 1) * cel);
        for (gx = 0; gx < GW;) {
          var v = grille[gy * GW + gx], x2 = gx + 1;
          while (x2 < GW && grille[gy * GW + x2] === v) x2++;
          if (v !== 255) {
            var xa = Math.round(ox + gx * cel), xb = Math.round(ox + x2 * cel);
            ctx.fillStyle = pal[v];
            ctx.fillRect(xa, ya, xb - xa, yb - ya);
          }
          gx = x2;
        }
      }
    }
  });
})();

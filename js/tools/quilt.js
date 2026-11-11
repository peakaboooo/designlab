/* 31 Quilt : couvertures en patchwork, en pixels (canvas 2D).
   La couverture est une grille de blocs carrés, chacun dessiné pixel par pixel d'après un motif
   traditionnel de patchwork (moulinet, rondins, étoile, neuf carrés, oies sauvages, carré sur
   pointe), évalué au centre de chaque pixel : les diagonales prennent d'elles-mêmes l'escalier
   du pixel art. Les blocs sont tournés selon un arrangement (au hasard, losanges concentriques
   façon « barn raising », sillons), séparés par des bandes d'encadrement avec carrés de coin ;
   certains tissus sont imprimés (pois, rayures, carreaux, semis) et une couture en pointillés
   suit les blocs. Tout se compte en pixels de la grille, jamais en pixels d'écran. */
(function () {
  'use strict';
  var DL = window.DL;

  // Ramène un point d'un quart du bloc dans le quart haut-gauche par rotation autour du centre
  // (symétrie d'ordre 4 du moulinet). Repère écran : y vers le bas.
  function versHautGauche(u, v) {
    if (u < 0.5 && v < 0.5) return [u, v];
    if (u >= 0.5 && v < 0.5) return [v, 1 - u];
    if (u >= 0.5 && v >= 0.5) return [1 - u, 1 - v];
    return [1 - v, u];
  }

  /* Motifs : (u, v) dans [0,1)² → rôle de tissu. 0 = fond clair du bloc, 1 à 3 = tissus,
     4 = tissu clair secondaire (rondins). La couleur de chaque rôle est choisie plus loin. */
  var MOTIFS = {
    // Moulinet : quatre triangles rectangles qui tournent autour du centre.
    moulinet: function (u, v) {
      var p = versHautGauche(u, v), quart = (u < 0.5) === (v < 0.5) ? 0 : 1;
      return p[0] > p[1] ? (quart ? 3 : 1) : 0;
    },
    // Rondins (log cabin) : un carré central puis des bûches posées en spirale, sombres sur
    // deux côtés, claires sur les deux autres. Tournés, les blocs dessinent des losanges.
    rondins: function (u, v, N) {
      var K = Math.max(2, Math.min(5, Math.floor(N / 5)));
      var sw = 0.5 / (K + 0.5), x = u - 0.5, y = v - 0.5;
      var x0 = -sw / 2, x1 = sw / 2, y0 = -sw / 2, y1 = sw / 2;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) return 2;
      for (var k = 1; k <= K; k++) {
        var fonce = k % 2 ? 1 : 3, clair = k % 2 ? 0 : 4;
        if (x >= x1 && x < x1 + sw && y >= y0 && y < y1) return fonce;
        x1 += sw;
        if (y >= y1 && y < y1 + sw && x >= x0 && x < x1) return fonce;
        y1 += sw;
        if (x >= x0 - sw && x < x0 && y >= y0 && y < y1) return clair;
        x0 -= sw;
        if (y >= y0 - sw && y < y0 && x >= x0 && x < x1) return clair;
        y0 -= sw;
      }
      return 0;
    },
    // Étoile à dents de scie : grille 4 × 4, coins unis, centre en carré sur pointe,
    // et sur chaque côté une unité « oie » dont les deux petits triangles sont les branches.
    etoile: function (u, v) {
      var gx = Math.min(3, Math.floor(u * 4)), gy = Math.min(3, Math.floor(v * 4));
      var bordX = gx === 0 || gx === 3, bordY = gy === 0 || gy === 3;
      if (bordX && bordY) return 0;
      if (!bordX && !bordY) return Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.17 ? 3 : 2;
      var x = u, y = v;
      if (gx === 0) { x = 1 - v; y = u; } else if (gx === 3) { x = v; y = 1 - u; } else if (gy === 3) { x = 1 - u; y = 1 - v; }
      var a = (x - 0.25) / 0.5, b = y / 0.25;
      return b < 1 - Math.abs(2 * a - 1) ? 0 : 1;
    },
    // Neuf carrés : en damier ; avec assez de pixels, les carrés pleins deviennent eux-mêmes
    // de petits neuf-carrés (double neuf-carrés).
    neuf: function (u, v, N) {
      var gx = Math.min(2, Math.floor(u * 3)), gy = Math.min(2, Math.floor(v * 3));
      var centre = gx === 1 && gy === 1;
      if (N < 18) return (gx + gy) % 2 ? 0 : centre ? 2 : 1;
      if ((gx + gy) % 2) return 3;
      var sx = Math.min(2, Math.floor((u * 3 - gx) * 3)), sy = Math.min(2, Math.floor((v * 3 - gy) * 3));
      if ((sx + sy) % 2) return 0;
      return centre ? 2 : 1;
    },
    // Oies sauvages : deux colonnes de quatre triangles qui montent.
    oies: function (u, v) {
      var col = u < 0.5 ? 0 : 1, rang = Math.min(3, Math.floor(v * 4));
      var a = (u - col * 0.5) / 0.5, b = v * 4 - rang;
      return b >= Math.abs(2 * a - 1) ? ((rang + col) % 2 ? 3 : 1) : 0;
    },
    // Carré sur pointe : losange, carré inscrit, petit losange au centre.
    diamant: function (u, v) {
      var x = Math.abs(u - 0.5), y = Math.abs(v - 0.5);
      if (x + y > 0.5) return 0;
      if (Math.max(x, y) > 0.25) return 1;
      return x + y > 0.25 ? 2 : 3;
    }
  };
  var NOMS_MOTIFS = Object.keys(MOTIFS);

  // Impressions de tissu, sur les coordonnées globales des pixels : le motif imprimé court
  // d'un bloc à l'autre comme sur une vraie pièce de tissu découpée.
  var IMPRIMES = ['pois', 'rayures', 'carreaux', 'semis'];
  function imprime(type, gx, gy, s) {
    if (type === 'pois') return gx % 3 === 1 && gy % 3 === 1;
    if (type === 'rayures') return (gx + gy) % 4 === 0;
    if (type === 'carreaux') return gx % 4 === 0 || gy % 4 === 0;
    return DL.hash2(gx, gy, s) < 0.11;
  }

  // Orientation d'un bloc (quarts de tour) selon l'arrangement choisi.
  function rotationBloc(arr, bi, bj, nbx, nby, r) {
    if (arr === 'identique') return 0;
    if (arr === 'libre') return r.int(0, 3);
    if (arr === 'sillons') return ((bi + bj) % 2) * 2;
    // Losanges concentriques : orientation par quart de la couverture, retournée d'un anneau
    // de blocs à l'autre (« barn raising »).
    var dx = bi - (nbx - 1) / 2, dy = bj - (nby - 1) / 2;
    var q = dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 3 : 2);
    var anneau = Math.floor(Math.max(Math.abs(dx), Math.abs(dy)));
    return (q + (anneau % 2) * 2) % 4;
  }

  /* Choix des tissus d'un bloc : rôle → { c: indice de palette, imp: impression ou null, ci: encre
     de l'impression }. Le rôle 4 (bûches claires) prend l'encre la plus claire. */
  function choisirTissus(r, pal, encresTriees, P, contrastes) {
    var claire = encresTriees[0];
    var autres = r.shuffle(encresTriees.slice(1).length ? encresTriees.slice(1) : encresTriees);
    var roles = [0, autres[0 % autres.length], autres[1 % autres.length], autres[2 % autres.length], claire];
    return roles.map(function (c) {
      var t = { c: c, imp: null, ci: c };
      if (r.chance(P.imprimes)) {
        t.imp = r.pick(IMPRIMES);
        // Encre de l'impression : l'une des deux plus contrastées avec le tissu, pour rester lisible.
        var cand = contrastes[c];
        t.ci = cand[r.chance(0.6) ? 0 : Math.min(1, cand.length - 1)];
      }
      return t;
    });
  }

  DL.enregistrer({
    id: 'quilt',
    numero: '31',
    nom: 'Quilt',
    famille: 'pixel',
    description: 'Couvertures en patchwork pixel : blocs traditionnels (moulinet, rondins, étoile), tissus imprimés et coutures.',
    libs: ['Canvas 2D', 'chroma.js'],
    moteur: 'canvas2d',
    fondTransparent: false,
    nbCouleurs: 6,
    palette: ['#F3ECDD', '#22335B', '#B6402F', '#E4A23B', '#6E9A6B', '#D88B91'],
    params: [
      { cle: 'motif', label: 'Motif des blocs', type: 'select', defaut: 'melange', options: [
        { valeur: 'melange', label: 'Échantillonneur (tous)' }, { valeur: 'moulinet', label: 'Moulinet' },
        { valeur: 'rondins', label: 'Rondins (log cabin)' }, { valeur: 'etoile', label: 'Étoile' },
        { valeur: 'neuf', label: 'Neuf carrés' }, { valeur: 'oies', label: 'Oies sauvages' },
        { valeur: 'diamant', label: 'Carré sur pointe' }] },
      { cle: 'blocs', label: 'Blocs (petit côté)', type: 'range', min: 1, max: 10, pas: 1, defaut: 4 },
      { cle: 'pixels', label: 'Pixels par bloc', type: 'range', min: 8, max: 32, pas: 2, defaut: 16 },
      { cle: 'arrangement', label: 'Arrangement', type: 'select', defaut: 'libre', options: [
        { valeur: 'libre', label: 'Rotations au hasard' }, { valeur: 'identique', label: 'Blocs identiques' },
        { valeur: 'grange', label: 'Losanges concentriques' }, { valeur: 'sillons', label: 'Sillons en diagonale' }] },
      { cle: 'tissus', label: 'Tissus', type: 'select', defaut: 'chutes', options: [
        { valeur: 'assortis', label: 'Assortis' }, { valeur: 'chutes', label: 'Chutes' }] },
      { cle: 'encadrement', label: "Bandes d'encadrement", type: 'range', min: 0, max: 4, pas: 1, defaut: 1 },
      { cle: 'imprimes', label: 'Tissus imprimés', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'couture', label: 'Couture en pointillés', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h), N = P.pixels, s = P.encadrement;
      var encres = [];
      for (var e = 1; e < pal.length; e++) encres.push(e);
      // Encres de la plus claire à la plus foncée (luminance perçue).
      var encresTriees = encres.slice().sort(function (a, b) { return chroma(pal[b]).luminance() - chroma(pal[a]).luminance(); });
      // Pour chaque couleur : les autres couleurs, de la plus contrastée à la moins contrastée.
      var contrastes = pal.map(function (c, i) {
        return pal.map(function (_, j) { return j; }).filter(function (j) { return j !== i; })
          .sort(function (a, b) { return chroma.contrast(pal[b], c) - chroma.contrast(pal[a], c); });
      });

      // 1. Géométrie en pixels de grille : le petit côté compte « blocs » blocs et leurs bandes.
      var parCote = P.blocs * N + (P.blocs + 1) * s;
      var px = m / parCote;
      var GW = Math.ceil(w / px), GH = Math.ceil(h / px);
      var nbx = Math.max(1, Math.floor((GW - s) / (N + s))), nby = Math.max(1, Math.floor((GH - s) / (N + s)));
      var mx = Math.floor((GW - (nbx * (N + s) + s)) / 2), my = Math.floor((GH - (nby * (N + s) + s)) / 2);

      var rc = rng.fork('cadre');
      var cadre = rc.pick(encres), coin = rc.pick(encres.filter(function (c) { return c !== cadre; }));
      var grille = new Uint8Array(GW * GH).fill(cadre);

      // 2. Carrés de coin aux croisements des bandes d'encadrement.
      if (s > 0) {
        for (var cj = 0; cj <= nby; cj++) {
          for (var ci = 0; ci <= nbx; ci++) {
            var x0 = mx + ci * (N + s), y0 = my + cj * (N + s);
            for (var yy = y0; yy < y0 + s; yy++) for (var xx = x0; xx < x0 + s; xx++) {
              if (xx >= 0 && yy >= 0 && xx < GW && yy < GH) grille[yy * GW + xx] = coin;
            }
          }
        }
      }

      // 3. Blocs, pixel par pixel.
      var tissusCommuns = choisirTissus(rng.fork('tissus'), pal, encresTriees, P, contrastes);
      var motifCommun = P.motif === 'melange' ? null : MOTIFS[P.motif];
      var graine = DL.hacher(String(rng.seed) + 'imp');
      for (var bj = 0; bj < nby; bj++) {
        for (var bi = 0; bi < nbx; bi++) {
          var r = rng.fork('b' + bi + '-' + bj);
          var motif = motifCommun || MOTIFS[r.pick(NOMS_MOTIFS)];
          var rot = rotationBloc(P.arrangement, bi, bj, nbx, nby, r);
          var tissus = P.tissus === 'chutes' ? choisirTissus(r, pal, encresTriees, P, contrastes) : tissusCommuns;
          var bx = mx + s + bi * (N + s), by = my + s + bj * (N + s);
          for (var j = 0; j < N; j++) {
            for (var i = 0; i < N; i++) {
              var gx = bx + i, gy = by + j;
              if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
              var u = (i + 0.5) / N, v = (j + 0.5) / N;
              for (var q = 0; q < rot; q++) { var t = u; u = 1 - v; v = t; }
              var tissu = tissus[motif(u, v, N)];
              grille[gy * GW + gx] = tissu.imp && imprime(tissu.imp, gx, gy, graine) ? tissu.ci : tissu.c;
            }
          }
        }
      }

      // 4. Dessin par plages : une seule fillRect par suite de pixels de même couleur.
      var ox = (w - GW * px) / 2, oy = (h - GH * px) / 2;
      for (var y = 0; y < GH; y++) {
        var ya = Math.round(oy + y * px), yb = Math.round(oy + (y + 1) * px);
        for (var x = 0; x < GW;) {
          var c = grille[y * GW + x], x2 = x + 1;
          while (x2 < GW && grille[y * GW + x2] === c) x2++;
          var xa = Math.round(ox + x * px), xb = Math.round(ox + x2 * px);
          ctx.fillStyle = pal[c];
          ctx.fillRect(xa, ya, xb - xa, yb - ya);
          x = x2;
        }
      }

      // 5. Couture : points avant (tirets) autour de chaque bloc et au milieu des bandes.
      // Fil clair, sauf si l'encadrement est déjà clair : fil foncé.
      if (P.couture) {
        var fil = chroma.contrast(pal[0], pal[cadre]) >= 1.6 ? pal[0] : DL.encrePrincipale(pal);
        ctx.save();
        ctx.strokeStyle = fil;
        ctx.globalAlpha = 0.88;
        ctx.lineWidth = Math.max(1, px * 0.14);
        ctx.setLineDash([px * 0.55, px * 0.45]);
        ctx.beginPath();
        for (bj = 0; bj < nby; bj++) {
          for (bi = 0; bi < nbx; bi++) {
            var X = ox + (mx + s + bi * (N + s) + 0.5) * px, Y = oy + (my + s + bj * (N + s) + 0.5) * px;
            ctx.rect(X, Y, (N - 1) * px, (N - 1) * px);
          }
        }
        if (s > 0) {
          var milieu = s / 2;
          for (var k = 0; k <= nbx; k++) {
            var lx = ox + (mx + k * (N + s) + milieu) * px;
            ctx.moveTo(lx, oy + my * px); ctx.lineTo(lx, oy + (my + nby * (N + s) + s) * px);
          }
          for (k = 0; k <= nby; k++) {
            var ly = oy + (my + k * (N + s) + milieu) * px;
            ctx.moveTo(ox + mx * px, ly); ctx.lineTo(ox + (mx + nbx * (N + s) + s) * px, ly);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  });
})();

/* 16 Weave : rubans rayés tissés (canvas 2D).
   Une chaîne (rubans verticaux) et une trame (rubans horizontaux) s'entrecroisent selon une
   armure de tissage : toile, sergé (diagonale), natté (par paires) ou satin. À chaque croisement,
   l'armure décide quel ruban passe dessus ; une ombre portée marque le ruban qui passe dessous.
   Chaque ruban porte ses propres rayures dans le sens de la longueur. */
(function () {
  'use strict';
  var DL = window.DL;

  // Vrai = la chaîne (verticale) passe au-dessus au croisement (i, j).
  var ARMURES = {
    toile: function (i, j) { return ((i + j) & 1) === 0; },
    serge: function (i, j) { return (((i - j) % 4) + 4) % 4 < 2; },
    natte: function (i, j) { return ((Math.floor(i / 2) + Math.floor(j / 2)) & 1) === 0; },
    satin: function (i, j) { return ((((i * 2 + j) % 5) + 5) % 5) !== 0; }
  };

  // Rayures d'un ruban : bandes [début, fin] en fraction de largeur, avec leur couleur.
  function rayures(r, nb, encres) {
    var poids = [], total = 0, out = [], pos = 0;
    for (var k = 0; k < nb; k++) { var v = 0.4 + r(); poids.push(v); total += v; }
    var cols = r.shuffle(encres);
    for (k = 0; k < nb; k++) {
      var fin = pos + poids[k] / total;
      out.push([pos, fin, cols[k % cols.length]]);
      pos = fin;
    }
    return out;
  }

  DL.enregistrer({
    id: 'weave',
    numero: '16',
    nom: 'Weave',
    famille: 'textile',
    description: 'Rubans rayés tissés : chaîne et trame entrecroisées en toile, sergé, natté ou satin.',
    libs: ['Canvas 2D'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#1A1A1A', '#F2E3C6', '#D94F30', '#2E6E8E', '#E8B04B', '#7A9E7E'],
    params: [
      { cle: 'rubans', label: 'Rubans par côté', type: 'range', min: 3, max: 40, pas: 1, defaut: 10 },
      { cle: 'largeur', label: 'Largeur des rubans', type: 'range', min: 0.4, max: 1, pas: 0.01, defaut: 0.84 },
      { cle: 'armure', label: 'Armure', type: 'select', defaut: 'toile', options: [
        { valeur: 'toile', label: 'Toile' }, { valeur: 'serge', label: 'Sergé (diagonale)' },
        { valeur: 'natte', label: 'Natté (par paires)' }, { valeur: 'satin', label: 'Satin' }] },
      { cle: 'rayures', label: 'Rayures par ruban', type: 'range', min: 1, max: 7, pas: 1, defaut: 3 },
      { cle: 'ombre', label: 'Ombre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.55 },
      { cle: 'rotation', label: 'Rotation', type: 'range', min: 0, max: 45, pas: 1, defaut: 0, unite: '°' },
      { cle: 'unis', label: 'Rubans unis', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.25 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var pas = m / P.rubans, lw = pas * P.largeur, demi = lw / 2;
      var R = Math.sqrt(w * w + h * h) / 2 + pas;
      var N = Math.ceil(R / pas);
      var encres = pal.slice(1);
      var armure = ARMURES[P.armure] || ARMURES.toile;
      // Rayures tirées par ruban avec un rng dédié : changer le nombre de rubans ne rebat pas
      // les rayures des rubans existants.
      var chaine = {}, trame = {};
      for (var i = -N; i <= N; i++) {
        var rc = rng.fork('c' + i), rt = rng.fork('t' + i);
        chaine[i] = rayures(rc, rc.chance(P.unis) ? 1 : P.rayures, encres);
        trame[i] = rayures(rt, rt.chance(P.unis) ? 1 : P.rayures, encres);
      }
      // Largeur d'ombre bornée par l'espace entre rubans : sinon elle déborde sur le ruban voisin.
      var ombre = P.ombre, lo = Math.max(pas * 0.02, Math.min(pas * 0.18, pas - lw));

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate(P.rotation * Math.PI / 180);

      // Segment de ruban rayé : horizontal (trame) ou vertical (chaîne).
      function segment(bandes, horizontal, centre, a, b) {
        bandes.forEach(function (bd) {
          ctx.fillStyle = bd[2];
          var p0 = centre - demi + bd[0] * lw, ep = (bd[1] - bd[0]) * lw;
          if (horizontal) ctx.fillRect(a, p0, b - a, ep + 0.5);
          else ctx.fillRect(p0, a, ep + 0.5, b - a);
        });
      }
      // Ombre portée : dégradé sur le ruban du dessous, le long du bord du ruban du dessus.
      function ombrer(x0, y0, x1, y1, gx0, gy0, gx1, gy1) {
        if (ombre <= 0) return;
        var g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        g.addColorStop(0, 'rgba(0,0,0,' + (0.55 * ombre) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }

      // 1. Trame complète (horizontale).
      for (var j = -N; j <= N; j++) segment(trame[j], true, j * pas, -R, R);
      // 2. Chaîne : visible entre les rubans de trame, et par-dessus là où l'armure le dit.
      for (i = -N; i <= N; i++) {
        var cx = i * pas;
        for (j = -N; j <= N; j++) {
          var cy = j * pas;
          // Intervalle libre entre deux rubans de trame : toujours visible.
          segment(chaine[i], false, cx, cy + demi, cy + pas - demi);
          if (armure(i, j)) {
            segment(chaine[i], false, cx, cy - demi, cy + demi);
            // La trame passe dessous : ombre de part et d'autre de la chaîne.
            ombrer(cx + demi, cy - demi, cx + demi + lo, cy + demi, cx + demi, 0, cx + demi + lo, 0);
            ombrer(cx - demi - lo, cy - demi, cx - demi, cy + demi, cx - demi, 0, cx - demi - lo, 0);
          } else {
            // La chaîne passe dessous : ombre au-dessus et au-dessous de la trame.
            ombrer(cx - demi, cy + demi, cx + demi, cy + demi + lo, 0, cy + demi, 0, cy + demi + lo);
            ombrer(cx - demi, cy - demi - lo, cx + demi, cy - demi, 0, cy - demi, 0, cy - demi - lo);
          }
        }
      }
      ctx.restore();
    }
  });
})();

/* 21 Modular : affiches en grille modulaire (Paper.js, export SVG).
   Une grille suisse (colonnes, rangées, gouttières) est remplie de modules qui couvrent
   1 à n cellules. Chaque module reçoit une forme géométrique simple (aplat, disque,
   demi-disque, quart d'ellipse, triangle, bandes) posée sur un fond éventuel d'une autre couleur.
   Le remplissage se fait par occupation : on parcourt les cellules dans un ordre seedé et
   chaque module prend la plus grande taille libre tirée, donc aucun chevauchement. */
(function () {
  'use strict';
  var DL = window.DL;

  // Formes par famille : « droites » donne une affiche constructiviste, « courbes » une affiche Bauhaus.
  var FORMES = {
    tout: ['aplat', 'disque', 'demi', 'quart', 'triangle', 'bandes'],
    droites: ['aplat', 'triangle', 'bandes'],
    courbes: ['disque', 'demi', 'quart']
  };

  // Points d'un arc d'ellipse (centre cx, cy ; rayons rx, ry ; angles a0 → a1).
  function arc(cx, cy, rx, ry, a0, a1, n) {
    var pts = [];
    for (var k = 0; k <= n; k++) {
      var a = a0 + (a1 - a0) * k / n;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  DL.enregistrer({
    id: 'modular',
    numero: '21',
    nom: 'Modular',
    famille: 'vecteur',
    description: 'Affiches en grille modulaire : modules de 1 à n cellules, disques, quarts et bandes, export SVG.',
    libs: ['Paper.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#EDEBE4', '#141414', '#FF3B00', '#1F4BFF', '#FFC800'],
    params: [
      { cle: 'colonnes', label: 'Colonnes', type: 'range', min: 2, max: 12, pas: 1, defaut: 6 },
      { cle: 'rangees', label: 'Rangées', type: 'range', min: 2, max: 16, pas: 1, defaut: 8 },
      { cle: 'gouttiere', label: 'Gouttière', type: 'range', min: 0, max: 0.5, pas: 0.01, defaut: 0.1 },
      { cle: 'marge', label: 'Marge', type: 'range', min: 0, max: 0.2, pas: 0.01, defaut: 0.06 },
      { cle: 'portee', label: 'Taille maximale des modules', type: 'range', min: 1, max: 6, pas: 1, defaut: 3 },
      { cle: 'densite', label: 'Densité', type: 'range', min: 0.1, max: 1, pas: 0.01, defaut: 0.85 },
      { cle: 'formes', label: 'Formes', type: 'select', defaut: 'tout', options: [
        { valeur: 'tout', label: 'Toutes' }, { valeur: 'droites', label: 'Droites' }, { valeur: 'courbes', label: 'Courbes' }] },
      { cle: 'grille', label: 'Grille visible', type: 'toggle', defaut: false }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h), encres = pal.slice(1);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });

      var C = P.colonnes, R = P.rangees, M = P.marge * m;
      // Gouttière relative à la taille d'une cellule : même proportion quel que soit le nombre de cases.
      var g = P.gouttiere * m / Math.max(C, R);
      var cw = (w - 2 * M - (C - 1) * g) / C, ch = (h - 2 * M - (R - 1) * g) / R;
      if (cw <= 0 || ch <= 0) return;
      var pasArc = m * 0.008;

      if (P.grille) {
        for (var i = 0; i < C; i++) for (var j = 0; j < R; j++) {
          new S.Path.Rectangle({ point: [M + i * (cw + g), M + j * (ch + g)], size: [cw, ch],
            strokeColor: encres[0], strokeWidth: Math.max(0.5, m * 0.0015), opacity: 0.35 });
        }
      }

      var libre = [];
      for (i = 0; i < C * R; i++) libre.push(true);
      function estLibre(c0, r0, a, b) {
        if (c0 + a > C || r0 + b > R) return false;
        for (var x = c0; x < c0 + a; x++) for (var y = r0; y < r0 + b; y++) if (!libre[y * C + x]) return false;
        return true;
      }

      var ordre = [];
      for (i = 0; i < C * R; i++) ordre.push(i);
      ordre = rng.shuffle(ordre);
      var formes = FORMES[P.formes] || FORMES.tout;

      ordre.forEach(function (idx) {
        if (!libre[idx] || !rng.chance(P.densite)) return;
        var c0 = idx % C, r0 = Math.floor(idx / C);
        // Taille tirée puis réduite jusqu'à tenir dans l'espace libre.
        var a = rng.int(1, P.portee), b = rng.int(1, P.portee);
        while (!estLibre(c0, r0, a, b)) { if (a >= b && a > 1) a--; else if (b > 1) b--; else break; }
        if (!estLibre(c0, r0, a, b)) return;
        for (var x = c0; x < c0 + a; x++) for (var y = r0; y < r0 + b; y++) libre[y * C + x] = false;

        var X = M + c0 * (cw + g), Y = M + r0 * (ch + g);
        var W = a * cw + (a - 1) * g, H = b * ch + (b - 1) * g;
        var cols = rng.shuffle(encres);
        var forme = rng.pick(formes);
        // Fond du module : une fois sur deux, sinon la forme se pose directement sur le papier.
        if (forme === 'aplat' || rng.chance(0.5)) new S.Path.Rectangle({ point: [X, Y], size: [W, H], fillColor: cols[0] });
        if (forme === 'aplat') return;
        var c = cols[1];

        if (forme === 'disque') {
          new S.Path.Circle({ center: [X + W / 2, Y + H / 2], radius: Math.min(W, H) / 2, fillColor: c });
        } else if (forme === 'demi') {
          // Demi-disque posé sur l'un des 4 bords, diamètre = ce bord (ellipse si le module est allongé).
          var cote = rng.int(0, 3), pts;
          var n = Math.max(12, Math.ceil(Math.PI * Math.max(W, H) / 2 / pasArc));
          if (cote === 0) pts = arc(X + W / 2, Y + H, W / 2, Math.min(H, W / 2), Math.PI, 2 * Math.PI, n);
          else if (cote === 1) pts = arc(X + W / 2, Y, W / 2, Math.min(H, W / 2), 0, Math.PI, n);
          else if (cote === 2) pts = arc(X, Y + H / 2, Math.min(W, H / 2), H / 2, -Math.PI / 2, Math.PI / 2, n);
          else pts = arc(X + W, Y + H / 2, Math.min(W, H / 2), H / 2, Math.PI / 2, 1.5 * Math.PI, n);
          new S.Path({ segments: pts, closed: true, fillColor: c });
        } else if (forme === 'quart') {
          // Quart d'ellipse centré sur un coin : rayons = côtés du module.
          var coin = rng.int(0, 3);
          var cx = coin === 1 || coin === 2 ? X + W : X, cy = coin >= 2 ? Y + H : Y;
          var a0 = [0, 0.5, 1, 1.5][coin] * Math.PI;
          var nq = Math.max(12, Math.ceil(Math.PI * Math.max(W, H) / 2 / pasArc));
          var q = arc(cx, cy, W, H, a0, a0 + Math.PI / 2, nq);
          q.unshift([cx, cy]);
          new S.Path({ segments: q, closed: true, fillColor: c });
        } else if (forme === 'triangle') {
          var coins = [[X, Y], [X + W, Y], [X + W, Y + H], [X, Y + H]], ot = rng.int(0, 3);
          new S.Path({ segments: [coins[ot], coins[(ot + 1) % 4], coins[(ot + 2) % 4]], closed: true, fillColor: c });
        } else {
          // Bandes : nombre impair pour qu'une bande touche chaque bord.
          var nb = rng.pick([3, 5, 7, 9]), vert = rng.chance(0.5);
          for (var k = 0; k < nb; k += 2) {
            if (vert) new S.Path.Rectangle({ point: [X + k * W / nb, Y], size: [W / nb, H], fillColor: c });
            else new S.Path.Rectangle({ point: [X, Y + k * H / nb], size: [W, H / nb], fillColor: c });
          }
        }
      });
    }
  });
})();

/* 39 Pane : panneaux de verre en dégradé, en vectoriel (Paper.js, export SVG).
   Le cadre est découpé en panneaux (grille, découpe libre façon Mondrian, bandes verticales ou
   arches), séparés par des joints. Un même dégradé traverse toute l'image (échelle LCH entre
   les encres, sans couleur boueuse au milieu) ; la « réfraction » fait que chaque panneau le
   montre à sa façon : direction tournée, plage de couleurs décalée, parfois inversée, comme
   à travers du verre cannelé. À zéro, le dégradé est continu d'un panneau à l'autre. Un biseau
   (filet clair en haut à gauche, sombre en bas à droite) donne l'épaisseur du verre.
   Les dégradés SVG mélangent en sRGB : on échantillonne donc l'échelle LCH en plusieurs arrêts. */
(function () {
  'use strict';
  var DL = window.DL;

  // Aller-retour dans [0,1] : un décalage qui sort de l'échelle revient en arrière, sans saut.
  function pingpong(t) {
    t = ((t % 2) + 2) % 2;
    return t > 1 ? 2 - t : t;
  }

  // Découpe d'un rectangle en n panneaux selon la disposition.
  function decouper(dispo, n, X, Y, W, H, r) {
    var out = [], k;
    if (dispo === 'bandes') {
      var poids = [], total = 0;
      for (k = 0; k < n; k++) { poids.push(r.range(0.5, 1.5)); total += poids[k]; }
      var x = X;
      for (k = 0; k < n; k++) { var lw = W * poids[k] / total; out.push({ x: x, y: Y, w: lw, h: H }); x += lw; }
      return out;
    }
    if (dispo === 'libre') {
      // Découpe récursive : on coupe un des plus grands panneaux, sur son côté long.
      out.push({ x: X, y: Y, w: W, h: H });
      while (out.length < n) {
        out.sort(function (a, b) { return b.w * b.h - a.w * a.h; });
        var i = r.int(0, Math.min(2, out.length - 1)), p = out.splice(i, 1)[0], f = r.range(0.3, 0.7);
        if (p.w >= p.h) out.push({ x: p.x, y: p.y, w: p.w * f, h: p.h }, { x: p.x + p.w * f, y: p.y, w: p.w * (1 - f), h: p.h });
        else out.push({ x: p.x, y: p.y, w: p.w, h: p.h * f }, { x: p.x, y: p.y + p.h * f, w: p.w, h: p.h * (1 - f) });
      }
      return out;
    }
    // Grille (et arches) : colonnes et rangées au plus près de n, selon le format.
    var cols = Math.max(1, Math.round(Math.sqrt(n * W / H))), rangs = Math.max(1, Math.round(n / cols));
    for (var j = 0; j < rangs; j++) for (k = 0; k < cols; k++) {
      out.push({ x: X + k * W / cols, y: Y + j * H / rangs, w: W / cols, h: H / rangs, arche: dispo === 'arches' });
    }
    return out;
  }

  // Forme d'un panneau : rectangle arrondi, ou arche (rectangle surmonté d'un demi-cercle).
  function forme(S, p, rayon) {
    if (p.arche) {
      var r = Math.min(p.w / 2, p.h);
      var chemin = new S.Path({ insert: false });
      chemin.add([p.x, p.y + p.h]);
      chemin.lineTo([p.x, p.y + r]);
      chemin.arcTo([p.x + p.w / 2, p.y + r - Math.min(r, p.w / 2)], [p.x + p.w, p.y + r]);
      chemin.lineTo([p.x + p.w, p.y + p.h]);
      chemin.closePath();
      return chemin;
    }
    return new S.Path.Rectangle({ rectangle: new S.Rectangle(p.x, p.y, p.w, p.h), radius: rayon, insert: false });
  }

  DL.enregistrer({
    id: 'pane',
    numero: '39',
    nom: 'Pane',
    famille: 'degrade',
    description: 'Panneaux de verre en dégradé : grilles, bandes ou arches qui réfractent un même dégradé, export SVG.',
    libs: ['Paper.js', 'chroma.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#121212', '#F25F5C', '#FFE066', '#70C1B3', '#247BA0'],
    params: [
      { cle: 'disposition', label: 'Disposition', type: 'select', defaut: 'libre', options: [
        { valeur: 'grille', label: 'Grille' }, { valeur: 'libre', label: 'Libre' }, { valeur: 'bandes', label: 'Bandes' }, { valeur: 'arches', label: 'Arches' }] },
      { cle: 'panneaux', label: 'Panneaux', type: 'range', min: 2, max: 48, pas: 1, defaut: 12 },
      { cle: 'joint', label: 'Joint', type: 'range', min: 0, max: 0.05, pas: 0.001, defaut: 0.012 },
      { cle: 'angle', label: 'Angle du dégradé', type: 'range', min: 0, max: 355, pas: 5, defaut: 120, unite: '°' },
      { cle: 'refraction', label: 'Réfraction', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'radial', label: 'Panneaux radiaux', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.15 },
      { cle: 'arrondi', label: 'Coins arrondis', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.15 },
      { cle: 'biseau', label: 'Biseau', type: 'toggle', defaut: true }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var encres = pal.length > 2 ? pal.slice(1) : [pal[1] || '#888888', pal[0]];
      var echelle = chroma.scale(encres).mode('lch');
      var g = P.joint * m;

      // Dégradé global : t de 0 à 1 d'un bord à l'autre du cadre, selon l'angle.
      var th = P.angle * Math.PI / 180, dg = [Math.cos(th), Math.sin(th)];
      var demiG = Math.max(1e-6, (Math.abs(w * dg[0]) + Math.abs(h * dg[1])) / 2);
      function tGlobal(x, y) { return ((x - w / 2) * dg[0] + (y - h / 2) * dg[1]) / (2 * demiG) + 0.5; }
      function arrets(t0, t1) {
        var a = [];
        for (var k = 0; k <= 6; k++) a.push([echelle(pingpong(t0 + (t1 - t0) * k / 6)).hex(), k / 6]);
        return a;
      }

      var panneaux = decouper(P.disposition, P.panneaux, g / 2, g / 2, w - g, h - g, rng.fork('decoupe'));
      panneaux.forEach(function (p0, i) {
        var r = rng.fork('p' + i);
        var p = { x: p0.x + g / 2, y: p0.y + g / 2, w: Math.max(1, p0.w - g), h: Math.max(1, p0.h - g), arche: p0.arche };
        var rayon = P.arrondi * Math.min(p.w, p.h) * 0.5;
        var vitre = forme(S, p, rayon);
        S.project.activeLayer.addChild(vitre);

        var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        // Direction propre au panneau : celle du dégradé global, tournée selon la réfraction.
        var ang = th + P.refraction * r.range(-1, 1) * 1.1, d = [Math.cos(ang), Math.sin(ang)];
        var demi = (Math.abs(p.w * d[0]) + Math.abs(p.h * d[1])) / 2;
        var o = [cx - d[0] * demi, cy - d[1] * demi], dest = [cx + d[0] * demi, cy + d[1] * demi];
        var t0 = tGlobal(o[0], o[1]), t1 = tGlobal(dest[0], dest[1]);
        var decal = P.refraction * r.range(-0.5, 0.5);
        t0 += decal; t1 += decal;
        if (r.chance(P.refraction * 0.4)) { var tt = t0; t0 = t1; t1 = tt; }
        if (r.chance(P.radial)) {
          // Radial : foyer décentré dans le panneau, rayon jusqu'au coin le plus loin.
          var fx = p.x + p.w * r.range(0.2, 0.8), fy = p.y + p.h * r.range(0.2, 0.8);
          var R = Math.max(Math.hypot(fx - p.x, fy - p.y), Math.hypot(fx - p.x - p.w, fy - p.y), Math.hypot(fx - p.x, fy - p.y - p.h), Math.hypot(fx - p.x - p.w, fy - p.y - p.h));
          vitre.fillColor = new S.Color({ gradient: { stops: arrets(t0, t1), radial: true }, origin: [fx, fy], destination: [fx + R, fy] });
        } else {
          vitre.fillColor = new S.Color({ gradient: { stops: arrets(t0, t1) }, origin: o, destination: dest });
        }

        // Biseau : filet intérieur, clair en haut à gauche, sombre en bas à droite.
        if (P.biseau) {
          var ep = Math.max(1, m * 0.0035);
          var pi = { x: p.x + ep / 2, y: p.y + ep / 2, w: Math.max(1, p.w - ep), h: Math.max(1, p.h - ep), arche: p.arche };
          var filet = forme(S, pi, Math.max(0, rayon - ep / 2));
          S.project.activeLayer.addChild(filet);
          filet.strokeWidth = ep;
          filet.strokeColor = new S.Color({
            gradient: { stops: [['rgba(255,255,255,0.55)', 0], ['rgba(255,255,255,0)', 0.45], ['rgba(0,0,0,0)', 0.55], ['rgba(0,0,0,0.35)', 1]] },
            origin: [p.x, p.y], destination: [p.x + p.w, p.y + p.h]
          });
        }
      });
    }
  });
})();

/* 36 Atlas : cartes imaginaires en caractères (canvas 2D, police Space Mono de vendor/fonts).
   Une grille de caractères à chasse fixe, comme un terminal. Un relief en bruit fbm, déformé
   pour des côtes naturelles et façonné en île, archipel, terre ou côte, est coupé au niveau de
   la mer de sorte que la part de terres soit celle demandée. Chaque case reçoit un signe selon
   l'altitude et l'humidité (~ eau, . grève, , prairie, Y forêt, n collines, ^ monts, A sommets).
   Les rivières descendent la plus forte pente jusqu'à la mer ; les villes se posent près des
   côtes et des rivières, avec un nom inventé. Cadre, titre, légende, rose des vents et échelle
   sont dessinés avec les mêmes caractères. Tout se compte en cases : l'export HD est identique. */
(function () {
  'use strict';
  var DL = window.DL;

  var SYLLABES = ['ka', 'lo', 'mi', 'an', 've', 'do', 'is', 'te', 'ru', 'sa', 'be', 'go', 'ar', 'ny', 'to', 'li', 'em',
    'or', 'qua', 'ste', 'mon', 'fa', 'ri', 'su', 'ca', 'za', 'pe', 'lin', 'va', 'bri', 'cor', 'del', 'fen', 'gal',
    'hel', 'jor', 'mal', 'nor', 'pol', 'tal', 'vir', 'zen'];
  var FINALES = ['', '', '', 'a', 'ia', 'or', 'ane', 'ec', 'is', 'el', 'on', 'ys'];
  function nomInvente(r) {
    var s = r.pick(SYLLABES) + r.pick(SYLLABES) + (r.chance(0.35) ? r.pick(SYLLABES) : '') + r.pick(FINALES);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // « de » ou « d' » devant une voyelle : MER D'ORVANE, MONTS DE KALO.
  function de(nom) { return /^[aeiouy]/i.test(nom) ? "D'" + nom : 'DE ' + nom; }

  var POLICE = '"Space Mono", monospace';
  // Encres : 1 trait et textes, 2 eau, 3 végétation, 4 relief et capitale.
  var LEGENDE = [['~', 'mer', 2], [',', 'prairie', 3], ['Y', 'forêt', 3], ['n', 'collines', 1], ['^', 'monts', 4],
    ['|', 'rivière', 2], ['@', 'capitale', 4], ['o', 'ville', 1]];

  DL.enregistrer({
    id: 'atlas',
    numero: '36',
    nom: 'Atlas',
    famille: 'typo',
    description: 'Cartes imaginaires en caractères : relief, forêts, rivières et villes nommées, avec légende et rose des vents.',
    libs: ['Canvas 2D', 'polices locales'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 5,
    palette: ['#EFE6D2', '#2B2118', '#2F6690', '#5C7A3A', '#A23B2A'],
    params: [
      { cle: 'colonnes', label: 'Colonnes de caractères', type: 'range', min: 40, max: 200, pas: 2, defaut: 90 },
      { cle: 'forme', label: 'Forme', type: 'select', defaut: 'ile', options: [
        { valeur: 'ile', label: 'Île' }, { valeur: 'archipel', label: 'Archipel' }, { valeur: 'terre', label: 'Terre' }, { valeur: 'cote', label: 'Côte' }] },
      { cle: 'terres', label: 'Part de terres', type: 'range', min: 0.15, max: 0.85, pas: 0.01, defaut: 0.42 },
      { cle: 'relief', label: 'Relief', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'rivieres', label: 'Rivières', type: 'range', min: 0, max: 12, pas: 1, defaut: 4 },
      { cle: 'villes', label: 'Villes', type: 'range', min: 0, max: 12, pas: 1, defaut: 6 },
      { cle: 'legende', label: 'Cadre et légende', type: 'toggle', defaut: true },
      { cle: 'couleur', label: 'En couleurs', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }

      // 1. Grille : la chasse de Space Mono fixe la largeur d'une case, l'interligne sa hauteur.
      ctx.font = '400 100px ' + POLICE;
      var chasse = (ctx.measureText('M').width || 61) / 100;
      var cols = P.colonnes, cw = w / cols, corps = cw / chasse, lh = corps * 1.12;
      var rows = Math.max(10, Math.floor(h / lh)), oy = (h - rows * lh) / 2, n = cols * rows;
      var car = new Array(n), encre = new Uint8Array(n), gras = new Uint8Array(n), pris = new Uint8Array(n);
      for (var q = 0; q < n; q++) car[q] = ' ';
      function poser(c, r, ch, e, g) {
        if (c < 0 || r < 0 || c >= cols || r >= rows) return;
        var o = r * cols + c;
        car[o] = ch; encre[o] = e; gras[o] = g ? 1 : 0; pris[o] = 1;
      }
      function libre(c, r, l) {
        if (r < 0 || r >= rows || c < 0 || c + l > cols) return false;
        for (var k = 0; k < l; k++) if (pris[r * cols + c + k]) return false;
        return true;
      }

      // 2. Relief, en coordonnées « petit côté » (indépendantes de la taille de rendu).
      var bruit = DL.creerBruit(rng.fork('relief'));
      var W = cols * cw / m, H = rows * lh / m;
      var formes = rng.fork('forme'), ilots = [], cote = formes.int(0, 3);
      for (var b = 0; b < 8; b++) ilots.push([formes.range(0.12, 0.88) * W, formes.range(0.12, 0.88) * H, formes.range(0.05, 0.15)]);
      var f = new Float32Array(n), hum = new Float32Array(n);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var X = (c + 0.5) * cw / m, Y = (r + 0.5) * lh / m;
          // Déformation du domaine : des côtes découpées plutôt que des cercles bruités.
          var wx = X + 0.22 * bruit.fbm2(X * 1.6, Y * 1.6, 3), wy = Y + 0.22 * bruit.fbm2(X * 1.6 + 5.2, Y * 1.6 + 1.3, 3);
          var dx = (wx - W / 2) / (W / 2), dy = (wy - H / 2) / (H / 2), d = Math.sqrt(dx * dx + dy * dy);
          var base, detail;
          if (P.forme === 'archipel') {
            base = 0;
            ilots.forEach(function (il) { var ex = (wx - il[0]) / il[2], ey = (wy - il[1]) / il[2]; base = Math.max(base, Math.exp(-(ex * ex + ey * ey))); });
            detail = bruit.fbm2(wx * 3.4, wy * 3.4, 5);
            f[r * cols + c] = 0.55 * base + 0.45 * (0.5 + 0.5 * detail);
          } else if (P.forme === 'cote') {
            var s = [wx / W, 1 - wx / W, wy / H, 1 - wy / H][cote];
            base = 1 - DL.smooth(0.25, 0.8, s);
            detail = bruit.fbm2(wx * 2.2, wy * 2.2, 5);
            f[r * cols + c] = 0.55 * base + 0.45 * (0.5 + 0.5 * detail);
          } else {
            base = P.forme === 'terre' ? 1 - DL.smooth(0.45, 1.3, d) : 1 - DL.smooth(0.15, 0.85, d);
            detail = bruit.fbm2(wx * (P.forme === 'terre' ? 1.7 : 2.3), wy * (P.forme === 'terre' ? 1.7 : 2.3), 5);
            f[r * cols + c] = (P.forme === 'terre' ? 0.45 : 0.6) * base + (P.forme === 'terre' ? 0.55 : 0.4) * (0.5 + 0.5 * detail);
          }
          hum[r * cols + c] = 0.5 + 0.5 * bruit.fbm2(X * 3 + 20, Y * 3 + 20, 3);
        }
      }
      // Niveau de la mer : quantile, pour que la part de terres soit celle demandée.
      var tri = Array.prototype.slice.call(f).sort(function (a2, b2) { return a2 - b2; });
      var mer = tri[Math.min(n - 1, Math.floor((1 - P.terres) * n))], haut = tri[n - 1];
      var alt = new Float32Array(n), terre = new Uint8Array(n);
      for (q = 0; q < n; q++) {
        if (f[q] > mer) { terre[q] = 1; alt[q] = Math.pow((f[q] - mer) / Math.max(1e-6, haut - mer), 1.6 - 1.1 * P.relief); }
      }

      // Distance à la côte (en cases) : mer → terre la plus proche, terre → mer la plus proche.
      function distances(source) {
        var dist = new Int16Array(n).fill(-1), file = [];
        for (var k = 0; k < n; k++) if (terre[k] === source) { dist[k] = 0; file.push(k); }
        for (var t = 0; t < file.length; t++) {
          var o = file[t], cc = o % cols, rr = (o - cc) / cols;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
            var c2 = cc + v[0], r2 = rr + v[1];
            if (c2 < 0 || r2 < 0 || c2 >= cols || r2 >= rows) return;
            var o2 = r2 * cols + c2;
            if (dist[o2] < 0) { dist[o2] = dist[o] + 1; file.push(o2); }
          });
        }
        return dist;
      }
      var versTerre = distances(1), versMer = distances(0);

      // 3. Signes du terrain.
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          var o = r * cols + c, hsh = DL.hash2(c, r, 17);
          X = (c + 0.5) * cw / m; Y = (r + 0.5) * lh / m;
          if (!terre[o]) {
            var dt = versTerre[o];
            if (dt === 1) { car[o] = '~'; encre[o] = 2; }
            else if (dt > 1 && dt <= 3 && (c + 2 * r) % 3 === 0) { car[o] = '~'; encre[o] = 2; }
            else if (dt > 3 && bruit.n2(X * 5, Y * 13) > 0.6) { car[o] = '~'; encre[o] = 2; }
            continue;
          }
          var e = alt[o];
          if (e < 0.05) { car[o] = '.'; encre[o] = 1; }
          else if (e < 0.32) {
            if (hum[o] > 0.6) { car[o] = hsh < 0.6 ? 'Y' : hsh < 0.85 ? 'y' : 'T'; encre[o] = 3; }
            else { car[o] = hsh < 0.45 ? ',' : hsh < 0.7 ? '.' : hsh < 0.85 ? "'" : ' '; encre[o] = 3; }
          } else if (e < 0.55) {
            if (hum[o] > 0.66) { car[o] = 'Y'; encre[o] = 3; }
            else { car[o] = hsh < 0.6 ? 'n' : hsh < 0.8 ? 'm' : '.'; encre[o] = 1; }
          } else if (e < 0.82) { car[o] = hsh < 0.72 ? '^' : 'A'; encre[o] = 4; }
          else { car[o] = 'A'; encre[o] = 4; gras[o] = 1; }
        }
      }

      // 4. Rivières : de sources en hauteur, plus forte pente jusqu'à la mer ; un creux devient lac.
      var rr = rng.fork('rivieres'), sources = [];
      for (q = 0; q < n; q++) if (terre[q] && alt[q] > 0.45) sources.push(q);
      sources = rr.shuffle(sources);
      var riviere = new Uint8Array(n);
      for (var s2 = 0; s2 < Math.min(P.rivieres, sources.length); s2++) {
        var o2 = sources[s2], pas = 0;
        while (terre[o2] && pas++ < cols + rows) {
          var c2 = o2 % cols, r2 = (o2 - c2) / cols, meilleur = -1, bas = f[o2], vx = 0, vy = 0;
          for (var dy2 = -1; dy2 <= 1; dy2++) for (var dx2 = -1; dx2 <= 1; dx2++) {
            if (!dx2 && !dy2) continue;
            var c3 = c2 + dx2, r3 = r2 + dy2;
            if (c3 < 0 || r3 < 0 || c3 >= cols || r3 >= rows) continue;
            var o3 = r3 * cols + c3;
            if (f[o3] < bas) { bas = f[o3]; meilleur = o3; vx = dx2; vy = dy2; }
          }
          if (meilleur < 0) { car[o2] = 'o'; encre[o2] = 2; riviere[o2] = 1; break; }
          // Signe selon la direction (y vers le bas) : \ descend vers la droite.
          car[o2] = vy === 0 ? '-' : vx === 0 ? '|' : vx === vy ? '\\' : '/';
          encre[o2] = 2; gras[o2] = 0; riviere[o2] = 1;
          if (riviere[meilleur]) break; // rejoint une autre rivière
          o2 = meilleur;
        }
      }

      // 5. Cadre, titre, légende, rose des vents, échelle (avant les noms : ils les évitent).
      var rn = rng.fork('noms');
      var pays = nomInvente(rn);
      var place = P.legende && cols >= 44 && rows >= 22;
      function texte(c0, r0, t, e, g) { for (var k = 0; k < t.length; k++) poser(c0 + k, r0, t.charAt(k), e, g); }
      function boite(c0, r0, lignes, enc) {
        var l = Math.max.apply(null, lignes.map(function (x) { return x.length; })) + 2;
        for (var rr2 = r0; rr2 < r0 + lignes.length + 2; rr2++) for (var cc2 = c0; cc2 < c0 + l + 2; cc2++) poser(cc2, rr2, ' ', 1, 0);
        texte(c0, r0, '+' + new Array(l + 1).join('-') + '+', 1, 0);
        lignes.forEach(function (ligne, k) {
          poser(c0, r0 + 1 + k, '|', 1, 0); poser(c0 + l + 1, r0 + 1 + k, '|', 1, 0);
          if (enc) {
            // Ligne de légende : symbole dans sa couleur, libellé au trait.
            poser(c0 + 2, r0 + 1 + k, ligne.charAt(0), enc[k], ligne.charAt(0) === '@');
            texte(c0 + 3, r0 + 1 + k, ligne.slice(1), 1, 0);
          } else texte(c0 + 2, r0 + 1 + k, ligne, 1, 1);
        });
        texte(c0, r0 + lignes.length + 1, '+' + new Array(l + 1).join('-') + '+', 1, 0);
      }
      if (place) {
        for (c = 0; c < cols; c++) { poser(c, 0, '-', 1, 0); poser(c, rows - 1, '-', 1, 0); }
        for (r = 0; r < rows; r++) { poser(0, r, '|', 1, 0); poser(cols - 1, r, '|', 1, 0); }
        [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]].forEach(function (p) { poser(p[0], p[1], '+', 1, 0); });
        boite(2, 1, ['ATLAS ' + de(pays.toUpperCase()), 'feuille ' + rn.int(2, 48) + ', 1:' + rn.pick(['250 000', '500 000', '1 000 000'])]);
        var lignesLeg = LEGENDE.filter(function (x) { return !(x[0] === '|' && !P.rivieres) && !((x[0] === '@' || x[0] === 'o') && !P.villes); });
        if (rows >= lignesLeg.length + 8) {
          boite(2, rows - lignesLeg.length - 3, lignesLeg.map(function (x) { return x[0] + ' ' + x[1]; }),
            P.couleur ? lignesLeg.map(function (x) { return x[2]; }) : lignesLeg.map(function () { return 1; }));
        }
        // Rose des vents en haut à droite.
        var rc = cols - 9;
        [['    N    ', 0], ['    |    ', 1], ['W---+---E', 2], ['    |    ', 3], ['    S    ', 4]].forEach(function (l) {
          for (var k = 0; k < l[0].length; k++) poser(rc - 1 + k, 2 + l[1], l[0].charAt(k), l[0].charAt(k) === 'N' ? 4 : 1, /[NSEW]/.test(l[0].charAt(k)));
        });
        // Échelle en bas à droite.
        var ech = ['0    50   100', '|----|----|', 'lieues'];
        texte(cols - 16, rows - 5, ech[0], 1, 0);
        texte(cols - 16, rows - 4, ech[1], 1, 0);
        texte(cols - 16, rows - 3, ech[2], 1, 0);
      }

      // 6. Villes : près des côtes et des rivières, assez éloignées les unes des autres.
      var rv = rng.fork('villes'), cand = [];
      for (q = 0; q < n; q++) {
        if (!terre[q] || pris[q] || riviere[q] || alt[q] > 0.42) continue;
        var poids = (versMer[q] <= 3 ? 3 : 1) + (DL.hash2(q, 3, 5) < 0.3 ? 1 : 0);
        for (var k2 = 0; k2 < poids; k2++) cand.push(q);
      }
      cand = rv.shuffle(cand);
      var villes = [], ecartC = Math.max(6, Math.round(cols / 9)), ecartR = Math.max(3, Math.round(rows / 8));
      for (q = 0; q < cand.length && villes.length < P.villes; q++) {
        var oc = cand[q], vc = oc % cols, vr = (oc - vc) / cols;
        if (villes.some(function (v) { return Math.abs(v[0] - vc) < ecartC && Math.abs(v[1] - vr) < ecartR; })) continue;
        villes.push([vc, vr]);
      }
      villes.forEach(function (v, k) {
        var capitale = k === 0, nom = nomInvente(rv);
        poser(v[0], v[1], capitale ? '@' : 'o', capitale ? 4 : 1, true);
        var etiquette = capitale ? nom.toUpperCase() : nom, l = etiquette.length;
        // Une case vide sépare le signe de la ville de son nom (sinon « @nDELLO »).
        if (libre(v[0] + 1, v[1], l + 1)) { poser(v[0] + 1, v[1], ' ', 1, 0); texte(v[0] + 2, v[1], etiquette, 1, capitale); }
        else if (libre(v[0] - 1 - l, v[1], l + 1)) { poser(v[0] - 1, v[1], ' ', 1, 0); texte(v[0] - 1 - l, v[1], etiquette, 1, capitale); }
      });

      // 7. Noms de la mer et des monts, en capitales espacées si la place le permet.
      function espace(t) { return t.split('').join(' '); }
      // Mer : les cases les plus éloignées des côtes d'abord, jusqu'à trouver où le nom tient
      // entièrement en mer, sans toucher le cadre ni la légende.
      var largeMer = [];
      for (q = 0; q < n; q++) if (!terre[q] && versTerre[q] >= 3) largeMer.push(q);
      largeMer.sort(function (a2, b2) { return versTerre[b2] - versTerre[a2] || a2 - b2; });
      var nomMer = rn.pick(['MER ', 'GOLFE ', 'BAIE ']) + de(nomInvente(rn).toUpperCase());
      largeMer.slice(0, 400).some(function (o3) {
        return [espace(nomMer), nomMer].some(function (t) {
          var c0 = Math.round(o3 % cols - t.length / 2), r0 = Math.floor(o3 / cols);
          if (!libre(c0 - 1, r0, t.length + 2)) return false;
          for (var k = -1; k <= t.length; k++) if (terre[r0 * cols + c0 + k]) return false;
          texte(c0, r0, t, 2, 1);
          return true;
        });
      });
      var sommet = -1, aMax = 0;
      for (q = 0; q < n; q++) if (terre[q] && alt[q] > aMax) { aMax = alt[q]; sommet = q; }
      if (sommet >= 0 && aMax > 0.55) {
        var nomMonts = 'MONTS ' + de(nomInvente(rn).toUpperCase());
        [2, -2, 3, -3].some(function (dr) {
          var c0 = Math.round(sommet % cols - nomMonts.length / 2), r0 = Math.floor(sommet / cols) + dr;
          if (!libre(c0, r0, nomMonts.length)) return false;
          texte(c0, r0, nomMonts, 4, 1);
          return true;
        });
      }

      // 8. Dessin : un fillText par case occupée, centré dans sa case.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var polices = ['400 ' + corps.toFixed(3) + 'px ' + POLICE, '700 ' + corps.toFixed(3) + 'px ' + POLICE];
      var courante = -1;
      for (r = 0; r < rows; r++) {
        for (c = 0; c < cols; c++) {
          o = r * cols + c;
          if (car[o] === ' ') continue;
          if (gras[o] !== courante) { courante = gras[o]; ctx.font = polices[courante]; }
          ctx.fillStyle = pal[P.couleur ? (encre[o] || 1) : 1];
          ctx.fillText(car[o], (c + 0.5) * cw, oy + (r + 0.5) * lh);
        }
      }
    }
  });
})();

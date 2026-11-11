/* 37 Kiosk : mur d'affiches collées (canvas 2D, polices de vendor/fonts).
   Des affiches typographiques sont collées en rangées sur un mur, couche après couche, comme
   l'affichage sauvage : la même affiche est souvent répétée plusieurs fois de suite, les
   rangées se chevauchent, certaines affiches sont déchirées. Une déchirure enlève l'encre et
   laisse une bande de papier blanc (le dos de l'affiche resté collé) avant de découvrir ce
   qui est dessous. L'usure ajoute plis, décoloration et grain. Les tailles sont relatives au
   petit côté : l'export HD redonne exactement le même mur. */
(function () {
  'use strict';
  var DL = window.DL;

  var POL = {
    archivo: { css: '"Archivo Black"', g: '400', s: 'normal' },
    dela: { css: '"Dela Gothic One"', g: '400', s: 'normal' },
    grotesk: { css: '"Space Grotesk"', g: '700', s: 'normal' },
    mono: { css: '"Space Mono"', g: '700', s: 'normal' },
    serif: { css: '"Instrument Serif"', g: '400', s: 'italic' }
  };
  function fonte(p, t) { return p.s + ' ' + p.g + ' ' + Math.max(1, t).toFixed(2) + 'px ' + p.css; }

  var JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  var HEURES = ['19H', '20H', '20H30', '21H', '22H', 'MINUIT'];
  var LIEUX = ['SALLE 3', 'LE HANGAR', 'CAVE 54', 'QUAI EST', 'GRAND STUDIO', 'PLACE DU MARCHÉ', 'LA FRICHE', 'GARE NORD'];
  var PHRASES = ['ENTRÉE LIBRE', 'COMPLET', 'DERNIÈRES PLACES', 'EN CONCERT', 'CE SOIR', 'NOUVEL ALBUM', 'EN TOURNÉE', 'PREMIÈRE'];

  // Taille de police pour qu'un texte tienne dans une boîte (mesure de l'encre réelle).
  function ajuster(ctx, pol, texte, largeur, hauteur) {
    ctx.font = fonte(pol, 100);
    var mt = ctx.measureText(texte);
    var lw = Math.max(1, mt.width), lh = Math.max(1, (mt.actualBoundingBoxAscent || 72) + (mt.actualBoundingBoxDescent || 0));
    return 100 * Math.min(largeur / lw, hauteur / lh);
  }
  // Texte centré dans une boîte (x, y, largeur, hauteur), corps ajusté.
  function texteBoite(ctx, pol, texte, x, y, l, ht, couleur) {
    var t = ajuster(ctx, pol, texte, l, ht);
    ctx.font = fonte(pol, t);
    var mt = ctx.measureText(texte);
    var asc = mt.actualBoundingBoxAscent || t * 0.72, desc = mt.actualBoundingBoxDescent || 0;
    ctx.fillStyle = couleur;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(texte, x + l / 2, y + ht / 2 + (asc - desc) / 2);
  }

  // Affiche : tout est tiré du rng de l'affiche, pour qu'une copie répétée soit identique.
  function concevoir(r, mots, pal) {
    var indices = [];
    for (var i = 1; i < pal.length; i++) indices.push(i);
    var papier = r.chance(0.55) ? 1 : r.pick(indices);
    var autres = indices.filter(function (i2) { return i2 !== papier; });
    var e1 = r.pick(autres), e2 = r.pick(autres);
    var encre = chroma.contrast(pal[papier], pal[e1]) >= chroma.contrast(pal[papier], pal[e2]) ? e1 : e2;
    if (chroma.contrast(pal[papier], pal[encre]) < 2.5) {
      encre = autres.slice().sort(function (a, b) { return chroma.contrast(pal[papier], pal[b]) - chroma.contrast(pal[papier], pal[a]); })[0];
    }
    var accents = autres.filter(function (i2) { return i2 !== encre; });
    var type = r.pick(['mot', 'mot', 'chiffre', 'bandes', 'cercle', 'serif', 'grille']);
    return {
      type: type,
      papier: pal[papier], encre: pal[encre], accent: pal[accents.length ? r.pick(accents) : encre],
      mot: r.pick(mots),
      chiffre: String(r.int(1, 31)),
      date: r.pick(JOURS) + ' ' + r.int(1, 28) + '.' + ('0' + r.int(1, 12)).slice(-2),
      heure: r.pick(HEURES),
      lieu: r.pick(LIEUX),
      phrase: r.pick(PHRASES),
      vertical: r.chance(0.3),
      bandes: r.int(4, 7),
      police: r.pick(['archivo', 'dela', 'grotesk']),
      ratio: type === 'grille' ? 1.1 : r.pick([1.414, 1.414, 1.3, 1.5])
    };
  }

  // Dessin d'une affiche dans son repère (0, 0)-(l, ht).
  function dessinerDesign(ctx, D, l, ht) {
    var marge = l * 0.07, pied = ht * 0.13, infos = D.date + '  ' + D.heure;
    ctx.fillStyle = D.papier;
    ctx.fillRect(0, 0, l, ht);
    function pieds() {
      ctx.fillStyle = D.encre;
      ctx.fillRect(marge, ht - pied - ht * 0.012, l - 2 * marge, Math.max(1, ht * 0.006));
      texteBoite(ctx, POL.mono, infos, marge, ht - pied + ht * 0.012, l - 2 * marge, pied * 0.36, D.encre);
      texteBoite(ctx, POL.mono, D.lieu + ' · ' + D.phrase, marge, ht - pied * 0.5, l - 2 * marge, pied * 0.3, D.encre);
    }
    if (D.type === 'mot') {
      if (D.vertical && D.mot.length <= 9) {
        ctx.save();
        ctx.translate(l / 2, (ht - pied) / 2);
        ctx.rotate(-Math.PI / 2);
        texteBoite(ctx, POL[D.police], D.mot, -(ht - pied) * 0.46, -l * 0.44, (ht - pied) * 0.92, l * 0.88, D.encre);
        ctx.restore();
      } else {
        texteBoite(ctx, POL[D.police], D.mot, marge, ht * 0.08, l - 2 * marge, ht * 0.42, D.encre);
        ctx.fillStyle = D.accent;
        ctx.fillRect(marge, ht * 0.56, l - 2 * marge, ht * 0.2);
        texteBoite(ctx, POL.grotesk, D.phrase, marge * 1.6, ht * 0.585, l - 3.2 * marge, ht * 0.14, D.papier);
      }
      pieds();
    } else if (D.type === 'chiffre') {
      texteBoite(ctx, POL.grotesk, D.mot, marge, ht * 0.06, l - 2 * marge, ht * 0.12, D.encre);
      texteBoite(ctx, POL.dela, D.chiffre, marge, ht * 0.2, l - 2 * marge, ht * 0.52, D.accent);
      pieds();
    } else if (D.type === 'bandes') {
      var n = D.bandes, bh = ht / n;
      for (var k = 0; k < n; k++) {
        var fond = k % 2 ? D.encre : D.papier, encre = k % 2 ? D.papier : D.encre;
        if (k === n - 1) fond = D.accent;
        ctx.fillStyle = fond;
        ctx.fillRect(0, k * bh, l, bh + 1);
        texteBoite(ctx, POL[D.police], D.mot, marge, k * bh + bh * 0.14, l - 2 * marge, bh * 0.72, k === n - 1 ? D.papier : encre);
      }
    } else if (D.type === 'cercle') {
      ctx.fillStyle = D.accent;
      ctx.beginPath();
      ctx.arc(l / 2, ht * 0.4, l * 0.4, 0, Math.PI * 2);
      ctx.fill();
      texteBoite(ctx, POL[D.police], D.mot, marge * 0.6, ht * 0.32, l - 1.2 * marge, ht * 0.16, D.encre);
      pieds();
    } else if (D.type === 'serif') {
      ctx.fillStyle = D.encre;
      ctx.fillRect(marge, ht * 0.1, l - 2 * marge, Math.max(1, ht * 0.004));
      texteBoite(ctx, POL.mono, D.phrase, marge, ht * 0.125, l - 2 * marge, ht * 0.04, D.encre);
      texteBoite(ctx, POL.serif, D.mot.charAt(0) + D.mot.slice(1).toLowerCase(), marge, ht * 0.22, l - 2 * marge, ht * 0.38, D.encre);
      ctx.fillRect(marge, ht * 0.7, l - 2 * marge, Math.max(1, ht * 0.004));
      texteBoite(ctx, POL.serif, D.date + ', ' + D.heure.toLowerCase(), marge, ht * 0.73, l - 2 * marge, ht * 0.07, D.accent);
      texteBoite(ctx, POL.mono, D.lieu, marge, ht * 0.86, l - 2 * marge, ht * 0.035, D.encre);
    } else {
      // Grille : une lettre par case, cases de couleurs alternées.
      var lettres = D.mot.replace(/\s+/g, '').slice(0, 9).split('');
      var colsG = lettres.length <= 4 ? 2 : 3, rangs = Math.ceil(lettres.length / colsG);
      var cl = l / colsG, ch = (ht - pied) / rangs;
      lettres.forEach(function (lettre, i) {
        var cx = (i % colsG) * cl, cy = Math.floor(i / colsG) * ch, alt = (i + Math.floor(i / colsG)) % 2;
        ctx.fillStyle = alt ? D.accent : D.encre;
        ctx.fillRect(cx, cy, cl + 1, ch + 1);
        texteBoite(ctx, POL.archivo, lettre, cx + cl * 0.1, cy + ch * 0.12, cl * 0.8, ch * 0.76, D.papier);
      });
      pieds();
    }
  }

  // Bord déchiré : ligne brisée de A vers B, déviée perpendiculairement par un bruit.
  function bordDechire(A, B, amp, r, n) {
    var pts = [], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L, ph = r.range(0, 10);
    for (var k = 0; k <= n; k++) {
      var t = k / n, bord = Math.sin(Math.PI * t);
      var d = amp * bord * (0.6 * Math.sin(t * 7 + ph) + 0.4 * (r() - 0.5) * 2);
      pts.push([A[0] + dx * t + nx * d, A[1] + dy * t + ny * d]);
    }
    return pts;
  }

  /* Déchirure : deux polygones emboîtés. Extérieur = encre arrachée ; intérieur = papier
     arraché aussi (on voit dessous). Entre les deux reste le papier blanc. */
  function dechirure(r, l, ht, m) {
    var genre = r.pick(['coin', 'coin', 'haut', 'bas']);
    var amp = m * 0.025, n = 22, profondeur = m * r.range(0.012, 0.03), coin, A, B;
    if (genre === 'coin') {
      var cx = r.chance(0.5) ? 0 : l, cy = r.chance(0.5) ? 0 : ht;
      coin = [[cx, cy]];
      A = [cx === 0 ? l * r.range(0.3, 0.85) : l * r.range(0.15, 0.7), cy];
      B = [cx, cy === 0 ? ht * r.range(0.25, 0.75) : ht * r.range(0.25, 0.75)];
    } else {
      var y1 = ht * (genre === 'haut' ? r.range(0.15, 0.5) : r.range(0.5, 0.85)), y2 = ht * (genre === 'haut' ? r.range(0.15, 0.5) : r.range(0.5, 0.85));
      coin = genre === 'haut' ? [[l, 0], [0, 0]] : [[0, ht], [l, ht]];
      A = genre === 'haut' ? [0, y1] : [l, y1];
      B = genre === 'haut' ? [l, y2] : [0, y2];
    }
    var exterieur = bordDechire(A, B, amp, r, n);
    // Le bord intérieur est décalé vers la partie arrachée (vers le coin), avec son propre bruit.
    var ref = coin.reduce(function (s, p) { return [s[0] + p[0] / coin.length, s[1] + p[1] / coin.length]; }, [0, 0]);
    var interieur = bordDechire(A, B, amp * 0.7, r, n).map(function (p) {
      var vx = ref[0] - p[0], vy = ref[1] - p[1], L = Math.hypot(vx, vy) || 1;
      return [p[0] + vx / L * profondeur, p[1] + vy / L * profondeur];
    });
    return { exterieur: exterieur.concat(coin), interieur: interieur.concat(coin) };
  }

  function chemin(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }

  DL.enregistrer({
    id: 'kiosk',
    numero: '37',
    nom: 'Kiosk',
    famille: 'impression',
    description: "Mur d'affiches collées : typographie, affiches répétées, papier déchiré et usé.",
    libs: ['Canvas 2D', 'polices locales', 'chroma.js'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#8D8880', '#F2EEE6', '#141414', '#E63B2E', '#F2C230', '#2F5DD8'],
    params: [
      { cle: 'texte', label: 'Mots (/ entre chaque)', type: 'texte', max: 60, defaut: 'BRUIT/NUIT/LIVE/EXPO/FÊTE' },
      { cle: 'couches', label: 'Couches', type: 'range', min: 1, max: 4, pas: 1, defaut: 2 },
      { cle: 'echelle', label: 'Taille des affiches', type: 'range', min: 0.4, max: 1.6, pas: 0.05, defaut: 1 },
      { cle: 'repetition', label: 'Répétition', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'dechirures', label: 'Déchirures', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'desordre', label: 'Désordre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'usure', label: 'Usure', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      var mots = String(P.texte || '').split('/').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      if (!mots.length) mots = ['KIOSK'];

      // Grain : une petite texture de bruit répétée sans lissage, à une échelle relative au
      // petit côté, posée en « overlay » sur le mur puis sur chaque affiche (jamais sur le vide
      // d'un fond transparent).
      var motifGrain = null, echelleGrain = Math.max(1, m / 900);
      if (P.usure > 0) {
        var T = 128, tex = document.createElement('canvas');
        tex.width = T; tex.height = T;
        var tc = tex.getContext('2d'), img = tc.createImageData(T, T), s = DL.hacher(String(rng.seed) + 'grain');
        for (var q = 0; q < T * T; q++) {
          var v = 100 + Math.floor(DL.hash2(q % T, Math.floor(q / T), s) * 56);
          img.data[q * 4] = img.data[q * 4 + 1] = img.data[q * 4 + 2] = v;
          img.data[q * 4 + 3] = 255;
        }
        tc.putImageData(img, 0, 0);
        motifGrain = ctx.createPattern(tex, 'repeat');
      }
      function grain(x, y, l, ht, force) {
        if (!motifGrain) return;
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = force;
        ctx.imageSmoothingEnabled = false;
        ctx.scale(echelleGrain, echelleGrain);
        ctx.fillStyle = motifGrain;
        ctx.fillRect(x / echelleGrain, y / echelleGrain, l / echelleGrain + 1, ht / echelleGrain + 1);
        ctx.restore();
      }

      if (!pal.transparent) {
        ctx.fillStyle = pal[0];
        ctx.fillRect(0, 0, w, h);
        grain(0, 0, w, h, 0.6 * P.usure);
      }

      // 1. Plan de collage : rangées par couche, copies successives de la même affiche.
      var ht0 = m * 0.46 * P.echelle;
      var affiches = [];
      for (var c = 0; c < P.couches; c++) {
        var rl = rng.fork('couche' + c);
        var y = -ht0 * rl.range(0.05, 0.45) + c * ht0 * 0.37;
        if (c > 0) y -= ht0;
        while (y < h) {
          var rangH = ht0 * rl.range(0.92, 1.08), x = -rangH / 1.414 * rl.range(0.1, 0.7), precedent = null;
          while (x < w) {
            var D = precedent && rl.chance(P.repetition) ? precedent : concevoir(rl.fork('a' + affiches.length), mots, pal);
            var l = rangH / D.ratio;
            if (c === 0 || rl.chance(0.55)) {
              affiches.push({
                x: x, y: y, l: l, h: rangH, D: D,
                rot: (rl() - 0.5) * P.desordre * 0.06,
                dx: (rl() - 0.5) * P.desordre * 0.04 * m, dy: (rl() - 0.5) * P.desordre * 0.05 * m,
                dechire: rl.chance(P.dechirures * (c === P.couches - 1 ? 1 : 0.7)) ? rl.fork('d' + affiches.length) : null,
                plis: rl.fork('p' + affiches.length),
                use: rl()
              });
            }
            x += l * (1 - P.desordre * rl.range(0, 0.1));
            precedent = D;
          }
          y += rangH * (1 - P.desordre * rl.range(0, 0.12));
        }
      }

      // 2. Collage, de la première couche à la dernière.
      affiches.forEach(function (A) {
        ctx.save();
        ctx.translate(A.x + A.l / 2 + A.dx, A.y + A.h / 2 + A.dy);
        ctx.rotate(A.rot);
        ctx.translate(-A.l / 2, -A.h / 2);
        var dech = A.dechire ? dechirure(A.dechire, A.l, A.h, m) : null;

        // Partie imprimée : affiche moins la déchirure extérieure.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, A.l, A.h);
        ctx.clip();
        if (dech) {
          ctx.beginPath();
          ctx.rect(-A.l, -A.h, 3 * A.l, 3 * A.h);
          chemin(ctx, dech.exterieur);
          ctx.clip('evenodd');
        }
        dessinerDesign(ctx, A.D, A.l, A.h);
        // Usure : décoloration, plis (un trait clair, un trait sombre côte à côte).
        var u = P.usure * (0.4 + 0.6 * A.use);
        if (u > 0) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * u).toFixed(3) + ')';
          ctx.fillRect(0, 0, A.l, A.h);
          var rp = A.plis;
          var plis = Math.round(u * 3);
          for (var k = 0; k < plis; k++) {
            var px = rp.range(0.1, 0.9) * A.l, ang = rp.range(-0.4, 0.4) + (rp.chance(0.5) ? 0 : Math.PI / 2);
            ctx.save();
            ctx.translate(px, A.h / 2);
            ctx.rotate(ang);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.22 * u).toFixed(3) + ')';
            ctx.fillRect(-m * 0.002, -A.h, m * 0.002, 2 * A.h);
            ctx.fillStyle = 'rgba(0,0,0,' + (0.18 * u).toFixed(3) + ')';
            ctx.fillRect(0, -A.h, m * 0.003, 2 * A.h);
            ctx.restore();
          }
        }
        grain(0, 0, A.l, A.h, 0.45 * P.usure);
        ctx.restore();

        // Papier blanc resté collé entre les deux bords de la déchirure.
        if (dech) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, A.l, A.h);
          ctx.clip();
          ctx.beginPath();
          chemin(ctx, dech.exterieur);
          chemin(ctx, dech.interieur);
          ctx.fillStyle = chroma.mix(pal[1], '#FFFFFF', 0.5).hex();
          ctx.fill('evenodd');
          ctx.restore();
        }
        ctx.restore();
      });
    }
  });
})();

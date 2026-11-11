/* 40 Stipple : portraits en pointillé (canvas 2D + d3-delaunay).
   Le sujet est une image importée par l'utilisateur (images.js : elle reste sur l'appareil) ou,
   sans image, un sujet généré : buste en plâtre (petit lancer de rayons sur une surface à
   distance signée), sphères éclairées ou drapé. Sa luminance donne une densité d'encre.
   Pointillé par relaxation de Voronoi pondérée (Secord, 2002) : des points tirés selon la
   densité sont déplacés à plusieurs reprises vers le centre de gravité pondéré de leur cellule ;
   ils s'espacent régulièrement tout en restant plus serrés dans les ombres.
   Tout est calculé sur une grille dont la taille ne dépend que des réglages, du sujet et du
   format (rapport arrondi au 1/64), jamais de la taille de rendu : l'aperçu et l'export HD
   placent les mêmes points. La relaxation, partie lente, est mémorisée : changer les
   couleurs ou la taille des points redessine sans recalculer. */
(function () {
  'use strict';
  var DL = window.DL;

  // Derniers calculs (mémo de fonctions pures : même clé, même résultat).
  var memoSujet = { cle: null, val: null };
  var memoPoints = { cle: null, val: null };

  function norme(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  /* ---------- Sujet 1 : sphères sur un sol (repère écran : x à droite, y vers le bas) ---------- */
  function sujetSpheres(r, ax, ay) {
    var cote = r.chance(0.5) ? -1 : 1;
    var L = norme([0.6 * cote, -0.62, 0.55]), H = norme([L[0], L[1], L[2] + 1]);
    var horizon = r.range(-0.05, 0.1), bas = ay * 0.92;
    var boules = [], n = r.int(3, 5);
    for (var k = 0; k < n; k++) {
      var z = n === 1 ? 1 : k / (n - 1), rad = r.range(0.1, 0.17) * (0.65 + 0.6 * z);
      var yc = horizon + (bas - horizon) * (0.3 + 0.7 * z), cx = 0;
      for (var essai = 0; essai < 30; essai++) {
        cx = r.range(-ax + rad, ax - rad);
        var ok = boules.every(function (b) { return Math.abs(b.cx - cx) > (b.rad + rad) * 0.75 || Math.abs(b.yc - yc) > rad; });
        if (ok) break;
      }
      boules.push({ cx: cx, cy: yc - rad, yc: yc, rad: rad, albedo: r.range(0.6, 1) });
    }
    // Les plus proches (bas de l'image) masquent les autres : on les teste en premier.
    var ordre = boules.slice().sort(function (a, b) { return b.yc - a.yc; });
    return function (X, Y) {
      for (var i = 0; i < ordre.length; i++) {
        var b = ordre[i], nx = (X - b.cx) / b.rad, ny = (Y - b.cy) / b.rad, q = nx * nx + ny * ny;
        if (q >= 1) continue;
        var nz = Math.sqrt(1 - q);
        var dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        var spec = Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 60);
        var rebond = Math.max(0, ny) * 0.16;
        return DL.clamp(b.albedo * (0.05 + 0.86 * dif + rebond) + 0.45 * spec, 0, 1);
      }
      // Fond : mur puis sol, ombres portées à l'opposé de la lumière.
      if (Y < horizon) return 0.74 + 0.12 * (1 - Math.abs(X) / (ax + 0.01));
      var lum = 0.88 + 0.08 * (Y - horizon) / (ay - horizon + 1e-6), ombre = 0;
      for (i = 0; i < boules.length; i++) {
        b = boules[i];
        var sx = b.cx - L[0] / Math.max(0.2, -L[1]) * b.rad * 0.9, sy = b.yc + b.rad * 0.04;
        var ex = (X - sx) / (b.rad * 1.35), ey = (Y - sy) / (b.rad * 0.3), e = Math.sqrt(ex * ex + ey * ey);
        ombre = Math.max(ombre, 0.55 * (1 - DL.smooth(0.55, 1, e)));
        var cx2 = (X - b.cx) / (b.rad * 0.55), cy2 = (Y - b.yc) / (b.rad * 0.1);
        ombre = Math.max(ombre, 0.7 * (1 - DL.smooth(0.3, 1, Math.sqrt(cx2 * cx2 + cy2 * cy2))));
      }
      return lum * (1 - ombre);
    };
  }

  /* ---------- Sujet 2 : drapé (relief de plis, éclairage rasant) ---------- */
  function sujetDrape(r, ax, ay) {
    var bruit = DL.creerBruit(r.fork('drape'));
    var plis = [], n = r.int(6, 11);
    for (var k = 0; k < n; k++) {
      plis.push({
        x0: r.range(-ax, ax) * 0.8, x1: r.range(-ax, ax) * 1.3,
        a: r.range(0.4, 1) * (r.chance(0.3) ? -0.6 : 1), s: r.range(0.025, 0.07)
      });
    }
    var cote = r.chance(0.5) ? -1 : 1, L = norme([0.6 * cote, -0.4, 0.75]);
    function hauteur(X, Y) {
      var t = (Y + ay) / (2 * ay), hsum = 0;
      for (var i = 0; i < plis.length; i++) {
        var p = plis[i], xc = p.x0 + (p.x1 - p.x0) * t + 0.035 * Math.sin(Y * 9 + i);
        var s = p.s * (0.55 + 0.9 * t), d = (X - xc) / s;
        hsum += p.a * s * Math.exp(-d * d);
      }
      return hsum + 0.02 * bruit.fbm2(X * 3, Y * 3, 3);
    }
    var e = 0.003;
    // Relief lisse : calculé sur une petite grille puis lu en bilinéaire (sinon plus d'une
    // seconde sur une grille de densité fine, pour un résultat identique à l'œil).
    return grilleLisse(function (X, Y) {
      var dx = (hauteur(X + e, Y) - hauteur(X - e, Y)) / (2 * e), dy = (hauteur(X, Y + e) - hauteur(X, Y - e)) / (2 * e);
      var n = norme([-dx * 1.6, -dy * 1.6, 1]);
      var dif = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      return DL.clamp(0.06 + 0.98 * dif, 0, 1);
    }, ax, ay, 300);
  }

  /* Précalcule f(X, Y) sur une grille de n cases au grand côté et renvoie sa lecture
     bilinéaire, en coordonnées centrées (X dans [−ax, ax], Y dans [−ay, ay]). */
  function grilleLisse(f, ax, ay, n) {
    var lw = Math.max(8, Math.round(n * Math.min(1, ax / ay))), lh = Math.max(8, Math.round(n * Math.min(1, ay / ax)));
    var g = new Float32Array(lw * lh);
    for (var j = 0; j < lh; j++) {
      for (var i = 0; i < lw; i++) g[j * lw + i] = f(((i + 0.5) / lw - 0.5) * 2 * ax, ((j + 0.5) / lh - 0.5) * 2 * ay);
    }
    return function (X, Y) {
      var fx = DL.clamp((X / (2 * ax) + 0.5) * lw - 0.5, 0, lw - 1), fy = DL.clamp((Y / (2 * ay) + 0.5) * lh - 0.5, 0, lh - 1);
      var x0 = Math.floor(fx), x1 = Math.min(lw - 1, x0 + 1), tx = fx - x0;
      var y0 = Math.floor(fy), y1 = Math.min(lh - 1, y0 + 1), ty = fy - y0;
      return (g[y0 * lw + x0] * (1 - tx) + g[y0 * lw + x1] * tx) * (1 - ty) + (g[y1 * lw + x0] * (1 - tx) + g[y1 * lw + x1] * tx) * ty;
    };
  }

  /* ---------- Sujet 3 : buste en plâtre, par lancer de rayons sur une distance signée ----------
     Repère objet : y vers le haut, z vers le spectateur. Formes : ellipsoïdes et capsules
     fondues entre elles (union douce), orbites et commissure creusées (soustraction douce). */
  function sdEll(x, y, z, rx, ry, rz) {
    var a = x / rx, b = y / ry, c = z / rz, k0 = Math.sqrt(a * a + b * b + c * c);
    var a2 = a / rx, b2 = b / ry, c2 = c / rz, k1 = Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  }
  function sdCap(x, y, z, ax, ay, az, bx, by, bz, rr) {
    var px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
    var t = DL.clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
    var dx = px - vx * t, dy = py - vy * t, dz = pz - vz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - rr;
  }
  function smin(a, b, k) { var hh = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - hh * hh * k * 0.25; }
  function smax(a, b, k) { return -smin(-a, -b, k); }

  function creerBuste(r) {
    var F = {
      nez: r.range(0.9, 1.15), menton: r.range(0.9, 1.15), crane: r.range(0.96, 1.05),
      cheveux: r.pick(['court', 'boucles', 'chignon', 'nu']), boucle: r.range(70, 110)
    };
    function tete(x, y, z) {
      // Englobant : loin de la tête, la distance à une sphère suffit (et accélère la marche).
      var b = Math.sqrt(x * x + (y - 0.24) * (y - 0.24) + (z - 0.02) * (z - 0.02)) - 0.27;
      if (b > 0.06) return b;
      var ax = Math.abs(x);
      var d = sdEll(x, y - 0.3, z + 0.015, 0.148 * F.crane, 0.178, 0.172);
      d = smin(d, sdEll(x, y - 0.175, z - 0.04, 0.112, 0.148, 0.13), 0.06);
      d = smin(d, sdEll(x, y - 0.075 - 0.01 * (F.menton - 1), z - 0.088 * F.menton, 0.05, 0.042, 0.05), 0.045);
      d = smin(d, sdEll(ax - 0.068, y - 0.205, z - 0.085, 0.048, 0.032, 0.05), 0.04);
      d = smin(d, sdEll(x, y - 0.272, z - 0.118, 0.1, 0.026, 0.048), 0.03);
      d = smax(d, -sdEll(ax - 0.047, y - 0.238, z - 0.162, 0.034, 0.024, 0.035), 0.02);
      d = smin(d, sdEll(ax - 0.047, y - 0.238, z - 0.122, 0.025, 0.021, 0.024), 0.01);
      d = smin(d, sdCap(x, y, z, 0, 0.262, 0.15, 0, 0.19, 0.155 + 0.05 * F.nez, 0.017), 0.022);
      d = smin(d, sdEll(x, y - 0.185, z - 0.165 - 0.035 * (F.nez - 1), 0.027, 0.02, 0.024), 0.014);
      d = smin(d, sdEll(x, y - 0.139, z - 0.162, 0.042, 0.012, 0.02), 0.012);
      d = smin(d, sdEll(x, y - 0.118, z - 0.156, 0.036, 0.014, 0.02), 0.012);
      d = smax(d, -sdEll(x, y - 0.129, z - 0.178, 0.04, 0.0028, 0.02), 0.004);
      d = smin(d, sdEll(ax - 0.147, y - 0.232, z + 0.01, 0.016, 0.042, 0.028), 0.012);
      // Cheveux : calotte un peu plus grande que le crâne, gardée au-dessus d'un plan incliné
      // (haut du front devant, nuque derrière) ; boucles = petites bosses périodiques.
      if (F.cheveux !== 'nu') {
        var ch = sdEll(x, y - 0.312, z + 0.028, 0.161 * F.crane, 0.19, 0.186);
        ch = smax(ch, -(y - 0.3 - 0.95 * (z - 0.07)), 0.02);
        if (F.cheveux === 'boucles') ch += 0.006 * Math.sin(x * F.boucle) * Math.sin(y * F.boucle) * Math.sin(z * F.boucle);
        d = smin(d, ch, 0.012);
        if (F.cheveux === 'chignon') d = smin(d, Math.sqrt(x * x + (y - 0.37) * (y - 0.37) + (z + 0.15) * (z + 0.15)) - 0.07, 0.03);
      }
      return d;
    }
    function corps(x, y, z) {
      var b = Math.sqrt(x * x + (y + 0.22) * (y + 0.22) + z * z) - 0.38;
      if (b > 0.06) return b;
      var d = sdCap(x, y, z, 0, 0.12, -0.02, 0, -0.15, -0.015, 0.062);
      var torse = sdEll(x, y + 0.24, z + 0.015, 0.29, 0.13, 0.14);
      torse = smax(torse, -(y + 0.3), 0.012);
      d = smin(d, torse, 0.07);
      // Socle : cylindre court sous la coupe.
      var qx = Math.sqrt(x * x + z * z) - 0.1, qy = Math.abs(y + 0.37) - 0.065;
      var socle = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      return Math.min(d, socle);
    }
    return function (x, y, z) { return smin(tete(x, y, z), corps(x, y, z), 0.05); };
  }

  function sujetBuste(r, ax, ay) {
    var sdf = creerBuste(r.fork('forme'));
    var cote = r.chance(0.5) ? -1 : 1;
    var lacet = r.range(0.25, 0.65) * (r.chance(0.5) ? -1 : 1), tangage = r.range(-0.06, 0.1);
    var Lw = norme([0.62 * cote, 0.5, 0.6]);
    var cy = Math.cos(lacet), sy = Math.sin(lacet), cp = Math.cos(tangage), sp = Math.sin(tangage);
    // Monde → objet : rotation inverse (lacet autour de y, puis tangage autour de x).
    function versObjet(v) {
      var x = v[0] * cy - v[2] * sy, z = v[0] * sy + v[2] * cy, y = v[1];
      return [x, y * cp + z * sp, -y * sp + z * cp];
    }
    var Lo = versObjet(Lw), dirO = versObjet([0, 0, -1]), vueO = versObjet([0, 0, 1]);
    var echelle = 0.94, centreY = 0.03;

    var e = 0.0015;
    // Un rayon par case d'une grille réduite (le relief est lisse : 170 cases au grand côté),
    // lue ensuite en bilinéaire à la résolution voulue.
    return grilleLisse(function (X, Y) {
        var o = versObjet([X / echelle, -Y / echelle + centreY, 1.2]);
        // Entrée dans la sphère englobante (centre (0, 0.03, 0), rayon 0.62).
        var ox = o[0], oy = o[1] - 0.03, oz = o[2];
        var bq = ox * dirO[0] + oy * dirO[1] + oz * dirO[2], cq = ox * ox + oy * oy + oz * oz - 0.3844, disc = bq * bq - cq;
        // Fond : plus sombre du côté éclairé du buste, plus clair du côté de l'ombre (les deux
        // bords du buste se détachent), sans aller jusqu'au noir (points empâtés).
        var lum = 0.6 + 0.28 * DL.smooth(-0.6, 0.6, -cote * X) - 0.08 * (X * X + Y * Y);
        if (disc > 0) {
          var t = Math.max(0, -bq - Math.sqrt(disc)), tmax = -bq + Math.sqrt(disc), touche = false, px = 0, py = 0, pz = 0;
          for (var it = 0; it < 96 && t < tmax; it++) {
            px = o[0] + dirO[0] * t; py = o[1] + dirO[1] * t; pz = o[2] + dirO[2] * t;
            var dd = sdf(px, py, pz);
            if (dd < 0.0012) { touche = true; break; }
            t += dd * 0.9;
          }
          if (touche) {
            // Normale (tétraèdre), ombre douce vers la lumière, occlusion ambiante.
            var a1 = sdf(px + e, py - e, pz - e), a2 = sdf(px - e, py - e, pz + e), a3 = sdf(px - e, py + e, pz - e), a4 = sdf(px + e, py + e, pz + e);
            var n = norme([a1 - a2 - a3 + a4, -a1 - a2 + a3 + a4, -a1 + a2 - a3 + a4]);
            var dif = Math.max(0, n[0] * Lo[0] + n[1] * Lo[1] + n[2] * Lo[2]);
            var ombre = 1, ts = 0.012;
            if (dif > 0) {
              for (var s = 0; s < 32 && ts < 0.8; s++) {
                var hs = sdf(px + n[0] * 0.004 + Lo[0] * ts, py + n[1] * 0.004 + Lo[1] * ts, pz + n[2] * 0.004 + Lo[2] * ts);
                if (hs < 0.0006) { ombre = 0; break; }
                ombre = Math.min(ombre, 9 * hs / ts);
                ts += DL.clamp(hs, 0.005, 0.06);
              }
            }
            var occ = 0, poids = 1;
            for (var q = 1; q <= 4; q++) {
              var hq = 0.008 * q;
              occ += (hq - sdf(px + n[0] * hq, py + n[1] * hq, pz + n[2] * hq)) * poids;
              poids *= 0.7;
            }
            var ao = DL.clamp(1 - 9 * occ, 0, 1);
            var bord = Math.pow(1 - Math.max(0, n[0] * vueO[0] + n[1] * vueO[1] + n[2] * vueO[2]), 3);
            lum = DL.clamp(0.04 + 0.86 * dif * DL.clamp(ombre, 0, 1) + 0.2 * ao + 0.12 * bord, 0, 1);
          }
        }
        return lum;
    }, ax, ay, 170);
  }

  /* Sujet généré : fonction (X, Y) → luminance (0 noir, 1 blanc), en coordonnées centrées
     (unité = petit côté). Mémorisée : le buste, seul calcul lourd, n'est lancé qu'une fois
     par seed et par format. */
  function sujetGenere(sujet, rng, aspect) {
    var cle = sujet + '|' + rng.seed + '|' + aspect;
    if (memoSujet.cle === cle) return memoSujet.val;
    var ax = aspect >= 1 ? aspect / 2 : 0.5, ay = aspect >= 1 ? 0.5 : 0.5 / aspect;
    var r = rng.fork('sujet-' + sujet);
    var f = sujet === 'buste' ? sujetBuste(r, ax, ay) : sujet === 'drape' ? sujetDrape(r, ax, ay) : sujetSpheres(r, ax, ay);
    memoSujet.cle = cle;
    memoSujet.val = { f: f, ax: ax, ay: ay };
    return memoSujet.val;
  }

  // Luminance d'un sujet généré sur une grille gw × gh.
  function grilleSujet(s, gw, gh) {
    var out = new Float32Array(gw * gh);
    for (var j = 0; j < gh; j++) {
      for (var i = 0; i < gw; i++) out[j * gw + i] = s.f(((i + 0.5) / gw - 0.5) * 2 * s.ax, ((j + 0.5) / gh - 0.5) * 2 * s.ay);
    }
    return out;
  }

  /* Densité d'encre : obscurité (ou clarté en négatif), niveaux automatiques (2e et 98e
     centiles), puis contraste autour du gris moyen. */
  function densite(lum, negatif, contraste) {
    var n = lum.length, d = new Float32Array(n), histo = new Uint32Array(256);
    for (var i = 0; i < n; i++) { d[i] = negatif ? lum[i] : 1 - lum[i]; histo[Math.min(255, Math.floor(d[i] * 256))]++; }
    var cumul = 0, bas = 0, haut = 1, k;
    for (k = 0; k < 256; k++) { cumul += histo[k]; if (cumul >= n * 0.02) { bas = k / 256; break; } }
    cumul = 0;
    for (k = 255; k >= 0; k--) { cumul += histo[k]; if (cumul >= n * 0.02) { haut = (k + 1) / 256; break; } }
    var ecart = Math.max(0.05, haut - bas);
    for (i = 0; i < n; i++) d[i] = DL.clamp(0.5 + ((d[i] - bas) / ecart - 0.5) * contraste, 0, 1);
    return d;
  }

  /* Placement initial par diffusion d'erreur (Floyd-Steinberg en serpentin) : les points
     partent déjà à peu près régulièrement espacés. Un tirage au hasard forme des amas que la
     relaxation met des dizaines de passes à défaire (défauts en étoile dans les aplats
     sombres). Le compte est ensuite ajusté à N exactement : retraits au hasard, ou
     compléments tirés selon la densité. */
  function placer(dens, gw, gh, N, total, cdf, rng) {
    var k = N / total, cur = new Float32Array(gw + 2), next = new Float32Array(gw + 2), out = [];
    for (var y = 0; y < gh; y++) {
      var sens = y % 2 ? -1 : 1, x0 = sens > 0 ? 0 : gw - 1;
      for (var s = 0; s < gw; s++) {
        var x = x0 + s * sens, v = dens[y * gw + x] * k + cur[x + 1];
        var q = v >= 0.5 ? 1 : 0;
        if (q) out.push(x + 0.5 + (rng() - 0.5) * 0.6, y + 0.5 + (rng() - 0.5) * 0.6);
        var e = v - q;
        cur[x + 1 + sens] += e * 7 / 16;
        next[x + 1 - sens] += e * 3 / 16;
        next[x + 1] += e * 5 / 16;
        next[x + 1 + sens] += e / 16;
      }
      var t = cur; cur = next; next = t; next.fill(0);
    }
    var nb = out.length / 2;
    while (nb > N) {
      var j = Math.floor(rng() * nb);
      out[2 * j] = out[2 * nb - 2]; out[2 * j + 1] = out[2 * nb - 1];
      out.length -= 2; nb--;
    }
    while (nb < N) {
      var u = rng() * total, a = 0, b = cdf.length - 1;
      while (a < b) { var c = (a + b) >> 1; if (cdf[c] < u) a = c + 1; else b = c; }
      out.push((a % gw) + rng(), Math.floor(a / gw) + rng());
      nb++;
    }
    return Float64Array.from(out);
  }

  // Placement des points selon la densité puis relaxation de Lloyd pondérée.
  function pointiller(dens, gw, gh, N, iterations, rng) {
    var n = gw * gh, cdf = new Float64Array(n), total = 0;
    for (var i = 0; i < n; i++) { total += dens[i]; cdf[i] = total; }
    if (total < 1e-6) return { pts: new Float64Array(0), total: 0 };
    var pts = placer(dens, gw, gh, N, total, cdf, rng), p;
    var del = new d3.Delaunay(pts);
    var sx = new Float64Array(N), sy = new Float64Array(N), sw = new Float64Array(N);
    for (var it = 0; it < iterations; it++) {
      sx.fill(0); sy.fill(0); sw.fill(0);
      var proche = 0;
      for (var y = 0; y < gh; y++) {
        for (var x = 0; x < gw; x++) {
          var wgt = dens[y * gw + x];
          if (wgt < 0.01) continue; // zones blanches : aucun point à attirer
          proche = del.find(x + 0.5, y + 0.5, proche);
          sx[proche] += wgt * (x + 0.5); sy[proche] += wgt * (y + 0.5); sw[proche] += wgt;
        }
      }
      for (p = 0; p < N; p++) if (sw[p] > 0) { pts[2 * p] = sx[p] / sw[p]; pts[2 * p + 1] = sy[p] / sw[p]; }
      del.update();
    }
    return { pts: pts, total: total };
  }

  DL.enregistrer({
    id: 'stipple',
    numero: '40',
    nom: 'Stipple',
    famille: 'impression',
    description: 'Portraits en pointillé : ta photo (importée, elle reste sur ton appareil) ou un sujet généré, en milliers de points.',
    libs: ['Canvas 2D', 'd3-delaunay'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 3,
    palette: ['#F3EEE4', '#161616', '#C8452F'],
    params: [
      { cle: 'image', label: 'Image', type: 'image', defaut: '' },
      { cle: 'sujet', label: 'Sujet sans image', type: 'select', defaut: 'buste', options: [
        { valeur: 'buste', label: 'Buste' }, { valeur: 'spheres', label: 'Sphères' }, { valeur: 'drape', label: 'Drapé' }] },
      { cle: 'points', label: 'Points', type: 'range', min: 1000, max: 30000, pas: 500, defaut: 9000 },
      { cle: 'regularite', label: 'Régularité', type: 'range', min: 0, max: 20, pas: 1, defaut: 10 },
      { cle: 'contraste', label: 'Contraste', type: 'range', min: 0.5, max: 2.5, pas: 0.05, defaut: 1.2 },
      { cle: 'taille', label: 'Taille des points', type: 'range', min: 0.3, max: 1.6, pas: 0.05, defaut: 0.9 },
      { cle: 'variation', label: 'Variation de taille', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.6 },
      { cle: 'encrage', label: 'Encrage', type: 'select', defaut: 'une', options: [
        { valeur: 'une', label: 'Une encre' }, { valeur: 'deux', label: 'Deux encres (ombres et demi-teintes)' },
        { valeur: 'negatif', label: 'Négatif (points sur les clairs)' }] }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      // Format arrondi au 1/64 : l'aperçu (taille arrondie au pixel) et l'export partagent
      // exactement la même grille, donc les mêmes points.
      var aspect = Math.max(1 / 64, Math.round(64 * w / h) / 64);
      var image = DL.imageImportee(P.image);
      var negatif = P.encrage === 'negatif';
      // Partage du ton entre nombre et taille des points : poids = densité^gamma pour placer
      // les points, rayon ∝ densité^((1 − gamma) / 2) pour la taille. Sans variation, tout
      // passe par le nombre (pointillé classique, points égaux).
      var gamma = 1 - 0.5 * P.variation;
      var cle = [image ? P.image : 'sujet-' + P.sujet, rng.seed, aspect, P.points, P.regularite, P.contraste, negatif, gamma].join('|');

      var res = memoPoints.cle === cle ? memoPoints.val : null;
      if (!res) {
        var sujet = image ? null : sujetGenere(P.sujet, rng, aspect);
        var lire = function (gw2, gh2) { return image ? DL.luminanceImage(P.image, gw2, gh2) : grilleSujet(sujet, gw2, gh2); };
        // Taille de grille : environ 24 pixels par point dans le plus sombre. Avec trop peu de
        // pixels par cellule de Voronoi, le centre de gravité se calcule mal, des cellules ne
        // reçoivent aucun pixel, leurs points ne bougent plus et les ombres font des grumeaux
        // en étoile (constaté à 12, presque disparu à 24-30). On estime donc la densité
        // moyenne sur une grille grossière avant de choisir la grille de calcul.
        var g0w = Math.max(16, Math.round(Math.sqrt(16384 * aspect))), g0h = Math.max(16, Math.round(g0w / aspect));
        var d0 = densite(lire(g0w, g0h), negatif, P.contraste), moyenne = 0;
        for (var k = 0; k < d0.length; k++) moyenne += Math.pow(d0[k], gamma);
        moyenne = Math.max(0.05, moyenne / d0.length);
        var cible = DL.clamp(24 * P.points / moyenne, 60000, 700000);
        var gw = Math.max(16, Math.round(Math.sqrt(cible * aspect))), gh = Math.max(16, Math.round(gw / aspect));
        var dens = densite(lire(gw, gh), negatif, P.contraste), poids = new Float32Array(dens.length);
        for (k = 0; k < dens.length; k++) poids[k] = Math.pow(dens[k], gamma);
        res = pointiller(poids, gw, gh, P.points, P.regularite, rng.fork('points'));
        res.dens = dens; res.gw = gw; res.gh = gh;
        memoPoints.cle = cle;
        memoPoints.val = res;
      }
      if (!res.total) return;

      // Rayon : dans le plus sombre, les points se touchent presque (diamètre ≈ 0,9 × espacement).
      gw = res.gw; gh = res.gh;
      var kx = w / gw, ky = h / gh;
      var r0 = 0.45 * Math.sqrt(res.total / P.points) * P.taille * Math.sqrt(kx * ky);
      var expo = (1 - gamma) / 2;
      var pts = res.pts, N = pts.length / 2;
      var chemins = [new Path2D(), new Path2D()];
      for (var i = 0; i < N; i++) {
        var gx = pts[2 * i], gy = pts[2 * i + 1];
        var d = res.dens[DL.clamp(Math.floor(gy), 0, gh - 1) * gw + DL.clamp(Math.floor(gx), 0, gw - 1)];
        var rr = r0 * (expo > 0 ? Math.pow(d, expo) : 1);
        if (rr <= 0) continue;
        var x = gx * kx, y = gy * ky;
        // Deux encres : seuil propre à chaque point (de 0,3 à 0,7), pour un passage progressif
        // des demi-teintes aux ombres plutôt qu'une frontière nette.
        var c = P.encrage === 'deux' && d < 0.3 + 0.4 * DL.hash2(i, 7, 11) ? 1 : 0;
        chemins[c].moveTo(x + rr, y);
        chemins[c].arc(x, y, rr, 0, Math.PI * 2);
      }
      ctx.fillStyle = pal[1];
      ctx.fill(chemins[0]);
      if (P.encrage === 'deux') { ctx.fillStyle = pal[2] || pal[1]; ctx.fill(chemins[1]); }
    }
  });
})();

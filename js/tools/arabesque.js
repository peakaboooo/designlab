/* 11 Arabesque : mosaïques géométriques type zellige / fresque (canvas 2D).
   Méthode des « polygones en contact » (Hankin) : on part d'un pavage régulier (octogones +
   carrés, hexagones, triangles + hexagones, carrés). Au milieu de chaque arête partent deux
   rayons inclinés d'un même angle ; ils se croisent d'un polygone à l'autre et dessinent les
   étoiles et rosaces de l'art islamique. Chaque polygone est découpé en régions :
   - le centre (polygone formé par les croisements, éventuellement re-découpé en rosace),
   - les branches de l'étoile (triangles vers les milieux d'arêtes),
   - les cerfs-volants autour des sommets (ils forment des étoiles secondaires entre tuiles).
   Les régions sont posées comme des tesselles (joints au fond), les rayons deviennent des
   bandes d'entrelacs. Symétrie au choix : simple (aucun miroir), miroir, miroir double,
   kaléidoscope 6 / 8 / 12, appliquée sur le rendu. */
(function () {
  'use strict';
  var DL = window.DL;
  var R3 = Math.sqrt(3);

  /* ---------- Pavages ----------
     Polygones (sommets + type) couvrant un disque de rayon R autour de l'origine, pas u. */
  function pavage(nom, u, R) {
    var polys = [];
    function regulier(cx, cy, n, rc, rot, type) {
      if (Math.sqrt(cx * cx + cy * cy) > R + u * 1.5) return;
      var pts = [];
      for (var k = 0; k < n; k++) {
        var a = rot + 2 * Math.PI * k / n;
        pts.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]);
      }
      polys.push({ pts: pts, type: type });
    }
    var n = Math.ceil(R / u) + 2, i, j;
    if (nom === 'octogones') {
      // 4.8.8 : octogones de côté t au pas u = t(1+√2), carrés en losange dans les trous.
      var t = u / (1 + Math.SQRT2);
      for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) {
        regulier(i * u, j * u, 8, t / (2 * Math.sin(Math.PI / 8)), Math.PI / 8, 0);
        regulier((i + 0.5) * u, (j + 0.5) * u, 4, t / Math.SQRT2, 0, 1);
      }
    } else if (nom === 'hexagones') {
      // 6.6.6 : hexagones de côté u/√3 (largeur entre plats = u).
      var th = u / R3;
      for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) {
        regulier(i * 1.5 * th, (j + (i & 1 ? 0.5 : 0)) * u, 6, th, 0, 0);
      }
    } else if (nom === 'trihex') {
      // 3.6.3.6 : hexagones de côté t qui se touchent par les sommets, triangles entre eux.
      var tt = u / 2;
      for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) {
        var cx = i * 2 * tt + j * tt, cy = j * R3 * tt;
        if (Math.sqrt(cx * cx + cy * cy) > R + u * 1.5) continue;
        regulier(cx, cy, 6, tt, 0, 0);
        polys.push({ type: 1, pts: [[cx + tt, cy], [cx + 1.5 * tt, cy + R3 / 2 * tt], [cx + 0.5 * tt, cy + R3 / 2 * tt]] });
        polys.push({ type: 1, pts: [[cx + 0.5 * tt, cy + R3 / 2 * tt], [cx, cy + R3 * tt], [cx - 0.5 * tt, cy + R3 / 2 * tt]] });
      }
    } else {
      for (i = -n; i <= n; i++) for (j = -n; j <= n; j++) {
        regulier(i * u, j * u, 4, u / Math.SQRT2, Math.PI / 4, (i + j) & 1);
      }
    }
    return polys;
  }

  function centre(pts) {
    var x = 0, y = 0;
    pts.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / pts.length, y / pts.length];
  }

  /* ---------- Hankin ----------
     Pour un polygone : milieux d'arêtes m[i] et croisements q[i] (près du sommet i+1).
     Si les rayons ne se croisent pas vers l'intérieur (angle extrême), q retombe au centre. */
  function hankin(pts, theta) {
    var n = pts.length, c = centre(pts), m = [], rA = [], rB = [], q = [];
    var cs = Math.cos(theta), sn = Math.sin(theta);
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var ex = b[0] - a[0], ey = b[1] - a[1], L = Math.sqrt(ex * ex + ey * ey);
      ex /= L; ey /= L;
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      var nx = -ey, ny = ex;
      if ((c[0] - mx) * nx + (c[1] - my) * ny < 0) { nx = -nx; ny = -ny; }
      m.push([mx, my]);
      rB.push([cs * ex + sn * nx, cs * ey + sn * ny]);   // vers le sommet b
      rA.push([-cs * ex + sn * nx, -cs * ey + sn * ny]); // vers le sommet a
    }
    for (i = 0; i < n; i++) {
      var k = (i + 1) % n, p = m[i], d = rB[i], r = m[k], e = rA[k];
      var den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-9) { q.push([(p[0] + r[0]) / 2, (p[1] + r[1]) / 2]); continue; }
      var t = ((r[0] - p[0]) * e[1] - (r[1] - p[1]) * e[0]) / den;
      q.push(t > 0 ? [p[0] + d[0] * t, p[1] + d[1] * t] : c.slice());
    }
    return { m: m, q: q, c: c };
  }

  function chemin(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  /* ---------- Rendu du motif (sans symétrie) ---------- */
  function motif(ctx, w, h, P, rng, pal, ox, oy) {
    var m = Math.min(w, h);
    var u = m / P.echelle;
    var R = Math.sqrt(w * w + h * h) / 2 + u;
    var theta = P.ouverture * Math.PI / 180;
    var polys = pavage(P.pavage, u, R);
    var tuiles = pal.slice(2);
    var roles = rng.shuffle(tuiles.map(function (_, i) { return i; }));
    // Patine : variantes de clarté pré-calculées (pas un appel chroma par tesselle).
    var variantes = tuiles.map(function (c) {
      var v = [];
      for (var k = -3; k <= 3; k++) v.push(chroma(c).brighten(k * 0.12).hex());
      return v;
    });
    function teinte(role) {
      var idx = roles[role % roles.length];
      if (P.desordre > 0 && rng.chance(P.desordre)) idx = rng.int(0, tuiles.length - 1);
      var j = 3;
      if (P.patine > 0) j = DL.clamp(Math.round(3 + rng.gauss(0, 1.3) * P.patine), 0, 6);
      return variantes[idx][j];
    }

    var joints = new Path2D(), bandes = new Path2D();
    ctx.save();
    ctx.translate(w / 2 + ox, h / 2 + oy);

    // Pose d'un polygone découpé en régions ; prof = niveau de rosace imbriquée.
    function poser(pts, type, prof) {
      var H = hankin(pts, theta), n = pts.length, i;
      var base = type * 3 + prof * 2;
      for (i = 0; i < n; i++) {
        // Cerf-volant autour du sommet i+1 et branche d'étoile au milieu m[i].
        var kite = [H.m[i], pts[(i + 1) % n], H.m[(i + 1) % n], H.q[i]];
        var branche = [H.q[(i + n - 1) % n], H.m[i], H.q[i]];
        ctx.fillStyle = teinte(base);
        ctx.beginPath(); chemin(ctx, kite); ctx.fill();
        chemin(joints, kite);
        ctx.fillStyle = teinte(base + 1);
        ctx.beginPath(); chemin(ctx, branche); ctx.fill();
        chemin(joints, branche);
        if (prof === 0) {
          bandes.moveTo(H.m[i][0], H.m[i][1]);
          bandes.lineTo(H.q[i][0], H.q[i][1]);
          bandes.lineTo(H.m[(i + 1) % n][0], H.m[(i + 1) % n][1]);
        }
      }
      if (prof < P.rosaces && n >= 4) poser(H.q, type, prof + 1);
      else {
        ctx.fillStyle = teinte(base + 2);
        ctx.beginPath(); chemin(ctx, H.q); ctx.fill();
        chemin(joints, H.q);
      }
    }
    polys.forEach(function (p) { poser(p.pts, p.type, 0); });

    // Joints entre tesselles : couleur du fond, épaisseur relative à la taille du motif.
    ctx.strokeStyle = pal[0];
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, u * 0.012);
    ctx.stroke(joints);

    // Entrelacs : bande d'encre bordée de fond (effet de ruban posé sur la mosaïque).
    if (P.entrelacs > 0) {
      var bw = u * 0.055 * P.entrelacs;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = pal[0];
      ctx.lineWidth = bw + Math.max(1, u * 0.018);
      ctx.stroke(bandes);
      ctx.strokeStyle = pal[1];
      ctx.lineWidth = bw;
      ctx.stroke(bandes);
    }
    ctx.restore();

    // Patine de fresque : petits éclats d'enduit, en densité relative à la surface.
    if (P.patine > 0) {
      var nb = Math.round(P.patine * 900 * (w * h) / (m * m));
      ctx.fillStyle = pal[0];
      for (var e = 0; e < nb; e++) {
        ctx.globalAlpha = 0.25 + rng() * 0.6;
        ctx.beginPath();
        ctx.arc(rng() * w, rng() * h, m * (0.0008 + rng() * 0.0035), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- Symétries ----------
     Le motif est rendu une fois hors écran, puis recomposé : demi-image en miroir, quart en
     miroir double, ou secteur d'angle π/N répété 2N fois (pair miroir) pour le kaléidoscope. */
  function composer(ctx, src, w, h, mode) {
    if (mode === 'miroir') {
      ctx.drawImage(src, 0, 0, Math.ceil(w / 2), h, 0, 0, Math.ceil(w / 2), h);
      ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0, Math.ceil(w / 2), h, 0, 0, Math.ceil(w / 2), h);
      ctx.restore();
      return;
    }
    if (mode === 'quadruple') {
      var hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
      [[1, 1, 0, 0], [-1, 1, w, 0], [1, -1, 0, h], [-1, -1, w, h]].forEach(function (s) {
        ctx.save(); ctx.translate(s[2], s[3]); ctx.scale(s[0], s[1]);
        ctx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
        ctx.restore();
      });
      return;
    }
    var N = parseInt(mode.slice(1), 10), a = Math.PI / N, R = Math.sqrt(w * w + h * h);
    // Léger recouvrement des secteurs : pas de fil de jour dû à l'anticrénelage sur les axes.
    var marge = 0.004;
    for (var k = 0; k < N; k++) {
      for (var f = 0; f < 2; f++) {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(k * 2 * a);
        if (f) ctx.scale(1, -1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, R, -marge, a + marge);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(src, -src.width / 2, -src.height / 2);
        ctx.restore();
      }
    }
  }

  DL.enregistrer({
    id: 'arabesque',
    numero: '11',
    nom: 'Arabesque',
    famille: 'motif',
    description: 'Mosaïques géométriques type zellige : étoiles, rosaces et entrelacs, en simple, miroir ou kaléidoscope.',
    libs: ['Canvas 2D', 'méthode de Hankin'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#F2E8D5', '#14213D', '#1D5C96', '#0F7B5F', '#E0A526', '#B8432E'],
    params: [
      { cle: 'symetrie', label: 'Symétrie', type: 'select', defaut: 'aucune', options: [
        { valeur: 'aucune', label: 'Simple (sans miroir)' }, { valeur: 'miroir', label: 'Miroir' },
        { valeur: 'quadruple', label: 'Miroir double' }, { valeur: 'k6', label: 'Kaléidoscope 6' },
        { valeur: 'k8', label: 'Kaléidoscope 8' }, { valeur: 'k12', label: 'Kaléidoscope 12' }] },
      { cle: 'pavage', label: 'Pavage', type: 'select', defaut: 'octogones', options: [
        { valeur: 'octogones', label: 'Étoiles à 8 (octogones)' }, { valeur: 'hexagones', label: 'Étoiles à 6 (hexagones)' },
        { valeur: 'trihex', label: 'Triangles et hexagones' }, { valeur: 'carres', label: 'Étoiles à 4 (carrés)' }] },
      { cle: 'echelle', label: 'Motifs par côté', type: 'range', min: 1.5, max: 14, pas: 0.5, defaut: 4 },
      { cle: 'ouverture', label: 'Ouverture des étoiles', type: 'range', min: 30, max: 75, pas: 1, defaut: 60, unite: '°' },
      { cle: 'entrelacs', label: 'Entrelacs', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'rosaces', label: 'Rosaces imbriquées', type: 'range', min: 0, max: 2, pas: 1, defaut: 1 },
      { cle: 'desordre', label: 'Désordre des tesselles', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.08 },
      { cle: 'patine', label: 'Patine de fresque', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.3 }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      // Décalage du réseau tiré par la seed : en kaléidoscope, il change la rosace centrale.
      var ox = (rng() - 0.5) * m / P.echelle, oy = (rng() - 0.5) * m / P.echelle;
      if (P.symetrie === 'aucune') { motif(ctx, w, h, P, rng, pal, ox, oy); return; }
      // Kaléidoscope : les secteurs tournés vont chercher l'image jusqu'à la diagonale ; la source
      // doit donc couvrir un carré de côté = diagonale, sinon les coins restent vides.
      var kaleido = P.symetrie.charAt(0) === 'k';
      var sw = kaleido ? Math.ceil(Math.sqrt(w * w + h * h)) : w, sh = kaleido ? sw : h;
      var src = document.createElement('canvas');
      src.width = sw; src.height = sh;
      var sc = src.getContext('2d');
      if (!pal.transparent) { sc.fillStyle = pal[0]; sc.fillRect(0, 0, sw, sh); }
      // Taille de motif calée sur le cadre final (pas sur la source agrandie) : même échelle visuelle.
      var Pm = Object.assign({}, P, { echelle: P.echelle * Math.min(sw, sh) / m });
      motif(sc, sw, sh, Pm, rng, pal, ox, oy);
      composer(ctx, src, w, h, P.symetrie);
      src.width = src.height = 0;
    }
  });
})();

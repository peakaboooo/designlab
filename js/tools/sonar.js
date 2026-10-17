/* 25 Sonar : masses terrestres tramées (canvas 2D).
   Une carte imaginaire (relief fbm seedé, seuillé au niveau de la mer) ou une vraie carte
   (monde, continents : contours Natural Earth de vendor/geo/terres.js) est gravée en trame :
   lignes horizontales dont l'épaisseur suit l'altitude, anneaux concentriques autour d'un
   émetteur sonar, ou points de demi-teinte. La mer reste en trait fin (ou vide), la terre
   s'épaissit vers les sommets. Option « relief » : les lignes se soulèvent avec l'altitude,
   façon relevé topographique. Tout est relatif à min(w, h) : l'export garde le même nombre de lignes. */
(function () {
  'use strict';
  var DL = window.DL;

  /* Cartes réelles : fenêtre en longitude / latitude (degrés) et centre de projection.
     Les longitudes peuvent dépasser 180 (Asie, Océanie) : la fenêtre enjambe l'antiméridien. */
  var CARTES = {
    monde: { nom: 'Monde' },
    europe: { nom: 'Europe', lon: [-25, 45], lat: [34, 72], centre: [12, 52] },
    afrique: { nom: 'Afrique', lon: [-20, 55], lat: [-37, 38], centre: [18, 2] },
    asie: { nom: 'Asie', lon: [25, 190], lat: [-12, 78], centre: [100, 42] },
    amnord: { nom: 'Amérique du Nord', lon: [-170, -50], lat: [7, 84], centre: [-100, 48] },
    amsud: { nom: 'Amérique du Sud', lon: [-85, -32], lat: [-57, 14], centre: [-60, -20] },
    oceanie: { nom: 'Océanie', lon: [110, 182], lat: [-50, 2], centre: [145, -25] },
    antarctique: { nom: 'Antarctique', lon: [-180, 180], lat: [-90, -60], centre: [0, -90] }
  };
  var GRILLE = 300; // résolution du champ d'altitude des cartes réelles, sur le petit côté
  var RAD = Math.PI / 180;

  // Anneaux décodés une seule fois (format « polyline » au 1/q de degré, voir vendor/geo/terres.js).
  var anneauxGeo = null;
  function anneaux() {
    if (anneauxGeo) return anneauxGeo;
    var src = window.DL_TERRES, q = src ? src.q : 1;
    anneauxGeo = (src ? src.anneaux : []).map(function (s) {
      var pts = [], i = 0, x = 0, y = 0, lonMin = 999, lonMax = -999;
      function lire() {
        var r = 0, dec = 0, b;
        do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << dec; dec += 5; } while (b >= 0x20);
        return r & 1 ? ~(r >> 1) : r >> 1;
      }
      while (i < s.length) {
        x += lire(); y += lire();
        var lon = x / q;
        pts.push([lon, y / q]);
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
      }
      return { pts: pts, lonMin: lonMin, lonMax: lonMax };
    });
    return anneauxGeo;
  }

  // Projection Equal Earth (Šavrič et al., 2018) pour le monde : aires justes, silhouette douce.
  function equalEarth(lon, lat) {
    var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
    var t = Math.asin(Math.sqrt(3) / 2 * Math.sin(lat * RAD)), t2 = t * t, t6 = t2 * t2 * t2;
    var x = 2 * Math.sqrt(3) * lon * RAD * Math.cos(t) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
    return [x, -(A4 * t6 * t2 * t + A3 * t6 * t + A2 * t2 * t + A1 * t)];
  }
  // Azimutale équivalente de Lambert centrée sur la région : continents peu déformés, pôle compris.
  function lambert(c) {
    var l0 = c[0] * RAD, sp0 = Math.sin(c[1] * RAD), cp0 = Math.cos(c[1] * RAD);
    return function (lon, lat) {
      var l = lon * RAD - l0, sp = Math.sin(lat * RAD), cp = Math.cos(lat * RAD);
      var k = Math.sqrt(2 / Math.max(1e-9, 1 + sp0 * sp + cp0 * cp * Math.cos(l)));
      return [k * cp * Math.sin(l), -k * (cp0 * sp - sp0 * cp * Math.cos(l))];
    };
  }

  // Découpe d'un polygone par un demi-plan (Sutherland-Hodgman), axe 0 = lon, 1 = lat.
  function couper(pts, axe, borne, garderSup) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var ina = garderSup ? a[axe] >= borne : a[axe] <= borne, inb = garderSup ? b[axe] >= borne : b[axe] <= borne;
      if (ina) out.push(a);
      if (ina !== inb) {
        var t = (borne - a[axe]) / (b[axe] - a[axe]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }

  /* Anneaux projetés d'une carte, en unités de projection, plus le cadre à faire tenir.
     Les régions sont découpées dans une fenêtre élargie (la terre continue hors du cadre
     quand l'image est plus large que la région), copies décalées de ±360° pour l'antiméridien.
     La fenêtre de découpe s'élargit quand on dézoome (taille < 1) ou qu'on décale le cadrage, pour ne
     jamais montrer de bord coupé.
     Mémorisé par carte et par élargissement : seul le cadrage change d'un rendu à l'autre. */
  var cacheProj = {};
  function projeter(id, zoom, decalage) {
    // Par paliers de 0,25 : quelques variantes en cache au plus, pas un recalcul à chaque cran de curseur.
    var elargi = Math.ceil((0.45 + Math.max(0, (1 / zoom - 1) * 0.6) + decalage * 0.55) * 4) / 4, cle = id + ':' + elargi;
    if (cacheProj[cle]) return cacheProj[cle];
    var c = CARTES[id], polys = [], cadre = [], proj;
    if (id === 'monde') {
      proj = equalEarth;
      anneaux().forEach(function (a) { polys.push(a.pts.map(function (p) { return proj(p[0], p[1]); })); });
      // Cadré sur les terres, pas sur l'ovale du globe : le Pacifique vide des bords ne réduit pas la carte.
      polys.forEach(function (poly) { poly.forEach(function (p) { cadre.push(p); }); });
    } else {
      proj = lambert(c.centre);
      var dLon = (c.lon[1] - c.lon[0]) * elargi, dLat = (c.lat[1] - c.lat[0]) * elargi;
      // Au-delà de ~340° de large, on prend tout le tour (pas de découpe en longitude).
      var tour = c.lon[1] - c.lon[0] + 2 * dLon >= 340;
      var lo0 = c.lon[0] - dLon, lo1 = c.lon[1] + dLon;
      var la0 = Math.max(-90, c.lat[0] - dLat), la1 = Math.min(90, c.lat[1] + dLat);
      anneaux().forEach(function (a) {
        (tour ? [0] : [-360, 0, 360]).forEach(function (dec) {
          if (!tour && (a.lonMax + dec < lo0 || a.lonMin + dec > lo1)) return;
          var pts = dec ? a.pts.map(function (p) { return [p[0] + dec, p[1]]; }) : a.pts;
          if (!tour) { pts = couper(pts, 0, lo0, true); if (pts.length > 2) pts = couper(pts, 0, lo1, false); }
          if (pts.length > 2) pts = couper(pts, 1, la0, true);
          if (pts.length > 2) pts = couper(pts, 1, la1, false);
          if (pts.length > 2) polys.push(pts.map(function (p) { return proj(p[0], p[1]); }));
        });
      });
      for (var i = 0; i <= 20; i++) for (var j = 0; j <= 20; j++) {
        cadre.push(proj(c.lon[0] + (c.lon[1] - c.lon[0]) * i / 20, c.lat[0] + (c.lat[1] - c.lat[0]) * j / 20));
      }
    }
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    cadre.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return (cacheProj[cle] = { polys: polys, x0: x0, x1: x1, y0: y0, y1: y1 });
  }

  // Distance (en cases) à la case la plus proche de l'autre type : chanfrein 3-4 en deux passes.
  function distance(masque, gw, gh, cible) {
    var D = new Float32Array(gw * gh), INF = 1e9;
    for (var k = 0; k < D.length; k++) D[k] = masque[k] === cible ? INF : 0;
    function v(i, j) { return i < 0 || j < 0 || i >= gw || j >= gh ? INF : D[j * gw + i]; }
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var o = j * gw + i;
      if (D[o]) D[o] = Math.min(D[o], v(i - 1, j) + 3, v(i, j - 1) + 3, v(i - 1, j - 1) + 4, v(i + 1, j - 1) + 4);
    }
    for (j = gh - 1; j >= 0; j--) for (i = gw - 1; i >= 0; i--) {
      o = j * gw + i;
      if (D[o]) D[o] = Math.min(D[o], v(i + 1, j) + 3, v(i, j + 1) + 3, v(i + 1, j + 1) + 4, v(i - 1, j + 1) + 4);
    }
    for (k = 0; k < D.length; k++) D[k] /= 3;
    return D;
  }

  /* Champ d'altitude d'une vraie carte sur une grille fixe (GRILLE cases sur le petit côté) :
     la terre monte avec la distance à la côte, la mer descend avec la distance à la terre,
     le bruit seedé ajoute chaînes et vallées. Même grille à l'aperçu et à l'export. */
  function champCarte(id, w, h, m, bruit, ox, oy, P) {
    var cs = m / GRILLE, gw = Math.ceil(w / cs) + 2, gh = Math.ceil(h / cs) + 2;
    // Cadrage : la région tient dans l'image (marge 6 %), « Taille de la carte » zoome, et les deux
    // décalages déplacent le centre de vue : ±1 = jusqu'au bord de la région (est / sud en positif).
    var pr = projeter(id, P.zoom, Math.max(Math.abs(P.decalX), Math.abs(P.decalY))), marge = 0.06;
    var s = P.zoom * Math.min(w * (1 - 2 * marge) / (pr.x1 - pr.x0), h * (1 - 2 * marge) / (pr.y1 - pr.y0));
    var cx = (pr.x0 + pr.x1) / 2 + P.decalX * (pr.x1 - pr.x0) / 2, cy = (pr.y0 + pr.y1) / 2 + P.decalY * (pr.y1 - pr.y0) / 2;
    var tx = w / 2 - s * cx, ty = h / 2 - s * cy;

    var cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    var c2 = cv.getContext('2d');
    c2.setTransform(s / cs, 0, 0, s / cs, tx / cs, ty / cs);
    c2.beginPath();
    pr.polys.forEach(function (poly) {
      poly.forEach(function (p, i) { if (i) c2.lineTo(p[0], p[1]); else c2.moveTo(p[0], p[1]); });
      c2.closePath();
    });
    // Pair-impair : les lacs (Caspienne…) sont des trous dans les anneaux de terre.
    c2.fillStyle = '#000';
    c2.fill('evenodd');
    var px = c2.getImageData(0, 0, gw, gh).data, masque = new Uint8Array(gw * gh);
    for (var k = 0; k < masque.length; k++) masque[k] = px[k * 4 + 3] > 127 ? 1 : 0;

    var dTerre = distance(masque, gw, gh, 1), dMer = distance(masque, gw, gh, 0);
    var F = new Float32Array(gw * gh), f = cs / m, E = P.echelle * 2.5;
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var o = j * gw + i, u = (i * cs - w / 2) / m, v = (j * cs - h / 2) / m;
      if (masque[o]) {
        var interieur = Math.min(1, dTerre[o] * f * 7);
        var n = bruit.fbm2(u * E + ox, v * E + oy, 5, 2, 0.5);
        F[o] = 0.04 + interieur * (0.22 + 0.45 * Math.max(0, n + 0.2));
      } else {
        F[o] = -0.01 - dMer[o] * f * 3;
      }
    }
    return function (x, y) {
      var fx = DL.clamp(x / cs, 0, gw - 1.001), fy = DL.clamp(y / cs, 0, gh - 1.001);
      var ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, o2 = iy * gw + ix;
      return (F[o2] * (1 - ax) + F[o2 + 1] * ax) * (1 - ay) + (F[o2 + gw] * (1 - ax) + F[o2 + gw + 1] * ax) * ay;
    };
  }

  DL.enregistrer({
    id: 'sonar',
    numero: '25',
    nom: 'Sonar',
    famille: 'impression',
    description: 'Masses terrestres tramées : carte imaginaire ou vraie carte (monde, continents) gravée en lignes, anneaux sonar ou points.',
    libs: ['Canvas 2D', 'Natural Earth'],
    moteur: 'canvas2d',
    fondTransparent: true,
    nbCouleurs: 4,
    palette: ['#0F1A2B', '#E8E2D0', '#3C6E8F', '#FF5A36'],
    params: [
      { cle: 'carte', label: 'Carte', type: 'select', defaut: 'aleatoire', options: [{ valeur: 'aleatoire', label: 'Aléatoire (seed)' }]
        .concat(Object.keys(CARTES).map(function (k) { return { valeur: k, label: CARTES[k].nom }; })) },
      { cle: 'zoom', label: 'Taille de la carte (cartes réelles)', type: 'range', min: 0.5, max: 4, pas: 0.05, defaut: 1 },
      { cle: 'decalX', label: 'Décalage horizontal (ouest ↔ est)', type: 'range', min: -1, max: 1, pas: 0.01, defaut: 0 },
      { cle: 'decalY', label: 'Décalage vertical (nord ↔ sud)', type: 'range', min: -1, max: 1, pas: 0.01, defaut: 0 },
      { cle: 'mode', label: 'Trame', type: 'select', defaut: 'lignes', options: [
        { valeur: 'lignes', label: 'Lignes' }, { valeur: 'anneaux', label: 'Anneaux sonar' }, { valeur: 'points', label: 'Points' }] },
      { cle: 'lignes', label: 'Densité de trame', type: 'range', min: 20, max: 200, pas: 1, defaut: 80 },
      { cle: 'echelle', label: 'Échelle (continents, relief)', type: 'range', min: 0.5, max: 5, pas: 0.05, defaut: 1.6 },
      { cle: 'niveau', label: 'Niveau de la mer', type: 'range', min: -0.5, max: 0.5, pas: 0.01, defaut: 0.05 },
      { cle: 'contraste', label: 'Épaisseur sur la terre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'relief', label: 'Relief', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0 },
      { cle: 'mer', label: 'Tracer la mer', type: 'toggle', defaut: true },
      { cle: 'cotes', label: 'Côtes en couleur', type: 'toggle', defaut: true }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) { ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h); }
      var bruit = DL.creerBruit(rng.fork('relief'));
      var ox = rng.range(-50, 50), oy = rng.range(-50, 50);
      var terre = pal[1], mer = pal[2] || pal[1], cote = pal[3] || pal[1];

      // Altitude au point (x, y) en pixels. Carte imaginaire : fbm + léger renfort au centre pour
      // éviter les cartes vides. Vraie carte : champ précalculé ; le niveau de la mer garde le même
      // sens (0,05 par défaut = côtes réelles, plus haut = littoraux noyés).
      var alt;
      if (CARTES[P.carte] && window.DL_TERRES) {
        var champ = champCarte(P.carte, w, h, m, bruit, ox, oy, P), dNiveau = P.niveau - 0.05;
        alt = function (x, y) { return champ(x, y) - dNiveau; };
      } else {
        alt = function (x, y) {
          var u = (x - w / 2) / m, v = (y - h / 2) / m;
          var a = bruit.fbm2(u * P.echelle + ox, v * P.echelle + oy, 5, 2, 0.5);
          return a + 0.15 * (1 - Math.min(1, Math.hypot(u, v) * 1.6)) - P.niveau;
        };
      }
      var pasL = m / P.lignes, epMax = pasL * (0.15 + 0.8 * P.contraste), epMer = pasL * 0.08;
      function epaisseur(a) { return a > 0 ? epMer + (epMax - epMer) * DL.clamp(a * 2.2 + 0.15, 0, 1) : (P.mer ? epMer : 0); }
      function couleur(a) { return a > 0 ? (P.cotes && a < 0.035 ? cote : terre) : mer; }
      var levee = P.relief * pasL * 6;

      // Trace un ruban le long d'une courbe : on coupe le ruban à chaque changement de couleur.
      function ruban(pts) {
        var debut = 0;
        for (var k = 1; k <= pts.length; k++) {
          if (k < pts.length && pts[k].c === pts[debut].c) continue;
          var seg = pts.slice(debut, Math.min(k + 1, pts.length));
          if (seg[0].e > 0 || seg[seg.length - 1].e > 0) {
            ctx.fillStyle = seg[0].c;
            ctx.beginPath();
            seg.forEach(function (p, i) { var x = p.x + p.nx * p.e / 2, y = p.y + p.ny * p.e / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            for (var i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i].x - seg[i].nx * seg[i].e / 2, seg[i].y - seg[i].ny * seg[i].e / 2);
            ctx.closePath();
            ctx.fill();
          }
          debut = k;
        }
      }

      var pas = Math.max(1, m / 500);
      if (P.mode === 'lignes') {
        for (var y = pasL / 2; y < h + levee; y += pasL) {
          var pts = [];
          for (var x = 0; x <= w + pas; x += pas) {
            var a = alt(x, y);
            pts.push({ x: x, y: y - Math.max(0, a) * levee, nx: 0, ny: 1, e: epaisseur(a), c: couleur(a) });
          }
          ruban(pts);
        }
      } else if (P.mode === 'anneaux') {
        // Émetteur décentré : les anneaux balaient la carte comme un écran radar.
        var cx = rng.range(0.3, 0.7) * w, cy = rng.range(0.3, 0.7) * h;
        var Rmax = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
        for (var R = pasL; R < Rmax; R += pasL) {
          var n = Math.ceil(2 * Math.PI * R / pas), pa = [];
          for (var k = 0; k <= n; k++) {
            var t = k / n * 2 * Math.PI, nx = Math.cos(t), ny = Math.sin(t);
            var px = cx + R * nx, py = cy + R * ny, a2 = alt(px, py);
            var Rl = R + Math.max(0, a2) * levee;
            pa.push({ x: cx + Rl * nx, y: cy + Rl * ny, nx: nx, ny: ny, e: epaisseur(a2), c: couleur(a2) });
          }
          ruban(pa);
        }
        ctx.fillStyle = cote;
        ctx.beginPath(); ctx.arc(cx, cy, pasL * 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        // Points en quinconce : rayon proportionnel à l'épaisseur de trait.
        for (var j = 0, yy = pasL / 2; yy < h + pasL; yy += pasL * 0.87, j++) {
          for (var xx = (j % 2) * pasL / 2; xx < w + pasL; xx += pasL) {
            var a3 = alt(xx, yy), e = epaisseur(a3);
            if (e <= 0) continue;
            ctx.fillStyle = couleur(a3);
            ctx.beginPath(); ctx.arc(xx, yy - Math.max(0, a3) * levee, e * 0.62, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }
  });
})();

/* 42 Crowd : foules floutées (canvas 2D).
   Les passants vivent sur un sol en mètres (X vers la droite, Z vers le fond), puis une caméra les projette :
   vue du dessus (orthographique, comme un drone), plongée (perspective à 50°) ou face (à hauteur des yeux).
   Deux flous, comme en photo :
   - mouvement : chaque marcheur est redessiné le long de sa trajectoire avec peu d'opacité (pose longue) ;
   - profondeur : l'image est découpée en tranches de profondeur, chacune floutée selon son écart à la zone
     nette, puis empilées du fond vers l'avant. Le flou est fait maison (boîte ×3 sur une copie réduite,
     couleurs prémultipliées) : le filtre canvas « blur » manque à Safari.
   Toute longueur vient du petit côté de l'image : l'export HD redonne la même image. */
(function () {
  'use strict';
  var DL = window.DL;

  // Teintes naturelles (cheveux, peau) : les couleurs vives restent celles de la palette (vêtements).
  var CHEVEUX = ['#17120E', '#2B1F17', '#3E2A1C', '#5C3B22', '#8A6239', '#B8935A', '#6E6A66', '#C9C2B8'];
  var PEAUX = ['#F2CDB0', '#E3B08A', '#C98E63', '#A26B45', '#7A4A2E', '#55321F'];
  var TRANCHES = 12;          // tranches de profondeur pour le flou
  var MAX_PASSANTS = 2600;    // plafond, pour garder le rendu sous la seconde en aperçu

  /* ---------- Flou maison ---------- */
  // Flou de boîte séparable, trois passes (≈ gaussien), sur des couleurs prémultipliées
  // (sinon le noir des pixels transparents bave autour des silhouettes).
  function flouBoite(img, W, H, r) {
    var d = img.data, n = W * H, i, k;
    var tab = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (i = 0; i < n; i++) {
      var a = d[i * 4 + 3] / 255;
      tab[0][i] = d[i * 4] * a; tab[1][i] = d[i * 4 + 1] * a; tab[2][i] = d[i * 4 + 2] * a; tab[3][i] = d[i * 4 + 3];
    }
    var tmp = new Float32Array(Math.max(W, H));
    function passe(c, longueur, pas, debut) {
      // Moyenne glissante sur 2r + 1 pixels, bords répétés.
      var somme = 0, j, inv = 1 / (2 * r + 1);
      for (j = -r; j <= r; j++) somme += c[debut + DL.clamp(j, 0, longueur - 1) * pas];
      for (j = 0; j < longueur; j++) {
        tmp[j] = somme * inv;
        somme += c[debut + Math.min(j + r + 1, longueur - 1) * pas] - c[debut + Math.max(j - r, 0) * pas];
      }
      for (j = 0; j < longueur; j++) c[debut + j * pas] = tmp[j];
    }
    for (k = 0; k < 4; k++) {
      for (var it = 0; it < 3; it++) {
        var y, x;
        for (y = 0; y < H; y++) passe(tab[k], W, 1, y * W);
        for (x = 0; x < W; x++) passe(tab[k], H, W, x);
      }
    }
    for (i = 0; i < n; i++) {
      var al = tab[3][i];
      var inv2 = al > 0.01 ? 255 / al : 0;
      d[i * 4] = tab[0][i] * inv2; d[i * 4 + 1] = tab[1][i] * inv2; d[i * 4 + 2] = tab[2][i] * inv2; d[i * 4 + 3] = al;
    }
  }

  // Floute la bande [y0, y1] de la source (avec une marge) et la pose sur ctx, découpée à la bande.
  // Copie réduite d'un facteur ~r/3 : le flou y coûte peu et l'agrandissement lissé reste invisible.
  function poserFloute(ctx, src, w, h, y0, y1, r, decouper) {
    var marge = Math.ceil(r * 3 + 2);
    var sy = Math.max(0, Math.floor(y0 - marge)), ey = Math.min(h, Math.ceil(y1 + marge));
    if (ey <= sy) return;
    ctx.save();
    // Bandes calées au pixel entier et chevauchantes : sinon l'anticrénelage du découpage laisse un trait.
    if (decouper) { ctx.beginPath(); ctx.rect(0, Math.floor(y0), w, Math.ceil(y1) - Math.floor(y0) + 1); ctx.clip(); }
    if (r < 0.6) {
      ctx.drawImage(src, 0, sy, w, ey - sy, 0, sy, w, ey - sy);
    } else {
      var f = Math.max(1, r / 3), rr = Math.max(1, Math.round(r / f));
      var pw = Math.max(1, Math.ceil(w / f)), ph = Math.max(1, Math.ceil((ey - sy) / f));
      var petit = document.createElement('canvas');
      petit.width = pw; petit.height = ph;
      var pc = petit.getContext('2d');
      pc.imageSmoothingQuality = 'high';
      pc.drawImage(src, 0, sy, w, ey - sy, 0, 0, pw, ph);
      var img = pc.getImageData(0, 0, pw, ph);
      flouBoite(img, pw, ph, rr);
      pc.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(petit, 0, 0, pw, ph, 0, sy, pw * f, ph * f);
    }
    ctx.restore();
  }

  /* ---------- Caméras ---------- */
  // Renvoie project(X, Z, Y) → { x, y, s (pixels par mètre), p (profondeur) }, la zone de sol à peupler
  // et le haut du sol à l'écran (l'horizon en vue de face).
  function camera(vue, w, h, m) {
    var cx = w / 2, cy = h / 2;
    if (vue === 'dessus') {
      var k = m / 14;                                   // 14 m sur le petit côté
      var demiX = w / 2 / k + 1.5, demiZ = h / 2 / k + 1.5;
      return {
        ortho: true, k: k, haut: 0,
        project: function (X, Z) { return { x: cx + X * k, y: cy + Z * k, s: k, p: 1 }; },
        zMin: -demiZ, zMax: demiZ,
        demiLargeur: function () { return demiX; }
      };
    }
    // Plongée : balcon à 13 m, objectif normal (50° en vertical).
    // Face : téléobjectif (14°) un peu au-dessus des têtes, comme les photos de foule « compressée » :
    // les rangs s'empilent jusqu'en haut du cadre au lieu de laisser un mur vide au-dessus de l'horizon.
    var plongee = vue === 'plongee';
    var H = plongee ? 13 : 2.4;                         // hauteur de l'œil, en mètres
    var phi = (plongee ? 48 : 5) * Math.PI / 180;
    var F = (h / 2) / Math.tan((plongee ? 25 : 7) * Math.PI / 180);
    var sp = Math.sin(phi), cp = Math.cos(phi);
    function project(X, Z, Y) {
      Y = Y || 0;
      var prof = (H - Y) * sp + Z * cp;
      var haut = (Y - H) * cp + Z * sp;
      return { x: cx + F * X / prof, y: cy - F * haut / prof, s: F / prof, p: prof };
    }
    // Z du sol vu sur une ligne d'écran (inverse de la projection pour Y = 0).
    function zEcran(ys) {
      var t = (cy - ys) / F;
      return H * (cp + t * sp) / (sp - t * cp);
    }
    var horizon = cy - F * Math.tan(phi);
    var zMin = plongee ? zEcran(h) - 1.2 : Math.max(4, zEcran(h) * 0.6);
    var zMax = plongee ? zEcran(0) + 2 : 130;
    return {
      ortho: false, haut: Math.max(0, horizon), horizon: horizon,
      project: project, zMin: zMin, zMax: zMax,
      demiLargeur: function (Z) { return (w / 2 + m * 0.05) * (H * sp + Z * cp) / F + 0.6; }
    };
  }

  DL.enregistrer({
    id: 'crowd',
    numero: '42',
    nom: 'Crowd',
    famille: 'volume',
    description: 'Foules floutées : passants vus du dessus, en plongée ou de face, traînées de pose longue et flou de profondeur.',
    libs: ['Canvas 2D', 'chroma.js'],
    moteur: 'canvas2d',
    fondTransparent: false,
    nbCouleurs: 5,
    palette: ['#C9C4BA', '#E8432E', '#1F3A8A', '#F2B705', '#EDEAE3'],
    params: [
      { cle: 'vue', label: 'Vue', type: 'select', defaut: 'dessus', options: [
        { valeur: 'dessus', label: 'Dessus' }, { valeur: 'plongee', label: 'Plongée' }, { valeur: 'face', label: 'Face' }] },
      { cle: 'densite', label: 'Densité', type: 'range', min: 0.05, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'flux', label: 'Flux', type: 'select', defaut: 'croise', options: [
        { valeur: 'sens', label: 'Un sens' }, { valeur: 'croise', label: 'Croisé' },
        { valeur: 'disperse', label: 'Dispersé' }, { valeur: 'rassemblement', label: 'Rassemblement' }] },
      { cle: 'mouvement', label: 'Mouvement', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'profondeur', label: 'Flou de profondeur', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'nette', label: 'Zone nette', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'sol', label: 'Sol', type: 'select', defaut: 'pieton', options: [
        { valeur: 'uni', label: 'Uni' }, { valeur: 'dalles', label: 'Dalles' }, { valeur: 'pieton', label: 'Passage' }] }
    ],

    render: function (ctx, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      var cam = camera(P.vue, w, h, m);
      var sol = pal[0], encres = pal.slice(1);
      var clair = chroma(sol).luminance() > 0.3;
      var ombre = chroma.mix(sol, '#000', clair ? 0.55 : 0.75, 'rgb').hex();

      /* ---- Direction principale et lumière ---- */
      var rd = rng.fork('direction');
      var theta = cam.ortho ? rd.range(0, Math.PI * 2)
        : rd.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]) + rd.range(-0.25, 0.25);
      var lumiere = rd.range(0, Math.PI * 2);
      var dirX = Math.cos(theta), dirZ = Math.sin(theta);

      /* ---- Placement des passants (tirage avec distance minimale, grille de voisinage) ---- */
      var rp = rng.fork('passants');
      var zMin = cam.zMin, zMax = cam.zMax;
      // Aire du sol peuplé (intégrale de la largeur), pour régler l'effectif sur la densité au m².
      var aire = 0, pasZ = (zMax - zMin) / 40;
      for (var zi = 0; zi < 40; zi++) aire += 2 * cam.demiLargeur(zMin + (zi + 0.5) * pasZ) * pasZ;
      var parM2 = 0.03 + Math.pow(P.densite, 1.6) * 1.9;
      var cible = Math.min(MAX_PASSANTS, Math.round(parM2 * aire));
      var dMin = Math.min(0.62, 0.78 / Math.sqrt(Math.max(parM2, cible / aire)));
      var largeurMax = cam.demiLargeur(zMax);

      // Point de rassemblement : au centre de l'image en vue du dessus, au milieu de la scène sinon.
      var zC = cam.ortho ? rp.range(-0.25, 0.25) * (zMax - zMin) : zMin + (zMax - zMin) * (P.vue === 'face' ? 0.12 : 0.45);
      var xC = cam.ortho ? rp.range(-0.25, 0.25) * 2 * largeurMax : rp.range(-0.3, 0.3) * cam.demiLargeur(zC);
      var rayonC = 4 + 6 * (1 - P.densite);

      var cellule = dMin, grille = {}, passants = [];
      function cleG(gx, gz) { return gx + ',' + gz; }
      function libre(X, Z) {
        var gx = Math.floor(X / cellule), gz = Math.floor(Z / cellule);
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
          var l = grille[cleG(gx + a, gz + b)];
          if (!l) continue;
          for (var q = 0; q < l.length; q++) {
            var dx = l[q].X - X, dz = l[q].Z - Z;
            if (dx * dx + dz * dz < dMin * dMin) return false;
          }
        }
        return true;
      }
      var essais = cible * 14;
      while (passants.length < cible && essais-- > 0) {
        var X, Z;
        if (P.flux === 'rassemblement' && rp.chance(0.6)) {
          X = rp.gauss(xC, rayonC); Z = rp.gauss(zC, rayonC * (cam.ortho ? 1 : 0.8));
          if (Z < zMin || Z > zMax) continue;
        } else {
          // Z tiré selon la largeur visible (plus de sol au fond en perspective), X uniforme.
          Z = rp.range(zMin, zMax);
          if (!cam.ortho && !rp.chance(cam.demiLargeur(Z) / largeurMax)) continue;
          X = rp.range(-1, 1) * cam.demiLargeur(Z);
        }
        if (Math.abs(X) > cam.demiLargeur(Z)) continue;
        if (!libre(X, Z)) continue;

        // Cap et vitesse selon le flux.
        var cap, vitesse = rp.range(1.0, 1.6), immobile = rp.chance(0.08);
        if (P.flux === 'sens') cap = theta + rp.gauss(0, 0.16);
        else if (P.flux === 'croise') {
          // Couloirs de 2,5 m alternés : on croise, on ne se percute pas.
          var t = X * -dirZ + Z * dirX;
          var couloir = Math.floor(t / 2.5 + rp.range(-0.3, 0.3));
          cap = theta + (couloir % 2 ? Math.PI : 0) + rp.gauss(0, 0.14);
          if (rp.chance(0.12)) cap += Math.PI / 2 * (rp.chance(0.5) ? 1 : -1);
        } else if (P.flux === 'disperse') {
          cap = rp.range(0, Math.PI * 2); vitesse = rp.range(0.3, 1.4); immobile = rp.chance(0.3);
        } else {
          var dxC = xC - X, dzC = zC - Z, dist = Math.sqrt(dxC * dxC + dzC * dzC);
          cap = Math.atan2(dzC, dxC) + rp.gauss(0, 0.35);
          immobile = dist < rayonC * 0.9 ? rp.chance(0.85) : rp.chance(0.1);
          vitesse *= DL.clamp(dist / rayonC, 0.4, 1);
        }
        var p = {
          X: X, Z: Z, cap: cap, v: immobile ? 0 : vitesse,
          taille: rp.gauss(1.72, 0.08),
          haut: rp.pick(encres), bas: chroma(rp.pick(encres)).darken(rp.range(0.8, 2.2)).hex(),
          cheveux: rp.pick(CHEVEUX), peau: rp.pick(PEAUX),
          nuance: rp.range(-0.5, 0.7), sac: rp.chance(0.16) ? rp.pick(encres) : null,
          parapluie: rp.chance(0.02) ? rp.pick(encres) : null, phase: rp.range(0, 1)
        };
        p.haut = chroma(p.haut).darken(p.nuance).hex();
        passants.push(p);
        var g = cleG(Math.floor(X / cellule), Math.floor(Z / cellule));
        (grille[g] = grille[g] || []).push(p);
      }

      /* ---- Profondeur à l'écran : 0 devant (bas), 1 au fond (haut ou horizon) ---- */
      var hautSol = cam.haut;
      function profEcran(y) { return DL.clamp((h - y) / Math.max(1, h - hautSol), 0, 1); }
      var rayonMax = m * 0.028 * P.profondeur;
      function rayonFlou(d) { return rayonMax * Math.pow(Math.abs(d - P.nette), 1.2) * 1.6; }

      // Pose longue : 1,4 s au maximum.
      var pose = P.mouvement * 1.4;
      passants.forEach(function (p) {
        var pied = cam.project(p.X, p.Z, 0);
        p.ecran = pied;
        p.d = profEcran(pied.y);
        var dep = p.v * pose;
        p.fx = Math.cos(p.cap) * dep; p.fz = Math.sin(p.cap) * dep;
        var fin = cam.project(p.X - p.fx, p.Z - p.fz, 0);
        var trainePx = Math.hypot(fin.x - pied.x, fin.y - pied.y);
        // Une copie tous les 4 cm : plus espacées, la traînée se lit comme une pile de disques.
        p.copies = Math.max(1, Math.min(32, Math.ceil(trainePx / Math.max(1, pied.s * 0.04))));
      });

      /* ---------- Sol ---------- */
      var calqueSol = document.createElement('canvas');
      calqueSol.width = w; calqueSol.height = h;
      var cs = calqueSol.getContext('2d');
      dessinerSol(cs);
      // Ombres portées au sol (avec leurs traînées), floutées avec lui.
      cs.fillStyle = ombre;
      passants.forEach(function (p) { dessinerOmbre(cs, p); });
      cs.globalAlpha = 1;

      var bandes = TRANCHES;
      for (var b = 0; b < bandes; b++) {
        var y0 = hautSol + (h - hautSol) * b / bandes, y1 = hautSol + (h - hautSol) * (b + 1) / bandes;
        var dB = 1 - (b + 0.5) / bandes;
        poserFloute(ctx, calqueSol, w, h, b === 0 ? 0 : y0, y1, rayonFlou(dB), true);
      }
      if (hautSol > 0) poserFloute(ctx, calqueSol, w, h, 0, hautSol, rayonFlou(1), true);

      /* ---------- Passants, tranche par tranche, du fond vers l'avant ---------- */
      var calque = document.createElement('canvas');
      calque.width = w; calque.height = h;
      var cc = calque.getContext('2d');
      passants.sort(function (a, b2) { return a.ecran.y - b2.ecran.y; });
      for (var t2 = 0; t2 < TRANCHES; t2++) {
        var dHaut = 1 - t2 / TRANCHES, dBas = 1 - (t2 + 1) / TRANCHES;
        var lot = passants.filter(function (p) { return p.d <= dHaut && (p.d > dBas || (t2 === TRANCHES - 1)); });
        if (!lot.length) continue;
        cc.clearRect(0, 0, w, h);
        var yMin = h, yMax = 0;
        lot.forEach(function (p) {
          var e = dessinerPassant(cc, p);
          if (e[0] < yMin) yMin = e[0];
          if (e[1] > yMax) yMax = e[1];
        });
        cc.globalAlpha = 1;
        poserFloute(ctx, calque, w, h, Math.max(0, yMin), Math.min(h, yMax), rayonFlou((dHaut + dBas) / 2), false);
      }

      /* ---------- Fonctions de dessin ---------- */
      function quad(c, pts) {
        c.beginPath();
        c.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
        c.closePath();
        c.fill();
      }

      function dessinerSol(c) {
        c.fillStyle = sol;
        c.fillRect(0, 0, w, h);
        // Au-dessus de l'horizon (vue de face) : un mur lointain, un ton plus clair que le sol.
        if (!cam.ortho && cam.horizon > 0) {
          c.fillStyle = chroma.mix(sol, clair ? '#fff' : '#000', 0.35, 'rgb').hex();
          c.fillRect(0, 0, w, cam.horizon);
        }
        // Grain du sol : taches de bruit, très discrètes.
        // Calculé sur une petite grille puis agrandi avec lissage : des carrés pleins se voyaient.
        var rb = rng.fork('sol'), bruit = DL.creerBruit(rb);
        var gc = 64, gr = Math.max(1, Math.round(gc * h / w));
        var grain = document.createElement('canvas');
        grain.width = gc; grain.height = gr;
        var gctx = grain.getContext('2d'), gimg = gctx.createImageData(gc, gr);
        for (var gy = 0; gy < gr; gy++) for (var gx = 0; gx < gc; gx++) {
          var v = bruit.fbm2(gx * 0.14, gy * 0.14, 3), o = (gy * gc + gx) * 4;
          var blanc = v > 0 ? 255 : 0;
          gimg.data[o] = gimg.data[o + 1] = gimg.data[o + 2] = blanc;
          gimg.data[o + 3] = Math.round(Math.abs(v) * (v > 0 ? 0.08 : 0.09) * 255);
        }
        gctx.putImageData(gimg, 0, 0);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(grain, 0, 0, w, h);
        if (P.sol === 'uni') return;
        var joint = chroma.mix(sol, '#000', clair ? 0.18 : 0.35, 'rgb').hex();
        var bande = chroma.mix(sol, '#fff', clair ? 0.7 : 0.55, 'rgb').hex();
        // Repère du sol : en vue du dessus il suit la direction de la foule, en perspective il est droit.
        var ca = cam.ortho ? Math.cos(theta) : 1, sa = cam.ortho ? Math.sin(theta) : 0;
        function pt(u, v2) { return cam.project(u * ca - v2 * sa, u * sa + v2 * ca, 0); }
        var etendue = cam.ortho ? Math.hypot(w, h) / cam.k / 2 + 2 : largeurMax + 2;
        var vMin = cam.ortho ? -etendue : zMin - 2, vMax = cam.ortho ? etendue : zMax;
        if (P.sol === 'dalles') {
          var cote = 1.2, ep = 0.05;
          c.fillStyle = joint;
          for (var u = Math.floor(-etendue / cote) * cote; u <= etendue; u += cote) {
            quad(c, [pt(u - ep, vMin), pt(u + ep, vMin), pt(u + ep, vMax), pt(u - ep, vMax)]);
          }
          for (var v3 = Math.floor(vMin / cote) * cote; v3 <= vMax; v3 += cote) {
            quad(c, [pt(-etendue, v3 - ep), pt(etendue, v3 - ep), pt(etendue, v3 + ep), pt(-etendue, v3 + ep)]);
          }
        } else {
          // Passage piéton : bandes parallèles au flux, sur une chaussée de 5 m de large.
          var milieu = cam.ortho ? 0 : zMin + (zMax - zMin) * (P.vue === 'face' ? 0.1 : 0.5);
          c.fillStyle = bande;
          if (cam.ortho) {
            for (var u2 = -etendue; u2 <= etendue; u2 += 1.0) {
              quad(c, [pt(milieu - 3, u2), pt(milieu + 3, u2), pt(milieu + 3, u2 + 0.5), pt(milieu - 3, u2 + 0.5)]);
            }
          } else {
            var vertical = Math.abs(Math.cos(theta)) < 0.5; // flux vers le fond : bandes vers le fond
            for (var u3 = -etendue; u3 <= etendue; u3 += 1.0) {
              if (vertical) quad(c, [pt(u3, milieu - 3), pt(u3 + 0.5, milieu - 3), pt(u3 + 0.5, milieu + 3), pt(u3, milieu + 3)]);
              else if (u3 > zMin - 2 && u3 < zMax) quad(c, [pt(-etendue, u3), pt(etendue, u3), pt(etendue, u3 + 0.5), pt(-etendue, u3 + 0.5)]);
            }
          }
        }
      }

      // Copies le long de la traînée : position i/n en arrière, de plus en plus pâles vers l'arrière
      // (on lit le sens de la marche) ; la position actuelle est pleine, sinon les têtes du fond
      // transparaissent à travers les corps du premier plan.
      function copies(p, fn) {
        var n = p.copies;
        if (n <= 1) { fn(p.X, p.Z, 1, 0); return; }
        var a = 1 - Math.pow(1 - 0.45, 1 / n);
        for (var i = n - 1; i >= 0; i--) {
          var t = i / (n - 1);
          fn(p.X - p.fx * t, p.Z - p.fz * t, i === 0 ? 1 : a * (1 - 0.75 * t), t);
        }
      }

      function ellipse(c, x, y, rx, ry, rot) {
        c.beginPath();
        c.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), rot || 0, 0, Math.PI * 2);
        c.fill();
      }

      function dessinerOmbre(c, p) {
        copies(p, function (X, Z, a) {
          var e = cam.project(X, Z, 0);
          if (cam.ortho) {
            // Ombre en silhouette dans l'axe de la lumière : étroite aux pieds, large aux épaules,
            // la tête au bout. Un simple rectangle se lisait comme un tube gris plus visible que le passant.
            c.globalAlpha = a * 0.3;
            var s = e.s, L = p.taille * 0.55 * s;
            c.save();
            c.translate(e.x, e.y);
            c.rotate(lumiere);
            c.beginPath();
            c.moveTo(0, -0.07 * s);
            c.lineTo(L * 0.72, -0.22 * s);
            c.quadraticCurveTo(L * 0.8, 0, L * 0.72, 0.22 * s);
            c.lineTo(0, 0.07 * s);
            c.closePath();
            c.fill();
            ellipse(c, L * 0.9, 0, 0.1 * s, 0.09 * s);
            c.restore();
          } else {
            c.globalAlpha = a * 0.42;
            var avant = cam.project(X, Z - 0.3, 0), arriere = cam.project(X, Z + 0.3, 0);
            ellipse(c, e.x, e.y, 0.36 * e.s, Math.abs(avant.y - arriere.y) / 2 + 0.3);
          }
        });
      }

      // Dessine un passant (et sa traînée) ; renvoie l'étendue verticale [haut, bas] à l'écran.
      function dessinerPassant(c, p) {
        var yHaut = h, yBas = 0;
        copies(p, function (X, Z, a, t) {
          c.globalAlpha = a;
          var e = cam.project(X, Z, 0), s = e.s;
          if (cam.ortho) {
            var r = 0.5 * s;
            yHaut = Math.min(yHaut, e.y - r); yBas = Math.max(yBas, e.y + r);
            var rot = p.cap;
            if (p.parapluie) { c.fillStyle = p.parapluie; ellipse(c, e.x, e.y, 0.55 * s, 0.55 * s); return; }
            if (p.sac) { c.fillStyle = p.sac; ellipse(c, e.x - Math.cos(rot) * 0.13 * s, e.y - Math.sin(rot) * 0.13 * s, 0.09 * s, 0.15 * s, rot); }
            c.fillStyle = p.haut;
            ellipse(c, e.x, e.y, 0.14 * s, 0.26 * s, rot);
            c.fillStyle = p.cheveux;
            ellipse(c, e.x + Math.cos(rot) * 0.02 * s, e.y + Math.sin(rot) * 0.02 * s, 0.1 * s, 0.09 * s, rot);
            return;
          }
          // Vues en perspective : silhouette en pied entre le sol et le sommet du crâne.
          var tete = cam.project(X, Z, p.taille);
          var Hp = e.y - tete.y;
          if (Hp < 0.8) { c.fillStyle = p.haut; c.fillRect(e.x - 0.3, tete.y, 0.6, Math.max(0.6, Hp)); return; }
          yHaut = Math.min(yHaut, tete.y); yBas = Math.max(yBas, e.y + 1);
          var x = e.x, epaules = 0.44 * s, hanches = 0.34 * s;
          function niv(f) { return e.y - Hp * f; }
          // Jambes : écartées selon la phase du pas.
          var pas = p.v ? Math.sin((p.phase + t * 2.2) * Math.PI * 2) * 0.09 * s : 0;
          c.fillStyle = p.bas;
          c.fillRect(x - hanches / 2 + pas * 0.5, niv(0.5), hanches * 0.46, Hp * 0.5);
          c.fillRect(x + hanches * 0.04 - pas * 0.5, niv(0.5), hanches * 0.46, Hp * 0.5);
          // Buste en trapèze, bras compris.
          c.fillStyle = p.haut;
          c.beginPath();
          c.moveTo(x - hanches / 2, niv(0.46));
          c.lineTo(x + hanches / 2, niv(0.46));
          c.lineTo(x + epaules / 2, niv(0.8));
          c.quadraticCurveTo(x, niv(0.85), x - epaules / 2, niv(0.8));
          c.closePath();
          c.fill();
          if (p.sac) { c.fillStyle = p.sac; c.fillRect(x + epaules * 0.28, niv(0.62), epaules * 0.24, Hp * 0.14); }
          // Tête : visage si le passant vient vers nous, cheveux sinon.
          var face = Math.sin(p.cap) < 0, rx = 0.1 * s, ry = Hp * 0.065;
          c.fillStyle = face ? p.peau : p.cheveux;
          ellipse(c, x, niv(0.93), rx, ry);
          if (face) { c.fillStyle = p.cheveux; ellipse(c, x, niv(0.965), rx, ry * 0.55); }
          if (p.parapluie) {
            c.fillStyle = p.parapluie;
            c.beginPath();
            c.ellipse(x, niv(1.12), 0.55 * s, Hp * 0.12, 0, Math.PI, Math.PI * 2);
            c.fill();
            yHaut = Math.min(yHaut, niv(1.25));
          }
        });
        return [yHaut, yBas];
      }
    }
  });
})();

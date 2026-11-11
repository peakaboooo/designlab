/* 32 Zig : zigzags arrondis, en vectoriel (Paper.js, export SVG).
   Une ligne brisée (pics et creux) dont chaque angle est arrondi par un arc de cercle tangent,
   recopiée en bandes empilées : chaque bande est la surface entre deux copies de cette ligne
   décalées à la verticale. (Un trait épais ne convenait pas : son bord intérieur repasse en
   pointe dans les creux, ce qui donnait des écailles au lieu de zigzags.) Sans écart, on
   obtient un tissu continu ; avec « Flamme », la hauteur des pics varie d'une dent à l'autre et
   toutes les bandes suivent, comme le point de Hongrie (bargello). */
(function () {
  'use strict';
  var DL = window.DL;

  /* Ajoute à un chemin une ligne brisée aux angles arrondis.
     pts : sommets ; arrondi dans [0,1] : part du rayon maximal que permet chaque angle
     (au maximum, les arcs se touchent et la ligne devient une onde). */
  function ligneArrondie(chemin, pts, arrondi) {
    chemin.add(pts[0]);
    for (var k = 1; k < pts.length - 1; k++) {
      var A = pts[k - 1], V = pts[k], B = pts[k + 1];
      var ax = A[0] - V[0], ay = A[1] - V[1], bx = B[0] - V[0], by = B[1] - V[1];
      var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-6 || lb < 1e-6) continue;
      ax /= la; ay /= la; bx /= lb; by /= lb;
      var phi = Math.acos(DL.clamp(ax * bx + ay * by, -1, 1)); // angle intérieur au sommet
      var tanDemi = Math.tan(phi / 2);
      // Les points de tangence ne doivent pas dépasser le milieu des segments voisins.
      var rMax = Math.min(la, lb) / 2 * tanDemi;
      var R = rMax * arrondi;
      if (R < 1e-3 || phi > Math.PI - 1e-3) { chemin.add(V); continue; }
      var d = R / tanDemi;
      var bis = [ax + bx, ay + by], lbis = Math.hypot(bis[0], bis[1]);
      bis = [bis[0] / lbis, bis[1] / lbis];
      var dc = R / Math.sin(phi / 2);
      var C = [V[0] + bis[0] * dc, V[1] + bis[1] * dc];
      chemin.lineTo([V[0] + ax * d, V[1] + ay * d]);
      chemin.arcTo([C[0] - bis[0] * R, C[1] - bis[1] * R], [V[0] + bx * d, V[1] + by * d]);
    }
    chemin.lineTo(pts[pts.length - 1]);
  }

  DL.enregistrer({
    id: 'zig',
    numero: '32',
    nom: 'Zig',
    famille: 'motif',
    description: 'Zigzags arrondis empilés en bandes, du chevron sage au point de Hongrie, export SVG.',
    libs: ['Paper.js', 'chroma.js'],
    moteur: 'paper',
    vectoriel: true,
    fondTransparent: true,
    nbCouleurs: 6,
    palette: ['#F2EBDD', '#D1495B', '#EDAE49', '#00798C', '#30638E', '#003D5B'],
    params: [
      { cle: 'bandes', label: 'Bandes', type: 'range', min: 3, max: 40, pas: 1, defaut: 14 },
      { cle: 'dents', label: 'Dents', type: 'range', min: 1, max: 20, pas: 1, defaut: 5 },
      { cle: 'amplitude', label: 'Hauteur des pics', type: 'range', min: 0.1, max: 2, pas: 0.05, defaut: 0.8 },
      { cle: 'arrondi', label: 'Arrondi', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.75 },
      { cle: 'flamme', label: 'Flamme (point de Hongrie)', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0 },
      { cle: 'ecart', label: 'Écart entre bandes', type: 'range', min: 0, max: 0.8, pas: 0.01, defaut: 0 },
      { cle: 'orientation', label: 'Orientation', type: 'select', defaut: 'horizontale', options: [
        { valeur: 'horizontale', label: 'Horizontale' }, { valeur: 'verticale', label: 'Verticale' }, { valeur: 'biais', label: 'En biais (45°)' }] },
      { cle: 'couleurs', label: 'Couleurs', type: 'select', defaut: 'cycle', options: [
        { valeur: 'cycle', label: 'Cycle' }, { valeur: 'degrade', label: 'Dégradé' }, { valeur: 'hasard', label: 'Hasard' }] }
    ],

    render: function (S, w, h, P, rng, pal) {
      var m = Math.min(w, h);
      if (!pal.transparent) new S.Path.Rectangle({ point: [0, 0], size: [w, h], fillColor: pal[0] });
      var encres = pal.slice(1);
      var angle = { horizontale: 0, verticale: 90, biais: -45 }[P.orientation] || 0;
      // On dessine dans un repère centré assez grand pour couvrir le cadre une fois tourné.
      var D = Math.sqrt(w * w + h * h);
      var pas = m / P.bandes;                 // décalage vertical d'une bande à la suivante
      var demiDent = m / P.dents / 2;         // distance horizontale d'un pic au creux suivant
      var amp = P.amplitude * demiDent * 2;   // hauteur pic-creux
      var bruit = DL.creerBruit(rng.fork('flamme'));

      // Sommets de la ligne brisée de référence, centrée en 0 ; la flamme fait varier chaque pic.
      var nDemi = Math.ceil((D / 2 + 2 * demiDent) / demiDent);
      var sommets = [], ampMax = 0;
      for (var k = -nDemi; k <= nDemi; k++) {
        var signe = k % 2 === 0 ? -1 : 1;
        var a = amp / 2 * (1 + P.flamme * 0.9 * bruit.n2(k * 0.31, 0.7));
        sommets.push([k * demiDent, signe * a]);
        ampMax = Math.max(ampMax, a);
      }

      // Couleurs des bandes. Dégradé : aller-retour dans une échelle LCH (pas de saut de couleur).
      var echelle = chroma.scale(encres.length > 1 ? encres : [encres[0], pal[0]]).mode('lch');
      var etapes = Math.max(2, encres.length * 3);
      var rc = rng.fork('couleurs'), precedente = -1;
      function couleur(i) {
        if (P.couleurs === 'degrade') {
          var t = ((i % (2 * etapes)) + 2 * etapes) % (2 * etapes);
          return echelle(t <= etapes ? t / etapes : 2 - t / etapes).hex();
        }
        if (P.couleurs === 'hasard') {
          var c;
          do { c = rc.int(0, encres.length - 1); } while (encres.length > 1 && c === precedente);
          precedente = c;
          return encres[c];
        }
        return encres[((i % encres.length) + encres.length) % encres.length];
      }

      // Une bande = la surface entre deux copies de la même ligne arrondie, décalées à la
      // verticale : épaisseur verticale constante (comme les points de Hongrie), pics ET creux
      // arrondis des deux côtés. Sans écart, chaque bande déborde un peu sous la suivante,
      // peinte par-dessus : aucun liseré clair d'anticrénelage entre deux bandes.
      var ref = new S.Path({ insert: false });
      ligneArrondie(ref, sommets, P.arrondi);
      var epaisseur = P.ecart > 0 ? pas * (1 - P.ecart) : pas * 1.03;
      var groupe = new S.Group();
      var nb = Math.ceil((D / 2 + ampMax + pas) / pas);
      for (var i = -nb; i <= nb; i++) {
        var bande = ref.clone({ insert: false });
        bande.translate(new S.Point(0, i * pas));
        var dessous = ref.clone({ insert: false });
        dessous.translate(new S.Point(0, i * pas + epaisseur));
        dessous.reverse();
        bande.addSegments(dessous.segments.map(function (sg) { return sg.clone(); }));
        bande.closed = true;
        bande.fillColor = couleur(i + nb);
        groupe.addChild(bande);
      }
      groupe.rotate(angle, new S.Point(0, 0));
      groupe.translate(new S.Point(w / 2, h / 2));

      // Masque au cadre : le SVG ne garde que ce qui se voit.
      var masque = new S.Path.Rectangle({ point: [0, 0], size: [w, h], insert: false });
      var cadre = new S.Group([masque, groupe]);
      cadre.clipped = true;
    }
  });
})();

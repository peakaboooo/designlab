/* 41 News : collage de coupures de journaux (canvas 2D, polices de vendor/fonts).
   Des morceaux de pages de journal, coupés aux ciseaux ou déchirés, sont posés en tas les uns
   sur les autres. Chaque coupure est une vraie mise en page : bandeau du journal, gros titre,
   colonnes de texte justifié, photo tramée. Le collage se partage entre un à douze articles, dont
   le titre et le paragraphe sont écrits par l'utilisateur, comme le nom du journal. zones()
   décrit les coupures à app.js, pour qu'un clic sur l'image ouvre la retouche du texte.
   Toutes les longueurs sont relatives au petit côté, et les largeurs de mots sont mesurées une
   fois à 100 px puis mises à l'échelle : les lignes se coupent au même endroit dans l'aperçu
   et dans l'export HD. */
(function () {
  'use strict';
  var DL = window.DL;

  var POL = {
    serif: { css: '"Instrument Serif"', g: '400', s: 'normal' },
    italique: { css: '"Instrument Serif"', g: '400', s: 'italic' },
    archivo: { css: '"Archivo Black"', g: '400', s: 'normal' },
    dela: { css: '"Dela Gothic One"', g: '400', s: 'normal' },
    grotesk: { css: '"Space Grotesk"', g: '700', s: 'normal' },
    texte: { css: '"Space Grotesk"', g: '400', s: 'normal' },
    mono: { css: '"Space Mono"', g: '400', s: 'normal' },
    monoGras: { css: '"Space Mono"', g: '700', s: 'normal' }
  };
  function fonte(p, t) { return p.s + ' ' + p.g + ' ' + Math.max(1, t).toFixed(2) + 'px ' + p.css; }

  // Contenu d'habillage (ce que l'utilisateur ne saisit pas) : rubriques, dates, légendes.
  var RUBRIQUES = ['SOCIÉTÉ', 'MÉTÉO', 'SPORT', 'CULTURE', 'ÉCONOMIE', 'MONDE', 'RÉGION', 'FAITS DIVERS', 'SCIENCES', 'À LA UNE'];
  var JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE'];
  var MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
  var PRIX = ['0,90 €', '1,20 €', '1,50 €', '2,00 €'];
  var LEGENDES = ['Hier, sur la place.', 'Photo d\'archives.', 'Vue générale des lieux.', 'De notre envoyé spécial.', 'Peu avant midi.', 'Le quartier, ce matin.'];
  /* Articles par défaut : la mobilisation des jeunes en Belgique francophone à l'automne 2026
     (minerval, écoles secondaires, transports), demandée par l'autrice. Textes écrits pour
     l'outil d'après la presse belge de septembre à novembre 2026, sans citation ni chiffre
     inventé : ne rien y ajouter qui ne soit sourcé (voir la note de session 7).
     Chaque article a son titre et son texte ; une coupure appartient à
     un article et en montre un morceau. Leur nombre fixe celui des paires de params. */
  var ARTICLES = [
    { titre: "Minerval : les étudiants dans la rue", texte: "À la rentrée, le minerval plein est passé de 835 à 1 194 euros. Deux jours après la reprise des cours, les étudiants défilaient déjà à Bruxelles.\nLa Fédération des étudiants francophones promet de ne rien lâcher. Pour elle, étudier ne doit pas dépendre du portefeuille des parents." },
    { titre: "Liège, là où tout a commencé", texte: "Les premiers cortèges d'élèves du secondaire sont partis de Liège, au tout début du mois d'octobre. En quelques jours, Mons et Charleroi ont suivi.\nLes élèves disent marcher aussi pour leurs professeurs. Dans leurs écoles, racontent-ils, les absents ne sont plus remplacés." },
    { titre: "Classes pleines, murs fatigués", texte: "Trop d'élèves par classe, des bâtiments vétustes, des cours qui sautent faute de remplaçant : la liste des griefs est longue.\nLes élèves du secondaire la répètent de cortège en cortège. À leurs yeux, ce sont les conditions mêmes pour apprendre qui se dégradent." },
    { titre: "Le bus à 12 euros, c'est fini", texte: "L'abonnement TEC à 12 euros pour les jeunes a disparu. Pour beaucoup d'élèves, c'est la mesure de trop.\nAller à l'école coûte désormais plus cher, avant même d'avoir ouvert un cahier. Le prix du bus est devenu l'un des griefs du mouvement." },
    { titre: "Les écoles de Liège fermées", texte: "Vendredi 2 octobre, des écoles secondaires de Liège sont restées portes closes. La décision a été prise pour des raisons de sécurité, au lendemain d'actions d'élèves.\nDans les rues, les cortèges ont continué. Des élèves disent regretter la présence de casseurs à leurs côtés." },
    { titre: "Un blocus venu de France", texte: "Le mouvement s'inspire des blocus de lycées lancés en France à la fin du mois de septembre. L'idée a passé la frontière en quelques jours.\nLes raisons, elles, sont bien d'ici : le coût des études, l'état des écoles, les économies décidées dans l'enseignement." },
    { titre: "La ministre reçoit dix élèves", texte: "Le 7 octobre, la ministre de l'Éducation a reçu une délégation de dix élèves, dont des membres du Comité des élèves francophones.\nLa mobilisation, elle, ne s'est pas arrêtée là. Deux jours plus tard, la rue était de nouveau pleine à Bruxelles." },
    { titre: "Trente mille dans la capitale", texte: "Le 9 octobre, 30 000 personnes selon la police ont défilé à Bruxelles contre la rigueur budgétaire. Les syndicats avaient appelé, en plein mouvement des élèves.\nDes violences et des dégâts ont été signalés en marge du cortège." },
    { titre: "Un décret et des économies", texte: "Tout part d'un décret-programme adopté le 5 juin par le Parlement de la Fédération Wallonie-Bruxelles. Il fait partie d'un plan d'économies plus large.\nPour les étudiants, c'est l'enseignement qui paie la note. Ils demandent son refinancement, à tous les niveaux." },
    { titre: "Étudier, combien ça coûte ?", texte: "Selon la Fédération des étudiants francophones, une année d'études peut coûter entre 8 100 et 13 600 euros. Le minerval n'en est qu'une partie.\nIl faut compter aussi le logement, les transports, les syllabus et les repas." },
    { titre: "Profs et élèves, même combat", texte: "En octobre, des actions ont eu lieu dans toute la Fédération Wallonie-Bruxelles. Enseignants, personnel, élèves et étudiants s'y sont retrouvés côte à côte.\nTous dénoncent des mesures qui fragilisent l'école. Le mouvement n'est plus seulement celui des jeunes." },
    { titre: "Rendez-vous le 17 novembre", texte: "Une nouvelle mobilisation est annoncée à Bruxelles le 17 novembre, Journée internationale des étudiants. La CSC marchera aux côtés des jeunes.\nLes métallos de la FGTB ont déposé un préavis de grève en soutien aux étudiants." }
  ];

  /* Largeur d'un mot pour 1 px de corps. Mesurée à 100 px et mémorisée le temps du rendu :
     le résultat ne dépend pas de la taille de l'image, et on ne change de police qu'une fois
     par mot nouveau. */
  function creerMesure(ctx) {
    var cache = {};
    return function (cle, mot) {
      var k = cle + '|' + mot, v = cache[k];
      if (v === undefined) {
        ctx.font = fonte(POL[cle], 100);
        v = cache[k] = ctx.measureText(mot).width / 100;
      }
      return v;
    };
  }

  // Coupe un texte en lignes qui tiennent dans une largeur (découpe gloutonne, mot par mot).
  function couper(mes, cle, texte, taille, largeur) {
    var mots = texte.split(/\s+/).filter(Boolean), lignes = [], ligne = '';
    mots.forEach(function (mot) {
      var essai = ligne ? ligne + ' ' + mot : mot;
      if (ligne && mes(cle, essai) * taille > largeur) { lignes.push(ligne); ligne = mot; }
      else ligne = essai;
    });
    if (ligne) lignes.push(ligne);
    return lignes;
  }

  // Titre : on part du corps voulu et on le réduit jusqu'à tenir en largeur et en lignes.
  // Un titre reste toujours entier et lisible, c'est le contenu de l'utilisateur.
  function titrer(mes, cle, texte, largeur, taille, maxLignes) {
    var lignes = [texte];
    for (var k = 0; k < 24; k++) {
      lignes = couper(mes, cle, texte, taille, largeur);
      var large = 0;
      for (var q = 0; q < lignes.length; q++) large = Math.max(large, mes(cle, lignes[q]) * taille);
      if (lignes.length <= maxLignes && large <= largeur) break;
      taille *= 0.9;
    }
    return { taille: taille, lignes: lignes };
  }

  // Paragraphe de l'utilisateur → suite de mots. « debut » marque le premier mot d'un
  // paragraphe ; « phrases » liste les débuts de phrase, où une coupure peut commencer.
  function preparerTexte(brut) {
    var jetons = [];
    String(brut).split(/\n+/).forEach(function (par) {
      par.trim().split(/\s+/).filter(Boolean).forEach(function (mot, i) { jetons.push({ m: mot, debut: i === 0 }); });
    });
    // Texte de quelques mots : il boucle en continu, sinon chaque répétition ouvrirait un
    // paragraphe et les colonnes n'auraient qu'un mot par ligne.
    if (jetons.length < 12) jetons.forEach(function (j) { j.debut = false; });
    var phrases = [0];
    for (var i = 0; i + 1 < jetons.length; i++) if (/[.!?…]$/.test(jetons[i].m)) phrases.push(i + 1);
    return { jetons: jetons, phrases: phrases };
  }

  /* Compose une colonne de texte justifié, de y0 à yFin. E = { i, reste, lettrine, lettrineL } :
     position dans le texte (elle continue d'une colonne à l'autre), fin du mot entamé par la
     lettrine, nombre de lignes encore en retrait à côté d'elle. Le texte boucle s'il est court. */
  function composer(ctx, mes, T, E, x, y0, yFin, larg, corps, lh, cle) {
    var esp = mes(cle, ' ') * corps, n = T.length, y = y0 + corps * 0.82, garde = 0;
    var police = fonte(POL[cle], corps);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    while (y <= yFin && garde++ < 600) {
      var decal = 0;
      if (E.lettrine > 0) { decal = E.lettrineL; E.lettrine--; }
      else if (T[E.i % n].debut && E.reste === null) decal = corps;
      var dispo = larg - decal, mots = [], somme = 0, fin = false;
      for (;;) {
        var j = T[E.i % n];
        if (mots.length && j.debut) { fin = true; break; }
        var txt = E.reste !== null ? E.reste : j.m, lw = mes(cle, txt) * corps;
        if (mots.length && somme + esp * mots.length + lw > dispo) break;
        mots.push([txt, lw]);
        somme += lw;
        E.reste = null;
        E.i++;
        if (mots.length > 40) break;
      }
      // Justification : l'espace restant est réparti entre les mots, sauf en fin de
      // paragraphe ou si la ligne deviendrait trop lâche (colonne étroite, mots longs).
      var ecart = esp;
      if (!fin && mots.length > 1) {
        ecart = (dispo - somme) / (mots.length - 1);
        if (ecart > esp * 3.2) ecart = esp;
      }
      // La police est reposée à chaque ligne : mesurer un mot nouveau la change (creerMesure).
      // L'oublier dessinait des lignes entières en corps 100.
      ctx.font = police;
      var cx = x + decal;
      for (var k = 0; k < mots.length; k++) { ctx.fillText(mots[k][0], cx, y); cx += mots[k][1] + ecart; }
      y += lh;
    }
  }

  /* Photo tramée : une scène simple (portrait, paysage ou matière) donne une valeur de gris
     par point, rendue par la taille de points en quinconce, comme une similigravure. */
  function photo(ctx, r, x, y, l, ht, pas, encre) {
    var bruit = DL.creerBruit(r), scene = r.pick(['portrait', 'paysage', 'paysage', 'matiere']);
    var rap = ht / l, horizon = r.range(0.5, 0.68), sx = r.range(0.2, 0.8), sy = r.range(0.14, 0.32);
    var tx = r.range(0.42, 0.58), d1 = r.range(0, 50), d2 = r.range(0, 50);
    function gris(u, v) {
      if (scene === 'portrait') {
        // Tête ovale, cheveux plus sombres en haut, épaules ; fond clair en dégradé.
        var g = 0.2 + 0.16 * v + 0.08 * bruit.n2(u * 3 + d1, v * 3 * rap);
        var ex = (u - tx) / 0.17, ey = (v - 0.4) / (0.24 / Math.max(0.6, rap) * 0.8);
        if (ex * ex + ey * ey < 1) g = ey < -0.35 + 0.25 * bruit.n2(u * 6 + d2, 3) ? 0.82 : 0.42 + 0.2 * ex;
        var qx = (u - tx) / 0.4, qy = (v - 1.08) / 0.4;
        if (qx * qx + qy * qy < 1) g = 0.72 + 0.1 * bruit.n2(u * 9, v * 9 + d1);
        return g;
      }
      if (scene === 'paysage') {
        var ds = Math.hypot(u - sx, (v - sy) * rap);
        if (ds < 0.075) return 0.02;
        var h1 = horizon + 0.07 * bruit.n2(u * 2.2 + d1, 0.5), h2 = horizon + 0.2 + 0.06 * bruit.n2(u * 3.4 + d2, 4.2);
        if (v > h2) return 0.78 + 0.1 * bruit.n2(u * 14, v * 14);
        if (v > h1) return 0.5 + 0.16 * bruit.n2(u * 7 + d2, v * 7);
        return 0.14 + 0.3 * (v / horizon) + 0.07 * bruit.n2(u * 2.5 + d2, v * 5 + d1);
      }
      return 0.5 + 0.55 * bruit.fbm2(u * 3.2 + d1, v * 3.2 * rap + d2, 3);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, l, ht);
    ctx.clip();
    ctx.fillStyle = encre;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(x, y, l, ht);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    var rangs = Math.ceil(ht / (pas / 2)) + 1, cols = Math.ceil(l / pas) + 1;
    for (var j = 0; j < rangs; j++) {
      for (var i = 0; i < cols; i++) {
        var px = i * pas + (j % 2) * pas / 2, py = j * pas / 2;
        var g = DL.clamp(gris(px / l, py / ht), 0, 1);
        if (g < 0.03) continue;
        // 0,36 : à pleine valeur les points se touchent à peine, la trame reste lisible
        // (au-delà, les ombres deviennent un aplat noir).
        var ray = pas * 0.36 * Math.sqrt(g);
        ctx.moveTo(x + px + ray, y + py);
        ctx.arc(x + px, y + py, ray, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  /* Contour d'une coupure : 4 coins un peu rentrés (personne ne coupe droit), puis chaque
     côté soit coupé net, soit déchiré. Un côté déchiré a deux bords : « ext » (le papier) et
     « int » (l'encre), plus rentré, pour laisser voir la frange blanche du papier arraché. */
  function contour(r, l, ht, dechire, m) {
    var j = m * 0.012;
    var coins = [[r.range(0, j), r.range(0, j)], [l - r.range(0, j), r.range(0, j)], [l - r.range(0, j), ht - r.range(0, j)], [r.range(0, j), ht - r.range(0, j)]];
    var ext = [], int = [];
    for (var k = 0; k < 4; k++) {
      var A = coins[k], B = coins[(k + 1) % 4], dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L;
      if (!dechire[k]) {
        ext.push(A); int.push(A);
        // Un léger écart au milieu : le coup de ciseaux n'est pas une règle.
        var e = r.range(0, m * 0.003), t0 = r.range(0.3, 0.7), M = [A[0] + dx * t0 + nx * e, A[1] + dy * t0 + ny * e];
        ext.push(M); int.push(M);
        continue;
      }
      var n = Math.max(6, Math.ceil(L / (m * 0.011))), amp = m * r.range(0.008, 0.016), prof = m * r.range(0.004, 0.011);
      var f1 = r.range(5, 11), f2 = r.range(17, 31), p1 = r.range(0, 7), p2 = r.range(0, 7);
      for (var q = 0; q < n; q++) {
        var t = q / n;
        var d = amp * (0.5 + 0.3 * Math.sin(t * f1 + p1) + 0.2 * Math.sin(t * f2 + p2)) * (0.55 + 0.45 * r());
        var d2 = d + prof * (0.3 + 0.7 * r());
        ext.push([A[0] + dx * t + nx * d, A[1] + dy * t + ny * d]);
        int.push([A[0] + dx * t + nx * d2, A[1] + dy * t + ny * d2]);
      }
    }
    return { ext: ext, int: int };
  }

  function chemin(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }

  // Bout de scotch : rectangle translucide aux petits côtés en dents de scie, avec un reflet.
  function scotch(ctx, x, y, angle, lon, lar, couleur) {
    var dents = 5, prof = lar * 0.14, k;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-lon / 2, -lar / 2);
    ctx.lineTo(lon / 2, -lar / 2);
    for (k = 1; k <= dents * 2; k++) ctx.lineTo(lon / 2 - (k % 2 ? prof : 0), -lar / 2 + lar * k / (dents * 2));
    ctx.lineTo(-lon / 2, lar / 2);
    for (k = 1; k <= dents * 2; k++) ctx.lineTo(-lon / 2 + (k % 2 ? prof : 0), lar / 2 - lar * k / (dents * 2));
    ctx.closePath();
    ctx.fillStyle = couleur;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-lon / 2 + prof, -lar / 2 + lar * 0.12, lon - 2 * prof, lar * 0.16);
    ctx.restore();
  }

  /* Deux params par article (t1, p1, t2, p2...), rangés sous un intertitre « Article N » et
     affichés seulement si l'article existe. Les textes des articles masqués sont gardés :
     repasser de 2 à 4 articles retrouve ce qu'on avait écrit. */
  var PARAMS_ARTICLES = [];
  ARTICLES.forEach(function (A, i) {
    var n = i + 1, visible = function (P) { return P.articles >= n; };
    PARAMS_ARTICLES.push(
      { cle: 't' + n, label: 'Titre', type: 'texte', max: 60, defaut: A.titre, groupe: 'Article ' + n, visible: visible },
      { cle: 'p' + n, label: 'Paragraphe', type: 'texte', lignes: 4, max: 400, defaut: A.texte, groupe: 'Article ' + n, visible: visible });
  });

  DL.enregistrer({
    id: 'news',
    numero: '41',
    nom: 'News',
    famille: 'impression',
    description: 'Collage de coupures de journaux superposées : tes titres, ton texte, ciseaux ou déchirures.',
    libs: ['Canvas 2D', 'polices locales', 'chroma.js'],
    moteur: 'canvas2d',
    polices: true,
    fondTransparent: true,
    nbCouleurs: 5,
    // Fond (la table), papier, encre, accent 1 (rubriques, bandeaux, stylo), accent 2 (surligneur).
    palette: ['#26231F', '#EFE8D8', '#191816', '#D8352A', '#F2C230'],
    params: [
      { cle: 'journal', label: 'Nom du journal', type: 'texte', max: 24, defaut: 'La Gazette' },
      { cle: 'coupures', label: 'Coupures', type: 'range', min: 3, max: 32, pas: 1, defaut: 16 },
      { cle: 'remplir', label: 'Remplir la page', type: 'toggle', defaut: true },
      { cle: 'decoupe', label: 'Découpe', type: 'select', defaut: 'melange', options: [
        { valeur: 'ciseaux', label: 'Ciseaux' }, { valeur: 'dechire', label: 'Déchiré' }, { valeur: 'melange', label: 'Mélangé' }] },
      { cle: 'desordre', label: 'Désordre', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.4 },
      { cle: 'usure', label: 'Usure', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.45 },
      { cle: 'scotch', label: 'Bouts de scotch', type: 'toggle', defaut: true },
      // Nombre d'articles : il décide de ce que l'utilisateur a à écrire, ce n'est pas un
      // réglage à brasser (« Tout au hasard » n'y touche pas).
      { cle: 'articles', label: 'Articles', type: 'range', min: 1, max: ARTICLES.length, pas: 1, defaut: 3, hasard: false }
    ].concat(PARAMS_ARTICLES),

    render: function (ctx, w, h, P, rng, pal) { collage(ctx, w, h, P, rng, pal, false); },

    /* Zones cliquables de l'aperçu (app.js) : une par coupure, dans l'ordre de la pile, avec
       les params que la fenêtre de retouche propose. Même plan que le rendu, sans rien dessiner. */
    zones: function (ctx, w, h, P, rng, pal) {
      return collage(ctx, w, h, P, rng, pal, true).map(function (C) {
        var c = Math.cos(C.rot), s = Math.sin(C.rot), n = C.art + 1;
        var coins = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (k) {
          var x = k[0] * C.l / 2, y = k[1] * C.ht / 2;
          return [C.x + x * c - y * s, C.y + x * s + y * c];
        });
        return { points: coins, titre: 'Article ' + n, champs: (C.type === 'une' ? ['journal'] : []).concat(['t' + n, 'p' + n]) };
      });
    }
  });

  // Plan puis dessin du collage. seulementPlan : s'arrête après le plan et rend les coupures.
  function collage(ctx, w, h, P, rng, pal, seulementPlan) {
      var m = Math.min(w, h), mes = creerMesure(ctx);
      var articles = [];
      for (var a = 1; a <= P.articles; a++) {
        var Ta = preparerTexte(P['p' + a]);
        if (!Ta.jetons.length) Ta = preparerTexte(ARTICLES[a - 1].texte);
        articles.push({ titre: String(P['t' + a] || '').trim() || 'Article ' + a, T: Ta });
      }
      var journal = String(P.journal || '').trim() || 'News';
      var PAPIER = pal[1], ENCRE = pal[2], ACCENT = pal[3], FLUO = pal[4];

      // Grain : petite texture de bruit répétée sans lissage, à une échelle relative au petit
      // côté, posée en « overlay » sur la table puis sur chaque coupure (comme Kiosk).
      var motifGrain = null, echelleGrain = Math.max(1, m / 900);
      if (P.usure > 0 && !seulementPlan) {
        var TG = 128, tex = document.createElement('canvas');
        tex.width = TG; tex.height = TG;
        var tc = tex.getContext('2d'), img = tc.createImageData(TG, TG), sg = DL.hacher(String(rng.seed) + 'grain');
        for (var q = 0; q < TG * TG; q++) {
          var vg = 100 + Math.floor(DL.hash2(q % TG, Math.floor(q / TG), sg) * 56);
          img.data[q * 4] = img.data[q * 4 + 1] = img.data[q * 4 + 2] = vg;
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

      if (!pal.transparent && !seulementPlan) {
        ctx.fillStyle = pal[0];
        ctx.fillRect(0, 0, w, h);
        grain(0, 0, w, h, 0.5 * P.usure);
      }

      /* 1. Plan du collage, en deux temps.
         a) « Remplir la page » : une couche de fond. Le cadre est découpé en cases, et chaque
            case reçoit une grande page d'article assez large pour la couvrir entièrement une
            fois tournée et décalée : aucun coin de table ne reste visible, quels que soient
            les réglages.
         b) La pile : les autres coupures, posées par-dessus. Peu = grandes, beaucoup = plus
            petites. Les bandes de titre arrivent plutôt à la fin, donc au-dessus : ce sont
            elles qu'on lit. Chaque position est la meilleure de 8 essais (la plus loin des
            coupures déjà posées), pour répartir sans grille visible.
         Il y a toujours au moins une coupure de pile par article, pour que chacun se voie. */
      var nA = articles.length, cases = [];
      if (P.remplir) {
        var nFond = Math.max(2, Math.round(P.coupures * 0.4));
        var colsF = Math.max(1, Math.round(Math.sqrt(nFond * w / h))), rangsF = Math.max(1, Math.round(nFond / colsF));
        var rf = rng.fork('fond');
        for (var cf = 0; cf < colsF * rangsF; cf++) cases.push({ cx: (cf % colsF + 0.5) * w / colsF, cy: (Math.floor(cf / colsF) + 0.5) * h / rangsF, lc: w / colsF, hc: h / rangsF });
        // Ordre de pose tiré au sort : les chevauchements ne suivent pas le sens de lecture.
        cases = rf.shuffle(cases);
      }
      var nFondReel = cases.length, nPile = Math.max(P.coupures - nFondReel, nA), n = nFondReel + nPile;
      // Page remplie : tout est un peu plus petit, sinon les pages de fond écrasent la pile.
      var ech = DL.clamp(Math.sqrt((P.remplir ? 7 : 9) / nPile), 0.6, 1.3);
      // Les coupures se partagent les articles à tour de rôle, dans un ordre tiré par la seed.
      var ordre = rng.fork('titres').shuffle(articles.map(function (x, k) { return k; })), coupures = [];
      var rangUne = P.remplir ? Math.floor(nFondReel * 0.5) : Math.floor(n * 0.4);
      for (var i = 0; i < n; i++) {
        var r = rng.fork('c' + i), fond = i < nFondReel ? cases[i] : null, j = i - nFondReel;
        var avance = fond ? 0 : nPile > 1 ? j / (nPile - 1) : 1;
        var art = ordre[(fond ? i + 1 : j) % nA];
        var C = { r: r, art: art, titre: articles[art].titre, T: articles[art].T, corps: m * 0.0115 * ech * r.range(0.9, 1.25) };
        if (fond) {
          /* Page de fond. Pour qu'un rectangle l × ht tourné de a couvre sa case lc × hc, il
             faut l >= lc cos a + hc sin a et ht >= lc sin a + hc cos a ; on ajoute le décalage
             et de quoi absorber les coins rentrés et les bords déchirés (jusqu'à 4 % du petit côté). */
          C.type = i === rangUne ? 'une' : 'article';
          C.rot = (r() - 0.5) * 2 * P.desordre * 0.28;
          var ca = Math.cos(C.rot), sa = Math.abs(Math.sin(C.rot)), dec = Math.min(fond.lc, fond.hc) * 0.1 * P.desordre, garde = m * 0.045;
          C.x = fond.cx + (r() - 0.5) * 2 * dec; C.y = fond.cy + (r() - 0.5) * 2 * dec;
          C.l = (fond.lc * ca + fond.hc * sa + 2 * dec) * r.range(1, 1.12) + 2 * garde;
          C.ht = (fond.lc * sa + fond.hc * ca + 2 * dec) * r.range(1, 1.12) + 2 * garde;
        } else {
        C.type = !P.remplir && i === rangUne ? 'une' : r.chance(0.12 + 0.42 * avance) ? 'bande' : r.pick(['article', 'article', 'article', 'colonne']);
        if (C.type === 'une') {
          C.l = m * ech * r.range(0.55, 0.72); C.ht = C.l * r.range(0.78, 1.1);
        } else if (C.type === 'article') {
          C.l = m * ech * r.range(0.38, 0.6); C.ht = C.l * r.range(0.62, 1.15);
        } else if (C.type === 'colonne') {
          C.l = C.corps * r.range(16, 30); C.ht = m * ech * r.range(0.38, 0.62);
        } else {
          // Bande : la coupure prend la taille de son titre, sur une ou deux lignes.
          C.police = r.pick(['archivo', 'archivo', 'dela', 'serif', 'grotesk']);
          C.variante = r.pick(['papier', 'papier', 'papier', 'encre', 'accent', 'fluo']);
          var majuscules = C.police === 'archivo' || C.police === 'dela';
          C.texte = majuscules ? C.titre.toUpperCase() : C.titre;
          var taille = m * ech * r.range(0.05, 0.085) * (C.police === 'serif' ? 1.25 : 1);
          C.marge = taille * 0.34;
          var fit = titrer(mes, C.police, C.texte, m * 0.84 - 2 * C.marge, taille, 2), large = 0;
          fit.lignes.forEach(function (ligne) { large = Math.max(large, mes(C.police, ligne) * fit.taille); });
          C.fit = fit;
          C.l = large + 2 * C.marge;
          C.ht = fit.lignes.length * fit.taille * 1.06 + 1.7 * C.marge;
        }
        // La pile ne se compare qu'à elle-même : les pages de fond sont partout.
        var meilleur = null, score = -1;
        for (var e = 0; e < 8; e++) {
          var px = w * r.range(0.1, 0.9), py = h * r.range(0.1, 0.9), dmin = 1e9;
          for (var c = nFondReel; c < coupures.length; c++) dmin = Math.min(dmin, Math.hypot(px - coupures[c].x, py - coupures[c].y));
          if (dmin > score) { score = dmin; meilleur = [px, py]; }
        }
        C.x = meilleur[0]; C.y = meilleur[1];
        C.rot = (r() - 0.5) * 2 * P.desordre * 0.55;
        }
        var tout = r();
        C.dechire = [0, 1, 2, 3].map(function () {
          if (P.decoupe === 'ciseaux') return false;
          if (P.decoupe === 'dechire') return true;
          return tout < 0.4 ? false : tout < 0.62 ? true : r.chance(0.5);
        });
        // Jaunissement propre à chaque coupure : elles ne viennent pas du même journal.
        C.use = r();
        C.papier = chroma.mix(PAPIER, '#C29A5B', 0.34 * P.usure * (0.15 + 0.85 * C.use), 'lab').hex();
        C.encre = chroma.mix(ENCRE, C.papier, 0.2 * P.usure * r(), 'lab').hex();
        coupures.push(C);
      }
      if (seulementPlan) return coupures;

      // Titre d'article : lignes ferrées à gauche, parfois surlignées ou soulignées au stylo.
      function grosTitre(C, r, x, y, largeur, tailleMax, maxLignes) {
        var cle = r.pick(['archivo', 'serif', 'serif', 'grotesk', 'dela']);
        var texte = cle === 'archivo' || cle === 'dela' ? C.titre.toUpperCase() : C.titre;
        var fit = titrer(mes, cle, texte, largeur, tailleMax * (cle === 'serif' ? 1.3 : 1), maxLignes), t = fit.taille;
        var inter = t * (cle === 'serif' ? 0.98 : 1.08), marque = r.pick(['', '', '', 'fluo', 'stylo']);
        fit.lignes.forEach(function (ligne, k) {
          var base = y + t * 0.82 + k * inter, lw = mes(cle, ligne) * t;
          if (marque === 'fluo') {
            ctx.fillStyle = FLUO;
            ctx.fillRect(x - t * 0.08, base - t * 0.74, lw + t * 0.16, t * 0.92);
          }
          ctx.font = fonte(POL[cle], t);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = C.encre;
          ctx.fillText(ligne, x, base);
        });
        var bas = y + t * 0.82 + (fit.lignes.length - 1) * inter + t * 0.3;
        if (marque === 'stylo') {
          // Trait de stylo sous la dernière ligne : une ondulation tirée à la main.
          var der = mes(cle, fit.lignes[fit.lignes.length - 1]) * t, ph = r.range(0, 6);
          ctx.beginPath();
          for (var s = 0; s <= 24; s++) {
            var sx = x + der * s / 24, sy = bas + t * 0.04 * Math.sin(s * 0.9 + ph);
            if (s) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
          }
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = Math.max(0.6, t * 0.07);
          ctx.lineCap = 'round';
          ctx.stroke();
          bas += t * 0.14;
        }
        return bas;
      }

      function filet(x, y, largeur, epaisseur, couleur) {
        ctx.fillStyle = couleur;
        ctx.fillRect(x, y, largeur, Math.max(0.5, epaisseur));
      }

      // Une du journal ou article : bandeau, titre, chapeau, puis colonnes avec photo et lettrine.
      function dessinerArticle(C) {
        var T = C.T, r = C.r.fork('page'), u = C.corps, l = C.l, ht = C.ht, une = C.type === 'une';
        var mg = u * 1.6, g = u * 1.3, lh = u * 1.2, colW = u * r.range(12.5, 16);
        // Côtés où la page continue : les colonnes sortent du cadre et sont tranchées.
        var coupeG = !une && r.chance(0.3), coupeD = !une && r.chance(0.45), coupeB = r.chance(0.65);
        var xa = coupeG ? -colW * r.range(0.25, 0.7) : mg, nc;
        if (coupeD) nc = Math.ceil((l - xa + g) / (colW + g));
        else {
          nc = Math.max(1, Math.round((l - mg - xa + g) / (colW + g)));
          colW = (l - mg - xa + g) / nc - g;
        }
        var W = nc * (colW + g) - g;
        // Le titre, lui, reste dans la partie visible.
        var xt = Math.max(xa, mg), Wt = Math.min(xa + W, l - mg) - xt, y = mg;

        if (une) {
          var cleJ = r.pick(['serif', 'dela', 'archivo']), tj = Math.min(u * 7.5, Wt * 0.92 / mes(cleJ, journal));
          ctx.font = fonte(POL[cleJ], tj);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = C.encre;
          ctx.fillText(journal, xt + Wt / 2, y + tj * 0.8);
          y += tj * 1.02;
          filet(xt, y, Wt, u * 0.14, C.encre);
          var tm = u * 0.74, by = y + u * 0.14 + tm * 1.25;
          ctx.font = fonte(POL.mono, tm);
          ctx.fillStyle = C.encre;
          ctx.textAlign = 'left';
          ctx.fillText('N° ' + r.int(1, 9) + ' ' + r.int(100, 999), xt, by);
          ctx.textAlign = 'center';
          ctx.fillText(r.pick(JOURS) + ' ' + r.int(1, 28) + ' ' + r.pick(MOIS), xt + Wt / 2, by);
          ctx.textAlign = 'right';
          ctx.fillText(r.pick(PRIX), xt + Wt, by);
          y = by + tm * 0.6;
          filet(xt, y, Wt, u * 0.06, C.encre);
          y += u * 1.3;
        } else if (r.chance(0.5)) {
          ctx.font = fonte(POL.monoGras, u * 0.8);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = ACCENT;
          ctx.fillText(r.pick(RUBRIQUES), xt, y + u * 0.7);
          y += u * 1.5;
        }

        y = grosTitre(C, r, xt, y, Wt, u * (une ? r.range(5, 6.5) : r.range(3.4, 5)), 3) + u * 0.5;

        // Position de départ dans le texte : un début de phrase tiré au sort.
        var E = { i: r.pick(T.phrases), reste: null, lettrine: 0, lettrineL: 0 };

        // Chapeau : la première phrase en italique, deux lignes au plus.
        if (r.chance(0.55)) {
          var mots = [];
          for (var k = 0; k < 26; k++) {
            var jeton = T.jetons[(E.i + k) % T.jetons.length];
            mots.push(jeton.m);
            if (/[.!?…]$/.test(jeton.m)) break;
          }
          var tc2 = u * 1.55, lignes = couper(mes, 'italique', mots.join(' '), tc2, Wt).slice(0, 2);
          ctx.font = fonte(POL.italique, tc2);
          ctx.textAlign = 'left';
          ctx.fillStyle = C.encre;
          lignes.forEach(function (ligne, q2) { ctx.fillText(ligne, xt, y + tc2 * 0.8 + q2 * tc2 * 1.08); });
          y += lignes.length * tc2 * 1.08 + u * 0.5;
          // Le texte courant reprend après le chapeau, pas dessus.
          E.i += mots.length;
        }
        filet(xt, y, Wt, u * 0.06, C.encre);
        y += u * 0.9;

        // Photo en tête d'une ou plusieurs colonnes, avec sa légende.
        var yFin = coupeB ? ht + lh : ht - mg, c0 = -1, portee = 0, basPhoto = y;
        if (r.chance(une ? 0.9 : 0.55)) {
          portee = Math.min(nc, une ? r.int(2, 3) : r.int(1, 2));
          var debut = r.int(0, nc - portee), pl = portee * (colW + g) - g, ph = Math.min(pl * r.range(0.55, 0.8), (ht - y) * 0.6);
          if (ph > u * 5) {
            c0 = debut;
            var px0 = xa + c0 * (colW + g);
            photo(ctx, r.fork('photo'), px0, y, pl, ph, u * 0.5, r.chance(0.2) ? ACCENT : C.encre);
            ctx.font = fonte(POL.italique, u * 0.9);
            ctx.textAlign = 'left';
            ctx.fillStyle = C.encre;
            ctx.fillText(r.pick(LEGENDES), px0, y + ph + u * 1.05);
            basPhoto = y + ph + u * 1.9;
          }
        }

        // Lettrine : première lettre du texte en grand, sur trois lignes de la première colonne.
        var cleTexte = r.chance(0.75) ? 'serif' : 'texte', corps = cleTexte === 'serif' ? u * 1.08 : u * 0.92;
        var y0 = c0 === 0 ? basPhoto : y;
        if (r.chance(0.5) && y0 + 3 * lh < yFin) {
          var mot = T.jetons[E.i % T.jetons.length].m, lettre = mot.charAt(0).toUpperCase(), tl = (2 * lh + corps * 0.7) / 0.72;
          ctx.font = fonte(POL.archivo, tl);
          ctx.textAlign = 'left';
          ctx.fillStyle = r.chance(0.3) ? ACCENT : C.encre;
          ctx.fillText(lettre, xa, y0 + corps * 0.82 + 2 * lh);
          E.lettrine = 3;
          E.lettrineL = mes('archivo', lettre) * tl + u * 0.35;
          E.reste = mot.slice(1);
        }

        var filets = r.chance(0.5);
        for (var col = 0; col < nc; col++) {
          var x = xa + col * (colW + g);
          if (x > l || x + colW < 0) continue;
          var haut = c0 >= 0 && col >= c0 && col < c0 + portee ? basPhoto : y;
          if (filets && col > 0) filet(x - g / 2, haut, u * 0.05, yFin - haut, C.encre);
          ctx.fillStyle = C.encre;
          composer(ctx, mes, T.jetons, E, x, haut, yFin, colW, corps, lh, cleTexte);
        }
      }

      // Colonne isolée : texte tranché en haut et en bas, avec un intertitre au milieu.
      function dessinerColonne(C) {
        var T = C.T, r = C.r.fork('page'), u = C.corps, l = C.l, ht = C.ht, lh = u * 1.2, mg = u * 1.2, g = u * 1.3;
        var nc = l > u * 23 ? 2 : 1, colW = (l - 2 * mg + g) / nc - g, corps = u * 1.08;
        var E = { i: r.pick(T.phrases), reste: null, lettrine: 0, lettrineL: 0 };
        var depart = -lh * r.range(0.2, 0.9), colTitre = r.int(0, nc - 1);
        for (var col = 0; col < nc; col++) {
          var x = mg + col * (colW + g);
          if (col > 0) filet(x - g / 2, 0, u * 0.05, ht, C.encre);
          ctx.fillStyle = C.encre;
          if (col !== colTitre) { composer(ctx, mes, T.jetons, E, x, depart, ht + lh, colW, corps, lh, 'serif'); continue; }
          var yt = ht * r.range(0.18, 0.5);
          composer(ctx, mes, T.jetons, E, x, depart, yt - lh, colW, corps, lh, 'serif');
          var fit = titrer(mes, 'grotesk', C.titre, colW, u * 1.7, 4);
          filet(x, yt, colW, u * 0.12, r.chance(0.4) ? ACCENT : C.encre);
          ctx.font = fonte(POL.grotesk, fit.taille);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = C.encre;
          fit.lignes.forEach(function (ligne, k) { ctx.fillText(ligne, x, yt + u * 0.7 + fit.taille * (0.8 + k * 1.1)); });
          var suite = yt + u * 0.7 + fit.lignes.length * fit.taille * 1.1 + u * 0.6;
          ctx.fillStyle = C.encre;
          composer(ctx, mes, T.jetons, E, x, suite, ht + lh, colW, corps, lh, 'serif');
        }
      }

      // Bande : le titre seul, découpé pour lui-même, parfois sur aplat d'encre ou de couleur.
      function dessinerBande(C) {
        var fond = null, encre = C.encre, t = C.fit.taille;
        if (C.variante === 'encre') { fond = C.encre; encre = C.papier; }
        else if (C.variante === 'accent') {
          fond = ACCENT;
          encre = chroma.contrast(ACCENT, C.papier) >= chroma.contrast(ACCENT, C.encre) ? C.papier : C.encre;
        }
        if (fond) { ctx.fillStyle = fond; ctx.fillRect(-C.l, -C.ht, 3 * C.l, 3 * C.ht); }
        C.fit.lignes.forEach(function (ligne, k) {
          var base = C.marge * 0.85 + t * 0.84 + k * t * 1.06;
          if (C.variante === 'fluo') {
            ctx.fillStyle = FLUO;
            ctx.fillRect(C.marge - t * 0.08, base - t * 0.74, mes(C.police, ligne) * t + t * 0.16, t * 0.92);
          }
          ctx.font = fonte(POL[C.police], t);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = encre;
          ctx.fillText(ligne, C.marge, base);
        });
      }

      // 2. Collage, de la première coupure (dessous) à la dernière (dessus).
      var teinteScotch = chroma.mix(PAPIER, '#E2CB7C', 0.55, 'lab').alpha(0.62).css();
      coupures.forEach(function (C) {
        var r = C.r.fork('pose'), bords = contour(r, C.l, C.ht, C.dechire, m);
        ctx.save();
        ctx.translate(C.x, C.y);
        ctx.rotate(C.rot);
        ctx.translate(-C.l / 2, -C.ht / 2);

        // Papier (frange claire des déchirures comprise), avec l'ombre portée sur ce qui est dessous.
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.38)';
        ctx.shadowBlur = m * 0.014;
        ctx.shadowOffsetY = m * 0.004;
        chemin(ctx, bords.ext);
        ctx.fillStyle = chroma.mix(C.papier, '#FFFFFF', 0.6).hex();
        ctx.fill();
        ctx.restore();

        // Partie imprimée.
        ctx.save();
        chemin(ctx, bords.int);
        ctx.clip();
        ctx.fillStyle = C.papier;
        ctx.fillRect(-C.l, -C.ht, 3 * C.l, 3 * C.ht);
        if (C.type === 'bande') dessinerBande(C);
        else if (C.type === 'colonne') dessinerColonne(C);
        else dessinerArticle(C);
        // Usure : plis du journal (un trait clair et un trait sombre côte à côte), puis grain.
        var us = P.usure * (0.4 + 0.6 * C.use);
        if (us > 0) {
          var plis = Math.round(us * 2.4);
          for (var k = 0; k < plis; k++) {
            var horizontal = r.chance(0.5);
            ctx.save();
            ctx.translate(horizontal ? C.l / 2 : C.l * r.range(0.2, 0.8), horizontal ? C.ht * r.range(0.2, 0.8) : C.ht / 2);
            ctx.rotate((horizontal ? Math.PI / 2 : 0) + r.range(-0.03, 0.03));
            var portee = 2 * Math.max(C.l, C.ht);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.3 * us).toFixed(3) + ')';
            ctx.fillRect(-m * 0.0018, -portee, m * 0.0018, 2 * portee);
            ctx.fillStyle = 'rgba(0,0,0,' + (0.16 * us).toFixed(3) + ')';
            ctx.fillRect(0, -portee, m * 0.0024, 2 * portee);
            ctx.restore();
          }
        }
        grain(-C.l * 0.1, -C.ht * 0.1, C.l * 1.2, C.ht * 1.2, 0.42 * P.usure);
        ctx.restore();

        // Scotch : à cheval sur le bord du haut ou sur un coin, pour une partie des coupures.
        if (P.scotch && r.chance(0.5)) {
          var lon = m * r.range(0.06, 0.085), lar = m * r.range(0.02, 0.026);
          if (r.chance(0.5)) {
            scotch(ctx, C.l * r.range(0.25, 0.75), m * 0.004, Math.PI / 2 + r.range(-0.25, 0.25), lon, lar, teinteScotch);
          } else {
            scotch(ctx, m * 0.012, m * 0.012, -Math.PI / 4 + r.range(-0.2, 0.2), lon, lar, teinteScotch);
            scotch(ctx, C.l - m * 0.012, C.ht - m * 0.012, -Math.PI / 4 + r.range(-0.2, 0.2), lon, lar, teinteScotch);
          }
        }
        ctx.restore();
      });
      return coupures;
  }
})();

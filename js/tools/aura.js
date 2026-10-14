/* 04 Aura : dégradés doux et vibrants, avec grain (fragment shader WebGL).
   Chaque encre est une « tache » gaussienne ; la couleur d'un pixel est la moyenne pondérée
   des taches, calculée dans un espace déformé par du bruit (domain warping) pour obtenir
   des transitions organiques plutôt que des cercles concentriques. Grain proportionnel
   à la taille de l'image : l'export 4000 px a le même toucher que l'aperçu. */
(function () {
  'use strict';
  var DL = window.DL;
  var MAX = 6;

  var FRAG = [
    'uniform vec3 u_bg;',
    'uniform vec3 u_col[6];',
    'uniform vec2 u_pos[6];',
    'uniform float u_rad[6];',
    'uniform int u_n;',
    'uniform float u_douceur, u_def, u_echelle, u_grain, u_vib, u_contraste;',
    'uniform vec2 u_dec;',
    'void main() {',
    '  vec2 uv = dl_uv();',
    // Deux niveaux de déformation : le second, nourri par le premier, crée les volutes.
    '  vec2 q = uv * u_echelle + u_dec;',
    '  vec2 d = vec2(dl_noise(q), dl_noise(q + vec2(5.2, 1.3)));',
    '  vec2 d2 = vec2(dl_noise(q * 2.0 + d * 1.5 + vec2(1.7, 9.2)), dl_noise(q * 2.0 + d * 1.5 + vec2(8.3, 2.8)));',
    '  vec2 p = uv + u_def * (0.22 * d + 0.1 * d2);',
    '  vec3 acc = u_bg * 0.08; float somme = 0.08;',
    '  for (int i = 0; i < 6; i++) {',
    '    if (i >= u_n) break;',
    '    vec2 e = p - u_pos[i];',
    '    float r = u_rad[i] * u_douceur;',
    '    float w = exp(-dot(e, e) / (r * r));',
    '    acc += u_col[i] * w; somme += w;',
    '  }',
    '  vec3 c = acc / somme;',
    // Vibrance : on écarte la couleur de sa luminance (plus saturé sans changer la clarté).
    '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  c = mix(vec3(l), c, u_vib);',
    '  c = (c - 0.5) * u_contraste + 0.5;',
    // Grain : un tirage par « grain » de taille relative, monochrome pour ne pas salir les teintes.
    '  float taille = max(1.0, min(u_res.x, u_res.y) / 900.0);',
    '  float g = dl_hash(floor(dl_px() / taille)) - 0.5;',
    '  c += g * u_grain * 0.28;',
    '  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  // Tirages partagés par le shader et le repli 2D : même composition dans les deux cas.
  function tirer(w, h, P, rng, pal) {
    var m = Math.min(w, h), ax = w / m * 0.5, ay = h / m * 0.5;
    var encres = pal.slice(1);
    var taches = [];
    // Les encres sont parcourues dans un ordre tiré : avec moins de taches que d'encres,
    // la seed choisit lesquelles apparaissent ; avec plus, des doublons enrichissent le mélange.
    var n = Math.min(MAX, P.taches);
    encres = rng.shuffle(encres);
    for (var i = 0; i < n; i++) {
      taches.push({
        x: rng.range(-ax * 0.9, ax * 0.9),
        y: rng.range(-ay * 0.9, ay * 0.9),
        r: P.taille * rng.range(0.6, 1.3),
        c: encres[i % encres.length]
      });
    }
    return { taches: taches, dec: [rng.range(0, 100), rng.range(0, 100)] };
  }

  DL.enregistrer({
    id: 'aura',
    numero: '04',
    nom: 'Aura',
    famille: 'degrade',
    description: 'Dégradés doux et vibrants : taches de couleur fondues, volutes et grain photographique.',
    libs: ['WebGL', 'GLSL'],
    moteur: 'webgl',
    fondTransparent: false,
    nbCouleurs: 5,
    palette: ['#F4E9D8', '#FF4D00', '#FFB000', '#E6007E', '#00875A'],
    params: [
      { cle: 'taches', label: 'Taches', type: 'range', min: 2, max: 6, pas: 1, defaut: 5 },
      { cle: 'taille', label: 'Taille des taches', type: 'range', min: 0.1, max: 1, pas: 0.01, defaut: 0.3 },
      { cle: 'douceur', label: 'Douceur', type: 'range', min: 0.3, max: 2.5, pas: 0.05, defaut: 0.85 },
      { cle: 'deformation', label: 'Déformation', type: 'range', min: 0, max: 3, pas: 0.05, defaut: 1.2 },
      { cle: 'echelle', label: 'Échelle des volutes', type: 'range', min: 0.5, max: 6, pas: 0.1, defaut: 1.8 },
      { cle: 'grain', label: 'Grain', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.35 },
      { cle: 'vibrance', label: 'Vibrance', type: 'range', min: 0.3, max: 2, pas: 0.05, defaut: 1.25 },
      { cle: 'contraste', label: 'Contraste', type: 'range', min: 0.6, max: 1.8, pas: 0.05, defaut: 1 }
    ],

    render: function (g, w, h, P, rng, pal) {
      var t = tirer(w, h, P, rng, pal);
      var col = [], pos = [], rad = [];
      for (var i = 0; i < MAX; i++) {
        var k = t.taches[i] || t.taches[0];
        col.push.apply(col, DL.rgb01(k.c));
        pos.push(k.x, k.y);
        rad.push(k.r);
      }
      g.dessiner(FRAG, {
        u_bg: ['3fv', DL.rgb01(pal[0])],
        u_col: ['3fv', col],
        u_pos: ['2fv', pos],
        u_rad: ['1fv', rad],
        u_n: ['1i', t.taches.length],
        u_douceur: ['1f', P.douceur],
        u_def: ['1f', P.deformation],
        u_echelle: ['1f', P.echelle],
        u_grain: ['1f', P.grain],
        u_vib: ['1f', P.vibrance],
        u_contraste: ['1f', P.contraste],
        u_dec: ['2fv', t.dec]
      });
    },

    // Repli sans WebGL : dégradés radiaux superposés et grain par pixel, sans les volutes.
    renduRepli: function (ctx, w, h, P, rng, pal) {
      var t = tirer(w, h, P, rng, pal), m = Math.min(w, h);
      ctx.fillStyle = pal[0];
      ctx.fillRect(0, 0, w, h);
      t.taches.forEach(function (k) {
        var x = w / 2 + k.x * m, y = h / 2 + k.y * m, r = k.r * P.douceur * m * 1.6;
        var rgb = DL.rgb255(k.c).join(',');
        var gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(' + rgb + ',1)');
        gr.addColorStop(0.5, 'rgba(' + rgb + ',0.55)');
        gr.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, w, h);
      });
      if (P.grain > 0) {
        var img = ctx.getImageData(0, 0, w, h), d = img.data, taille = Math.max(1, m / 900), s = DL.hacher(String(rng.seed));
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var gq = (DL.hash2(Math.floor(x / taille), Math.floor(y / taille), s) - 0.5) * P.grain * 72;
            var i = (y * w + x) * 4;
            d[i] += gq; d[i + 1] += gq; d[i + 2] += gq;
          }
        }
        ctx.putImageData(img, 0, 0);
      }
    }
  });
})();

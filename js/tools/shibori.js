/* 15 Shibori : teinture indigo à réserve, façon japonaise (fragment shader WebGL, repli 2D).
   Trois techniques :
   - itajime : tissu plié en accordéon puis serré entre deux formes ; le pliage se traduit par
     une onde triangulaire (coordonnée « repliée »), la forme de réserve reste claire ;
   - kumo : tissu pincé et ligaturé en petites « araignées » (rayons + anneaux blancs) ;
   - arashi : tissu enroulé en biais sur un poteau, d'où des rayures obliques froissées.
   La teinture « bave » au bord des réserves (capillarité = bruit) et la trame du tissu est
   ajoutée à une échelle relative : l'export HD a le même grain que l'aperçu. */
(function () {
  'use strict';
  var DL = window.DL;
  var TECH = { itajime: 0, kumo: 1, arashi: 2 };
  var RESERVES = ['cercle', 'diagonale', 'carre'];

  var FRAG = [
    'uniform int u_tech, u_reserve;',
    'uniform float u_plis, u_forme, u_diff, u_int, u_fibre, u_angle;',
    'uniform vec3 u_c0, u_c1, u_c2;',
    'uniform vec2 u_dec;',
    'float tri(float x) { return abs(fract(x * 0.5) * 2.0 - 1.0); }',
    'float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * dl_noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }',
    'void main() {',
    '  float c = cos(u_angle), s = sin(u_angle);',
    '  vec2 uv0 = dl_uv();',
    '  vec2 uv = vec2(c * uv0.x - s * uv0.y, s * uv0.x + c * uv0.y);',
    '  float m = min(u_res.x, u_res.y);',
    '  vec2 rel = dl_px() / m;',
    '  float bave = 0.012 + u_diff * 0.09;',
    // Capillarité : la teinture avance de façon irrégulière ; fibres : micro-irrégularités.
    '  float wob = fbm(uv * 3.0 + u_dec) * u_diff * 0.14 + dl_noise(rel * 160.0) * 0.02 * u_fibre;',
    '  float dye;',
    '  if (u_tech == 0) {',
    '    vec2 q = (uv + 0.5) * u_plis;',
    '    vec2 f = vec2(tri(q.x), tri(q.y));',
    '    float d;',
    '    if (u_reserve == 0) d = length(f) - u_forme;',
    '    else if (u_reserve == 1) d = abs(f.x - f.y) * 0.7 - u_forme * 0.45;',
    '    else d = max(f.x, f.y) - u_forme;',
    '    dye = smoothstep(-bave, bave, d + wob);',
    // Plis serrés : la teinture pénètre mal au creux des plis (fines lignes claires).
    '    float creux = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));',
    '    dye *= mix(1.0, smoothstep(0.0, 0.035 + u_diff * 0.03, creux + wob * 0.3), 0.55);',
    '  } else if (u_tech == 1) {',
    '    vec2 g = uv * u_plis * 0.6 + u_dec;',
    '    vec2 id = floor(g);',
    '    vec2 o = dl_hash2(id) * 0.5 + 0.25;',
    '    vec2 e = fract(g) - o;',
    '    float r = length(e), a = atan(e.y, e.x);',
    '    float bras = 5.0 + floor(dl_hash(id + 3.1) * 6.0);',
    '    float rayons = abs(sin(a * bras + fbm(vec2(r * 9.0, a * 1.3) + id) * 2.4));',
    '    float anneaux = abs(sin(r * (18.0 + 30.0 * u_forme) + fbm(e * 7.0 + id) * 3.0));',
    '    float toile = min(rayons * (0.6 + r * 2.0), anneaux * 1.4);',
    '    dye = smoothstep(0.05, 0.22 + u_diff * 0.45, toile + wob * 1.5);',
    '    dye *= smoothstep(0.03, 0.12 + u_forme * 0.2, r + wob * 0.5);',
    '  } else {',
    '    float t = (uv.x + uv.y * 0.42) * u_plis * 5.0;',
    '    float froisse = fbm(vec2(uv.x * 1.4 - uv.y * 0.6, (uv.y + uv.x * 0.42) * 26.0) + u_dec);',
    '    float raie = sin(t + froisse * 5.0);',
    '    dye = smoothstep(-0.35 - u_diff * 0.5, 0.45 - u_forme * 0.4, raie + wob * 3.0);',
    '  }',
    '  dye = clamp(dye, 0.0, 1.0) * u_int;',
    // Profondeur de teinte irrégulière : les zones très teintes tirent vers la 2e encre.
    '  float prof = fbm(uv * 5.0 - u_dec) * 0.5 + 0.5;',
    '  vec3 col = mix(u_c0, mix(u_c1, u_c2, clamp(prof * dye * 1.2, 0.0, 1.0)), dye);',
    // Trame du tissu, à l'échelle relative de l'image.
    '  vec2 pa = dl_px() / max(1.0, m / 900.0);',
    '  col += sin(pa.x * 1.3) * sin(pa.y * 1.3) * 0.02 * u_fibre;',
    '  col += (dl_hash(floor(pa)) - 0.5) * 0.06 * u_fibre;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function tirage(P, rng) {
    return {
      reserve: RESERVES.indexOf(P.reserve) >= 0 ? RESERVES.indexOf(P.reserve) : 0,
      dec: [rng.range(0, 50), rng.range(0, 50)]
    };
  }

  DL.enregistrer({
    id: 'shibori',
    numero: '15',
    nom: 'Shibori',
    famille: 'textile',
    description: 'Teinture indigo à réserve : tissu plié, ligaturé ou enroulé, bords qui bavent et trame visible.',
    libs: ['WebGL', 'GLSL'],
    moteur: 'webgl',
    fondTransparent: false,
    nbCouleurs: 3,
    palette: ['#F1EEE6', '#22346E', '#0E1838'],
    params: [
      { cle: 'technique', label: 'Technique', type: 'select', defaut: 'itajime', options: [
        { valeur: 'itajime', label: 'Itajime (plié, serré)' }, { valeur: 'kumo', label: 'Kumo (araignées)' }, { valeur: 'arashi', label: 'Arashi (enroulé en biais)' }] },
      { cle: 'reserve', label: 'Forme de réserve', type: 'select', defaut: 'cercle', options: [
        { valeur: 'cercle', label: 'Cercle' }, { valeur: 'diagonale', label: 'Diagonale' }, { valeur: 'carre', label: 'Carré' }] },
      { cle: 'plis', label: 'Plis / répétitions', type: 'range', min: 2, max: 14, pas: 1, defaut: 6 },
      { cle: 'forme', label: 'Taille de la réserve', type: 'range', min: 0.1, max: 0.9, pas: 0.01, defaut: 0.45 },
      { cle: 'diffusion', label: 'Diffusion', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'intensite', label: 'Intensité', type: 'range', min: 0.3, max: 1, pas: 0.01, defaut: 0.92 },
      { cle: 'fibres', label: 'Fibres', type: 'range', min: 0, max: 1, pas: 0.01, defaut: 0.5 },
      { cle: 'angle', label: 'Angle', type: 'range', min: 0, max: 90, pas: 1, defaut: 0, unite: '°' }
    ],

    render: function (g, w, h, P, rng, pal) {
      var t = tirage(P, rng);
      g.dessiner(FRAG, {
        u_tech: ['1i', TECH[P.technique] || 0],
        u_reserve: ['1i', t.reserve],
        u_plis: ['1f', P.plis],
        u_forme: ['1f', P.forme],
        u_diff: ['1f', P.diffusion],
        u_int: ['1f', P.intensite],
        u_fibre: ['1f', P.fibres],
        u_angle: ['1f', P.angle * Math.PI / 180],
        u_c0: ['3fv', DL.rgb01(pal[0])],
        u_c1: ['3fv', DL.rgb01(pal[1])],
        u_c2: ['3fv', DL.rgb01(pal[2])],
        u_dec: ['2fv', t.dec]
      });
    },

    // Repli sans WebGL : même logique en JS, avec le bruit seedé de noise.js (rendu plus lent,
    // aspect proche mais pas identique au pixel près).
    renduRepli: function (ctx, w, h, P, rng, pal) {
      var t = tirage(P, rng), b = DL.creerBruit(rng.fork('repli'));
      var m = Math.min(w, h), c0 = DL.rgb255(pal[0]), c1 = DL.rgb255(pal[1]), c2 = DL.rgb255(pal[2]);
      var ca = Math.cos(P.angle * Math.PI / 180), sa = Math.sin(P.angle * Math.PI / 180);
      var bave = 0.012 + P.diffusion * 0.09;
      var trif = function (x) { var f = x * 0.5 - Math.floor(x * 0.5); return Math.abs(f * 2 - 1); };
      var img = ctx.createImageData(w, h), d = img.data;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var u0 = (x + 0.5 - w / 2) / m, v0 = (y + 0.5 - h / 2) / m;
          var u = ca * u0 - sa * v0, v = sa * u0 + ca * v0;
          var wob = b.fbm2(u * 3 + t.dec[0], v * 3 + t.dec[1], 4) * P.diffusion * 0.14;
          var dye;
          if (P.technique === 'itajime') {
            var fx = trif((u + 0.5) * P.plis), fy = trif((v + 0.5) * P.plis), dd;
            if (t.reserve === 0) dd = Math.sqrt(fx * fx + fy * fy) - P.forme;
            else if (t.reserve === 1) dd = Math.abs(fx - fy) * 0.7 - P.forme * 0.45;
            else dd = Math.max(fx, fy) - P.forme;
            dye = DL.smooth(-bave, bave, dd + wob);
          } else if (P.technique === 'kumo') {
            var gx = u * P.plis * 0.6, gy = v * P.plis * 0.6;
            var ex = gx - Math.floor(gx) - 0.5, ey = gy - Math.floor(gy) - 0.5;
            var r = Math.sqrt(ex * ex + ey * ey), a = Math.atan2(ey, ex);
            var toile = Math.min(Math.abs(Math.sin(a * 7 + b.n2(r * 9, a) * 2.4)) * (0.6 + r * 2), Math.abs(Math.sin(r * (18 + 30 * P.forme))) * 1.4);
            dye = DL.smooth(0.05, 0.22 + P.diffusion * 0.45, toile + wob * 1.5) * DL.smooth(0.03, 0.12 + P.forme * 0.2, r);
          } else {
            var tt = (u + v * 0.42) * P.plis * 5;
            var fr = b.fbm2(u * 1.4 - v * 0.6, (v + u * 0.42) * 26, 3);
            dye = DL.smooth(-0.35 - P.diffusion * 0.5, 0.45 - P.forme * 0.4, Math.sin(tt + fr * 5) + wob * 3);
          }
          dye = DL.clamp(dye, 0, 1) * P.intensite;
          var o = (y * w + x) * 4;
          for (var k = 0; k < 3; k++) {
            var fonce = c1[k] + (c2[k] - c1[k]) * 0.5 * dye;
            d[o + k] = c0[k] + (fonce - c0[k]) * dye;
          }
          d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  });
})();

/* 05 Warp : motifs op-art déformés (fragment shader WebGL, repli canvas 2D).
   Un motif régulier (rayures, damier, anneaux, ondes) est évalué dans un espace déformé :
   des lentilles gaussiennes gonflent ou pincent le plan, une torsion le fait tourner au centre.
   Anticrénelage par 4 échantillons par pixel : les bandes fines restent nettes à l'export.
   La même fonction existe en JS pour le repli sans WebGL. */
(function () {
  'use strict';
  var DL = window.DL;
  var MAXL = 5;
  var MOTIFS = ['rayures', 'damier', 'anneaux', 'ondes'];

  var FRAG = [
    'uniform int u_motif, u_n, u_nc;',
    'uniform float u_freq, u_def, u_torsion, u_angle;',
    'uniform vec2 u_lp[5];',
    'uniform float u_lf[5], u_lr[5];',
    'uniform vec3 u_cols[6];',
    'vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }',
    'float bande(vec2 p) {',
    '  for (int i = 0; i < 5; i++) {',
    '    if (i >= u_n) break;',
    '    vec2 d = p - u_lp[i];',
    '    float f = u_lf[i] * exp(-dot(d, d) / (u_lr[i] * u_lr[i]));',
    '    p -= d * f * u_def;',
    '  }',
    '  p = rot(p, u_torsion * 6.0 * exp(-dot(p, p) * 3.0));',
    '  vec2 q = rot(p, u_angle);',
    '  if (u_motif == 0) return q.x * u_freq;',
    '  if (u_motif == 1) return floor(q.x * u_freq * 0.5) + floor(q.y * u_freq * 0.5);',
    '  if (u_motif == 2) return length(p) * u_freq;',
    '  return q.x * u_freq + sin(q.y * u_freq * 0.35) * 2.2;',
    '}',
    'vec3 couleur(float t) {',
    '  float k = mod(floor(t), float(u_nc));',
    '  vec3 c = u_cols[0];',
    '  for (int j = 1; j < 6; j++) { if (float(j) == k) c = u_cols[j]; }',
    '  return c;',
    '}',
    'void main() {',
    '  float m = min(u_res.x, u_res.y);',
    '  vec3 acc = vec3(0.0);',
    // 4 échantillons en grille tournée : bon compromis netteté / coût.
    '  for (int s = 0; s < 4; s++) {',
    '    vec2 o = vec2(s == 0 ? 0.125 : s == 1 ? 0.375 : s == 2 ? -0.125 : -0.375, s == 0 ? 0.375 : s == 1 ? -0.125 : s == 2 ? -0.375 : 0.125);',
    '    vec2 uv = (dl_px() + o - 0.5 * u_res) / m;',
    '    acc += couleur(bande(uv));',
    '  }',
    '  gl_FragColor = vec4(acc * 0.25, 1.0);',
    '}'
  ].join('\n');

  function tirer(P, rng, w, h) {
    var m = Math.min(w, h), ax = w / m * 0.5, ay = h / m * 0.5, L = [];
    for (var i = 0; i < MAXL; i++) {
      L.push({ x: rng.range(-ax * 0.8, ax * 0.8), y: rng.range(-ay * 0.8, ay * 0.8), f: rng.range(0.4, 1.1) * (rng.chance(0.7) ? 1 : -0.8), r: rng.range(0.12, 0.35) });
    }
    return L;
  }

  // Version JS de bande() pour le repli 2D (un échantillon par pixel).
  function bandeJS(x, y, P, L) {
    for (var i = 0; i < P.lentilles; i++) {
      var dx = x - L[i].x, dy = y - L[i].y;
      var f = L[i].f * Math.exp(-(dx * dx + dy * dy) / (L[i].r * L[i].r)) * P.deformation;
      x -= dx * f; y -= dy * f;
    }
    var a = P.torsion * 6 * Math.exp(-(x * x + y * y) * 3), c = Math.cos(a), s = Math.sin(a);
    var px = c * x - s * y, py = s * x + c * y;
    var ang = P.angle * Math.PI / 180, c2 = Math.cos(ang), s2 = Math.sin(ang);
    var qx = c2 * px - s2 * py, qy = s2 * px + c2 * py, f2 = P.frequence;
    if (P.motif === 'rayures') return qx * f2;
    if (P.motif === 'damier') return Math.floor(qx * f2 * 0.5) + Math.floor(qy * f2 * 0.5);
    if (P.motif === 'anneaux') return Math.sqrt(px * px + py * py) * f2;
    return qx * f2 + Math.sin(qy * f2 * 0.35) * 2.2;
  }

  DL.enregistrer({
    id: 'warp',
    numero: '05',
    nom: 'Warp',
    famille: 'motif',
    description: 'Motifs op-art déformés : rayures, damiers et anneaux gonflés par des lentilles et tordus.',
    libs: ['WebGL', 'GLSL'],
    moteur: 'webgl',
    fondTransparent: false,
    nbCouleurs: 3,
    palette: ['#EDEBE4', '#141414', '#FF3B00'],
    params: [
      { cle: 'motif', label: 'Motif', type: 'select', defaut: 'rayures', options: [
        { valeur: 'rayures', label: 'Rayures' }, { valeur: 'damier', label: 'Damier' }, { valeur: 'anneaux', label: 'Anneaux' }, { valeur: 'ondes', label: 'Ondes' }] },
      { cle: 'frequence', label: 'Fréquence', type: 'range', min: 4, max: 140, pas: 1, defaut: 36 },
      { cle: 'deformation', label: 'Déformation', type: 'range', min: 0, max: 2, pas: 0.01, defaut: 1 },
      { cle: 'lentilles', label: 'Lentilles', type: 'range', min: 0, max: 5, pas: 1, defaut: 3 },
      { cle: 'torsion', label: 'Torsion', type: 'range', min: -1, max: 1, pas: 0.01, defaut: 0.25 },
      { cle: 'angle', label: 'Angle', type: 'range', min: 0, max: 180, pas: 1, defaut: 0, unite: '°' }
    ],

    render: function (g, w, h, P, rng, pal) {
      var L = tirer(P, rng, w, h), lp = [], lf = [], lr = [], cols = [];
      L.forEach(function (l) { lp.push(l.x, l.y); lf.push(l.f); lr.push(l.r); });
      for (var i = 0; i < 6; i++) cols.push.apply(cols, DL.rgb01(pal[i % pal.length]));
      g.dessiner(FRAG, {
        u_motif: ['1i', Math.max(0, MOTIFS.indexOf(P.motif))],
        u_n: ['1i', P.lentilles],
        u_nc: ['1i', pal.length],
        u_freq: ['1f', P.frequence],
        u_def: ['1f', P.deformation],
        u_torsion: ['1f', P.torsion],
        u_angle: ['1f', P.angle * Math.PI / 180],
        u_lp: ['2fv', lp], u_lf: ['1fv', lf], u_lr: ['1fv', lr],
        u_cols: ['3fv', cols]
      });
    },

    renduRepli: function (ctx, w, h, P, rng, pal) {
      var L = tirer(P, rng, w, h), m = Math.min(w, h), n = pal.length;
      var rgb = pal.map(DL.rgb255);
      var img = ctx.createImageData(w, h), d = img.data;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var t = bandeJS((x + 0.5 - w / 2) / m, (y + 0.5 - h / 2) / m, P, L);
          var c = rgb[((Math.floor(t) % n) + n) % n], o = (y * w + x) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  });
})();

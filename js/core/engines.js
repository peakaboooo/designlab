/* DesignLab : moteurs de rendu.
   Une « surface » encapsule un moteur (p5, canvas 2D, WebGL, Paper.js) et sait dessiner un outil
   à une taille donnée. Les surfaces partagées (aperçu, vignettes) sont réutilisées pour éviter de
   recréer une instance p5 ou un contexte WebGL à chaque image ; l'export crée une surface dédiée,
   détruite ensuite, pour libérer la mémoire d'un grand canvas.
   Point d'entrée : DL.rendre(outil, etat, w, h, { dediee, progression, vers }). */
(function () {
  'use strict';
  var DL = window.DL;

  // Conteneur hors écran : p5 et Paper veulent un canvas attaché au document pour lire sa taille.
  var hote = null;
  function obtenirHote() {
    if (!hote) {
      hote = document.createElement('div');
      hote.className = 'dl-hote';
      hote.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hote);
    }
    return hote;
  }

  // Cède la main au navigateur (affichage de la progression) entre deux étapes lourdes.
  DL.ceder = function () {
    // Repli setTimeout : requestAnimationFrame est suspendu quand l'onglet est masqué.
    return new Promise(function (ok) {
      var fait = false, go = function () { if (!fait) { fait = true; setTimeout(ok, 0); } };
      requestAnimationFrame(go);
      setTimeout(go, 50);
    });
  };

  /* ---------- p5 (mode instance) ---------- */
  function surfaceP5() {
    if (typeof window.p5 !== 'function') return Promise.reject(new Error('p5.js absent de vendor/'));
    return new Promise(function (resolve) {
      // p5 attend l'événement load si la page n'est pas encore chargée : la promesse le couvre.
      new window.p5(function (p) {
        p.setup = function () {
          p.createCanvas(16, 16);
          p.pixelDensity(1);
          p.noLoop();
          resolve({
            canvas: p.drawingContext.canvas,
            dessiner: function (outil, w, h, params, seed, palette) {
              // resizeCanvas(…, true) : ne pas déclencher draw() au redimensionnement.
              if (p.width !== w || p.height !== h) p.resizeCanvas(w, h, true);
              p.push();
              p.resetMatrix();
              p.blendMode(p.BLEND);
              p.clear();
              outil.render(p, w, h, params, DL.creerRng(seed), palette);
              p.pop();
            },
            detruire: function () { p.remove(); }
          });
        };
        p.draw = function () {};
      }, obtenirHote());
    });
  }

  /* ---------- Canvas 2D ---------- */
  function surface2D() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    return Promise.resolve({
      canvas: canvas,
      dessiner: function (outil, w, h, params, seed, palette) {
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        outil.render(ctx, w, h, params, DL.creerRng(seed), palette);
        ctx.restore();
      },
      detruire: function () { canvas.width = canvas.height = 0; }
    });
  }

  /* ---------- WebGL (fragment shaders sans framework) ---------- */
  // Prélude ajouté à chaque shader d'outil. dl_px() = coordonnée pixel dans l'image COMPLÈTE,
  // origine en haut à gauche : le rendu par tuiles (grands exports) reste continu.
  var PRELUDE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res;',
    'uniform vec2 u_off;',
    'uniform vec2 u_tile;',
    'vec2 dl_px() { return vec2(u_off.x + gl_FragCoord.x, u_off.y + u_tile.y - gl_FragCoord.y); }',
    // Coordonnées centrées, 1 unité = petit côté : même composition quel que soit le format.
    'vec2 dl_uv() { return (dl_px() - 0.5 * u_res) / min(u_res.x, u_res.y); }',
    // Hash sans sinus : stable sur tous les GPU, même pour de grandes coordonnées.
    'float dl_hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'vec2 dl_hash2(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }',
    // Bruit de gradient 2D (valeur dans ~[-1,1]) pour les déformations dans les shaders.
    'float dl_noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = dot(dl_hash2(i) * 2.0 - 1.0, f), b = dot(dl_hash2(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));',
    '  float c = dot(dl_hash2(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0)), d = dot(dl_hash2(i + vec2(1.0)) * 2.0 - 1.0, f - vec2(1.0));',
    '  return 1.4 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }',
    ''
  ].join('\n');
  var VERTEX = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';
  var TUILE = 2048;

  function compiler(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('Shader : ' + log);
    }
    return sh;
  }

  function surfaceGL() {
    var glCanvas = document.createElement('canvas');
    var gl = null;
    try {
      // preserveDrawingBuffer : on recopie le résultat après le dessin (drawImage).
      gl = glCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    } catch (e) { gl = null; }
    var sortie = document.createElement('canvas');
    var ctx2 = sortie.getContext('2d');
    var programmes = {};
    var tuile = TUILE;

    if (gl) {
      var dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      tuile = Math.min(TUILE, dims[0], dims[1]);
      var tampon = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    }

    function programme(frag) {
      if (programmes[frag]) return programmes[frag];
      var pr = gl.createProgram();
      gl.attachShader(pr, compiler(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(pr, compiler(gl, gl.FRAGMENT_SHADER, PRELUDE + frag));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(pr));
      programmes[frag] = { pr: pr, locs: {}, attr: gl.getAttribLocation(pr, 'a_pos') };
      return programmes[frag];
    }

    function contexteTuile(w, h, ox, oy, tw, th) {
      return {
        gl: gl,
        // uniforms : { nom: ['1f'|'1i'|'1fv'|'2fv'|'3fv'|'4fv', valeur] }
        dessiner: function (frag, uniforms) {
          var P = programme(frag);
          gl.useProgram(P.pr);
          gl.viewport(0, 0, tw, th);
          gl.enableVertexAttribArray(P.attr);
          gl.vertexAttribPointer(P.attr, 2, gl.FLOAT, false, 0, 0);
          var tous = Object.assign({ u_res: ['2fv', [w, h]], u_off: ['2fv', [ox, oy]], u_tile: ['2fv', [tw, th]] }, uniforms || {});
          Object.keys(tous).forEach(function (nom) {
            if (!(nom in P.locs)) P.locs[nom] = gl.getUniformLocation(P.pr, nom);
            var loc = P.locs[nom];
            if (loc === null) return; // uniform optimisé par le compilateur : normal
            var t = tous[nom][0], v = tous[nom][1];
            if (t.charAt(t.length - 1) === 'v') gl['uniform' + t](loc, new Float32Array(v));
            else gl['uniform' + t](loc, v);
          });
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      };
    }

    return Promise.resolve({
      canvas: sortie,
      webgl: !!gl,
      dessiner: async function (outil, w, h, params, seed, palette, progression) {
        if (sortie.width !== w || sortie.height !== h) { sortie.width = w; sortie.height = h; }
        ctx2.setTransform(1, 0, 0, 1, 0, 0);
        ctx2.globalCompositeOperation = 'source-over';
        ctx2.globalAlpha = 1;
        ctx2.clearRect(0, 0, w, h);
        if (!gl || gl.isContextLost()) {
          ctx2.save();
          outil.renduRepli(ctx2, w, h, params, DL.creerRng(seed), palette);
          ctx2.restore();
          return;
        }
        // Rendu par tuiles : au-delà de quelques milliers de pixels, un seul tampon WebGL
        // dépasse les limites du GPU ; la tuile garde des coordonnées globales (u_off).
        var nx = Math.ceil(w / tuile), ny = Math.ceil(h / tuile), total = nx * ny, n = 0;
        for (var ty = 0; ty < ny; ty++) {
          for (var tx = 0; tx < nx; tx++) {
            var ox = tx * tuile, oy = ty * tuile;
            var tw = Math.min(tuile, w - ox), th = Math.min(tuile, h - oy);
            if (glCanvas.width !== tw || glCanvas.height !== th) { glCanvas.width = tw; glCanvas.height = th; }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            // rng neuf par tuile : les uniforms tirés sont identiques pour chaque tuile.
            outil.render(contexteTuile(w, h, ox, oy, tw, th), w, h, params, DL.creerRng(seed), palette);
            ctx2.drawImage(glCanvas, ox, oy);
            n++;
            if (total > 1) {
              if (progression) progression(n / total);
              await DL.ceder();
            }
          }
        }
      },
      detruire: function () {
        var ext = gl && gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        sortie.width = sortie.height = 0;
      }
    });
  }

  /* ---------- Paper.js ---------- */
  function surfacePaper() {
    if (!window.paper) return Promise.reject(new Error('Paper.js absent de vendor/'));
    var canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    obtenirHote().appendChild(canvas);
    var scope = new window.paper.PaperScope();
    // hidpi désactivé : 1 unité Paper = 1 pixel exporté, sinon l'export double la taille.
    scope.settings.hidpi = false;
    scope.setup(canvas);
    return Promise.resolve({
      canvas: canvas,
      scope: scope,
      dessiner: function (outil, w, h, params, seed, palette) {
        scope.activate();
        scope.project.clear();
        new scope.Layer();
        scope.view.viewSize = new scope.Size(w, h);
        outil.render(scope, w, h, params, DL.creerRng(seed), palette);
        scope.view.update();
      },
      detruire: function () {
        scope.project.clear();
        scope.view.remove();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    });
  }

  var FABRIQUES = { p5: surfaceP5, canvas2d: surface2D, webgl: surfaceGL, paper: surfacePaper };

  // Surfaces partagées : une par moteur, avec une file d'attente pour qu'un rendu ne
  // commence jamais au milieu d'un autre (le résultat est recopié avant de libérer la file).
  var partagees = {};
  function surfacePartagee(moteur) {
    if (!partagees[moteur]) {
      partagees[moteur] = FABRIQUES[moteur]().then(function (s) { s.file = Promise.resolve(); return s; });
    }
    return partagees[moteur];
  }

  DL.webglDisponible = function () {
    try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; }
  };

  // Polices du dossier vendor/fonts : à charger avant tout rendu de texte sur canvas,
  // sinon le premier rendu utilise une police de repli et ne correspond pas à l'export.
  var policesPromesse = null;
  DL.chargerPolices = function () {
    if (!policesPromesse) {
      var specs = ['400 40px "Space Grotesk"', '700 40px "Space Grotesk"', '400 40px "Space Mono"', '700 40px "Space Mono"',
        '400 40px "Archivo Black"', '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '400 40px "Dela Gothic One"'];
      policesPromesse = document.fonts && document.fonts.load
        ? Promise.all(specs.map(function (s) { return document.fonts.load(s); })).catch(function () {})
        : Promise.resolve();
    }
    return policesPromesse;
  };

  /* Rend un outil.
     etat = { seed, params, couleurs, transparent }
     opts.dediee : surface neuve détruite après (export HD)
     opts.vers(canvas) : appelé avec le résultat tant que la surface est réservée (pour recopier)
     opts.progression(fraction) : avancement (rendu WebGL par tuiles) */
  DL.rendre = async function (outil, etat, w, h, opts) {
    opts = opts || {};
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (outil.polices) await DL.chargerPolices();
    var palette = DL.objetPalette(etat.couleurs, etat.transparent && outil.fondTransparent);
    var params = etat.params;

    if (opts.dediee) {
      var s = await FABRIQUES[outil.moteur]();
      try {
        await s.dessiner(outil, w, h, params, etat.seed, palette, opts.progression);
        // vers() peut être asynchrone (encodage PNG) : on attend avant de détruire la surface.
        return await opts.vers(s.canvas);
      } finally {
        s.detruire();
      }
    }

    var sp = await surfacePartagee(outil.moteur);
    var tache = sp.file.then(async function () {
      await sp.dessiner(outil, w, h, params, etat.seed, palette, opts.progression);
      return opts.vers ? await opts.vers(sp.canvas) : sp.canvas;
    });
    sp.file = tache.catch(function () {});
    return tache;
  };

  // SVG d'un outil vectoriel (moteur paper) : même rendu, exporté en texte.
  DL.rendreSVG = async function (outil, etat, w, h) {
    var s = await surfacePaper();
    try {
      var palette = DL.objetPalette(etat.couleurs, etat.transparent && outil.fondTransparent);
      s.dessiner(outil, Math.round(w), Math.round(h), etat.params, etat.seed, palette);
      return s.scope.project.exportSVG({ asString: true, bounds: 'view' });
    } finally {
      s.detruire();
    }
  };
})();

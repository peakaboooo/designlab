/* DesignLab : images importées par l'utilisateur (outils à param de type 'image', ex. Stipple).
   L'image est lue par le navigateur (fichier choisi, glissé ou collé) et ne quitte jamais
   l'appareil : pas de fetch, pas d'envoi. Elle est réduite une fois (1200 px au plus grand côté)
   et gardée en mémoire pour la session, sous un identifiant calculé sur son contenu.

   Pourquoi un identifiant de contenu : le param 'image' de l'URL ne contient que cet identifiant
   (une image ne tient pas dans une adresse). Historique et favoris retrouvent ainsi la bonne
   image tant qu'elle est en mémoire, et réimporter le même fichier redonne le même identifiant,
   donc la même URL. Sans l'image (lien partagé, page rechargée), l'outil dessine son sujet
   généré et le panneau le dit. */
(function () {
  'use strict';
  var DL = window.DL;

  var COTE_MAX = 1200;       // plus grand côté gardé en mémoire : largement assez pour un échantillonnage
  var IMAGES_MAX = 12;       // au-delà, on oublie les plus anciennes (mémoire)

  var store = {};            // id → { canvas, nom, w, h }
  var ordre = [];

  DL.images = store;

  // Identifiant valide : « i » + base 36 (voir valider() dans state.js).
  DL.ID_IMAGE = /^i[0-9a-z]{4,12}$/;

  DL.imageImportee = function (id) {
    return id && store[id] ? store[id] : null;
  };

  // Décode un fichier en élément image. Image + URL blob : marche en file://, respecte
  // l'orientation EXIF des photos de téléphone, et ne passe par aucun réseau.
  function decoder(fichier) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('illisible')); };
      img.src = url;
    });
  }

  // Réduction par moitiés successives puis passe finale : une seule grande réduction
  // crénelerait les détails fins (cheveux, textures) que le pointillé doit retrouver.
  function reduire(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var k = Math.min(1, COTE_MAX / Math.max(w, h));
    var cible = { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
    var src = img, sw = w, sh = h;
    while (sw / 2 >= cible.w * 1.5 && sh / 2 >= cible.h * 1.5) {
      var demi = document.createElement('canvas');
      demi.width = Math.round(sw / 2); demi.height = Math.round(sh / 2);
      var dc = demi.getContext('2d');
      dc.imageSmoothingQuality = 'high';
      dc.drawImage(src, 0, 0, demi.width, demi.height);
      src = demi; sw = demi.width; sh = demi.height;
    }
    var c = document.createElement('canvas');
    c.width = cible.w; c.height = cible.h;
    var ctx = c.getContext('2d');
    // Fond blanc : une image à transparence (PNG) se lit comme du papier, pas comme du noir.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  // Empreinte du contenu : vignette 16 × 16 + dimensions, hachée (FNV-1a de rng.js).
  function empreinte(canvas) {
    var t = document.createElement('canvas');
    t.width = 16; t.height = 16;
    var tc = t.getContext('2d');
    tc.drawImage(canvas, 0, 0, 16, 16);
    var d = tc.getImageData(0, 0, 16, 16).data, s = canvas.width + 'x' + canvas.height + ':';
    for (var i = 0; i < d.length; i += 4) s += String.fromCharCode(d[i], d[i + 1], d[i + 2]);
    return 'i' + DL.hacher(s).toString(36) + DL.hacher(s + '#').toString(36).slice(0, 3);
  }

  /* Importe un fichier image. Renvoie une promesse de l'identifiant.
     Erreur explicite si ce n'est pas une image lisible par ce navigateur (HEIC sur Chrome…). */
  DL.importerImage = function (fichier) {
    if (!fichier || (fichier.type && fichier.type.indexOf('image/') !== 0)) {
      return Promise.reject(new Error("Ce fichier n'est pas une image."));
    }
    return decoder(fichier).then(function (img) {
      var canvas = reduire(img);
      var id = empreinte(canvas);
      if (!store[id]) {
        store[id] = { canvas: canvas, nom: fichier.name || 'image collée', w: canvas.width, h: canvas.height };
        ordre.push(id);
        while (ordre.length > IMAGES_MAX) delete store[ordre.shift()];
      }
      return id;
    }, function () {
      throw new Error('Image illisible par ce navigateur. Essaie un JPEG, un PNG ou un WebP.');
    });
  };

  /* Luminance de l'image recadrée pour remplir un cadre de rapport gw / gh (comme
     background-size: cover), sur une grille gw × gh : Float32Array de 0 (noir) à 1 (blanc).
     Ne dépend que de l'image et de la grille, pas de la taille de rendu : l'export HD
     lit exactement les mêmes valeurs que l'aperçu. */
  DL.luminanceImage = function (id, gw, gh) {
    var src = store[id];
    if (!src) return null;
    var c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    var ctx = c.getContext('2d');
    var k = Math.max(gw / src.w, gh / src.h);
    var dw = src.w * k, dh = src.h * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src.canvas, (gw - dw) / 2, (gh - dh) / 2, dw, dh);
    var d = ctx.getImageData(0, 0, gw, gh).data, out = new Float32Array(gw * gh);
    for (var i = 0, j = 0; i < out.length; i++, j += 4) {
      // Luminance perçue (Rec. 709) sur des valeurs sRGB : suffisant pour une trame.
      out[i] = (0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]) / 255;
    }
    return out;
  };
})();

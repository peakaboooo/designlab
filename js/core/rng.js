/* DesignLab : aléa seedé.
   Une seed est un texte court (lisible, copiable, dans l'URL). On le hache en entier 32 bits,
   puis mulberry32 produit la suite. Chaque rendu crée son propre rng : deux rendus de la même
   seed donnent exactement la même image, quel que soit l'ordre des appels ailleurs dans la page. */
(function () {
  'use strict';
  var DL = window.DL;

  // Alphabet sans caractères ambigus (0/O, 1/I/L) : une seed recopiée à la main reste juste.
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  // FNV-1a puis brassage final : deux seeds proches (« A1 » / « A2 ») donnent des états très éloignés.
  DL.hacher = function (texte) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < texte.length; i++) {
      h ^= texte.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };

  DL.creerRng = function (seed) {
    var etat = typeof seed === 'number' ? seed >>> 0 : DL.hacher(String(seed));
    function r() {
      etat = (etat + 0x6D2B79F5) >>> 0;
      var t = etat;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    r.seed = seed;
    r.range = function (a, b) { return a + (b - a) * r(); };
    r.int = function (a, b) { return a + Math.floor(r() * (b - a + 1)); }; // bornes incluses
    r.pick = function (tab) { return tab[Math.floor(r() * tab.length)]; };
    r.chance = function (p) { return r() < p; };
    // Box-Muller : utile pour des dispersions naturelles autour d'un centre.
    r.gauss = function (moy, ecart) {
      var u = 1 - r(), v = r();
      return (moy || 0) + (ecart === undefined ? 1 : ecart) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    r.shuffle = function (tab) {
      var a = tab.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1));
        var x = a[i]; a[i] = a[j]; a[j] = x;
      }
      return a;
    };
    // Sous-générateur indépendant : ajouter un tirage dans une partie du rendu ne décale pas
    // toute la suite des autres parties (les compositions restent stables quand on fait évoluer un outil).
    r.fork = function (etiquette) { return DL.creerRng(String(seed) + '/' + etiquette); };
    return r;
  };

  // Nouvelle seed : hors rendu, donc on peut puiser dans l'aléa du navigateur.
  DL.nouvelleSeed = function () {
    var buf = new Uint32Array(6), s = '';
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buf);
    else for (var k = 0; k < 6; k++) buf[k] = Math.floor(Math.random() * 4294967296);
    for (var i = 0; i < 6; i++) s += ALPHABET[buf[i] % ALPHABET.length];
    return s;
  };

  // Seed saisie par l'utilisateur : on garde un texte sûr pour l'URL et le nom de fichier.
  DL.nettoyerSeed = function (s) {
    s = String(s || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
    return s || DL.nouvelleSeed();
  };

  // Aléa « hors rendu » (palette au hasard, tout au hasard) : seed fraîche à chaque appel.
  DL.rngLibre = function () { return DL.creerRng(DL.nouvelleSeed()); };
})();

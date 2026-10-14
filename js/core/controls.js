/* DesignLab : contrôles d'édition générés depuis outil.params.
   On s'appuie sur les éléments natifs (input range, select, checkbox) : clavier, lecteurs d'écran
   et tactile fonctionnent sans ARIA supplémentaire ; on ajoute seulement <output> lié par aria. */
(function () {
  'use strict';
  var DL = window.DL;

  // Nombre de décimales à afficher selon le pas : 0.05 → 2, 1 → 0.
  function decimales(pas) {
    var s = String(pas || 1);
    return s.indexOf('.') < 0 ? 0 : s.length - s.indexOf('.') - 1;
  }

  DL.formaterValeur = function (def, v) {
    if (def.type === 'range') return Number(v).toFixed(decimales(def.pas)) + (def.unite || '');
    if (def.type === 'toggle') return v ? 'oui' : 'non';
    if (def.type === 'select') {
      var o = def.options.find(function (x) { return String(typeof x === 'object' ? x.valeur : x) === String(v); });
      return o ? (typeof o === 'object' ? o.label : o) : String(v);
    }
    return String(v);
  };

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texte') n.textContent = attrs[k];
      else if (k === 'classe') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  DL.el = el;

  /* Construit les contrôles. surChangement(cle, valeur, termine) :
     termine = false pendant le glissement (aperçu en direct), true au relâchement (historique). */
  DL.construireControles = function (conteneur, outil, etat, surChangement) {
    conteneur.textContent = '';
    var champs = {};

    outil.params.forEach(function (def) {
      var id = 'dl-p-' + def.cle;
      var sortie = el('output', { classe: 'ctl-valeur', for: id, id: id + '-v' });
      var ligne = el('div', { classe: 'ctl ctl-' + def.type });
      var entete = el('div', { classe: 'ctl-entete' }, [
        el('label', { for: id, texte: def.label }),
        sortie
      ]);
      var input;

      if (def.type === 'range') {
        input = el('input', { type: 'range', id: id, min: def.min, max: def.max, step: def.pas || 1, 'aria-describedby': id + '-v' });
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          sortie.textContent = DL.formaterValeur(def, v);
          surChangement(def.cle, v, false);
        });
        input.addEventListener('change', function () { surChangement(def.cle, parseFloat(input.value), true); });
      } else if (def.type === 'select') {
        input = el('select', { id: id });
        def.options.forEach(function (o) {
          var val = typeof o === 'object' ? o.valeur : o;
          input.appendChild(el('option', { value: val, texte: typeof o === 'object' ? o.label : o }));
        });
        input.addEventListener('change', function () {
          sortie.textContent = DL.formaterValeur(def, input.value);
          surChangement(def.cle, input.value, true);
        });
      } else if (def.type === 'toggle') {
        input = el('input', { type: 'checkbox', id: id, classe: 'interrupteur' });
        input.addEventListener('change', function () {
          sortie.textContent = DL.formaterValeur(def, input.checked);
          surChangement(def.cle, input.checked, true);
        });
      } else if (def.type === 'texte') {
        input = el('input', { type: 'text', id: id, maxlength: def.max || 40, spellcheck: 'false', autocomplete: 'off' });
        input.addEventListener('input', function () {
          sortie.textContent = '';
          surChangement(def.cle, input.value, false);
        });
        input.addEventListener('change', function () { surChangement(def.cle, input.value, true); });
      }

      ligne.appendChild(entete);
      ligne.appendChild(input);
      conteneur.appendChild(ligne);
      champs[def.cle] = { def: def, input: input, sortie: sortie };
    });

    // Met les contrôles à jour depuis un état (retour arrière, tout au hasard, URL).
    function maj(e) {
      Object.keys(champs).forEach(function (k) {
        var c = champs[k], v = e.params[k];
        if (c.def.type === 'toggle') c.input.checked = !!v;
        else c.input.value = v;
        c.sortie.textContent = c.def.type === 'texte' ? '' : DL.formaterValeur(c.def, v);
      });
    }
    maj(etat);
    return { maj: maj };
  };

  // Tire des réglages au hasard dans le domaine de chaque param (« Tout au hasard »).
  // Les champs texte gardent leur valeur : un mot saisi n'est pas un réglage à brasser.
  DL.paramsAuHasard = function (outil, actuels) {
    var r = DL.rngLibre(), p = {};
    outil.params.forEach(function (d) {
      if (d.type === 'range') {
        var pas = d.pas || 1, n = Math.round((d.max - d.min) / pas);
        p[d.cle] = parseFloat((d.min + r.int(0, n) * pas).toFixed(6));
      } else if (d.type === 'select') {
        var o = r.pick(d.options); p[d.cle] = String(typeof o === 'object' ? o.valeur : o);
      } else if (d.type === 'toggle') p[d.cle] = r.chance(0.5);
      else p[d.cle] = actuels[d.cle];
    });
    return p;
  };
})();

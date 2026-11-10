/* DesignLab : contrôles d'édition générés depuis outil.params, au dessin des contrôles Toolcraft
   (slider fin à valeur éditable, segments, interrupteur). On s'appuie sur les éléments natifs
   (input range, radio, select, checkbox) : clavier, lecteurs d'écran et tactile fonctionnent sans
   ARIA supplémentaire ; le CSS ne fait que les redessiner. */
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

  /* Partie remplie d'un slider (Toolcraft : piste fine, portion à gauche de la poignée à l'encre).
     Le CSS lit --rempli ; Firefox a son propre ::-moz-range-progress et l'ignore. */
  DL.majRempli = function (range) {
    var min = parseFloat(range.min) || 0, max = parseFloat(range.max);
    if (isNaN(max)) max = 100;
    var pct = max > min ? (parseFloat(range.value) - min) / (max - min) * 100 : 0;
    range.style.setProperty('--rempli', DL.clamp(pct, 0, 100) + '%');
  };

  // Choix court affiché en segments plutôt qu'en liste (règle Toolcraft : 4 options au plus,
  // aucun libellé de plus de 9 caractères, 24 au total), sinon les segments se tassent.
  function enSegments(def) {
    if (def.options.length > 4) return false;
    var total = 0;
    return def.options.every(function (o) {
      var l = String(typeof o === 'object' ? o.label : o).length;
      total += l;
      return l <= 9;
    }) && total <= 24;
  }

  /* Construit les contrôles. surChangement(cle, valeur, termine) :
     termine = false pendant le glissement (aperçu en direct), true au relâchement (historique). */
  DL.construireControles = function (conteneur, outil, etat, surChangement) {
    conteneur.textContent = '';
    var champs = {};

    outil.params.forEach(function (def) {
      var id = 'dl-p-' + def.cle;
      var ligne = el('div', { classe: 'ctl ctl-' + def.type });
      var nom = el('label', { for: id, texte: def.label });
      var entete = el('div', { classe: 'ctl-entete' }, [nom]);
      var input, valeur = null, mode = def.type;

      if (def.type === 'range') {
        input = el('input', { type: 'range', id: id, min: def.min, max: def.max, step: def.pas || 1 });
        /* Valeur éditable (comme dans Toolcraft) : on peut taper un nombre exact. Il est borné,
           calé sur le pas, puis appliqué comme un relâchement de slider. Échap annule. */
        valeur = el('input', { type: 'text', classe: 'ctl-valeur', id: id + '-v', inputmode: 'decimal', spellcheck: 'false', autocomplete: 'off', 'aria-label': def.label + ', valeur exacte' });
        entete.appendChild(valeur);
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          valeur.value = DL.formaterValeur(def, v);
          DL.majRempli(input);
          surChangement(def.cle, v, false);
        });
        input.addEventListener('change', function () { surChangement(def.cle, parseFloat(input.value), true); });
        valeur.addEventListener('focus', function () { valeur.select(); });
        valeur.addEventListener('keydown', function (ev) {
          if (ev.key === 'Escape') { ev.stopPropagation(); valeur.value = DL.formaterValeur(def, parseFloat(input.value)); valeur.blur(); }
          else if (ev.key === 'Enter') valeur.blur();
        });
        valeur.addEventListener('change', function () {
          var n = parseFloat(valeur.value.replace(',', '.').replace(/[^0-9.+-]/g, ''));
          if (isNaN(n)) n = parseFloat(input.value);
          var pas = def.pas || 1;
          n = DL.clamp(def.min + Math.round((n - def.min) / pas) * pas, def.min, def.max);
          n = parseFloat(n.toFixed(decimales(pas)));
          input.value = n;
          valeur.value = DL.formaterValeur(def, n);
          DL.majRempli(input);
          surChangement(def.cle, n, true);
        });
      } else if (def.type === 'select' && enSegments(def)) {
        // Segments : de vraies radios (flèches du clavier, lecteurs d'écran), masquées sous le libellé.
        mode = 'segments';
        nom = el('span', { id: id + '-l', texte: def.label });
        entete.replaceChild(nom, entete.firstChild);
        input = el('div', { classe: 'segmente', role: 'radiogroup', 'aria-labelledby': id + '-l' });
        def.options.forEach(function (o) {
          var val = String(typeof o === 'object' ? o.valeur : o);
          var radio = el('input', { type: 'radio', name: id, value: val });
          radio.addEventListener('change', function () { if (radio.checked) surChangement(def.cle, val, true); });
          input.appendChild(el('label', { classe: 'segment' }, [radio, document.createTextNode(typeof o === 'object' ? o.label : o)]));
        });
      } else if (def.type === 'select') {
        input = el('select', { id: id });
        def.options.forEach(function (o) {
          var val = typeof o === 'object' ? o.valeur : o;
          input.appendChild(el('option', { value: val, texte: typeof o === 'object' ? o.label : o }));
        });
        input.addEventListener('change', function () { surChangement(def.cle, input.value, true); });
      } else if (def.type === 'toggle') {
        // Interrupteur sur la ligne du libellé (Toolcraft « switch ») : toute la ligne est cliquable.
        ligne = el('label', { classe: 'ctl ctl-toggle', for: id });
        entete = el('span', { classe: 'ctl-entete' }, [el('span', { texte: def.label })]);
        input = el('input', { type: 'checkbox', id: id, classe: 'interrupteur' });
        input.addEventListener('change', function () { surChangement(def.cle, input.checked, true); });
      } else if (def.type === 'texte') {
        input = el('input', { type: 'text', id: id, maxlength: def.max || 40, spellcheck: 'false', autocomplete: 'off' });
        input.addEventListener('input', function () { surChangement(def.cle, input.value, false); });
        input.addEventListener('change', function () { surChangement(def.cle, input.value, true); });
      }

      ligne.appendChild(entete);
      ligne.appendChild(input);
      conteneur.appendChild(ligne);
      champs[def.cle] = { def: def, input: input, valeur: valeur, mode: mode };
    });

    // Met les contrôles à jour depuis un état (retour arrière, tout au hasard, URL).
    function maj(e) {
      Object.keys(champs).forEach(function (k) {
        var c = champs[k], v = e.params[k];
        if (c.mode === 'toggle') c.input.checked = !!v;
        else if (c.mode === 'segments') {
          c.input.querySelectorAll('input').forEach(function (r) { r.checked = r.value === String(v); });
        } else c.input.value = v;
        if (c.mode === 'range') {
          c.valeur.value = DL.formaterValeur(c.def, v);
          DL.majRempli(c.input);
        }
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

/* DesignLab : export haute définition.
   Jamais d'agrandissement de l'aperçu : on re-rend l'outil à la taille demandée, avec la même
   seed, sur une surface hors écran dédiée (détruite ensuite pour libérer la mémoire). */
(function () {
  'use strict';
  var DL = window.DL;

  DL.nomFichier = function (outil, etat, ext) {
    return outil.id + '-' + etat.seed + '-' + etat.format.w + 'x' + etat.format.h + '.' + ext;
  };

  DL.telecharger = function (blob, nom) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révocation différée : certains navigateurs lisent l'URL après le clic.
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  function versBlob(canvas, mime, qualite) {
    return new Promise(function (ok, ko) {
      canvas.toBlob(function (b) {
        if (b) ok(b);
        else ko(new Error("Le navigateur n'a pas pu encoder une image de cette taille. Essayez un format plus petit."));
      }, mime, qualite);
    });
  }

  function mo(octets) { return (octets / 1048576).toFixed(octets > 10485760 ? 0 : 1) + ' Mo'; }

  // Avertissement mémoire : un canvas RGBA coûte 4 octets par pixel, et Safari/iOS refuse
  // les canvas au-delà d'environ 16,7 millions de pixels.
  DL.alerteTaille = function (w, h) {
    var px = w * h;
    if (px <= DL.PIXELS_ALERTE) return '';
    return 'Grande image : environ ' + Math.round(px * 4 / 1048576) + ' Mo de mémoire pendant le rendu. ' +
      "Sur téléphone ou sous Safari, l'export peut échouer au-delà de 4096 × 4096.";
  };

  /* Exporte l'état courant. type : 'png' | 'jpeg' | 'svg'. suivi(etape, fraction|null). */
  DL.exporter = async function (outil, etat, type, qualite, suivi) {
    var w = etat.format.w, h = etat.format.h;
    suivi = suivi || function () {};

    if (type === 'svg') {
      suivi('Rendu vectoriel ' + w + ' × ' + h + '…', null);
      await DL.ceder();
      var svg = await DL.rendreSVG(outil, etat, w, h);
      var blobSvg = new Blob([svg], { type: 'image/svg+xml' });
      DL.telecharger(blobSvg, DL.nomFichier(outil, etat, 'svg'));
      return { nom: DL.nomFichier(outil, etat, 'svg'), taille: blobSvg.size };
    }

    var e = DL.copierEtat(etat);
    // JPEG n'a pas de canal alpha : un fond transparent deviendrait noir.
    if (type === 'jpeg') e.transparent = false;
    var mime = type === 'jpeg' ? 'image/jpeg' : 'image/png';

    suivi('Rendu ' + w + ' × ' + h + '…', null);
    await DL.ceder();
    var blob = await DL.rendre(outil, e, w, h, {
      dediee: true,
      progression: function (f) { suivi('Rendu par tuiles ' + Math.round(f * 100) + ' %', f); },
      vers: async function (canvas) {
        suivi('Encodage ' + type.toUpperCase() + '…', null);
        await DL.ceder();
        return versBlob(canvas, mime, type === 'jpeg' ? qualite : undefined);
      }
    });
    var nom = DL.nomFichier(outil, e, type === 'jpeg' ? 'jpg' : 'png');
    DL.telecharger(blob, nom);
    return { nom: nom, taille: blob.size };
  };

  /* Modale d'export : lit l'outil et l'état courants via contexte() au moment de l'ouverture. */
  DL.initExport = function (contexte) {
    var dlg = document.getElementById('dlg-export');
    if (!dlg) return;
    var $ = function (id) { return document.getElementById(id); };
    var qualite = $('export-qualite'), qualiteV = $('export-qualite-v');
    var barre = $('export-barre'), barreBoite = barre.parentNode;
    var enCours = false;

    function typeChoisi() { return dlg.querySelector('input[name="type"]:checked').value; }

    function majResume() {
      var c = contexte(), e = c.etat, t = typeChoisi();
      $('export-qualite-ligne').hidden = t !== 'jpeg';
      var txt = DL.nomFichier(c.outil, e, t === 'jpeg' ? 'jpg' : t);
      if (t === 'svg') txt += ' · vectoriel, taille de référence ' + e.format.w + ' × ' + e.format.h;
      else txt += ' · ' + e.format.w + ' × ' + e.format.h + ' px';
      if (t === 'png' && e.transparent) txt += ' · fond transparent';
      if (t === 'jpeg' && e.transparent) txt += ' · fond opaque (JPEG sans transparence)';
      $('export-resume').textContent = txt;
      var alerte = t === 'svg' ? '' : DL.alerteTaille(e.format.w, e.format.h);
      $('export-alerte').hidden = !alerte;
      $('export-alerte').textContent = alerte;
    }

    function suivi(etape, f) {
      $('export-etape').textContent = etape;
      barreBoite.classList.toggle('indetermine', f === null);
      barre.style.width = f === null ? '' : Math.round(f * 100) + '%';
    }

    DL.ouvrirExport = function () {
      var c = contexte();
      if (!c) return;
      var svgDispo = !!c.outil.vectoriel;
      $('choix-svg').hidden = !svgDispo;
      if (!svgDispo && typeChoisi() === 'svg') dlg.querySelector('input[value="png"]').checked = true;
      if (!enCours) { $('export-progression').hidden = true; }
      majResume();
      if (!dlg.open) dlg.showModal();
      $('b-lancer-export').focus();
    };

    dlg.addEventListener('change', majResume);
    qualite.addEventListener('input', function () { qualiteV.textContent = qualite.value; });

    $('b-lancer-export').addEventListener('click', async function () {
      if (enCours) return;
      var c = contexte();
      enCours = true;
      this.disabled = true;
      $('export-progression').hidden = false;
      $('export-alerte').hidden = true;
      try {
        var res = await DL.exporter(c.outil, DL.copierEtat(c.etat), typeChoisi(), parseInt(qualite.value, 10) / 100, suivi);
        barreBoite.classList.remove('indetermine');
        barre.style.width = '100%';
        $('export-etape').textContent = 'Téléchargé : ' + res.nom + ' (' + mo(res.taille) + ')';
      } catch (err) {
        console.error(err);
        $('export-progression').hidden = true;
        $('export-alerte').hidden = false;
        $('export-alerte').textContent = 'Échec de l’export : ' + err.message;
      } finally {
        enCours = false;
        this.disabled = false;
      }
    });
  };
})();

/* DesignLab : registre des outils.
   Chargé en premier : tous les autres scripts s'accrochent à window.DL.
   Ajouter un outil = un fichier js/tools/<id>.js qui appelle DL.enregistrer(), plus sa balise <script> dans index.html. */
(function () {
  'use strict';
  var DL = (window.DL = window.DL || {});

  // Familles techniques affichées en filtre sur l'accueil. L'ordre ici est l'ordre des boutons.
  DL.familles = {pixel: 'Pixel',hamp: 'Champ',degrade: 'Dégradé',motif: 'Motif',impression: 'Impression',
    typo: 'Typo',
    vecteur: 'Vecteur',
    textile: 'Textile',
    volume: 'Volume'
  };

  // Idées non développées : affichées en texte seul dans « Prochainement ».
  // Quand une idée devient un outil, la retirer d'ici.
  DL.prochainement = [
    ['Quilt', 'Couvertures en pixels'],
    ['Zig', 'Zigzags arrondis'],
    ['Vee', 'Chevrons miroir'],
    ['Fete', 'Patchs de festival'],
    ['Parcel', 'Affiches de colis en pixels'],
    ['Stipple', 'Portraits en demi-teinte'],
    ['Prism', "Fonds d'aurore en pixels"],
    ['Delta', 'Mosaïques satellite corrompues'],
    ['Mist', 'Lavis néon pulvérisés'],
    ['Totem', 'Bannières de pixels en miroir'],
    ['Atlas', 'Cartes de terrain en texte'],
    ['Sampler', 'Nuanciers de tuiles'],
    ['Kiosk', 'Affiches typographiques collées'],
    ['Mosh', 'Signal corrompu'],
    ['Pane', 'Panneaux dégradés'],
    ['Bloom', 'Champs de pixels symétriques'],
    ['Sear', 'Champs thermiques étalés'],
    ['Carve', 'Collages de panneaux sculptés'],
    ['Culture', 'Colonies granuleuses'],
    ['Husk', 'Dispersions de balles'],
    ['Strand', 'Chaînes de tiges ramifiées'],
    ['Chaff', 'Lames lancées'],
    ['Splice', 'Cut-up riso'],
    ['Whorl', 'Rayures déformées'],
    ['Sprig', 'Répétitions botaniques'],
    ['Frond', 'Natures mortes dégradées'],
    ['Pith', 'Tissus cellulaires tramés'],
    ['Hiss', 'Neige de télévision'],
    ['Stitch', 'Grilles glitchées'],
    ['Coral', "Textile d'éventails marins"],
    ['Motley', 'Patchwork de glyphes'],
    ['Crowd', 'Foules floutées']
  ];

  DL.outils = [];
  DL.parId = {};

  // Valide le contrat au moment de l'inscription : une erreur ici apparaît dans la console
  // dès le chargement, plutôt qu'au premier rendu de l'outil.
  DL.enregistrer = function (outil) {
    var manque = ['id', 'nom', 'famille', 'description', 'moteur', 'params', 'render', 'palette'].filter(function (k) {
      return outil[k] === undefined;
    });
    if (manque.length) throw new Error('Outil « ' + (outil.id || '?') + ' » incomplet : ' + manque.join(', '));
    if (DL.parId[outil.id]) throw new Error('Outil en double : ' + outil.id);
    if (outil.moteur === 'webgl' && typeof outil.renduRepli !== 'function') {
      throw new Error('Outil webgl sans renduRepli : ' + outil.id);
    }
    outil.nbCouleurs = outil.nbCouleurs || outil.palette.length;
    outil.libs = outil.libs || [];
    if (outil.fondTransparent === undefined) outil.fondTransparent = true;
    DL.outils.push(outil);
    // Ordre d'affichage = numéro, quel que soit l'ordre des balises <script>.
    DL.outils.sort(function (a, b) { return String(a.numero || '99').localeCompare(String(b.numero || '99')); });
    DL.parId[outil.id] = outil;
  };

  // Valeurs par défaut des params d'un outil, sous forme d'objet { cle: valeur }.
  DL.paramsParDefaut = function (outil) {
    var p = {};
    outil.params.forEach(function (d) { p[d.cle] = d.defaut; });
    return p;
  };
})();

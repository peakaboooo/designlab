/* DesignLab : registre des outils.
   Chargé en premier : tous les autres scripts s'accrochent à window.DL.
   Ajouter un outil = un fichier js/tools/<id>.js qui appelle DL.enregistrer(), plus sa balise <script> dans index.html. */
(function () {
  'use strict';
  var DL = (window.DL = window.DL || {});

  // Familles techniques affichées en filtre sur l'accueil. L'ordre ici est l'ordre des boutons.
  DL.familles = {pixel: 'Pixel',champ: 'Champ',degrade: 'Dégradé',motif: 'Motif',impression: 'Impression',
    typo: 'Typo',
    vecteur: 'Vecteur',
    textile: 'Textile',
    volume: 'Volume'
  };

  // Idées non développées : affichées en texte seul dans « Prochainement ».
  // Quand une idée devient un outil, la retirer d'ici. Retirées sans être faites (session 6),
  // parce qu'elles doublaient un outil existant : Sear (Benday), Mosh, Stitch et Hiss (Static),
  // Motley (Ransom), Chaff (Husk).
  DL.prochainement = [
    ['Fete', 'Patchs de festival'],
    ['Parcel', 'Affiches de colis en pixels'],
    ['Delta', 'Mosaïques satellite corrompues'],
    ['Mist', 'Lavis néon pulvérisés'],
    ['Sampler', 'Nuanciers de tuiles'],
    ['Bloom', 'Champs de pixels symétriques'],
    ['Carve', 'Collages de panneaux sculptés'],
    ['Culture', 'Colonies granuleuses'],
    ['Husk', 'Dispersions de balles'],
    ['Splice', 'Cut-up riso'],
    ['Whorl', 'Rayures déformées'],
    ['Sprig', 'Répétitions botaniques'],
    ['Frond', 'Natures mortes dégradées'],
    ['Pith', 'Tissus cellulaires tramés'],
    ['Coral', "Textile d'éventails marins"],
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

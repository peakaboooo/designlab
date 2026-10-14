/* Regénère vendor/icons/carbon-icons.js à partir des SVG de vendor/icons/carbon/.
   Pourquoi : en file://, la page ne peut pas lire un .svg avec fetch() ; on embarque donc le
   contenu des icônes dans un script classique. Outil de maintenance, jamais chargé par le site.

   Ajouter une icône :
   1. curl -o vendor/icons/carbon/<nom>.svg https://cdn.jsdelivr.net/npm/@carbon/icons@11.90.0/svg/32/<nom>.svg
   2. node vendor/icons/generer-carbon.js   (depuis le dossier designlab/) */
'use strict';
const fs = require('fs');
const path = require('path');

const dossier = path.join(__dirname, 'carbon');
const icones = {};
fs.readdirSync(dossier).filter((f) => f.endsWith('.svg')).sort().forEach((f) => {
  const svg = fs.readFileSync(path.join(dossier, f), 'utf8');
  const m = /<svg[^>]*>([\s\S]*?)<\/svg>/.exec(svg);
  if (!m) throw new Error('SVG illisible : ' + f);
  // On garde seulement le dessin : <svg> est recréé par DL.icone() avec classe, taille et ARIA.
  icones[f.replace(/\.svg$/, '')] = m[1].replace(/<title>[\s\S]*?<\/title>/g, '').replace(/\s+/g, ' ').trim();
});

const sortie = '/* Icônes Carbon (IBM) 11.90.0, licence Apache 2.0, voir vendor/icons/carbon/LICENSE.\n' +
  '   Fichier généré par vendor/icons/generer-carbon.js : ne pas modifier à la main. */\n' +
  'window.DL_ICONES = ' + JSON.stringify(icones, null, 1) + ';\n';
fs.writeFileSync(path.join(__dirname, 'carbon-icons.js'), sortie);
console.log(Object.keys(icones).length + ' icônes → carbon-icons.js');

# Lab Design, par gappy

Vingt générateurs de visuels procéduraux dans le navigateur : motifs, textures, mosaïques, dégradés, affiches.
Chaque image vient d'une **seed** : même seed + mêmes réglages = même image, à l'écran comme en export jusqu'à 8000 px.

**Site : https://peakaboooo.github.io/designlab/**

| | | | |
|---|---|---|---|
| 01 Oddgrid : compositions pixel | 02 Terrain : courbes de niveau | 03 Filament : flow fields | 04 Aura : dégradés à grain |
| 05 Warp : op-art déformé | 06 Riso : collage risographie | 07 Benday : trames thermiques | 08 Specimen : affiches typographiques |
| 09 Vein : marbrures (SVG) | 10 Fold : pixel art kaléidoscope | 11 Arabesque : zellige et kaléidoscopes | 12 Strate : coupes géologiques |
| 13 Moiré : interférences (SVG) | 14 Origami : papier plié | 15 Shibori : teinture indigo | 16 Weave : rubans tissés |
| 17 Relief : blocs isométriques | 18 Rise : arcs radiaux (SVG) | 19 Dahlia : chrysanthèmes | 20 Static : pixels glitchés |

## Fonctionnement

- HTML, CSS et JavaScript statiques : aucun serveur, aucune compilation. Le site s'ouvre aussi en double-cliquant sur `index.html`.
- Réglages, seed et palette sont dans l'adresse : copier le lien suffit à partager une image exacte.
- Export PNG, JPEG ou SVG (outils vectoriels), re-rendu à la taille demandée (pas d'agrandissement).
- Raccourcis : `Espace` régénérer · `P` palette · `R` tout au hasard · `E` export · `Z` précédent · `F` favori.

## Crédits et licences

Bibliothèques et polices embarquées dans `vendor/`, chacune avec sa licence dans `vendor/licences/` :
p5.js (LGPL 2.1), Paper.js (MIT), d3-delaunay (ISC), chroma.js (BSD), icônes Carbon d'IBM (Apache 2.0),
polices Space Grotesk, Space Mono, Archivo Black, Instrument Serif et Dela Gothic One (SIL Open Font License).
Logo : GL Studio.

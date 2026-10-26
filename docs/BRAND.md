# Identité visuelle ZARAY — référence interne

Source : les deux visuels du logo transmis le 26 octobre 2026.
Le mot-symbole comporte des caractères blancs, un symbole vert intégré au « Z »
et une présentation naturelle sur fond noir. Le fichier transparent est la référence
de tracé de `public/brand/zaray-logo.svg` : il conserve les proportions et silhouettes
du visuel fourni, simplifiées en chemins vectoriels pour l'affichage web.

## Palette appliquée
- Noir d'identité : `#0A0D0B` — bandeaux et fonds recevant le logo blanc.
- Blanc : `#FFFFFF` — mot-symbole, surfaces et lisibilité.
- Vert vif issu du logo : `#21F728` — symbole, repères visuels.
- Vert bouton : `#2DF135` — surfaces d'actions, avec texte presque noir.
- Vert texte accessible : `#176D22` — liens/labels sur fond blanc.
- Fond d'application : `#F5F8F4` — support neutre et discret.

## Règles d'usage
1. Ne jamais recolorer, déformer ou reconstruire le mot-symbole en texte générique.
2. Le mot-symbole blanc est utilisé sur une surface foncée.
3. Le vert vif est réservé aux accents et aux commandes prioritaires : éviter
   le texte néon directement sur un fond blanc (contraste insuffisant).
4. Préserver les routes, interactions métier, données réelles et RLS existantes.
5. Respecter `prefers-reduced-motion`, le responsive et le focus clavier.
6. En impression thermique, préférer un reçu lisible sans aplat noir :
   la hiérarchie transactionnelle reste prioritaire.

Les composants de référence sont `BrandLogo`, `AppShell` et les tokens CSS.


## Versions officielles du logo (26 octobre 2026)
- \`public/brand/zaray-light.png\` : lettres noires, feuille verte, fond transparent, issu du fichier officiel fourni.
- \`public/brand/zaray-dark.png\` : lettres blanches, feuille verte, fond transparent ; généré à la compilation en préservant exactement la silhouette et le canal alpha du logo officiel. Le fichier blanc fourni comportant un aplat blanc intégré, cette opération est nécessaire pour garantir une véritable transparence.
- \`BrandLogo\` bascule instantanément entre ces deux images selon \`data-theme\` ou \`prefers-color-scheme\`.
- \`ThemeSelector\` propose Auto/Clair/Sombre ; Auto respecte la préférence système et la sélection explicite est sauvegardée localement.
- Le favicon SVG représente le Z et sa feuille verte issus de la silhouette officielle. Les variantes PNG sont produites au build.
- Aucun formulaire ou module métier n'utilise de données fictives pour cette intégration.

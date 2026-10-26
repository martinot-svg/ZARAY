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

## Logos officiels non modifiés — intégration prévue
Deux fichiers PNG originaux distincts, à enregistrer sans conversion :
- `public/brand/zaray-noir-vert-original.png` : 2048×746, SHA-256 `4c7615f63f466d10baf4ec955a1562a17fa0e99a861c84b7a69bc4c57271326f`
- `public/brand/zaray-blanc-vert-original.png` : 2048×682, SHA-256 `258c67cadb203f207958af93b96fa47be5971a1fc31283d5fec1f9d86a474140`

Le composant `BrandLogo` référence directement ces PNG originaux. Aucune génération des variantes, transformation de leur transparence, filtre, contour, fond ou effet sur le logo.

**Blocage actuel :** les PNG joints à la conversation ne sont pas encore dans le dépôt. Cette branche ne doit pas être déployée avant copie intégrale des fichiers et réussite du contrôle SHA-256. La production stable reste active.

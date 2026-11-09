# Intégration WinBox et diagnostic MikroTik dans ZARAY

## Nature de l'intégration

WinBox v4.5 est une application **native** publiée par MikroTik (Windows, macOS et Linux), **pas un module Next.js**. Le navigateur et Vercel ne peuvent pas exécuter son fichier `WinBox.exe`.

Le fichier utilisateur `WinBox_Windows.zip` a été inspecté sans exécuter l'application. Son SHA-256 est :

`c98c23f4d7e9e3c68264a79967e59ede8defc86e4c7af3c7eae05d071ea867fd`

Cette empreinte correspond à l'archive WinBox Windows v4.5 publiée par MikroTik :
https://mikrotik.com/download/winbox

ZARAY renvoie **directement** vers le téléchargement officiel versionné :
https://download.mikrotik.com/routeros/winbox/4.5/WinBox_Windows.zip

L'archive EXE n'est pas copiée dans GitHub, Vercel ni dans les ressources statiques publiques de ZARAY.

## Fonctions web livrées

Dans **Gestion réseau > WinBox · console MikroTik**, l'administrateur peut consulter :

- le routeur choisi, son modèle, sa version RouterOS et le dernier contact du connecteur ;
- les ressources CPU, mémoire et uptime reçues du routeur via le connecteur local ZARAY ;
- des compteurs d'interfaces et de sessions dérivés uniquement des observations reçues ;
- les liens de téléchargement officiels WinBox pour Windows et les autres plateformes.

Les mesures de ressources ont un indicateur de fraîcheur. En l'absence de données
récentes, ZARAY ne prétend pas afficher des valeurs « live ».

## Sécurité et données

- Le connecteur déjà appairé interroge uniquement `/rest/system/resource` en HTTPS.
- Aucune API RouterOS n'est ouverte directement depuis le navigateur.
- Les ressources sont validées et écrites par le serveur ZARAY dans
  `public.network_router_resources` avec association stricte au routeur et à l'entreprise.
- RLS + lecture authentifiée limitée aux membres actifs de la même entreprise.
- Aucun droit de modification de cette table n'est accordé aux clients web.
- Aucune commande de pare-feu, routage, hotspot ou RADIUS n'est ajoutée.
- L'activation du contrôle RouterOS reste distincte et inchangée.

## Mise en production

Appliquer la migration additive `20261109180000_network_router_resources.sql`,
puis déployer l'application. Les nouveaux champs seront renseignés au prochain
cycle de synchronisation d'un **connecteur local installé**. La publication Vercel
n'installe ni WinBox sur le PC d'un administrateur, ni un agent sur le MikroTik.

**FreeRADIUS 3.2** ne peut pas être installé comme démon UDP permanent au sein
de l'hébergement Vercel de ZARAY. L'intégration de préparation RADIUS et le
connecteur existant restent indépendants de cette console WinBox.

# ZARAY — Portail captif MikroTik avec catalogue d'offres

Le fichier `public/hotspot/zaray-login.html` est un modèle natif RouterOS Hotspot.

## Parcours client

1. Le client rejoint le SSID du site et ouvre la page du Hotspot.
2. Le portail affiche **les offres actives du site avec des tickets préimprimés et déjà provisionnés sur MikroTik**.
3. Il choisit l'offre du ticket acheté chez le vendeur.
4. Le formulaire demande l'identifiant et le mot de passe figurant sur ce ticket.
5. Le formulaire transmet les identifiants **directement au Hotspot MikroTik**, jamais à l'API publique ZARAY.
6. Le routeur authentifie le compte. L'agent ZARAY remonte la première session réussie ; le backend enregistre une unique activation et la valeur de l'offre associée au ticket réel.

**La sélection d'une offre n'accorde aucun droit, ne transforme pas la durée ni le tarif du ticket imprimé.**
Le routeur garde l'autorité. La valeur comptabilisée est celle de la première connexion, **pas un encaissement vérifié**.

## Préparation du fichier

Depuis **Tickets Wi-Fi > Personnalisation**, choisir le site et cliquer **Télécharger la page MikroTik pour ce site**. Le `login.html` téléchargé contient l'identifiant UUID du site. Aucune clé API ni mot de passe de ticket ne s'y trouve.

## Configuration nécessaire sur un MikroTik local

- Installer le fichier `login.html` dans le répertoire HTML effectivement utilisé par le serveur Hotspot, sans écraser les fichiers RouterOS indispensables.
- Conserver le fichier `md5.js` d'origine dans le même répertoire pour **HTTP-CHAP**. Si le Hotspot utilise la connexion directe **HTTP-PAP**, le modèle exige HTTPS avec certificat valide et refuse de poster un mot de passe sur une connexion HTTP non chiffrée.
- Autoriser avant authentification la requête HTTPS publique `https://zaray.vercel.app/api/public/wifi-offers?siteId=...` par la configuration walled-garden du Hotspot. Le site est identifié par son UUID, et seules les informations commerciales publiques des offres sont exposées (aucun identifiant de ticket, mot de passe, client ni code de caisse).
- Vérifier la résolution DNS, le certificat HTTPS, l'accès à l'API du catalogue, les contraintes du navigateur captif mobile et les règles de limitation des échecs de login. Les PINs de 3 à 5 chiffres sont intrinsèquement faciles à deviner.
- L'appairage du **connecteur ZARAY local** reste indispensable à la préparation des comptes et à la comptabilisation des premières connexions.

Documentation officielle MikroTik : https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/hotspot-customisation/

**Limite actuelle :** ZARAY déploie le modèle et les offres publiques dans le cloud, mais il ne peut pas installer ce fichier dans le système de fichiers d'un MikroTik local sans un accès aux équipements autorisé et opérationnel. Le simple déploiement Vercel ne modifie pas la page Hotspot physique.

## Résilience

Si la liste des offres n'est pas accessible avant authentification, le lien **J'ai déjà un ticket** permet de rejoindre le formulaire de connexion local. Le portail affiche les erreurs d'identifiants de manière générique sans exposer le contenu interne des messages RouterOS.

# ZARAY — Portail captif unique pour tickets Wi-Fi et abonnements résidentiels

Le fichier `public/hotspot/zaray-login.html` est un modèle natif RouterOS Hotspot.

## Parcours client unique

1. Le client rejoint le SSID du site et le MikroTik affiche automatiquement sa même page Hotspot `login.html` (si le Hotspot est correctement configuré ; certains terminaux demandent d’ouvrir le navigateur).
2. **Client occasionnel :** le portail affiche les offres disposant de tickets préimprimés et réellement provisionnés pour le site. Il choisit l’offre correspondant au ticket acheté chez le vendeur et saisit le nom d’utilisateur et le PIN du ticket.
3. **Futur client résidentiel :** sur cette **même page**, il clique **« Devenir un abonné de [nom de l’entreprise] »**, puis arrive sur `https://zaray.vercel.app/portail/<slug-entreprise>` pour renseigner ses coordonnées, choisir son abonnement et transmettre un justificatif de paiement.
4. La demande publique crée automatiquement une fiche CRM dans le module **Clients** (réutilisée si l’adresse e-mail existe dans la même entreprise) et une commande de souscription. **Aucun droit d’accès n’est activé avant paiement validé et provisionnement réseau confirmé.** 
5. **Client occasionnel :** le formulaire transmet les identifiants directement au Hotspot MikroTik, pas à l’API ZARAY. Le routeur authentifie le compte. L’agent ZARAY détecte la première session et comptabilise une seule activation.

**La page du routeur est commune, mais les deux méthodes d’accès et de facturation restent distinctes** : tickets à consommation cumulée pour l’occasionnel ; abonnement continu pour le résidentiel. Le chemin d’inscription résidentielle est une page web distante ouverte depuis le portail du routeur, pas un second portail captif.

**La sélection d'une offre n'accorde aucun droit, ne transforme pas la durée ni le tarif du ticket imprimé.**
Le routeur garde l'autorité. La valeur comptabilisée est celle de la première connexion, **pas un encaissement vérifié**.

## Préparation du fichier

Depuis **Tickets Wi-Fi > Personnalisation**, choisir le site et cliquer **Télécharger la page MikroTik pour ce site**. Le `login.html` téléchargé contient l’identifiant UUID du site ainsi que le **slug public de l’entreprise** pour que le bouton d’abonnement reste accessible même si le catalogue d’offres ne se charge pas. Aucun secret API ni mot de passe de ticket ne s’y trouve. La réponse API fournit le nom public de l’entreprise pour personnaliser le libellé « Devenir un abonné de … ».

## Configuration nécessaire sur un MikroTik local

- Installer le fichier `login.html` dans le répertoire HTML effectivement utilisé par le serveur Hotspot, sans écraser les fichiers RouterOS indispensables.
- Conserver le fichier `md5.js` d'origine dans le même répertoire pour **HTTP-CHAP**. Si le Hotspot utilise la connexion directe **HTTP-PAP**, le modèle exige HTTPS avec certificat valide et refuse de poster un mot de passe sur une connexion HTTP non chiffrée.
- **Autoriser l’accès pré-authentification** au catalogue `https://zaray.vercel.app/api/public/wifi-offers?siteId=...` et au parcours de souscription `https://zaray.vercel.app/portail/<slug-entreprise>` : HTML, ressources Next.js `/_next/`, endpoints `/api/portal/<slug>/...`, `/api/manual-payments/submit` et toute page de vérification de paiement utilisée. En pratique, les règles `/ip hotspot walled-garden` devront autoriser les noms DNS HTTPS nécessaires (vérifier les détails propres à RouterOS). Le navigateur captif doit pouvoir charger les scripts et téléverser les justificatifs. **Ne jamais ouvrir l’accès Internet général** pour permettre ces opérations. Toute autorisation de l'hôte `zaray.vercel.app` représente un périmètre web accessible gratuitement avant authentification à évaluer selon les capacités de filtrage du routeur.
- Vérifier le fonctionnement réel des inscriptions sur réseau non authentifié : la page de création du compte est externe et ne fonctionnera pas tant que les ressources nécessaires ne sont pas accessibles via walled garden.
- Vérifier la résolution DNS, le certificat HTTPS, l'accès à l'API du catalogue, les contraintes du navigateur captif mobile et les règles de limitation des échecs de login. Les PINs de 3 à 5 chiffres sont intrinsèquement faciles à deviner.
- L'appairage du **connecteur ZARAY local** reste indispensable à la préparation des comptes et à la comptabilisation des premières connexions.

Documentation officielle MikroTik : https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot+customisation et https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot+-+Captive+portal

**Limite actuelle :** ZARAY déploie le modèle et les offres publiques dans le cloud, mais il ne peut pas installer ce fichier dans le système de fichiers d'un MikroTik local sans un accès aux équipements autorisé et opérationnel. Le simple déploiement Vercel ne modifie pas la page Hotspot physique.

## Résilience

Si la liste des offres n'est pas accessible avant authentification, le lien **J'ai déjà un ticket** permet de rejoindre le formulaire de connexion local. Le bouton d’abonnement reste affiché grâce au slug d’entreprise intégré dans le modèle téléchargé, mais le parcours en ligne exige tout de même un accès HTTPS autorisé. Le portail affiche les erreurs d'identifiants de manière générique sans exposer le contenu interne des messages RouterOS.

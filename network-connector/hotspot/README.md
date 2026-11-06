# ZARAY — Portail captif unique pour tickets Wi-Fi et abonnements résidentiels

Le fichier `public/hotspot/zaray-login.html` est un modèle natif RouterOS Hotspot.

## Adresses du portail et du compte par site

Pour chaque site, le propriétaire choisit une adresse locale (exemple : `monsite.mg`).
Les chemins publics souhaités sont :

| Adresse | Rôle |
| --- | --- |
| `http://monsite.mg/` | Portail captif natif `login.html` servi par le MikroTik sur son Wi-Fi, après configuration DNS/HotSpot |
| `http://monsite.mg/mycompte/me` | Chemin privé **préparé**, réservé à l’espace du client du même site |

**Point de déploiement indispensable :** ce second chemin ne fonctionne pas simplement en créant `login.html` sur le MikroTik. Il exige un serveur HTTPS local/reverse proxy qui dessert `/mycompte/me` et rejoint l’application d’abonnements ZARAY, ou un domaine de site public vérifié et connecté à cette application. En l’absence d’un tel serveur, ZARAY affiche l’adresse comme préparée et **masque le lien de connexion non fonctionnel** sur le HotSpot natif. La prise en charge de chemins arbitraires sous la racine HotSpot ne doit pas être supposée acquise.

Sur un **hôte web de site vraiment raccordé à ZARAY**, la racine `/` montre la version web du portail Wi-Fi du site et `/mycompte/me` ouvre son compte résidentiel. Ces deux pages sont alors routées côté serveur par l’hôte vers le `site_id` associé, et l’accès aux dossiers reste soumis à une session e-mail vérifiée. Le portail Wi-Fi web ne remplace pas l’authentification native du MikroTik.

Un alias privé `.mg` non enregistré sur l’Internet public ne sera pas accessible depuis le réseau mobile. Pour un accès distant sans domaine acheté, un serveur HTTPS privé et un VPN avec DNS interne sont nécessaires ; aucun lien HTML seul ne crée ce serveur, certificat ou tunnel.

## Parcours client unique

1. Le client rejoint le SSID du site et le MikroTik affiche automatiquement sa même page Hotspot `login.html` (si le Hotspot est correctement configuré ; certains terminaux demandent d’ouvrir le navigateur).
2. **Client occasionnel :** le portail affiche **directement** le nom d’utilisateur et le mot de passe du ticket, sans offres encombrantes. Le petit bouton « Découvrir les offres » ouvre la liste des forfaits du site et permet de revenir à la connexion. La page reste compacte et adaptée aux mobiles.
3. **Futur client résidentiel :** depuis **« Découvrir les offres »**, il peut cliquer sur **« Devenir un abonné de [nom du fournisseur] »**. Si un service web distant est disponible, cette action ouvre la page personnalisée `/wifi/<slug-entreprise>?siteId=<uuid>&inscription=1`, qui conserve le site de raccordement.
4. **Client résidentiel déjà inscrit :** le lien **« Mon compte »** apparaît à côté de « Découvrir les offres » seulement lorsqu'une adresse de service web réellement joignable est configurée. Il pointe vers `/mon-internet/<uuid-du-site>` et demande une authentification e-mail. En mode *adresse locale uniquement*, ce lien reste masqué : le fichier HTML du MikroTik ne peut pas à lui seul consulter les comptes ou les abonnements Supabase.
5. La demande publique crée automatiquement une fiche CRM dans le module **Clients** (réutilisée si l’adresse e-mail existe dans la même entreprise) et une commande de souscription. **Aucun droit d’accès n’est activé avant paiement validé et provisionnement réseau confirmé.** 
6. **Client occasionnel :** le formulaire transmet les identifiants directement au Hotspot MikroTik, pas à l’API ZARAY. Le routeur authentifie le compte. L’agent ZARAY détecte la première session et comptabilise une seule activation.

**Sans achat de domaine :** le portail captif natif `login.html` reste accessible sur le réseau Wi-Fi après installation et configuration DNS/Hotspot locales. Les pages de souscription et de compte sont des applications distinctes nécessitant un serveur accessible (public ou privé via VPN) : une adresse locale saisie dans ZARAY ne les héberge pas automatiquement. Sur une URL publique technique, le contenu peut être en marque blanche, mais le nom du serveur peut rester visible dans la barre du navigateur.

**La page du routeur est commune, mais les deux méthodes d’accès et de facturation restent distinctes** : tickets à consommation cumulée pour l’occasionnel ; abonnement continu pour le résidentiel. Le chemin d’inscription résidentielle est une page web distante ouverte depuis le portail du routeur, pas un second portail captif.

**La sélection d'une offre n'accorde aucun droit, ne transforme pas la durée ni le tarif du ticket imprimé.**
Le routeur garde l'autorité. La valeur comptabilisée est celle de la première connexion, **pas un encaissement vérifié**.

## Préparation du fichier

Depuis **Tickets Wi-Fi > Personnalisation**, sélectionner **Tous les forfaits du site**, puis définir et **enregistrer** le nom commercial, le logo, les couleurs et le message d’accueil du site. Cliquer sur **Télécharger la page MikroTik pour ce site**. Le `login.html` contient son identifiant UUID, le **slug public de l’entreprise** et une **copie statique des réglages publics du site** : le branding fonctionne même sans chargement du catalogue pendant l’authentification. Quand l’API peut être jointe, ces réglages publics sont actualisés. Le logo doit rester un PNG, JPEG ou WebP de taille limitée. Les styles individuels des offres n’affectent pas le portail commun du site. Aucun secret API ni mot de passe de ticket n’y figure. Après modification de l’identité, remplacer le fichier `login.html` sur le MikroTik pour mettre à jour également sa copie hors ligne.

## Configuration nécessaire sur un MikroTik local

- Installer le fichier `login.html` dans le répertoire HTML effectivement utilisé par le serveur Hotspot, sans écraser les fichiers RouterOS indispensables.
- Conserver le fichier `md5.js` d'origine dans le même répertoire pour **HTTP-CHAP**. Si le Hotspot utilise la connexion directe **HTTP-PAP**, le modèle exige HTTPS avec certificat valide et refuse de poster un mot de passe sur une connexion HTTP non chiffrée.
- **Autoriser l’accès pré-authentification** au catalogue `https://zaray.vercel.app/api/public/wifi-offers?siteId=...` et au parcours de souscription `https://zaray.vercel.app/wifi/<slug-entreprise>?siteId=<uuid>&inscription=1` et au compte `https://zaray.vercel.app/mon-internet/<uuid>` : HTML, ressources Next.js `/_next/`, endpoints `/api/portal/<slug>/...`, `/api/manual-payments/submit` et toute page de vérification de paiement utilisée. En pratique, les règles `/ip hotspot walled-garden` devront autoriser les noms DNS HTTPS nécessaires (vérifier les détails propres à RouterOS). Le navigateur captif doit pouvoir charger les scripts et téléverser les justificatifs. **Ne jamais ouvrir l’accès Internet général** pour permettre ces opérations. Toute autorisation de l'hôte `zaray.vercel.app` représente un périmètre web accessible gratuitement avant authentification à évaluer selon les capacités de filtrage du routeur.
- Vérifier le fonctionnement réel des inscriptions sur réseau non authentifié : la page de création du compte est externe et ne fonctionnera pas tant que les ressources nécessaires ne sont pas accessibles via walled garden.
- Vérifier la résolution DNS, le certificat HTTPS, l'accès à l'API du catalogue, les contraintes du navigateur captif mobile et les règles de limitation des échecs de login. Les PINs de 3 à 5 chiffres sont intrinsèquement faciles à deviner.
- L'appairage du **connecteur ZARAY local** reste indispensable à la préparation des comptes et à la comptabilisation des premières connexions.

Documentation officielle MikroTik : https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot+customisation et https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot+-+Captive+portal

**Limite actuelle :** ZARAY déploie le modèle et les offres publiques dans le cloud, mais il ne peut pas installer ce fichier dans le système de fichiers d'un MikroTik local sans un accès aux équipements autorisé et opérationnel. Le simple déploiement Vercel ne modifie pas la page Hotspot physique.

## Résilience

Si la liste des offres n'est pas accessible avant authentification, le lien **J'ai déjà un ticket** permet de rejoindre le formulaire de connexion local. Le bouton d’abonnement reste affiché grâce au slug d’entreprise intégré dans le modèle téléchargé, mais le parcours en ligne exige tout de même un accès HTTPS autorisé. Le portail affiche les erreurs d'identifiants de manière générique sans exposer le contenu interne des messages RouterOS.

## Interface premium compacte

L'accueil du modèle MikroTik et la prévisualisation web `/wifi` utilisent la même logique UX : identité ZARAY, nom de l'entreprise, nom d'utilisateur et mot de passe visibles dès l'arrivée, bouton **Se connecter**, puis **Devenir un abonné de [entreprise]**. La consultation des offres Wi-Fi est une action secondaire, sans imposer un écran supplémentaire avant la saisie du ticket.

La page native garde son formulaire RouterOS `$(link-login-only)` avec HTTP-CHAP ou PAP sur HTTPS, et la version web **ne transmet pas de mot de passe de ticket** tant que le routeur n'est pas raccordé. Le rendu natif n'utilise pas de ressource visuelle externe nécessaire à son démarrage. Des défilements peuvent être requis sur des écrans très courts ou avec un agrandissement d'accessibilité.

# Compagnon Android — alarmes résidentielles ZARAY

Cette application **Android native (projet source Android Studio)** est un premier socle de synchronisation. Aucun APK signé n'est encore publié. Elle est distincte du portail HTML MikroTik et ne remplace pas la connexion par tickets Wi-Fi.

## Flux client

1. Un abonné ouvre son compte `/mon-internet/<siteId>` (ou `/mycompte/me` sur un hôte de site web relié à ZARAY), se connecte avec son e-mail et code OTP.
2. Dans **Alarmes de mon abonnement**, il choisit 7, 3, 1 jour avant et/ou le jour de l'expiration, une heure (Madagascar), puis enregistre son consentement.
3. Une application Android installée et associée au même site ouvre le compte sur l'URL technique HTTPS ZARAY (sans domaine acheté). Elle réutilise la session web authentifiée et appelle `GET /api/residential/alarm-schedule?siteId=<siteId>` via les cookies de ce même hôte.
4. Le téléphone demande **Notifications** (Android 13+) et **Alarmes et rappels** (Android 12+) avant de programmer des alarmes exactes. Si les alarmes exactes sont refusées, le code utilise une programmation **approximative** ; si les notifications sont refusées, l'alerte visible n'est pas garantie.
5. Après synchronisation réussie, `AlarmManager` programme les événements locaux, identifiés par leur site et abonnement. Les anciennes dates sont annulées avant la programmation des nouvelles. Les alarmes locales restantes peuvent fonctionner hors ligne.
6. Un redémarrage Android restaure les alarmes futures stockées localement.
7. En cas de renouvellement, les nouvelles échéances sont reçues **lors de la prochaine synchronisation**. Cette première version synchronise quand l'application est au premier plan et au clic du client, pas de manière continue en arrière-plan.

## Build Android

Ouvrir `mobile/android-alarms/` dans **Android Studio**, avec SDK Android 35 et JDK 17, synchroniser Gradle puis construire une application de développement sur un téléphone autorisé. Le projet ne contient ni clé Resend, ni clé de service Supabase, ni identifiants clients.

La version de développement accepte un deep link `compteinternet-alarmes://site/<uuid>` pour choisir le site, ou la saisie de son UUID. La vérification du client s'effectue **toujours dans l'API ZARAY** à partir de son compte et de la session e-mail validée : le deep link seul n'accorde aucun droit.

**À faire avant distribution publique :** signer l'APK/AAB, tester l'installation, les autorisations, les alarmes et les redémarrages sur plusieurs versions Android, ajouter une interface d'association du téléphone plus simple (QR code ou bouton de jumelage) et vérifier les politiques Google Play. Un URL deep link avec seulement le siteId ne contient aucune autorisation de connexion. Une synchronisation réseau en arrière-plan nécessiterait une stratégie d'authentification et de tâches périodiques supplémentaires.

## iPhone

Le code iOS n'est pas inclus dans ce premier projet. Une application iOS dédiée doit demander l'autorisation AlarmKit, programmer les mêmes événements, les supprimer/recréer aux renouvellements et préserver le site de chacun. Un site HTML/PWA ne peut pas silencieusement installer des alarmes natives dans l'application Horloge.

## Solution immédiatement disponible, sans application native

Dans l'espace abonné, **Ajouter les rappels à mon calendrier** télécharge un `.ics` avec des alertes `VALARM` relatives aux véritables échéances. Le téléphone peut les importer dans son calendrier après action explicite de l'utilisateur. **L'importation dépend de l'application de calendrier et n'équivaut pas à une alarme native de l'application Horloge.**

## Sécurité / limites

- Seules les données de l'abonné authentifié appartenant à l'entreprise et au site sont servies par l'API. Le téléphone vérifie que l'identifiant du site retourné est celui demandé.
- Les autorisations sont séparées : consentement ZARAY dans Supabase et permissions du système Android.
- Les notifications ont le nom du **fournisseur/site**, pas celui du SaaS. Les dates ne sont ni inventées ni extrapolées d'une commande impayée.
- Un abonnement sans paiement confirmé, sans activation et sans date d'expiration ne génère aucune alarme.
- Un alias local non enregistré comme `monsite.mg` reste limité au DNS du fournisseur et n'est pas un serveur de compte. Le compagnon utilise l'application HTTPS existante.
- Une annulation des préférences dans ZARAY ne peut désactiver les alarmes déjà enregistrées sur un téléphone **hors ligne** qu'après la prochaine synchronisation. L'utilisateur peut également désactiver les alertes dans les paramètres Android.

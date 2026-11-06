# Compagnon Android — Rappels Internet par fournisseur

Version de développement 0.2.0. Le projet natif Java existant est conservé : Android SDK 26–35, AlarmManager, notifications locales et page de compte WebView. **Aucun APK Release signé n'est publié.** Un build vert ne remplace pas les essais sur téléphones physiques.

## Architecture

- ZARAY/Supabase fournit exclusivement une échéance de forfait **payé et activé**, les quatre rappels choisis, l'heure de Madagascar (`Indian/Antananarivo`) et le nom commercial du site.
- Le client ouvre son espace résidentiel, active/enregistre les rappels et crée un **code d'association aléatoire de 256 bits, à usage unique, valable dix minutes**.
- Le téléphone utilise le lien `compteinternet-alarmes://pair/<site-uuid>/<code>` ou saisit le code. Le client confirme l'association dans l'app native.
- L'API `POST /api/residential/alarm-devices/claim` consomme ce code et remet un **jeton d'appareil aléatoire** limité au site + au client. Les codes et jetons sont hachés en SHA-256 dans la table `residential_alarm_devices` protégée par RLS et sans droits Data API pour les rôles publics.
- Android stocke le jeton en **AES-GCM via Android Keystore**, avec sauvegarde Android désactivée. Les accès sont indépendants de la WebView et des cookies. Aucun identifiant administrateur ni clé Supabase privilégiée n'est embarqué.
- `WorkManager` effectue le rapprochement en ligne toutes les **six heures approximativement**, avec une fenêtre flexible d'une heure, réseau requis et reprise exponentielle. L'ouverture de l'app déclenche aussi un travail immédiat non dupliqué. Aucune exécution à heure exacte n'est promise.
- `AlarmManager` conserve jusqu'à quatre alarmes locales par site, à 7, 3, 1 et 0 jour avant l'échéance, avec l'heure choisie dans le compte. Les instants sont calculés par le serveur et exprimés en UTC ; changer de fuseau sur le téléphone ne déplace pas l'heure de Madagascar.
- Si les alarmes exactes ne sont pas autorisées, `setAndAllowWhileIdle` constitue une solution **approximative**. Android 13+ demande la permission de notification ; Android 12+ peut demander l'autorisation d'alarme exacte.
- Au renouvellement, les anciennes alarmes sont annulées et les nouvelles programmées au **prochain contact réseau**. Le récepteur Android n'affiche que des rappels présents dans le plan local encore valide. Si la dernière validation remonte à plus de 24 heures, le message mentionne une échéance conservée hors ligne.
- Révocation sur le site : le jeton est rejeté, puis les alarmes sont supprimées à la prochaine synchronisation du téléphone. Un téléphone durablement hors ligne peut encore déclencher les anciennes alarmes. La révocation locale dans l'app requiert Internet.
- Plusieurs sites peuvent être associés à un même téléphone ; jusqu'à cinq appareils par abonné/site. Le nom du fournisseur apparaît dans les rappels, pas le nom du logiciel de gestion.

## Backend requis

La migration `supabase/migrations/20261106100000_residential_alarm_devices.sql` doit être appliquée **avant** le déploiement de l'API du compagnon. Le code ajoute :

- `GET/POST/DELETE /api/residential/alarm-devices` : liste, création de code et révocation via **session résidentielle vérifiée** et contrôle d'origine pour les écritures.
- `POST/DELETE /api/residential/alarm-devices/claim` : consommation du code et révocation native par jeton.
- `GET /api/residential/alarm-schedule?siteId=<uuid>` : vérification `Authorization: Device <token>` pour WorkManager, sans changer l'accès navigateur OTP.

Un `401`/`403`/`410` à la synchronisation fait supprimer le lien local ; les réponses temporaires (`429`, `5xx`, erreurs réseau) sont réessayées sans détruire les alarmes déjà enregistrées. Les réponses sont limitées à 64 Kio, sans redirections automatiques. Les jetons expirent après 90 jours sans synchronisation réussie, avec prolongation lors d'un contact valide.

**Attention :** aucun schéma de production n'est modifié par la seule présence de cette migration dans GitHub. Il faut valider la migration et la configuration Vercel/Supabase avant de pouvoir tester l'association réelle.

## Compilation et signature

Prérequis : Android Studio / SDK Android 35, JDK 17, Gradle **8.11.1**, Android Gradle Plugin **8.9.2**. WorkManager Java `2.11.2` est la seule nouvelle dépendance Android directe ; Room/Kotlin/FCM ne sont pas nécessaires à ce petit cache local.

```sh
cd mobile/android-alarms
gradle :app:assembleDebug :app:lintDebug
# Résultat : app/build/outputs/apk/debug/app-debug.apk
```

Le workflow `.github/workflows/android-companion.yml` compile un APK Debug non signé pour distribution (signé uniquement avec la clé Android de développement si Gradle l'utilise), sans publication. **Pas d'APK Release signé dans Git.**

Pour préparer une release *localement*, après validation sur téléphones, avec une clé privée protégée hors du dépôt :

```sh
gradle :app:assembleRelease
zipalign -p 4 app/build/outputs/apk/release/app-release-unsigned.apk app-aligned.apk
apksigner sign --ks /chemin-prive/cle-release.jks --out app-release-signed.apk app-aligned.apk
apksigner verify --verbose --print-certs app-release-signed.apk
adb install -r app-release-signed.apk
```

Créer et conserver sa clé via `keytool`/Android Studio en lieu sûr, sans la commiter ni l'envoyer à un service web. Conserver le même certificat pour les mises à jour et augmenter `versionCode` à chaque publication. Examiner permissions, taille, SDK et rapport de lint avant distribution. La première distribution doit recevoir une **autorisation explicite**.

## Matrice de validation avant distribution

| Scénario | Vérification requise |
| --- | --- |
| Première installation et consentement | Android 8, 10, 12, 13, 14, 15/16 si disponibles |
| Association simple et code expiré/réutilisé | Essai avec deux téléphones, deux sites et deux comptes |
| Connexion initiale, serveur indisponible, retour Internet | Vérifier WorkManager, statut et absence de doublons |
| Renouvellement, changement d'heure/date, annulation | Comparer les IDs et instants AlarmManager avant/après |
| Sans Internet et mode économie d'énergie | Tester le rappel préprogrammé, sans promettre une heure exacte |
| Redémarrage du téléphone / mise à jour de l'APK | Vérifier les alarmes futures restaurées |
| Fermeture, suppression des applications récentes, arrêt forcé | **Scénarios distincts** : un arrêt forcé empêche le travail jusqu'à réouverture |
| Refus puis accord des permissions | Exact vs approximatif ; notification désactivée |
| Changement de fuseau | Vérifier les instants UTC serveur (Madagascar) |
| Dissociation sur portail et dans l'app | Ancien jeton rejeté ; nettoyage au prochain contact |
| Plusieurs sites et plusieurs appareils | Isolation et révocation indépendante |

Les tests Node du dépôt contrôlent des invariants structurels ; **ils ne remplacent pas l'intégration avec Supabase réel, les tests instrumentés Android ni un appareil réel**.

## Limitations connues

- Un WorkManager périodique n'est pas une connexion permanente ; Android gère la cadence, la batterie et les quotas.
- Les notifications déjà programmées peuvent sonner sans Internet ; le téléphone ne connaît pas une annulation reçue uniquement par le serveur avant la prochaine synchronisation.
- Une interruption longue rend l'échéance potentiellement obsolète ; l'UI/notification l'indique sans déclarer que le serveur vient de la confirmer.
- Une fermeture normale et la suppression des applications récentes ne sont pas un `force-stop` ; ce dernier empêche les traitements attendus jusqu'à réouverture.
- L'identité visuelle du compte demeure celle du site ; l'application compagnon installée reste générique. Un véritable logo/icône Android différent par fournisseur nécessiterait des builds/package IDs distincts.
- Le lien personnalisé `.mg` doit être réellement routé et servi en HTTPS pour ouvrir le compte hors du hotspot ; l'app technique utilise l'origine HTTPS actuelle.

## Étude iPhone (aucun code iOS produit)

**Option A — Swift/SwiftUI + AlarmKit (iOS 26+) :** intégration native d'alarmes locales avec autorisation `NSAlarmKitUsageDescription`, synchronisation d'échéances et stockage Keychain. Meilleure expérience iPhone compatible, mais nécessite Xcode/macOS, une application iOS à maintenir et la revue App Store. Le programme Apple Developer coûte habituellement 99 USD/an pour distribuer via l'App Store (prix local éventuel).

**Option B — Swift/SwiftUI + notifications locales UNUserNotificationCenter :** plus large compatibilité iOS, mais ce sont des **notifications**, pas des alarmes AlarmKit pouvant outrepasser le mode silencieux. Synchronisation de fond sous contrôle du système, jamais garantie à heure exacte.

**Option C — PWA/calendrier .ics :** coût logiciel très faible, déjà en partie disponible ; dépend de l'import manuel et n'apporte pas d'AlarmKit natif.

Recommandation : conserver le contrat JSON de l'API et l'isolation des appareils, puis prototyper une version Swift dédiée seulement si les abonnés iPhone justifient la maintenance supplémentaire. Une réécriture multiplateforme du compagnon Android existant n'est pas justifiée pour l'instant.

# ZARAY — Validation isolée de la PR #130

État au 9 novembre 2026 : les étapes indépendantes du matériel sont réalisées
dans la branche `codex/mikrotik-administration`. **Aucun routeur physique, CHR
démarré ni projet Supabase Lab distinct n'est actuellement accessible**.
Ce document décrit les conditions indispensables avant d'autoriser les écritures.

## 1 — Architecture et isolation obligatoire

```text
             PR #130 → Vercel Preview
                        HTTPS
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
  Supabase ZARAY-LAB                 CHR / MikroTik LAB
  (nouveau projet distinct)          (réseau interne isolé)
          │                             │
  Test tenants A et B              Agent → HTTPS sortant
          └───────────────┬─────────────┘
                   Aucun lien vers
              Supabase ni routeurs PROD
```

Supabase production : projet `hosyeygtaksbahnxxiqf`.
La vérification des projets a trouvé **une seule organisation Supabase ZARAY
et un seul projet visible par cette connexion**. Le 9 novembre 2026, l'organisation
a été confirmée en **Free** et Supabase a coté la création à **0 USD/mois**.
Toutefois, l'appel de création de `ZARAY-LAB` a été **refusé** : le membre
`martinot-svg` aurait déjà atteint sa limite personnelle de **deux projets
gratuits actifs** dans les organisations où il est propriétaire/administrateur.
Le second projet n'est pas visible dans cette connexion et n'a pas été
modifié. **Aucun projet ZARAY-LAB n'a été créé**, aucune option payante activée.
Libérer une place gratuitement exige que le propriétaire examine ses projets
dans Supabase et choisisse lui-même de mettre en pause un projet qui n'est
plus nécessaire. Ne jamais arrêter, supprimer ou migrer une base en production
sans sa sélection explicite.

Pour poursuivre gratuitement sans second projet Supabase, la CI GitHub
utilise PostgreSQL 16 dans un conteneur **éphémère** :
`.github/workflows/mikrotik-lab-postgres.yml`.
Le job `migration-rls` crée deux tenants fictifs A/B et applique la
migration exacte `20261109121500_mikrotik_administration_inventory.sql`,
puis confirme par SQL :
- RLS A/B sous `SET ROLE authenticated` et `auth.uid()` simulé ;
- 54 observations du tenant A, pages de 50 puis 4 ;
- statut des sources partiellement collectées ou obsolètes ;
- absence de permission INSERT/UPDATE/DELETE pour le navigateur ;
- refus d'une déconnexion simultanée en doublon, puis nouveau départ
  autorisé après clôture.
Ce test a réussi sur GitHub Actions sans accéder aux données de production.
Il **ne remplace pas** la validation d'une instance Supabase Lab complète
(GoTrue, Data API et auth réel restent à éprouver).

La création du second projet exige la sélection
explicite de l'organisation par le propriétaire et la confirmation
éventuelle du coût si demandé par Supabase. **Ne jamais créer un projet
facturé sans consentement**. L'offre Free peut permettre deux projets,
selon l'éligibilité actuelle.

Ne pas créer de branche de la **base de production** sans comprendre ses
coûts ; préférer un projet Lab indépendant et vide. Ne pas copier les
données clients, paiements, tickets ou secrets de production.

Lorsque le projet Lab existe :
- Installer les migrations ZARAY du dépôt **dans l'ordre** avec une URL de
  base explicitement issue du projet Lab. Ne pas appliquer uniquement la
  dernière migration sur un projet vide.
- Appliquer et vérifier en particulier
  `supabase/migrations/20261109121500_mikrotik_administration_inventory.sql`.
- Créer **uniquement dans Lab** deux entreprises fictives A/B, deux sites,
  deux comptes de test email confirmés avec rôles admin/lecture seule,
  et deux routeurs fictifs. L'identité et les secrets de ces comptes ne
  doivent jamais être écrits dans GitHub ni communiqués dans le chat.
- À la fin, révoquer les sessions et supprimer les comptes Lab si nécessaire.

### Variables Vercel, branche uniquement

Configurer ces variables dans **Vercel → Projet ZARAY → Settings →
Environment Variables**, cible **Preview** et branche
`codex/mikrotik-administration` seulement :

| Variable | Valeur à utiliser | Visibilité |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS du nouveau projet Lab | Publique |
| `SUPABASE_URL` | Exactement la même URL Lab | Serveur |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique **Lab** | Publique |
| `SUPABASE_SECRET_KEY` | Clé secrète **Lab**, jamais celle de production | Sensible |
| `ZARAY_PREVIEW_SUPABASE_REF` | Identifiant du projet Lab | Serveur |
| `NEXT_PUBLIC_ZARAY_LAB_PROJECT_REF` | Même identifiant Lab | Publique |

Le code refuse les projets qui ne correspondent pas exactement à
`https://<ref>.supabase.co` et refuse le ref de production.
La sécurité côté navigateur vérifie également sa propre URL.
**Redéployer** la Preview après configuration : les anciennes fonctions
déployées ne reçoivent pas rétroactivement les nouvelles variables.

Ne pas définir `ZARAY_PREVIEW_NETWORK_MUTATIONS` ni
`ZARAY_PREVIEW_LAB_APPROVED` tant que la séparation de la base et
du réseau n'est pas confirmée. Quand l'isolation est prouvée et le CHR
dédié : `ZARAY_PREVIEW_NETWORK_MUTATIONS=enabled`,
`ZARAY_PREVIEW_LAB_APPROVED=approved`. Jamais sur la branche main ni dans
un environnement Preview partagé avec la production.

### Diagnostic public de la Preview (sans secret)

Une fois la nouvelle révision déployée, consulter
`/api/network/lab-status` sur l'URL Preview. Le diagnostic renvoie
`isolatedConfiguration=false` et HTTP 503 si les variables Lab manquent ;
`networkWritesBlocked=true` indique que les commandes sont désactivées.
Un résultat de configuration valide **ne prouve pas** la connexion à la base,
ses migrations, les permissions ni les validations sur un routeur : ces
contrôles doivent être exécutés séparément.

Un script de tests RLS prêt à exécuter est disponible dans
`tests/lab/supabase-tenant-isolation.mjs`. Il exige des jetons de
test **uniquement Lab**, refusant toute URL correspondant à la
production. Il vérifie la visibilité A/B, la protection contre les
insertions depuis le navigateur et la pagination. Fournir au moins 51
observations synthétiques au routeur A pour confirmer la seconde page.
Ne pas stocker les jetons de test dans Git ni les coller dans le chat.

### Preuves attendues avant déblocage

- Les métadonnées Supabase affichent **deux IDs de projet différents** ;
- l'URL Preview et toutes les variables Supabase pointent vers **Lab** ;
- un compte de test Lab ne voit ni utilisateur ni entreprise production ;
- aucune connexion du routeur de laboratoire vers le domaine ZARAY
  de production : l'agent généré utilise le **déploiement de la Preview** ;
- l'accès REST/WinBox du CHR n'est autorisé que sur son réseau privé ;
- la révision exacte de la Preview et des scripts est identifiée et figée.

## 2 — Préparer un MikroTik CHR virtuel gratuit

MikroTik propose CHR pour x86-64, avec une licence Free permanente
limitée à 1 Mbit/s par interface. L'image VirtualBox VDI se récupère
depuis la page officielle :
https://mikrotik.com/download

Sur un poste déjà disponible, installer VirtualBox ou un hyperviseur
équivalent. Créer une VM **hors du réseau de production** avec, par exemple,
1 vCPU, 1 GiB de RAM et le disque CHR VDI officiel.

Créer trois adaptateurs virtuels :
1. NAT : Internet sortant, pour l'API HTTPS Preview ;
2. Host-only (ou réseau privé local dédié) : accès administratif depuis
   le poste de laboratoire ;
3. Réseau interne isolé `zaray-lab-clients` : clients virtuels Hotspot/
   PPPoE, sans pont vers le réseau de l'entreprise.

Au premier démarrage, changer **localement** les identifiants initiaux
du CHR, vérifier l'horloge/NTP, le DNS et les certificats TLS, sauvegarder
l'état de la VM **avant** les tests. Désactiver/limiter les services
d'administration non nécessaires. Ne jamais ouvrir l'API RouterOS
sur Internet ni désactiver la validation TLS.

Dans la session actuelle, aucun périphérique `/dev/kvm` ni
`qemu-system-x86_64` n'était disponible : **CHR ne peut donc pas être
annoncé comme exécuté ici**. Le test nécessite un poste/hyperviseur
adapté. CHR permet de tester routage/IP, DHCP, NAT, pare-feu, Hotspot
Ethernet virtuel, PPPoE, REST, synchronisation et reprise d'erreurs.
Le Wi-Fi radio réel, bandes, puissance, stations et itinérance exigent
un MikroTik doté de matériel Wi-Fi.

Documentation MikroTik :
https://manual.mikrotik.com/docs/getting-started/installation-and-upgrade/install/chr-installation/

## 3 — Installation native guidée sans communiquer les mots de passe

Après validation de Lab et activation contrôlée des écritures Preview :

1. Ouvrir la **Preview de ZARAY**, se connecter avec un compte Lab
   confirmé possédant le rôle admin d'une entreprise fictive.
2. Créer le site et le routeur CHR Lab dans `Gestion réseau`.
   Vérifier que l'option de contrôle réseau est **désactivée**.
3. Cliquer `Agent natif (.rsc)` pour générer un fichier spécifique.
   Vérifier que le fichier contient l'URL **de la Preview**, pas
   `https://zaray.vercel.app/api/network/agent`. Un code de première
   association y figure : le conserver privé et l'effacer après import.
4. Dans **WinBox local sur CHR → Files**, transmettre le fichier.
   Depuis le terminal CHR : `/import file-name=<nom-du-fichier>.rsc`.
   L'import exige un accès admin et un code valide pendant environ 15 min.
   **Ne pas coller le contenu du fichier ni les mots de passe dans le chat.**
5. Dans CHR, vérifier :
   `/system scheduler print where name="zaray-native-minute"`,
   `/system script print where name="zaray-native-cycle"`,
   `/log print where message~"ZARAY"`.
   Ne pas afficher le contenu de `zaray-native-credentials` ni enregistrer
   des logs contenant le jeton.
6. Déclencher une synchronisation :
   `/system script run zaray-native-cycle` ; observer l'heure et
   l'identité du connecteur dans la Preview.
7. Tester d'abord **en lecture seule**. Activer le contrôle sur ce routeur
   Lab uniquement après les tests de tenant, de jeton, de certificat,
   d'expiration et de non-disponibilité de l'API.

Alternative : connecteur Node.js 22 sur le poste/hôte de laboratoire,
avec accès REST HTTPS uniquement au réseau privé CHR. Télécharger
la configuration depuis la Preview (URL générée automatiquement).
Conserver `MIKROTIK_USER`, `MIKROTIK_PASSWORD` et les clés d'appairage
dans un fichier local protégé, jamais dans Vercel ni GitHub.
Ne jamais faire tourner les agents natif et Node.js simultanément
avec des identités valides sur le même routeur.

### Révocation et suppression

1. Désactiver le contrôle réseau dans ZARAY Lab.
2. Générer un nouvel appairage pour révoquer l'ancien jeton, puis
   **ne pas le communiquer** au routeur qu'on souhaite retirer.
3. Sur CHR, arrêter puis retirer le scheduler
   `zaray-native-minute` et les scripts `zaray-native-cycle` et
   `zaray-native-credentials`. Ne pas supprimer les comptes Hotspot/PPP
   existants, ni un profil non géré par ZARAY.
4. Effacer le fichier `.rsc` téléchargé du poste et du CHR, ainsi que
   toute copie temporaire du code d'appairage.
5. Vérifier que le tableau ZARAY marque l'ancien connecteur comme
   hors ligne, sans accepter une nouvelle requête avec le jeton révoqué.

## 4 — Scénarios de validation obligatoires

**RLS et tenants** : connecter le compte Admin A, lire la table
`network_inventory_sources` de l'entreprise A et sa pagination
(plus de 50 éléments fictifs), puis tenter de lire B. Résultat
attendu : B invisible. Vérifier que le lecteur A ne peut ni
insérer directement ni modifier la table, et que le compte B
ne peut déclencher de commande sur le routeur A.

**Fraîcheur et couverture** : lire une source vide, une source
partielle (>25 entrées), une source obsolète (plus de 3 min)
et un agent natif ne supportant pas l'inventaire avancé.
Résultat attendu : état explicite, jamais total réseau inventé.

**Hotspot** : créer une session fictive sur CHR via le réseau
interne, constater sa présence dans RouterOS et ZARAY, demander
sa déconnexion avec motif depuis le compte Admin A :
`queued` → `dispatched` → disparition de la session relue
par RouterOS → `success`. Une session sans confirmation
ne doit pas être marquée réussie.

**PPPoE** : même procédure avec un utilisateur PPPoE de test
et un client PPPoE virtuel. La déconnexion ne doit ni désactiver
le compte ni modifier son abonnement.

**Échecs** : déconnecter un agent après dispatch, vérifier
la remise à disposition après 90 secondes tant que la commande
n'est pas expirée. Après expiration, la commande ne doit
pas être rejouée. Vérifier l'erreur REST, l'accusé contradictoire,
le même accusé envoyé deux fois, l'absence de session et
les rôles interdits. Vérifier les événements d'audit.

Les tests de fonction `tests/network-session-mock.test.mjs`
couvrent le **code du connecteur** avec un RouterOS REST simulé.
Ils ne prouvent pas les résultats sur un CHR.

## 5 — Contrôle visuel authentifié

Quand un compte Lab existe, exécuter localement :
`node tests/browser/mikrotik-lab-visual.mjs` avec les variables
`ZARAY_LAB_PREVIEW_URL`, `ZARAY_LAB_TEST_EMAIL` et
`ZARAY_LAB_TEST_PASSWORD` définies **dans le terminal local**.
Les captures `artifacts/mikrotik-lab/desktop.png` et
`artifacts/mikrotik-lab/mobile.png` sont générées par Playwright
après connexion ; le test refuse les URL de production.
Ne pas versionner les captures contenant des données d'utilisateur.
Sans compte Lab, on ne peut pas déclarer ces tests exécutés.

## 6 — Retour arrière des modifications avancées

Les écritures DHCP, filtre pare-feu, NAT et routage restent
**désactivées**. Un contrat de changement réversible et un modèle
de watchdog sont fournis dans
`network-connector/routeros/rollback-plan.mjs`.
Ils contrôlent le type, la cible gérée ZARAY, l'état initial,
la valeur demandée, la commande inverse et la fenêtre de
30 à 300 secondes. **Ce modèle n'active aucune opération
réelle**.

Sur un CHR de laboratoire, le mécanisme RouterOS devra réaliser
dans cet ordre :
1. Capturer la configuration exacte et une image de récupération ;
2. Installer un scheduler local de rollback vérifié **avant toute
   mutation**, avec une date limite de 180 secondes ;
3. Appliquer **une seule modification** appartenant à ZARAY ;
4. Relire les valeurs dans RouterOS et tester explicitement la
   continuité d'accès au routeur ;
5. En absence d'acquittement/confirmation, laisser le scheduler
   appliquer l'inverse, même si le cloud n'est plus accessible ;
6. Uniquement après lecture et confirmation de l'état attendu,
   retirer le scheduler. Journaliser toutes les transitions.

Le mode « Safe Mode » CLI/WinBox MikroTik est utile lors d'essais
manuels, mais ne remplace pas un scheduler autonome si le cloud
perd le contact ; et il a des limites d'historique :
https://help.mikrotik.com/docs/spaces/ROS/pages/8978498/Console

**Critère de promotion** : preuve du retour arrière réel sur CHR
après rupture intentionnelle de la liaison, puis approbation
technique avant le moindre ajout d'écriture DHCP/NAT/firewall/route
dans l'API de production. Conserver la PR en brouillon jusqu'alors.

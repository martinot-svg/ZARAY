# ZARAY — Administration MikroTik, livraison de prévisualisation

## État et périmètre
Cette tranche développe la **supervision avancée en lecture seule** et une
première **opération quotidienne de bout en bout** : déconnecter une session
Hotspot ou PPPoE. Elle prolonge la PR #130 sans lancer WinBox.exe dans le navigateur,
sans port RouterOS public, sans VPS obligatoire et sans déployer sur `main`.

Le contrôle réseau existant reste désactivé tant que le dirigeant ne l'active pas
explicitement sur un routeur déjà appairé.

### Inventaires

| Source | Agent RouterOS natif | Connecteur Node.js local | Écriture web |
|---|---|---|---|
| Interfaces, sessions Hotspot et PPPoE | Lecture bornée | Lecture bornée | Non |
| Stations Wi-Fi, DHCP leases, voisins, RADIUS | Non collecté | Lecture si API présente | Non |
| Comptes et profils Hotspot/PPP | Non collecté | Lecture si API présente | Non |
| Adresses et pools IP, DHCP servers | Non collecté | Lecture si API présente | Non |
| Files d'attente, filtre pare-feu, NAT, routes IP | Non collecté | Lecture si API présente | Non |
| Journaux et terminal libre | Non disponible | Non disponible | Non |

Le connecteur local nécessite Node.js 22+, le service HTTPS REST activé en
**réseau privé**, des identifiants RouterOS conservés uniquement dans le
connecteur, un certificat HTTPS vérifié et un appairage par routeur.
Aucune valeur brute du routeur n'est stockée : chaque classe ne conserve que
une identité, un libellé limité, un statut et éventuellement une IP/MAC.
Les mots de passe des comptes, secrets RADIUS, règles brutes et exports ne sont
jamais collectés.

**Bornes :** le connecteur lit jusqu'à 25 entrées par source et 500
observations par synchronisation. Le mode natif reste borné à 12 interfaces
et 10 sessions de chaque protocole. Les nombres collectés ne doivent pas être
présentés comme des totaux réseau si la source est tronquée. Une lecture
ancienne est marquée `stale` ; la non-compatibilité ou l'absence de lecture
n'est jamais présentée comme un inventaire vide fiable.

La table `network_inventory_sources` conserve le total rapporté, le nombre
effectivement collecté et la fraîcheur, par routeur et source. Son accès web
est en lecture seule avec RLS tenant-scoped.

### Déconnexion ciblée

1. L'administrateur ou le dirigeant choisit une session récemment observée,
   saisit un motif et confirme explicitement.
2. `POST /api/network/operations` valide le rôle dans l'entreprise,
   l'association routeur/site, l'appairage, le contrôle actif et l'horodatage
   de la session. Un utilisateur non administrateur reçoit HTTP 403.
3. La commande `disconnect_hotspot` ou `disconnect_ppp` est insérée dans
   `network_commands` avec la session et une durée maximale de 10 minutes.
   L'API répond **202** : *en file*, pas *appliquée*.
4. L'agent qui se connecte à ZARAY via HTTPS sortant récupère cette commande,
   l'applique localement puis relit la liste des sessions pour vérifier
   l'absence de la session ciblée.
5. Un accusé de résultat authentifié par routeur clôt la commande. Le module
   affiche `queued`, `dispatched`, `success` ou `failed` selon la base.
   Une rediffusion après 90 secondes est possible tant que la commande reste
   valide, avec validation des autorisations existantes.
6. Un évènement d'audit consigne l'identité de l'auteur, le routeur, la session,
   le protocole, le motif et l'heure. Les secrets RouterOS ne figurent jamais
   dans le journal.

Seules les sessions sont déconnectées ; la désactivation du compte ou la
suspension d'abonnement restent des opérations distinctes.

### Dépendances et prévisualisation

Migration **additive** : `supabase/migrations/20261109121500_mikrotik_administration_inventory.sql`.
Ne pas appliquer la migration en production avant l'approbation du cycle
de prévisualisation. Si elle n'existe pas dans l'environnement de
prévisualisation, la vue l'indique `migration_required` et évite de
prétendre que le nouvel inventaire fonctionne.

Déployer la branche `codex/mikrotik-administration` en **Preview**, puis
vérifier : connexion, lecture par entreprise, invalidation d'un routeur
étranger, état des sources, droits lecteur/admin, requêtes invalides et
file de commandes. Une migration est nécessaire dans la base de
prévisualisation avant de tester les nouvelles sources. Si Preview utilise
les identifiants de production, ne pas déclencher de commandes matérielles
sur des routeurs actifs.

### Tests matériels encore bloquants

Le code TypeScript, le build et les tests de sécurité peuvent être validés
sur GitHub Actions. **Aucun RouterOS de laboratoire avec accès réseau n'a
été fourni à cette session.** L'import du script natif, les chemins exacts
selon les modèles, les sessions réelles et les accusés matériels ne peuvent
pas être affirmés comme testés.

Avant une promotion en production, réaliser au minimum sur routeur de labo :
- Comparer les observations RouterOS aux inventaires ZARAY en situation
  nominale, partielle et hors ligne ;
- Déconnecter une session Hotspot, puis une PPPoE et vérifier l'absence
  sur RouterOS ainsi que le passage `success` ; simuler une erreur réseau ;
- Refuser une commande expirée, un compte d'une autre entreprise et un
  rôle lecture seule ; rejouer le même accusé ;
- Évaluer la longueur des corps HTTPS RouterOS et les équipements modestes ;
- Tester la révocation de l'agent, le redémarrage et le changement de réseau.

### Configuration avancée différée

Les changements de Wi-Fi, pare-feu, NAT, routes, adresses IP et DHCP
nécessitent impérativement un mécanisme **préparation/validation/retour
arrière local** qui fonctionne même quand la liaison cloud disparaît.
Cette tranche ne modifie donc ni ces paramètres ni les configurations
tierces. Le terminal arbitraire RouterOS reste désactivé.

Références :
- https://manual.mikrotik.com/docs/networking/remote-access/rest-api/
- https://manual.mikrotik.com/docs/tooling-and-management/fetch/

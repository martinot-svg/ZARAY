# WinBox 4.5 → ZARAY : cartographie fonctionnelle et preuves

Mise à jour : 10 novembre 2026. Source principale : `WinBox(3).exe`, SHA-256 `4ec6afb7b308633fd2d9e2354fbb164d727f3552216fd61a19518dbc1aaf6861`. Le binaire est identique à `WinBox(2).exe`. Analyse **statique**, sans exécution de WinBox, sans paquet réseau capturé.

## Ce que permet la preuve

- **B** : confirmé dans les symboles, chaînes ou ressources WinBox du binaire.
- **D** : fonctionnalité/chemin RouterOS confirmé dans la documentation officielle; ce n'est pas la preuve de sa présence dans chaque installation WinBox.
- **Z** : présence d'un chemin de code correspondant dans la branche ZARAY.
- **CI** : test automatisé de la logique, de la syntaxe, des types, de la migration simulée ou du build, pas un essai sur RouterOS.
- **H** : validé sur un routeur CHR/physique réel. **Aucun des ajouts de la PR #130 n'atteint H.**

WinBox v4 est un client natif de configuration RouterOS. La disponibilité de ses menus dépend de la version RouterOS, des packages installés, des licences et des permissions. La liste exhaustive de fenêtres et de champs **ne peut pas être extraite de ce seul exécutable** : certaines vues dépendent d'un routeur et de définitions récupérées en connexion. L'inventaire ci-dessous est donc une **carte de capacités majeures**, pas une fausse liste exhaustive des écrans internes WinBox.

## Architecture WinBox directement observable (B)

| Domaine | Indices WinBox (binaires) | Reproduction indépendante |
|---|---|---|
| Connexion, reconnexion | `WinBoxConnection`, `WboxSession`, `LoginView`, `ReconnectView` | Appairage RouterOS déjà présent, sessions côté agent, statut routeur |
| Découverte locale / MAC / RoMON | chaînes `DISCOVERY`, `MNDP`, `MacConnection`, `ROMON` | Détection par agent privé à étudier, **pas** d'accès MAC direct depuis le navigateur |
| Navigation | `WLeftMenu`, `WMenu`, `WRightMenuGroup` | Sélecteurs d'entreprise, site, routeur et vues réseau ZARAY |
| Fenêtres multiples | `MdiFactory`, `panels_MdiWindow`, `panels_MdiPanel` | Workspace ZARAY actuel; véritable mode multi-fenêtres non implémenté |
| Tableaux et filtres | `WTable`, `WTableFilter`, `WFindBar` | Recherche et tri sur la page d'inventaire courante (PR #130) |
| Propriétés, actions, formulaires | `panels_ObjectViewPanel`, `panels_ActionPanel`, `panels_SetupPanel` | Panneau de propriétés sûres, action de déconnexion avec garde-fous |
| Topologie | `Topology`, `TopologyNode`, `TopologyLink` | Non développée : aucun graphe de liaison vérifié |
| Graphiques, événements | `WGraph`, `WBarGraph`, `WEventsList` | CPU/RAM existants; graphes temps réel, événements profonds incomplets |
| Terminal/fichiers | `TerminalView`, `WFileTransfer` | Non répliqués; terminal arbitraire interdit pour l'instant |
| Taille des messages | `WinBoxImpl,ERR: too big msg size` | Lecteur HTTP borné à 1 Mio, implémentation indépendante |

## Carte des domaines d'administration et maturité ZARAY

Statuts : **Lecture PR** = résumé sanitisé et lecture seule codés dans la PR #130; **Principal** = fonctions antérieures dans `main`; **Partiel** = couverture non équivalente; **Absent** = aucun module complet; **À valider** = pas d'essai RouterOS réel.

| Famille | Fonction/capacité WinBox ou RouterOS (D) | Équivalent ZARAY / source | Statut |
|---|---|---|---|
| Système | Identification, version, CPU, mémoire, uptime | `system/resource`, `network_router_resources` | Principal + lectures |
| Système | Température, capteurs, stockage détaillé | Aucun relevé fiable exhaustif | Partiel |
| Système | Comptes et groupes RouterOS | Aucune modification RouterOS générique | Absent |
| Système | Logs et événements RouterOS | Pas de flux arbitraire | Absent |
| Système | Sauvegarde/restauration et fichiers | Aucune restauration cloud permise | Absent |
| Système | Paquets, mises à jour, reboot | Non intégrés | Absent |
| Session | Connexion, réappairage, révocation | Identifiants du connecteur hors navigateur | Principal |
| Session | Déconnexion Hotspot ciblée | `disconnect_hotspot`, file + acquittement | PR, matériel à valider |
| Session | Déconnexion PPPoE ciblée | `disconnect_ppp`, file + acquittement | PR, matériel à valider |
| Interface | Inventaire et état des interfaces | `interface` | Lecture PR |
| Interface | VLAN | `interface/vlan` | Lecture PR |
| Bridge | Bridges | `interface/bridge` | Lecture PR |
| Bridge | Ports de bridge | `interface/bridge/port` | Lecture PR |
| IP | Adresses IPv4 | `ip/address` | Lecture PR |
| IP | Adresses IPv6 | `ipv6/address` | Lecture PR |
| IP | Pools IP | `ip/pool` | Lecture PR |
| ARP | Entrées ARP | `ip/arp` | Lecture PR |
| Découverte | Voisins RouterOS | `ip/neighbor` | Lecture PR |
| DNS | Entrées DNS statiques | `ip/dns/static` | Lecture PR |
| DNS | Résolveurs, cache, configuration globale | Pas de modification ni lecture exhaustive | Partiel |
| DHCP | Serveurs DHCP | `ip/dhcp-server` | Lecture PR |
| DHCP | Baux DHCP | `ip/dhcp-server/lease` | Lecture PR |
| DHCP | Clients DHCP | `ip/dhcp-client` | Lecture PR |
| DHCP | Réseaux DHCP | `ip/dhcp-server/network` | Lecture PR |
| DHCP | Réservations, options, modifications | Aucune mutation autorisée | Absent |
| Routes | Routes IPv4 | `ip/route` | Lecture PR |
| Routes | Règles de routage | `routing/rule` | Lecture PR |
| Routes | BGP, OSPF, tables, VRF, MPLS | Non répliqués | Absent |
| Pare-feu | Filter | `ip/firewall/filter` | Lecture PR |
| Pare-feu | NAT | `ip/firewall/nat` | Lecture PR |
| Pare-feu | Address lists | `ip/firewall/address-list` | Lecture PR |
| Pare-feu | Mangle, raw, connexions suivies | Non répliqués | Absent |
| Pare-feu | Création/ordre/retrait de règles | Bloqués avant retour arrière validé | Absent |
| Débits | Simple Queues | `queue/simple` | Lecture PR |
| Débits | Queue Tree | `queue/tree` | Lecture PR |
| Débits | Profils QoS, PCQ, graphes de trafic | Pas de configuration/monitoring complet | Partiel |
| Hotspot | Sessions actives | `ip/hotspot/active` | Principal + PR |
| Hotspot | Comptes, profils | `ip/hotspot/user`, `ip/hotspot/user/profile` | Principal + PR |
| Hotspot | Coupons/tickets, limite de durée | Provisionnement ZARAY existant | Principal, matériel à valider |
| PPP | Sessions PPP/PPPoE | `ppp/active` | Principal + PR |
| PPP | Secrets et profils | `ppp/secret`, `ppp/profile` | Principal + PR |
| RADIUS | Serveurs configurés | `radius` sans secret | Lecture PR |
| RADIUS | Échanges d'authentification réels | Fondations existantes, validation matérielle manquante | Partiel |
| Wi-Fi | Stations associées (legacy et WiFi) | `interface/wireless/registration-table`, `interface/wifi/registration-table` | Lecture PR |
| Wi-Fi | SSID, sécurité, canaux, profils | Pas d'écritures génériques | Absent |
| CAPsMAN | Gestion des AP, provisionnement | Non répliqué | Absent |
| VPN | Interfaces WireGuard | `interface/wireguard` | Lecture PR |
| VPN | Pairs WireGuard (sans clés) | `interface/wireguard/peers` | Lecture PR |
| VPN | IPsec, L2TP, SSTP, OpenVPN | Non répliqués | Absent |
| Outils | Ping/traceroute/DNS lookup | Non intégrés avec résultats matériels | Absent |
| Outils | Torch, sniffer, bandwidth test | Non intégrés | Absent |
| Outils | Terminal RouterOS arbitraire | Non intégré pour des raisons de sécurité | Absent |
| UI | Tableaux filtrables, tri et propriétés | Inventaire ZARAY (page locale) | PR |
| UI | Multi-fenêtres/tableaux globaux | Navigation existante, pas de MDI équivalent | Partiel |
| UI | Topologie nœuds/liens | Structure WinBox observée; ZARAY sans graphe validé | Absent |

Les nouvelles sources de la tranche sont **10 chemins de configuration en lecture seule**, intégrés à l'agent Node local, aux listes de types autorisés, aux contraintes SQL de la migration additive et au sélecteur du module Gestion réseau. Les secrets, clés privées, règles brutes, scripts et exports ne sont pas collectés dans ces nouveaux champs.

**Important :** une entrée marquée « Lecture PR » n'est pas une capacité validée sur un vrai routeur. Toutes les sources restent conditionnées aux droits du connecteur local, à la version RouterOS et aux packages installés. Le mode agent natif conserve son inventaire limité.

## Coût et collecte

Les observations critiques (interfaces, Hotspot, PPPoE, baux DHCP, clients Wi-Fi) sont relevées à chaque cycle local. Les autres sources de configuration sont échantillonnées tous les 10 cycles (environ cinq minutes par défaut), avec un seuil d'ancienneté distinct. Les deux familles sont plafonnées en volume, leur couverture est déclarée complète/partielle, et les relevés partiels ne doivent pas désactiver des sessions absentes par effet de troncature.

Aucune connexion persistante ne tourne sur Vercel : la boucle de collecte reste dans le connecteur local. Aucun abonnement payant n'est nécessaire pour exécuter les tests automatisés et la logique locale.

## Protocole et compatibilité

L'interface REST documentée autorise `GET /rest/<path>?.proplist=...` **et** `POST /rest/<path>/print` avec `.proplist`. La PR utilise déjà la forme GET autorisée; ne pas la remplacer sans démontrer un avantage. RouterOS v7 fournit REST; les fonctions RouterOS v6, l'API classique, CAPsMAN et les modules spécifiques nécessitent un essai de compatibilité distinct.

Le protocole privé WinBox, le téléchargement de définitions d'UI et le système d'authentification interne n'ont pas été décompilés ni repris. **ZARAY reste une implémentation indépendante** fondée sur des interfaces publiques autorisées.

## Mesure honnête de couverture

- **Inventaires codés** : 31 types distincts d'observations issus de 32 chemins RouterOS (deux chemins Wi-Fi contribuent à un type).
- **Validation CHR/routeur physique pour la PR #130** : 0 fonctionnalité démontrée sur matériel dans cette analyse.
- **Taux de parité WinBox global** : **non mesurable honnêtement** sans profil de référence (modèle, RouterOS, packages, permissions), catalogue de scénarios exhaustif et tests en miroir sur le même équipement. Ne pas confondre pourcentage de types de lecture avec parité fonctionnelle.

## Prochaines tranches prioritaires

1. Tester GET `.proplist`, inventaires IPv4/IPv6, Bridge, DHCP, DNS, queues et WireGuard sur CHR isolé; comparer au contenu WinBox avec la même identité RouterOS.
2. Construire les diagnostics bornés (Ping/traceroute), résultat par routeur, quotas et audits.
3. Implémenter les fenêtres/onglets multi-sources sans contaminer les tenants; recherche sur l'ensemble des pages sous RLS.
4. Ajouter les contrôles de configuration par petites catégories uniquement après simulation et validation **du retour arrière local indépendant du cloud**.
5. Ajouter les outils Wi-Fi/CAPsMAN et VPN selon packages et droits détectés.
6. Vérifier la migration en base labo isolée, RLS, CI, sessions réelles, puis seulement planifier production.

Références officielles :
- https://mikrotik.com/download/winbox
- https://manual.mikrotik.com/docs/management-tools/winbox/
- https://manual.mikrotik.com/docs/developer-guides/rest-api/
- https://manual.mikrotik.com/docs/wireless/wifi/
- https://manual.mikrotik.com/docs/wireless/wifi/capsman/


## Tranche d'intégration du 10 novembre — recherche globale et propriétés réelles

La cartographie fonctionnelle a été confrontée aux **65 noms de composants QML compilés** observés dans `WinBox(3).exe`. Il s'agit de composants génériques d'interface, **pas** de 65 modules réseau et **pas** de fichiers sources C++/QML récupérés. Le binaire importe 35 bibliothèques Windows ; la présence d'un import ne prouve pas le protocole employé pour chaque écran.

### Comportements WinBox reproduits indépendamment

| Référence WinBox observée | Comportement ZARAY livré dans la PR | Fichiers principaux | Limite |
|---|---|---|---|
| `WFindBar`, `WTableFilter`, `WTable` | Recherche dans **toutes les observations déjà collectées d'un routeur**, pagination 50 éléments, correspondance insensible à la casse pour identifiants, libellés, IP et MAC | `src/app/api/network/inventory/route.ts`, `src/app/gestion-reseau/page.tsx`, `network_inventory_search` SQL | Pas une requête en direct vers RouterOS, ne renvoie pas les éléments non collectés |
| `panels_ObjectViewPanel` et `panels_QueryPanel` | Panneau de propriétés domaine par domaine avec champs réellement relevés et strictement limités | `network-connector/routeros/inspector-properties.mjs`, `src/lib/network-inventory-properties.ts`, `src/app/gestion-reseau/page.tsx` | La présence et les valeurs dépendent du modèle, de l'API, du paquet et des droits RouterOS |
| `MdiFactory` et `panels_MdiWindow` | Ouverture isolée d'un inventaire par routeur/source dans un onglet navigateur avec lien explicitement construit | `src/app/gestion-reseau/page.tsx` | Ce n'est pas la gestion native MDI de WinBox |
| Messages `WinBoxImpl,ERR: too big msg size` | Lecture HTTP à taille limitée, vérification des réponses, préservation de l'état en cas de source partielle | `network-connector/routeros/bounded-response.mjs`, `network-connector/agent.mjs` | Protocole HTTP public et implémentation indépendante, pas le format binaire privé WinBox |
| `WboxSession` / `WinBoxConnection` | File d'opérations par routeur, autorisations par entreprise, suivi des commandes et acquittements connecteur | API réseau et agent préexistants de la PR #130 | Pas de parité avec le protocole privé WinBox |

### Contrat de sécurité des propriétés

Le connecteur ne transmet pas d'objet RouterOS brut. La liste des propriétés par chemin est définie dans `inventory-projections.mjs` et une sélection plus étroite dans `inspector-properties.mjs`. Le serveur refait une validation **par catégorie** dans `network-inventory-properties.ts` avant de stocker `network_observations.safe_properties`. Les propriétés sont un objet JSONB limité à 2048 octets. Les champs tels que `password`, `secret`, `private-key`, `comment`, scripts et exports bruts ne figurent pas dans le chemin de stockage.

La fonction SQL `public.network_inventory_search` est **SECURITY INVOKER** et ne contourne pas RLS. Elle exige les critères entreprise, routeur et catégorie, puis recherche les valeurs de `identity_key`, `client_label`, `ip_address` et `mac_address` en texte ; elle borne les termes à 64 caractères et les pages à 50 résultats. Le filtrage s'exécute dans PostgreSQL, et non par chargement massif dans le navigateur. Les recherches ne sont pas nécessairement insensibles aux accents selon la collation PostgreSQL.

La migration est additive et **n'a pas été appliquée à la base de production**. L'API de recherche indique une indisponibilité si la fonction SQL n'existe pas encore. Les agents RouterOS natifs et anciens sont compatibles au niveau de la forme de requête en omettant les propriétés, mais leur comportement sur une base migrée nécessite toujours une validation d'intégration.

### Vérifications à cinq niveaux

- Fichiers créés/modifiés et commits : vérifiés par GitHub, branche `codex/mikrotik-administration`.
- Tests Node : validations des projections, de la fonction de filtrage, des propriétés et de l'interface ; le workflow CI doit réussir pour le SHA considéré.
- PostgreSQL jetable : tests réels de la fonction invoker et de RLS avec deux entreprises fictives, pagination, IP/MAC, et limite de taille JSONB.
- Authentification navigateur et RouterOS CHR/physique : **non validés** pour cette tranche.
- Déploiement de production : **non réalisé**, PR maintenue en brouillon.

Les composants WinBox `TerminalView`, `WFileTransfer`, `Topology`, `WGraph` et les mécanismes de configuration modifiable/retour arrière restent des chantiers distincts : aucun terminal libre ni commande de configuration générique n'est activé par cette tranche.

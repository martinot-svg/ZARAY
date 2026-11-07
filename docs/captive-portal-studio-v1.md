# ZARAY · Captive Portal Studio · première intégration

## Ce qui est maintenant installé côté application

Le Studio des portails est accessible via `/portail/editeur` (entreprise et site dans l'URL).
Il étend le portail web existant `/wifi/<slug>?siteId=<uuid>` sans changer son formulaire de souscription ou sa logique de création de tickets.

- Huit variantes : Minimaliste, Premium, Corporate, Modern Tech, Résidentiel, Commercial, Élégant et Personnalisé.
- Textes, couleurs, arrondis, alignement, image de couverture, liens commerciaux et mentions légales.
- Aperçu réactif sur téléphone et ordinateur. **Aperçu non authentifiant**.
- Enregistrement d'un brouillon puis publication sur confirmation. Le brouillon **ne remplace pas** le design publié.
- Historique des versions publiées, restauration dans le brouillon (sans remplacer le public) et copie volontaire depuis la **version publiée** d'un autre site de la même entreprise.
- Retour au rendu existant tant qu'aucune version personnalisée n'a été publiée.
- L'identité publique du site (logo PNG/WebP transparent, nom et coordonnées) continue à provenir des réglages existants `ticket_templates` et de l'API d'identité du site.

## Base Supabase et isolation

Migrations additives et sans modification des dossiers de clients existants :
- `20261106151000_site_portal_studio.sql` — `site_portal_configs`, `site_portal_versions`, RPC atomiques publication/restauration.
- `20261106152000_site_portal_tenant_guard.sql` — deux triggers vérifiant `(company_id,site_id)` contre `sites`.

RLS activée, aucune permission directe `anon`/`authenticated`, service_role uniquement pour les tables et les RPC. L'API Next.js authentifie et autorise **owner/admin** de la même entreprise et du même site. Les révisions optimistes empêchent d'écraser silencieusement les changements d'un autre administrateur. L'API publique retourne seulement `published` du site actif d'une entreprise active ou en essai. Elle ne retourne ni brouillon ni jeton.

**Note sur les médias :** l'import de couverture est redimensionné localement en WebP, avec une limite stricte de taille. L'original n'est pas téléversé : il reste sur l'appareil de l'administrateur. Pour un archivage durable des originaux, prévoir une extension Supabase Storage privée avec versions et politiques dédiées.

## Procédure administrateur

1. Ouvrir ZARAY > Portail captif > **Studio des portails**.
2. Choisir l'entreprise et le site, puis un modèle.
3. Adapter le titre, les couleurs, l'image et les parcours visibles.
4. Cliquer **Enregistrer** ; un simple brouillon est créé.
5. Prévisualiser sur les tailles mobile et ordinateur. Vérifier lisibilité, image, lien compte et consentement.
6. Cliquer **Publier**, puis confirmer. Seul le site choisi reçoit la nouvelle version publique.
7. Si nécessaire, sélectionner une ancienne version et la **Restaurer dans le brouillon**. Elle n'est publique qu'après une nouvelle publication confirmée.

Les options d'affichage désactivent les liens visibles, **pas les autorisations réseau ou l'accès aux API métiers**. Le constructeur visuel n'a aucun accès au routeur ni à ses secrets.

## Mode préparation sans MikroTik

En l'absence de routeur, ZARAY fonctionne comme outil de préparation :
- chaque entreprise et chaque site peut configurer et publier son portail web ;
- la page publique du site peut présenter les offres et l'inscription résidentielle (sans prétendre authentifier un ticket sur un routeur absent) ;
- dans **Tickets > Générer**, le choix de l'entreprise, du site, de l'offre et du modèle existant affiche un **aperçu fictif** ; le même écran permet un PDF de démonstration de 1 à 99 tickets ;
- les identifiants de démonstration sont fixes (`DEMO / 0000`) et tous les visuels, y compris les pages PDF, portent la mention **DÉMO — NON VALABLE** ;
- aucun ticket réel ni aucune commande réseau n'est créé par cet aperçu, et aucun stock ni abonnement n'est altéré ;
- la génération de vrais tickets, leur vente et leur authentification restent strictement liées à un MikroTik actif et à son connecteur.

Cet aperçu ne remplace pas l'activation sur MikroTik, ne crée pas de client et ne confère aucun droit d'accès Internet. Il reste intégré au module **Tickets**, sans créer de module Planche A4 indépendant.

## Préparation de l'installation MikroTik

Le Studio des portails contient désormais un volet **Installation MikroTik · état du site** :
- état de la publication web du site ;
- équipements associés au **même site et à la même entreprise** (une réponse périmée d'une autre entreprise n'est jamais affichée) ;
- état de connexion du connecteur observé par ZARAY, sans déduire la présence du HTML sur le routeur ;
- accès direct au module de réseau préfiltré sur ce site et au générateur existant de `login.html` ;
- téléchargement de `api.json` pour la détection du HotSpot sur les terminaux compatibles.

Les fichiers RouterOS restent à installer **dans le dossier HTML du serveur HotSpot concerné**, après sauvegarde :
- `login.html` : export ZARAY personnalisé sur le dernier design publié ; il conserve les macros RouterOS et l'authentification locale CHAP/HTTPS.
- `md5.js` : conserver **le fichier RouterOS d'origine** et les autres fichiers natifs nécessaires ; ne pas le supprimer.
- `api.json` : modèle natif avec `$(if logged-in ...)` et `$(link-login-only)` ; facultatif si un fichier équivalent et fonctionnel existe déjà dans le routeur. Il est intentionnellement invalide en JSON brut, car les macros sont rendues par RouterOS.

En cas de plusieurs HotSpots, veiller à ce que le bon profil pointe vers le dossier HTML de **ce** site. Ne jamais écraser le dossier d'un autre site sans validation. La détection DHCP du portail (`/api`) nécessite, sur RouterOS compatible, un DNS HotSpot et un certificat HTTPS valide pour ce nom. Il faut configurer le walled-garden sur les seuls services distants réellement nécessaires, sans ouvrir toute la navigation non authentifiée.

**Important :** un connecteur « en ligne » prouve uniquement que le connecteur a contacté ZARAY récemment. Cela ne prouve ni que `login.html` a été transféré ni qu'un client peut accéder à Internet. Sans MikroTik enregistré, la seule préparation possible est l'export des fichiers et la configuration du site.

Référence MikroTik : https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot+-+Captive+portal

## Export natif MikroTik

1. Depuis **Tickets Wi-Fi > Personnalisation**, sélectionner le même site et *Tous les forfaits du site*.
2. Cliquer **Télécharger la page MikroTik** : l'export intègre le dernier design **publié** du site, et non ses modifications en attente.
3. Installer `login.html` dans le dossier du serveur Hotspot avec le `md5.js` RouterOS et conserver les pages natives nécessaires.
4. Vérifier les DNS, profils Hotspot, HTTPS ou CHAP et l'accès pré-authentification aux seules URL nécessaires (walled garden), sans ouvrir Internet en général.
5. Faire une connexion **réelle** avec un ticket provisionné. Seul le résultat MikroTik, et non la validation HTML, confirme l'accès Internet.

Une publication dans Vercel ne remplace **jamais automatiquement** les fichiers d'un routeur privé. Si le routeur n'est pas raccordé, le nouveau design est publié sur le portail web mais doit encore être installé localement.

## Tests et critères

- `tests/site-portal-studio.test.mjs` : publication, RLS, isolation, modes, support natif CHAP/HTTPS et absence de clés.
- CI GitHub : suite complète Node, `npm run typecheck`, `npm run build`.
- Contrôle SQL Supabase : RLS, privilèges de lecture/publication des rôles et deux gardes de tenant.
- À vérifier sur téléphone : modèle mobile, clavier, faibles débits, 320 px de largeur et navigateur captif Android/iOS.
- À vérifier sur équipement MikroTik : erreur d'identifiants, authentification CHAP, redirection après connexion, mauvaise connexion DNS, absence d'API catalogue et restauration après coupure.

## Fonctionnalités du cahier des charges encore à compléter

Le Studio est une **première intégration**, pas la totalité des 14 modules :
- formulaire résidentiel à champs reconfigurables et vérification réelle du téléphone ;
- API de création manuelle de clients (actuellement volontairement `410`), audit et autorisations ;
- espace résidentiel enrichi : factures, assistance, profil et réinitialisation des accès ;
- archivage séparé des originaux de médias dans Storage et correction manuelle ;
- synchronisation automatique de fichiers avec les routeurs MikroTik associés, vérification physique complète ;
- étude de la validation et du déploiement massif de portails.

Ces chantiers devront être développés sans modifier arbitrairement les abonnements et données de production.

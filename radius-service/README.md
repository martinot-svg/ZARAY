# ZARAY — Fondations FreeRADIUS / Hotspot / PPPoE

Ce dossier n'est **pas** un serveur RADIUS autonome : le vrai serveur réseau est
FreeRADIUS 3.x, installé sur un hôte permanent et privé, **hors Vercel**.
Le fichier `bridge.mjs` est seulement la passerelle HTTP locale FreeRADIUS → API ZARAY.
Aucun routeur n'est modifié automatiquement par ce code.

## Ce qui fonctionne dans le code

1. La page API `/api/network/radius/gateway` délivre une clé distincte par routeur
   (à usage d'affichage unique) au propriétaire de l'entreprise. **La passerelle
   reste désactivée par défaut.** Une rotation remplace la clé et remet l'état
   à `enabled=false`.
2. `/api/network/radius/credentials` permet à un propriétaire/administrateur de
   préparer un secret PAP de 12 à 128 caractères pour un compte réseau existant.
   Seule une dérivation scrypt + sel aléatoire est stockée dans Supabase.
3. `/api/network/radius/auth` vérifie le jeton de passerelle, le routeur,
   l'entreprise et le site actifs, les droits réseau, la période de validité,
   l'absence de suspension, la commande payée et le mot de passe.
   Réponses : 204 acceptée, 401 refusée, 503 indisponible. Si la passerelle
   n'est pas explicitement activée, **toutes** les authentifications sont refusées.
4. `bridge.mjs` relaie, depuis `127.0.0.1`, les requêtes PAP vers ZARAY en
   HTTPS; il échoue fermé si l'API distante est indisponible.

## Mise en service (non effectuée)

- Prévoir un hôte permanent avec Node.js 22+, FreeRADIUS 3.x avec `rlm_rest`,
  un réseau privé entre NAS MikroTik et serveur FreeRADIUS, et HTTPS sortant vers ZARAY.
- Appliquer la migration `20261109113000_radius_gateway_credentials.sql`,
  **après** revue des règles RLS et tests, puis créer une passerelle depuis
  l'API propriétaire.
- Placer les variables de `.env.example` dans la configuration privée du service
  et lancer `node radius-service/bridge.mjs` sous supervision systemd.
  Ne pas placer la clé RADIUS ou les mots de passe dans Git, les variables
  `NEXT_PUBLIC_` ou une capture d'écran.
- Adapter les trois exemples `freeradius/*.example` à la distribution installée.
  Configurer seulement des NAS MikroTik connus, un secret RADIUS fort par NAS,
  pare-feu limité et tests PAP. **Aucune configuration n'est copiée automatiquement.**
- Vérifier les règles RouterOS de l'authentification Hotspot/PPP et la priorité
  des comptes locaux, puis tester le refus, l'expiration, la suspension et la
  reprise sur un routeur de test avec des comptes dédiés.
- Ajouter dans une étape ultérieure le processus de mise en service propriétaire
  et le commutateur contrôlé de `network_radius_gateways.enabled` après validation
  d'un serveur RADIUS opérationnel. Aucun endpoint d'activation n'est fourni ici.

## Limites volontaires

- **PAP uniquement**. CHAP, MS-CHAP, EAP, 802.1X et RadSec ne sont pas
  pris en charge par cette première passerelle.
- Les comptes RADIUS préparés sont des comptes résidentiels
  `network_access_accounts`; les tickets Wi-Fi MikroTik existants continuent
  d'utiliser leur provisionnement local, sans migration automatique.
- Pas de collecte RADIUS accounting, pas de CoA, pas de quota RADIUS dynamique,
  pas d'attribut MikroTik-Rate-Limit, pas de haute disponibilité ni garantie
  de performance sous forte charge.
- La perte de liaison Internet entre la passerelle et ZARAY refuse les **nouvelles**
  authentifications. Les sessions déjà actives restent régies par MikroTik.
- Ne jamais déclarer l'accès Internet effectif sur la seule base d'un succès HTTP :
  seul le routeur après test de bout en bout en apporte la preuve.

Documentation : https://manual.mikrotik.com/docs/authentication-authorization-accounting/radius/
et https://networkradius.com/doc/current/raddb/mods-available/rest.html

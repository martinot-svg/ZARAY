# M'lay Connexion — Accès distant privé au compte abonné (préparation)

## Objectif et limites

- **Sur le Wi-Fi** : `http://mlayconnexion.mg` reste l'adresse du portail captif HTML installé dans le HotSpot MikroTik.
- **Depuis l'extérieur via VPN** : `https://compte.mlayconnexion.mg` doit pointer vers un **serveur applicatif interne**, qui héberge l'espace résidentiel existant de ZARAY en marque blanche.
- **Sans VPN** : les adresses locales ne sont pas accessibles depuis l'Internet public et n'apparaissent pas dans le DNS public.
- La saisie du nom dans ZARAY **ne configure ni le routeur, ni l'hébergement, ni le TLS**. Le support serveur a été préparé, mais n'est pas déployé sur l'infrastructure locale.

L'espace abonné existe déjà dans Next.js sur `/mon-internet/[siteId]` (connexion par OTP e-mail, abonnements, historique de paiement et notifications), avec contrôle de l'adresse e-mail confirmée et du site du client. Consommation et débit ne sont pas disponibles sans collecte réseau.

## Architecture à configurer

1. Un serveur local (petit PC, VM ou mini-ordinateur) héberge l'application Next.js et reste disponible 24 h/24. Conservez les variables d'environnement Supabase côté serveur, en particulier toute clé de service. La version locale doit être installée, mise à jour et maintenue ; le MikroTik seul ne remplace pas ce serveur.
2. Un proxy HTTPS local, placé devant le serveur, répond à `compte.mlayconnexion.mg` et conserve l'en-tête `Host`. **Ne transmettez pas HTTP ni les codes OTP en clair sur le réseau local.** Puisque `.mg` n'est pas enregistré, une autorité de certification publique ne pourra généralement pas valider ce nom. Utilisez un certificat d'autorité privée installé explicitement et approuvé sur les appareils autorisés, ou enregistrez un domaine si vous voulez du HTTPS public standard.
3. Le MikroTik résout `mlayconnexion.mg` vers l'adresse HotSpot et `compte.mlayconnexion.mg` vers le serveur HTTPS interne. **Ce sont deux services distincts.**
4. Un tunnel WireGuard attribue à chaque appareil autorisé une clé de pair et une IP VPN individuelles, avec accès strictement limité au DNS du routeur et au port HTTPS du serveur local. Ne joignez pas par défaut l'interface WireGuard à la liste `LAN` et n'exposez pas WinBox, SSH ou l'API RouterOS aux abonnés.
5. Le terminal distant doit obtenir le DNS privé via WireGuard. Le serveur WireGuard doit être joignable depuis Internet (IP publique/IPv6, port UDP acheminé, ou relais VPN maîtrisé). **Une connexion CGNAT sans accès entrant nécessite un relais ou une autre solution de connectivité.**

## Préparation RouterOS 7 — exemples à adapter, pas de déploiement automatique

Les adresses ci-dessous sont **des exemples non vérifiés**, à adapter à la topologie réelle : réseau VPN `10.79.66.0/24`, routeur WireGuard `10.79.66.1`, serveur applicatif `192.168.88.10`, port UDP `51820`.

Vérifier **avant** toute commande les sous-réseaux déjà utilisés, la politique de pare-feu, les interfaces et les profils HotSpot. Sauvegarder la configuration RouterOS. La création du réseau VPN ne doit pas perturber les clients Wi-Fi existants.

### Étapes non destructives

```routeros
/interface wireguard add name=wg-abonnes listen-port=51820 disabled=yes
/ip address add address=10.79.66.1/24 interface=wg-abonnes
/interface wireguard print detail where name=wg-abonnes
```

L'interface est créée **désactivée** pour éviter une activation incomplète. Configurez ensuite un pair pour **chaque** appareil avec sa clé publique et une IP /32 unique, par exemple :

```routeros
/interface wireguard peers add interface=wg-abonnes public-key="<CLÉ_PUBLIQUE_APPAREIL>" allowed-address=10.79.66.2/32 comment="Appareil client autorisé"
```

Ne copiez jamais une clé privée dans ZARAY, GitHub, un ticket ou un journal applicatif.

### DNS privé

Le serveur doit être accessible depuis le LAN et depuis les pairs WireGuard autorisés. Sur le MikroTik (si son DNS interne est utilisé) :

```routeros
/ip dns static add name=compte.mlayconnexion.mg address=192.168.88.10 ttl=5m
```

Le nom du portail captif `mlayconnexion.mg` reste géré par le profil HotSpot existant. Les clients VPN doivent utiliser le DNS du routeur (par exemple `10.79.66.1`), avec des règles de pare-feu **limitées aux pairs autorisés** pour UDP/TCP 53. N'autorisez **jamais** les requêtes DNS arbitraires depuis le WAN.

### Pare-feu à valider avant activation

- Autoriser **uniquement** le port UDP WireGuard choisi depuis l'extérieur.
- Autoriser sur l'interface `wg-abonnes` seulement DNS UDP/TCP 53 vers le routeur et HTTPS TCP 443 vers le serveur de compte ; bloquer le reste (notamment WinBox/SSH/REST/SMB).
- Laisser le pare-feu administrateur et la configuration HotSpot inchangés.
- Activer le serveur VPN **seulement** après validation des règles, de l'endpoint, du certificat HTTPS et du DNS.

Le navigateur distant ouvre `https://compte.mlayconnexion.mg` **après activation de WireGuard**, puis se connecte avec l'e-mail enregistré et son code OTP. OTP exige un accès Internet sortant au service d'authentification Supabase : **le domaine n'est pas public, mais le backend n'est pas entièrement hors ligne**.

## Vérification de mise en service

- Avec VPN **désactivé** depuis un autre réseau, le nom privé ne doit pas résoudre vers le serveur.
- Avec VPN **activé**, le nom doit résoudre en IP interne et la page doit utiliser un certificat TLS approuvé par le navigateur.
- L'écran affiche uniquement l'identité graphique du fournisseur ; aucune page administrative n'est accessible depuis ce domaine.
- Les codes OTP ne donnent accès qu'au dossier du client vérifié et rattaché au bon site.
- Les sessions et notifications restent propres au site ; tester aussi qu'un autre abonné/une autre entreprise n'accède à aucune donnée.
- Le routeur MikroTik et son API d'administration restent inaccessibles au VPN client.

Sources techniques : [MikroTik WireGuard](https://help.mikrotik.com/docs/spaces/ROS/pages/69664792/WireGuard), [MikroTik DNS](https://help.mikrotik.com/docs/spaces/ROS/pages/37748767/DNS).

**État :** routage applicatif préparé dans GitHub ; aucun WireGuard, DNS de routeur, serveur local ni certificat TLS configuré à distance depuis ZARAY.

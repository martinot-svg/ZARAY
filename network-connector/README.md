# ZARAY Network Connector

Install this service on a host within the same private network as the MikroTik. Outbound HTTPS connectivity to ZARAY is required. The host must trust the RouterOS HTTPS certificate.

Node.js 22 or later is required. See the environment variable example in this folder. Pair once with the router-specific code from ZARAY.

## Mise en service sécurisée (RouterOS 7, sans ouverture WAN)

- Installer Node.js 22+ sur un hôte **du réseau local** accessible au MikroTik.
- Créer dans ZARAY le routeur associé au site réel, puis générer un code d'appairage valable 15 minutes (usage unique).
- Configurer les paramètres de `network-connector/.env.example` dans un fichier privé, jamais dans Git.
- Activer RouterOS `www-ssl` avec un certificat vérifiable. Importer la CA côté connecteur via `NODE_EXTRA_CA_CERTS` si nécessaire. Ne jamais utiliser `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Employer un compte RouterOS distinct limité au strict minimum : `api,rest-api,read,write`, selon les opérations activées. Éviter les groupes `full` et `sensitive` si non nécessaires. Restreindre les IP sources à la machine du connecteur, avec pare-feu.
- Le connecteur vérifie d'abord l'HTTPS et l'accès de lecture au routeur, puis consomme son code d'appairage et conserve une clé secrète locale (0600).
- Démarrer `node network-connector/agent.mjs` avec des variables d'environnement locales sécurisées. Il communique **uniquement en sortie** vers ZARAY, sans publication de l'API RouterOS sur Internet.
- Les commandes restent désactivées côté ZARAY jusqu'à activation explicite du contrôle. Une commande n'est réputée exécutée qu'après acquittement.
- En cas de perte de connexion, le connecteur réessaie automatiquement le cycle; les accusés de résultat sont réessayés trois fois. Surveillez les commandes non acquittées et réconciliez-les manuellement si le processus s'arrête brutalement.

Documentation officielle : https://manual.mikrotik.com/docs/developer-guides/rest-api/

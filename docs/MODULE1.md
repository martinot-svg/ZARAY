# Module 1 — inscription d'entreprise (phase 1)
## Implémenté en code (à tester après configuration)
- Inscription d'un administrateur via Neon Auth : /inscription
- Connexion : /connexion
- Création de société authentifiée : /entreprises/nouvelle
- POST /api/companies vérifie la session et l'email confirmé, puis crée atomiquement société, membre propriétaire et journal d'audit.
- Durée d'essai : 31 jours calculés par PostgreSQL.

## Prérequis de déploiement
1. Approuver la migration préparée sur la branche Neon temporaire avant de toucher production.
2. Ajouter sur Netlify (secrets non publics) DATABASE_URL, NEON_AUTH_BASE_URL et NEON_AUTH_COOKIE_SECRET (aléatoire, 32+ caractères).
3. Autoriser https://zaray01.netlify.app dans les domaines approuvés de Neon Auth.
4. Vérifier email verification, sessions et login dans le navigateur.
5. Tester permissions inter-entreprises et erreurs/rollbacks.
6. Ne pas fusionner sur main avant tests CI et configuration sécurisée.
7. Les services réseau et les paiements ne sont pas connectés.

## Sécurité
- Pas de secret dans Git.
- Le backend seul détient la connexion SQL.
- Tables RLS et droits PUBLIC révoqués.
- L'endpoint générique GET /api/companies n'expose aucune donnée.
- Vérifier MFA, limitation de débit et protection anti-abus avant commercialisation.
- Aucun accès Wi-Fi ni paiement créé implicitement.

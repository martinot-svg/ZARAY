# Zaray V1.0 — Plan technique

## Socle
- Next.js / TypeScript hébergé sur Vercel.
- GitHub comme source de code et de versions.
- Supabase Auth et PostgreSQL comme services de données.

## Priorités
1. Vérifier les builds TypeScript et Next.js dans CI.
2. Intégrer le logo officiel Zaray comme asset.
3. Vérifier le schéma PostgreSQL multi-tenant, les fonctions transactionnelles et les politiques RLS.
4. Finaliser les rôles, l'inscription et la gestion des entreprises.
5. Développer les flux Wi-Fi, paiements vérifiés et activation RADIUS séparément, avec tests et observabilité.
6. Intégrer tickets, comptabilité et CRM avec traces vérifiables.

## Règles non négociables
- Aucun accès cross-tenant; contrôler les permissions côté serveur et dans RLS.
- Aucun accès Internet activé par un paiement en attente, échoué ou non vérifié.
- Aucun secret dans GitHub ni dans les variables publiques Next.js.
- Les acheteurs de tickets occasionnels n'ont pas besoin d'un compte résidentiel.
- Le personnel admin est distinct des comptes clients du portail captif.
- Ne pas présenter les écrans statiques comme des fonctionnalités en production.
- Ne pas insérer de données fictives en production.

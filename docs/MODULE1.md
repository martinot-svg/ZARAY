# Module 1 — inscription d'entreprise (Supabase)

## Flux dans le code
- Inscription et connexion via Supabase Auth : `/inscription` et `/connexion`.
- Création d'entreprise authentifiée via `POST /api/companies`.
- Création atomique de l'entreprise, du propriétaire et de l'entrée d'audit par une fonction PostgreSQL restreinte.
- Création et modification des sites par fonctions PostgreSQL qui vérifient l'appartenance et le rôle.
- Essai : 31 jours calculés par PostgreSQL.

## Configuration requise
1. Appliquer la migration `db/migrations/0001_module1_companies.sql` au projet Supabase cible.
2. Configurer `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `NEXT_PUBLIC_APP_URL` dans Vercel Production.
3. Configurer l'URL de production et les URL de redirection autorisées dans Supabase Auth.
4. Vérifier inscription, confirmation e-mail, connexion et permissions entre entreprises avant de déclarer le module opérationnel.

## Sécurité
- Les tables métier activent RLS; les utilisateurs ne lisent que leurs entreprises et sites.
- Les mutations vérifient `auth.uid()`, l'appartenance et le rôle; leur exécution est réservée au rôle `authenticated`.
- Aucun secret de service_role n'est envoyé au navigateur.
- Aucune donnée de démonstration n'est insérée par la migration.
- Les paiements, services réseau et RADIUS ne sont pas encore connectés.

# Z’Alliance — état d’intégration et prérequis de mise en service

## Audit du code existant (27 octobre 2026)
- Auth Supabase SSR (session signée, compte avec e-mail confirmé).
- Tables référencées par les migrations GitHub : `company_members`, `company_invitations`, `audit_logs`.
- Invitations : RPC existante `create_company_invitation(company_id,email,role)` (propriétaire/administrateur seulement). Les administrateurs ne peuvent pas attribuer `admin` ni `finance`. Identifiants et rôle vérifiés dans la RPC, et non dans le seul navigateur.
- Acceptation : RPC `accept_company_invitation(invitation_id)` : correspondance d'e-mail confirmé, invitation en attente non expirée, verrou `FOR UPDATE` et insertion protégée de l'appartenance. Le destinataire doit ouvrir `/invitations` connecté.
- Liste des membres : RPC `list_company_members`.
- Journal : RPC `list_company_audit_logs` (limité à 50 événements par appel).
- **Aucun envoi d'e-mail dans le flux existant `/api/company-members` : une création d'invitation NE représente PAS un envoi.**
- **Aucun jeton d'acceptation secret généré et envoyé** dans ce flux. L'identifiant UUID d'invitation n'est pas un jeton à forte entropie destiné aux liens d'e-mail.
- La migration `db/migrations/0004_company_members_rbac_audit.sql` définit une invitation par entreprise et adresse, avec `expires_at`, et statut pending/accepted/revoked/expired ; aucune route de renvoi ou révocation n'existe actuellement.
- L'accès au Supabase de production n'a PAS été possible dans cette session (connecteur indisponible). Les schémas/RLS/migrations exécutés en production ne sont donc **pas vérifiés**, et aucun test réel avec deux comptes n'a été effectué.

## Portée de cette branche
- Remplacement « Inviter un collaborateur » par « Z’Alliance » et icône Lucide UsersRound dans le menu de profil, tout en conservant « Quitter mon espace ».
- Route authentifiée `/z-alliance` avec en-tête, bouton de fermeture et sections : formulaire d'invitation, créations visibles dans l'audit, membres actifs.
- Entreprises accessibles : uniquement celles autorisées en `owner`/`admin`; rôles proposés adaptés au rôle et revérifiés par la RPC.
- Création via l'API et la RPC existantes, avec validation e-mail, verrou anti-double-clic et résultat explicite : **enregistrée, aucun e-mail automatique envoyé**.
- Journal des créations : n'affiche jamais « envoyée » ni « acceptée » à partir du journal seul. Le journal peut être incomplet (limite de 50). Liste membres actifs issue de la RPC existante, sans faux exemples.
- L'acceptation par adresse confirmée reste disponible via `/invitations`.
- Aucune migration, clé d'administration ou politique RLS modifiée.

## Bloqueurs avant un parcours complet réellement opérationnel
1. **Connecter le projet Supabase ZARAY** et auditer en direct tables, indexes, rôles, RLS, RPC `SECURITY DEFINER`, grants et migrations déployées. Le SQL GitHub n'est pas la preuve du schéma réel.
2. **Configurer/identifier un fournisseur d'e-mails transactionnels** côté serveur, définir l'URL publique/allow-list et vérifier le SMTP. Ne pas mettre de secret dans `NEXT_PUBLIC_*`.
3. **Concevoir une migration reviewée** pour les jetons secrets stockés sous forme condensée, usages uniques/expiration atomique, idempotence, tentatives et états d'envoi, et une RPC de liste/historique envoyée autorisée et paginée.
4. **Implémenter** la génération des liens, le contenu d'e-mail, une route d'acceptation non destructive au GET, l'acceptation atomique, réémission/révocation, les contrôles d'accès par entreprise, le suivi des échecs d'e-mail et le rate limiting.
5. **Tester le parcours complet** avec des comptes de test et une boîte e-mail de test : invitation, délivrabilité, première inscription, acceptation vérifiée, lien expiré/révoqué/consommé, acceptations concurrentes, accès entre tenants, droits supérieurs, erreurs fournisseurs.
6. Confirmer les décisions de produit sur la révocation et la suppression/suspension de membres ; ne jamais supprimer le compte global par retrait local.
7. Exécuter les migrations via le workflow contrôlé du projet après sauvegarde, vérification des advisors et validation des tests.
8. Après seulement, activer le libellé « Envoyer l’invitation » et les statuts « envoyée » / « échec d’envoi ».

## Condition de lancement
Ne pas fusionner cette PR comme une fonctionnalité d'envoi prête à l'emploi ; elle est une **fondation UI et une intégration partielle explicite**. Les tests CI valident le code, pas l'envoi, l'acceptation réelle ou le schéma en production.

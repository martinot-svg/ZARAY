# Zaray V1.0 — Plan technique

## État de cette branche

Socle Next.js / TypeScript et page de présentation du périmètre fonctionnel. Aucun module métier, compte client, paiement ou accès réseau réel n'est encore connecté.

## Prochaines étapes prioritaires

1. Faire passer les vérifications TypeScript et build CI.
2. Fournir et intégrer le logo officiel Zaray comme asset (ne pas le remplacer par une marque fictive).
3. Définir le schéma PostgreSQL multi-tenant et les politiques d'isolement.
4. Implémenter l'identité des opérateurs, les rôles et l'inscription des entreprises.
5. Implémenter les flux résidentiels via portail captif puis paiements vérifiés et activation RADIUS en environnement de test.
6. Intégrer tickets, comptabilité et CRM avec traces vérifiables, tests et observabilité.

## Règles non négociables

- Aucun accès cross-tenant; contrôler les permissions côté serveur.
- Aucun accès Internet activé par un paiement en attente, échoué ou non vérifié.
- Aucun secret dans GitHub ni dans les variables publiques Next.js.
- Les acheteurs de tickets occasionnels n'ont pas besoin d'un compte résidentiel.
- Le personnel admin est distinct des comptes clients inscrits au portail captif.
- Ne pas présenter les maquettes ou écrans statiques comme des fonctionnalités en production.

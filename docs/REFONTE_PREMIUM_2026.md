# ZARAY — Couverture de refonte premium (suivi vérifiable)

Statut : **fondations premium et parcours publics interactifs intégrés sur branche ; vérification CI et déploiement à confirmer.**

## Objectif
Trois compositions par appareil (desktop, tablette, smartphone), un seul modèle de données Supabase et une seule logique métier. Préserver les politiques RLS, les parcours authentifiés et les documents imprimables.

## Périmètre inventorié dans src/app
- Public : /, connexion, inscription, mot-de-passe-oublie, reinitialiser-mot-de-passe.
- Compte : mon-compte, entreprises, finance-globale, invitations, z-alliance.
- Entreprise : tableau-de-bord, sites, membres, clients, offres, commandes.
- Opérations : tickets, personnalisation-tickets, caisse, paiements, paiement, autorisations-paiement, parametres-paiement, portail.
- Infrastructure transversale : layout, api, error, shell personnel, shell entreprise et composants UI.

## Matrice qualité (réalisation initiale)

| Composant / parcours | Entrée | Interaction | État / sortie | Desktop | Tablette | Mobile | Réduction des mouvements | Validation |
|---|---|---|---|---|---|---|---|---|
| Landing / Hero et visite interactive | Atmosphère, révélation et scènes commutables | Scènes pilotage, clients, Wi-Fi, finance, trois appareils | Aucun blocage | Spatial | Adaptatif | Composition compacte | Animations supprimées | Code intégré, visuel non vérifié |
| Landing / Cartes | Révélation au scroll selon support | Élévation sur survol | Retour au repos | 3 colonnes selon styles existants | Grille existante | Mono-colonne existante | Sans animation | Code intégré, visuel non vérifié |
| Espace entreprise / KPI | Pas d'entrée opaque | Survol | Indicateurs réels conservés | Espacé | 2 colonnes | 2 colonnes | Sans animation | Code intégré, données non testées |
| Formulaires / Champs | Sans animation bloquante | Focus visible | Validations métier inchangées | Contrôles existants | Contrôles tactiles | Hauteur min. 44px | Transitions supprimées | Code intégré, test de parcours non fait |
| Tableaux | Immédiate | Survol de ligne | Données inchangées | Grille | Débordement maîtrisé | Défilement horizontal | Transitions supprimées | Code intégré, visuel non vérifié |
| Menu entreprise | Existant | Ouverture / fermeture | Exit existant | Dropdown | Dropdown | Largeur contrainte | Styles sans transition | Test clavier à faire |
| Tickets Wi-Fi / reçus | Sans changement de logique | Actions existantes | Mise en page imprimable inchangée | Original | Original | Original | Aucune animation à l'impression | PDF à vérifier |
| Parcours authentifiés, actions serveur | Existant | Existant | Existant | À auditer | À auditer | À auditer | À auditer | Non validé |
| Modes clair / sombre | Existant | Existant | Existant | À auditer | À auditer | À auditer | À auditer | Non validé |

## Barrière de publication
1. Cartographier tous les composants UI et états (vide, erreur, succès, chargement).
2. Tester à 390px, 768px, 1024px et 1440px en clair et sombre, y compris clavier et reduced-motion.
3. Contrôler tous les parcours authentifiés avec comptes de test autorisés à plusieurs entreprises, RLS et absence de fuite inter-entreprises.
4. Exécuter `npm run typecheck`, `npm run build`, tous les scripts `test:*` et contrôler les PDF imprimés.
5. Vérifier le SHA exact déployé sur Vercel, le domaine de production et les erreurs observées.

**Ne pas annoncer une refonte intégrale ou une validation de production tant que ces lignes ne sont pas closes.**

## Implémentation de cette branche
- Un tour interactif public, sans fausses données, à trois mises en page conceptuelles.
- Navigation tactile dédiée au compte personnel et à l'espace entreprise, avec liens contextualisés par entreprise et site.
- Couche CSS séparée de la base métier et des styles historiques pour limiter les régressions.
- Fondations de matériaux, profondeur, motion progressive, styles d'état et exception d'impression.
- Tests source de non-régression `tests/premium-experience.test.mjs` exécutés par la CI.

## Limites qui empêchent encore l'appellation de refonte intégrale
- Les parcours authentifiés et les états de chaque module doivent être inspectés visuellement sur les trois appareils.
- Les thèmes clair/sombre complets, le rendu réel des tickets/PDF, les autorisations multi-entreprises et le fonctionnement réseau effectif ne peuvent pas être certifiés par les seuls tests source.
- Sans preuve de validation visuelle et authentifiée, aucun passage de la matrice à « terminé » n'est autorisé.

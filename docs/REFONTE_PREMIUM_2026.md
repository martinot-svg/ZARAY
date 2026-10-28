# ZARAY — Couverture de refonte premium (suivi vérifiable)

Statut : **fondations intégrées sur branche ; refonte complète non terminée**.

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
| Landing / Hero | Atmosphère et révélation | CTA existants | Aucun blocage | Spatial | Adaptatif | Composition compacte | Animations supprimées | Code intégré, visuel non vérifié |
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

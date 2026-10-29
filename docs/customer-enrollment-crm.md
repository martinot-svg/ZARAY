# ZARAY — Alimentation automatique du module Clients

## Règle métier
Le module **Clients** ne possède plus de création manuelle. Un futur client résidentiel se présente sur le portail public de son fournisseur (`/portail/<slug>`), choisit un forfait puis remplit le formulaire **Inscription client résidentiel** (nom, e-mail, téléphone facultatif). La création de la demande d'abonnement, via `create_public_subscription_order`, insère la fiche CRM dans **la même transaction SQL** au moyen du trigger `subscription_order_enroll_customer`.

- Un client = une fiche par **entreprise + adresse e-mail normalisée**.
- Les commandes successives du même inscrit référencent la fiche par `subscription_orders.customer_id`. Les informations historiques de la fiche ne sont pas écrasées par une nouvelle commande anonyme.
- Les nouveaux inscrits sont visibles dans **Clients**, même quand leur site d'installation n'a pas encore été attribué (`site_id = NULL`).
- Le nom, le contact, le site et le statut de la fiche peuvent être corrigés par les rôles autorisés. La création manuelle (`POST /api/customers`) répond HTTP 410 ; le rôle `authenticated` n'a plus le droit SQL d'insérer directement dans `customers`.
- `/inscription` est conservé exclusivement pour la création du compte **administrateur ZARAY** ; cette inscription ne doit pas créer un client dans le CRM d'une entreprise.
- Les anciennes fiches éventuelles restent intactes. Les commandes historiques correspondant à un client existant peuvent être associées automatiquement.

## Sécurité et états
Cette inscription par formulaire public ne prouve pas que le visiteur détient l'adresse e-mail déclarée. Elle ne constitue pas non plus un paiement : la commande reste `pending_payment` et **n'active aucun accès réseau**. Les justificatifs Orange Money/MVola doivent toujours être validés par les personnes autorisées. Les fiches CRM actives ne doivent pas être confondues avec un abonnement Internet actif.

## Évolution distincte
Si ZARAY doit permettre aux clients résidentiels de posséder un **compte de connexion personnel vérifié par OTP**, de retrouver leurs factures et de renouveler sans saisir leurs coordonnées, il faudra ajouter une authentification client spécifique et un espace abonné, distinct de `/inscription` destiné aux administrateurs. Ce travail ne fait pas partie de cette migration.

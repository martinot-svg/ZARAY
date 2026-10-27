# Z’Alliance — état technique vérifié (27 octobre 2026)

## Accès et migrations
- Projet Supabase Zaray `hosyeygtaksbahnxxiqf` identifié et consulté directement.
- Tables existantes auditées : `companies`, `company_members`, `company_invitations`, `audit_logs`.
- **Migration `zalliance_secure_invitation_tokens` appliquée avec succès** au projet Supabase. Elle ajoute la génération de jetons aléatoires de 32 octets, le stockage du condensat SHA-256, les fonctions de prévisualisation, acceptation, émission, renvoi, révocation et suivi d'envoi.
- Droits SQL vérifiés : aucune nouvelle fonction d'invitation n'est exécutable par `anon` ; `zalliance_mark_delivery` est réservée au rôle de service.
- Le projet avait zéro invitation au moment de l'audit. Les anciennes données, entreprises et membres n'ont pas été supprimés.

## Code implémenté
- Menu profil `Z’Alliance` et route `/z-alliance`, navigation mobile et desktop.
- Liste des entreprises où le membre est propriétaire/administrateur, rôles réels `admin`, `site_manager`, `support`, `technician`, `sales`, `finance` limités par autorisation.
- API `/api/z-alliance` : lister, émettre, renvoyer, révoquer ; API de prévisualisation et acceptation vérifiée.
- L'acceptation exige une session authentifiée avec l'adresse e-mail confirmée correspondante et propose l'entreprise et le rôle au destinataire. Le jeton à usage unique est placé dans le fragment du lien et supprimé de l'URL visible au chargement.
- Livraison conditionnelle avec Resend (API HTTP) à partir de variables côté serveur uniquement. Les réponses signalent l'envoi accepté par le fournisseur, pas une réception effectivement garantie.
- En l'absence de fournisseur, Z’Alliance autorise seulement la création d'une invitation **sans e-mail**, avec un état explicite ; le destinataire peut consulter `/invitations` avec son compte vérifié. Aucune fausse confirmation d'envoi.

## Configuration encore nécessaire pour les e-mails
Les variables suivantes doivent être définies dans Vercel (production et prévisualisation) :
- `ZARAY_RESEND_API_KEY` : clé API créée dans un compte Resend autorisé ;
- `ZARAY_INVITE_FROM` : expéditeur vérifié, par exemple `no-reply@domaine-verifie` ;
- `NEXT_PUBLIC_APP_URL` : URL HTTPS publique déjà configurée.

Aucune clé Resend n'était présente dans les variables Vercel accessibles lors de l'audit. Impossible d'inventer une clé, de vérifier un domaine ou d'envoyer un message réel sans compte de messagerie transactionnelle actif.

## Vérification et risques
- Compilation Vercel de la branche réussie en prévisualisation.
- Migration réelle appliquée et droits des nouvelles fonctions vérifiés par SQL.
- Les tests de bout en bout nécessitent deux comptes de test et un destinataire e-mail réel : envoi/délivrabilité, inscription, expiration, double acceptation, rôles non autorisés, révocation et réémission.
- Le statut « envoi accepté » reflète la réponse du fournisseur, sans webhook de délivrabilité.
- Les politiques RLS des tables existantes restent inchangées ; les fonctions SECURTY DEFINER ont un contrôle explicite des rôles et de l'adresse confirmée.
- Le travail n'est **pas encore certifié prêt à une livraison par e-mail en production** faute de fournisseur configuré et de tests de livraison réelle.

## Publication
Tant qu'il n'y a pas de fournisseur transactionnel confirmé et de tests réels, garder cette fonctionnalité en prévisualisation, ou publier uniquement le mode « invitation enregistrée sans e-mail » avec avertissement explicite. Ne pas annoncer « e-mail envoyé » en l'absence de confirmation fournisseur.

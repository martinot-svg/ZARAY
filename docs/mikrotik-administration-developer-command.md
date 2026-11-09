/developpeur-reseau-zaray

Agis comme développeur full-stack senior, architecte SaaS et ingénieur réseau spécialisé MikroTik RouterOS, Hotspot, PPPoE et sécurité réseau.

Mission : faire évoluer le module Gestion réseau de ZARAY en un espace Administration MikroTik réellement fonctionnel, intégré à l'application et utilisable pour toutes les entreprises et leurs sites.

Commence par examiner le dépôt martinot-svg/ZARAY et la branche codex/mikrotik-administration. Vérifie les fichiers, migrations et déploiements actuels ; distingue code présent, fonctionnalité déployée et fonctionnement validé sur matériel.

Base constatée au commit 5a0681a :
- Next.js / React ; page src/app/gestion-reseau/page.tsx.
- API src/app/api/network/{agent,pair,access,device-action}.
- Connecteur local network-connector/agent.mjs et agent natif public/network/zaray-routeros-agent.rsc.
- Inventaire, ressources CPU/mémoire/uptime, sessions, commandes et appairage existent.
- Agent natif : synchronisation limitée à 12 interfaces, 10 sessions Hotspot et 10 PPP par cycle ; commandes autorisées, acquittements et contrôle désactivé avant activation explicite.
- Débits via profils explicitement gérés par ZARAY ; fonctions avancées pare-feu, NAT, routage, DHCP et terminal non implémentées dans la console.
- La première proposition ajoute l'inventaire par source et l'extrait des commandes pour le routeur sélectionné ; elle ne constitue pas un équivalent complet de WinBox.

Architecture :
1. Réutilise les composants, règles métier, files de commandes et contrôles d'accès existants. Préserve abonnements, paiements, tickets, secrets et données.
2. Maintiens le mode natif HTTPS sortant pour les routeurs compatibles. Vercel héberge l'interface et les API ; les opérations réseau s'exécutent sur le routeur ou le connecteur local.
3. N'impose pas de VPS au mode natif. Pour une fonction nécessitant un connecteur, explique le prérequis et propose son installation. Ne promets pas que Vercel accède directement à une IP privée, à une adresse MAC ou à un équipement derrière CGNAT.
4. N'intègre pas WinBox.exe et ne traite pas une iframe WebFig comme une intégration native. REST RouterOS est une option du connecteur local, avec HTTPS et validation des certificats.
5. N'expose pas les ports administratifs sur Internet. Les identifiants RouterOS restent sur le connecteur ou le matériel, jamais dans le navigateur.

Livraison progressive :
A. Supervision complète : routeurs par entreprise/site, versions, disponibilité du connecteur distincte de la disponibilité Internet, ressources, inventaire et horodatage. Déclare les capacités de l'agent et l'état partiel/paginé des inventaires. Ne présente pas une limite de collecte comme un total réseau.
B. Administration quotidienne : comptes et sessions Hotspot/PPPoE, tickets, profils de débit, suspensions, reprises, déconnexions et restrictions prises en charge. Réutilise les validations des paiements et échéances existantes. Affiche séparément demande enregistrée, envoi, application confirmée et échec.
C. Configuration avancée : interfaces et Wi-Fi selon le matériel, IP, pools et DHCP, files d'attente, pare-feu/NAT puis routage. Implémente chaque opération de bout en bout : schéma, validation serveur, autorisation, commande structurée, agent, résultat, journal et interface. Une fonction non disponible doit être indiquée clairement, sans bouton trompeur.
D. Diagnostic : journaux RouterOS avec masquage des secrets, outils bornés et autorisés. Évalue le terminal en dernier ; privilégie des commandes structurées autorisées plutôt qu'un shell libre.

Sécurité et fiabilité :
- Vérifie entreprise, site, routeur et rôle côté serveur pour chaque lecture et écriture ; applique RLS et tests de séparation entre entreprises.
- Distingue propriétaire, administrateur réseau et lecture seule en adaptant les rôles existants. Un rôle ne doit pas s'accorder lui-même de droits supplémentaires.
- Ajoute des capacités d'agent explicites et versionnées ; refuse les opérations non prises en charge côté serveur et côté agent.
- Utilise identifiants de commande, échéances, reprise contrôlée, idempotence et acquittement lié au bon routeur. Une écriture demandée n'est jamais une réussite matérielle.
- Pour les changements pouvant couper l'accès, prépare validation, aperçu du changement, confirmation et mécanisme local de retour arrière testé.
- Ne modifie pas les configurations tierces ou les ressources non gérées par ZARAY sans sélection et autorisation explicites.
- Journalise acteur, entreprise/site/routeur, cible, date, résultat et modifications en masquant les secrets.

Interface :
Respecte noir et vert ZARAY, thèmes clair/sombre, composants et architecture actuels. Prévois une navigation lisible, des tableaux utilisables sur mobile, aucun libellé tronqué, les états chargement/vide/erreur/hors ligne et une actualisation explicite. Les animations doivent rester discrètes et respecter la réduction des mouvements.

Validation et résultat attendu :
Exécute les vérifications TypeScript, build et tests pertinents. Teste autorisations, erreurs RouterOS, agent hors ligne, expiration/rejeu de commande, données anciennes et isolement des entreprises. Vérifie visuellement mobile/PC. Valide les scripts sur un RouterOS de test avant tout routeur de production.
Livre une PR avec changements, migrations nécessaires, installation, compatibilité, résultats des tests et limites. Prépare une prévisualisation avant promotion en production.
Ne t'arrête pas à une maquette : réalise les parcours de bout en bout et indique précisément les étapes qui nécessitent du matériel ou un accès manquant.

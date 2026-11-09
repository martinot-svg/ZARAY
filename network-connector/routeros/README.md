# ZARAY Native Network Engine — RouterOS 7

Ce moteur est un **script RouterOS** exécuté directement par le routeur via
`/system/script` et `/system/scheduler` toutes les minutes. Aucun processus
Node.js, VPS ni serveur FreeRADIUS n'est requis pour ce **mode natif**.
La plateforme ZARAY reste hébergée sur Vercel avec les données dans Supabase.

## Première mise en service

1. Sauvegardez la configuration RouterOS et vérifiez le matériel et la version
   de RouterOS 7. Il faut l'accès administrateur local, l'heure système
   synchronisée, DNS fonctionnel, HTTPS sortant vers `zaray.vercel.app:443`
   et la chaîne de certificats du site reconnue par RouterOS.
2. Dans ZARAY → Gestion réseau, **enregistrez** le routeur avec son site.
   Cliquez sur **Agent natif (.rsc)** et acceptez la réinitialisation explicite
   de l'ancien appairage. Cela **révoque** la clé Node.js existante et désactive
   le contrôle réseau. N'effectuez pas cette opération sur un routeur exploité
   sans préparation à cette transition.
3. Le navigateur télécharge un script `.rsc` **privé** contenant le code
   d'appairage à usage unique (valable 15 minutes). ZARAY n'enregistre pas ce
   fichier public avec le code. Ne le partagez pas.
4. Téléversez le fichier sur le routeur via WinBox Files ou un canal admin
   privé. Dans le terminal RouterOS, exécutez
   `/import file-name=zaray-native-<ROUTER_UUID>.rsc`, en remplaçant le nom
   par celui de votre fichier. Le script échange le code contre un jeton
   permanent stocké dans un **script de configuration RouterOS**, puis installe
   `zaray-native-cycle` et `zaray-native-minute`.
5. Supprimez immédiatement l'archive d'installation du routeur et du poste
   local. Restreignez l'accès administrateur aux scripts RouterOS : le jeton
   de connecteur est lisible par un administrateur disposant de droits suffisants.
6. Vérifiez dans Gestion réseau qu'une **synchronisation réellement reçue**
   affiche `Agent RouterOS natif` et une heure récente. Le scheduler peut être
   déclenché manuellement par `/system script run zaray-native-cycle`.
7. **Uniquement après vérification des comptes, droits et tests d'échec**,
   le dirigeant peut activer le contrôle sur le routeur depuis ZARAY.
   Jusqu'à cette action, l'agent est en lecture seule.

## Capacités de cette tranche

- Synchronisation HTTPS en sortie (validation de certificat obligatoire) de
  ressources système, interfaces, jusqu'à dix sessions Hotspot et dix sessions
  PPP, une fois par minute.
- Traitement uniquement après autorisation explicite : suspensions/reprises de
  **comptes Hotspot/PPP existants**, déconnexion de sessions, provisionnement
  et expiration des tickets Hotspot portant l'empreinte ZARAY.
- Comptes tiers protégés pour les **tickets** : si un nom existe avec un
  commentaire différent de `zaray:voucher:<uuid>`, la commande échoue.
- Appairage révocable, journalisation des échecs, réponse `result` envoyée
  à l'API. L'API vérifie les droits métier avant d'envoyer chaque commande.
- Aucun port d'administration RouterOS n'est exposé sur Internet.
- Pas de modification automatique de pare-feu, routes, ports ou DNS.

## Limites actuelles

**Ce code n'a pas été exécuté sur un routeur physique dans cette session.**
Un build Next.js et des tests de structure ne remplacent pas une validation
d'import RouterOS sur l'appareil cible.

- Le déclenchement dépend d'Internet sortant et de ZARAY disponible.
  En cas de coupure, les comptes déjà configurés conservent leur état actuel.
- Les expirations de tickets par **temps de connexion cumulé** sont conservées
  par `limit-uptime` sur RouterOS, mais **l'expiration calendaire des comptes
  résidentiels hors ligne reste à développer**. Ne considérez pas encore
  ce mode comme une politique de coupure entièrement autonome hors ligne.
- Le mode natif n'inclut pas encore la synchronisation complète des compteurs
  cumulés de tous les tickets, les blocages MAC, le débit/les profils par offre,
  l'envoi garanti des accusés après une panne réseau, ni le RADIUS User Manager.
  Ces commandes non prises en charge restent dans la file ZARAY
  (`supportedActions`), sans être consommées silencieusement.
- Le cycle lit au plus 12 interfaces + 10 sessions Hotspot + 10 PPP pour
  limiter la taille des corps HTTP, et les comptes PPP doivent déjà exister.
- Les routeurs ayant de faibles ressources ou des restrictions de mode
  RouterOS peuvent ne pas prendre en charge cette installation.

## Suspension / désinstallation

Pour couper le service sans supprimer ses secrets : dans ZARAY désactivez le
contrôle puis exécutez `/system scheduler disable [find name="zaray-native-minute"]`.
Pour le retirer complètement, après avoir révoqué l'appairage dans ZARAY,
supprimez `zaray-native-minute`, `zaray-native-cycle` et
`zaray-native-credentials` dans leurs menus respectifs. Ne supprimez pas
les utilisateurs Hotspot ou PPP existants.

## Références

- https://manual.mikrotik.com/docs/developer-guides/scripting/
- https://manual.mikrotik.com/docs/tooling-and-management/fetch/
- https://manual.mikrotik.com/docs/system-information-and-utilities/scheduler/
- https://manual.mikrotik.com/docs/system-information-and-utilities/files/

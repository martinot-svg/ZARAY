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

- La **coupure calendaire hors ligne** est implémentée pour les comptes
  Hotspot/PPPoE explicitement étiquetés `zaray:access:<account_uuid>:<epoch_ns>`
  après validation d'un abonnement payé, de son site et de sa date limite.
  Le garde local s'exécute **avant** l'appel HTTPS à chaque minute : il désactive
  l'utilisateur et coupe les sessions quand la date est dépassée.
  **Condition indispensable :** l'horloge RouterOS doit être fiable. Si elle
  indique une date antérieure à 2024, la coupure calendaire est volontairement
  suspendue avec un avertissement, et ne peut pas être garantie pendant une
  panne prolongée sans horloge matérielle fiable. Testez NTP, changement de
  fuseau, redémarrage hors ligne et dérive de l'horloge sur le matériel cible.
  La coupure locale ne réactive jamais automatiquement un abonnement.
- L'acquittement est **récupérable pendant la durée de vie de la commande** :
  ZARAY peut rediffuser après 90 secondes une commande restée `dispatched`.
  Les actions prennent en charge une nouvelle exécution et les réponses
  identiques sont acceptées une seconde fois côté serveur. Les commandes
  expirent normalement après 24 heures : ce mécanisme n'est pas une garantie
  de livraison illimitée et ne remplace pas les vérifications terrain.
- Les offres peuvent maintenant définir des débits montant/descendant.
  Les valeurs sont copiées dans le compte réseau à son association à une
  commande, puis communiquées lors de `resume_account`. L'agent natif
  configure le `rate-limit` seulement si le compte utilise déjà un **profil
  explicitement géré par ZARAY**, marqué `zaray:managed-bandwidth`.
  Il refuse de remplacer le profil existant d'un administrateur tiers :
  aucun changement de débit n'est annoncé tant que l'application sur
  RouterOS n'est pas confirmée.
- Les expirations par **temps de connexion cumulé** des tickets restent
  couvertes par `limit-uptime` sur RouterOS. La synchronisation complète
  de tous les compteurs cumulés, les blocages MAC et RADIUS User Manager
  ne sont toujours pas inclus.
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

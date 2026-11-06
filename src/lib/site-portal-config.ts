/** Public, strictly validated presentation metadata. Contains no network credentials. */
export const PORTAL_TEMPLATES = [
 {key:'minimal',label:'Minimaliste',description:'Formulaire direct et surfaces simples.'},
 {key:'premium',label:'Premium',description:'Profondeur lumineuse et finition soignée.'},
 {key:'corporate',label:'Corporate',description:'Clarté institutionnelle et structure nette.'},
 {key:'modern-tech',label:'Modern Tech',description:'Grille technique et contraste affirmé.'},
 {key:'residential',label:'Résidentiel',description:'Accueil chaleureux pour les abonnés.'},
 {key:'commercial',label:'Commercial',description:'Offres et appels à l’action valorisés.'},
 {key:'elegant',label:'Élégant',description:'Typographie raffinée et détails subtils.'},
 {key:'custom',label:'Personnalisé',description:'Composition libre et identité du site.'}
] as const;
export type PortalTemplate = typeof PORTAL_TEMPLATES[number]['key'];
export type PortalConfig={
 template:PortalTemplate;
 headline:string;
 subtitle:string;
 buttonLabel:string;
 welcomeMessage:string;
 primaryColor:string;
 accentColor:string;
 backgroundColor:string;
 panelColor:string;
 textColor:string;
 align:'center'|'left';
 cornerRadius:number;
 showOffers:boolean;
 showSubscribe:boolean;
 showAccount:boolean;
 showContact:boolean;
 termsText:string;
 privacyText:string;
 coverImageDataUri:string|null;
};
export const DEFAULT_PORTAL_CONFIG:PortalConfig={
 template:'premium',
 headline:'Bienvenue sur notre réseau',
 subtitle:'Connectez-vous avec votre ticket Wi-Fi.',
 buttonLabel:'Se connecter',
 welcomeMessage:'',
 primaryColor:'#20c997',
 accentColor:'#6ce9d6',
 backgroundColor:'#06111e',
 panelColor:'#10273a',
 textColor:'#f1fff9',
 align:'center',
 cornerRadius:22,
 showOffers:true,
 showSubscribe:true,
 showAccount:true,
 showContact:true,
 termsText:'',
 privacyText:'',
 coverImageDataUri:null
};
const templateKeys=new Set<string>(PORTAL_TEMPLATES.map(x=>x.key));
const color=/^#[0-9a-fA-F]{6}$/;
const copy=(input:unknown,max:number):string=>{
 if(typeof input!=='string')throw new Error('Texte du portail invalide.');
 const value=input.trim();
 if(value.length>max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value))
  throw new Error('Un texte dépasse la longueur autorisée.');
 return value;
};
const getColor=(input:unknown):string=>{
 if(typeof input!=='string'||!color.test(input))throw new Error('Couleur du portail invalide.');
 return input.toLowerCase();
};
/** Reject unknown keys and unsafe input instead of persisting arbitrary browser JSON. */
export function parsePortalConfig(input:unknown):PortalConfig{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuration invalide.');
 const object=input as Record<string,unknown>;
 const allowed=new Set<keyof PortalConfig>(Object.keys(DEFAULT_PORTAL_CONFIG) as (keyof PortalConfig)[]);
 if(Object.keys(object).some(k=>!allowed.has(k as keyof PortalConfig)))
  throw new Error('Paramètre de portail inconnu.');
 if(!templateKeys.has(String(object.template)))throw new Error('Modèle de portail inconnu.');
 if(object.align!=='center'&&object.align!=='left')throw new Error('Alignement invalide.');
 if(!Number.isInteger(object.cornerRadius)||Number(object.cornerRadius)<0||Number(object.cornerRadius)>32)
  throw new Error('Arrondi de bordure invalide.');
 for(const key of ['showOffers','showSubscribe','showAccount','showContact'] as const)
  if(typeof object[key]!=='boolean')throw new Error('Option d’affichage invalide.');
 const image=object.coverImageDataUri;
 if(image!==null&&(typeof image!=='string'||image.length>145000||
   !/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(image)))
  throw new Error('Couverture : utilisez un PNG ou WebP léger, sans contenu externe.');
 return {
  template:object.template as PortalTemplate,
  headline:copy(object.headline,85),
  subtitle:copy(object.subtitle,180),
  buttonLabel:copy(object.buttonLabel,45),
  welcomeMessage:copy(object.welcomeMessage,180),
  primaryColor:getColor(object.primaryColor),
  accentColor:getColor(object.accentColor),
  backgroundColor:getColor(object.backgroundColor),
  panelColor:getColor(object.panelColor),
  textColor:getColor(object.textColor),
  align:object.align,
  cornerRadius:Number(object.cornerRadius),
  showOffers:object.showOffers as boolean,
  showSubscribe:object.showSubscribe as boolean,
  showAccount:object.showAccount as boolean,
  showContact:object.showContact as boolean,
  termsText:copy(object.termsText,1500),
  privacyText:copy(object.privacyText,1500),
  coverImageDataUri:image as string|null
 };
}
export function readPortalConfig(source:unknown):PortalConfig|null{
 try{return parsePortalConfig(source);}catch{return null;}
}

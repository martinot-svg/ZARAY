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
 inputBackgroundColor:string;
 inputBorderColor:string;
 inputFocusColor:string;
 inputTextColor:string;
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
 inputBackgroundColor:'#071628',
 inputBorderColor:'#4c6677',
 inputFocusColor:'#20c997',
 inputTextColor:'#ffffff',
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
  // Backward compatible with previously published portal versions.
  inputBackgroundColor:getColor(object.inputBackgroundColor??DEFAULT_PORTAL_CONFIG.inputBackgroundColor),
  inputBorderColor:getColor(object.inputBorderColor??DEFAULT_PORTAL_CONFIG.inputBorderColor),
  inputFocusColor:getColor(object.inputFocusColor??DEFAULT_PORTAL_CONFIG.inputFocusColor),
  inputTextColor:getColor(object.inputTextColor??DEFAULT_PORTAL_CONFIG.inputTextColor),
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

/** Shared contrast-safe field tokens used by both editor preview and web portal.
 * Text colors picked by the owner are honored whenever they meet WCAG AA.
 * Placeholder alpha is selected against the actual input background, not the card.
 */
function luminance(value:string):number{
 const rgb=[1,3,5].map(offset=>{
  const channel=parseInt(value.slice(offset,offset+2),16)/255;
  return channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4);
 });
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a:string,b:string):number{
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function mixedWithBackground(ink:string,bg:string,alpha:number):string{
 const channel=(n:number)=>{
  const a=parseInt(ink.slice(n,n+2),16),b=parseInt(bg.slice(n,n+2),16);
  return Math.round(a*alpha+b*(1-alpha)).toString(16).padStart(2,'0');
 };
 return '#'+channel(1)+channel(3)+channel(5);
}
export function portalFieldPalette(config:Pick<PortalConfig,
 'inputBackgroundColor'|'inputBorderColor'|'inputFocusColor'|'inputTextColor'>){
 const background=config.inputBackgroundColor;
 const preferred=config.inputTextColor;
 const black='#000000',white='#ffffff';
 const text=contrast(preferred,background)>=4.5?preferred:
  contrast(black,background)>=contrast(white,background)?black:white;
 const base=contrast(black,background)>=contrast(white,background)?black:white;
 let opacity=.72;
 // A gently muted guide, never an invisible guide on a midtone surface.
 while(opacity<.98&&contrast(mixedWithBackground(base,background,opacity),background)<4.5)
  opacity=Math.min(1,Math.round((opacity+.02)*100)/100);
 const placeholder=base===white
  ?'rgba(255,255,255,'+opacity.toFixed(2)+')'
  :'rgba(0,0,0,'+opacity.toFixed(2)+')';
 return {background,border:config.inputBorderColor,focus:config.inputFocusColor,text,placeholder};
}

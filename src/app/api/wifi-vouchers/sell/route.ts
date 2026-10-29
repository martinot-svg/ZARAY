import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
/** Manual sale is deprecated: preprinted vouchers are counted only on first authenticated RouterOS login. */
export async function POST(){
 return NextResponse.json({error:'La vente physique ne nécessite plus de validation manuelle dans ZARAY. Remettez le ticket imprimé ; sa première connexion réussie sera comptabilisée automatiquement.'},
  {status:410,headers:{'Cache-Control':'no-store'}});
}

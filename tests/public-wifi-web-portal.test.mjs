import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(p,'utf8');
const web=read('src/components/public-wifi-portal.tsx');
const demo=read('src/app/wifi/page.tsx');
const company=read('src/app/wifi/[slug]/page.tsx');
const admin=read('src/app/portail/page.tsx');
const css=read('src/components/public-wifi-portal.css');

test('public /wifi is accessible without admin authentication and offers an interactive preview',()=>{
 assert.match(demo,/PublicWifiPortal/);
 assert.match(web,/sampleTicketOffers/);
 assert.match(web,/sampleSubscriptions/);
 assert.match(web,/mode==='home'/);
 assert.match(web,/mode==='ticket'/);
 assert.match(web,/mode==='subscribe'/);
 assert.match(web,/mode==='order'/);
 assert.doesNotMatch(demo,/authorizeTenant|auth\.getUser/);
});
test('real business portal uses tenant-specific public offer/payment APIs',()=>{
 assert.match(company,/slug=\{slug\.toLowerCase\(\)\}/);
 assert.match(web,/\/api\/portal\//);
 assert.match(web,/\/payment-methods/);
 assert.match(web,/\/api\/public\/wifi-offers\?siteId=/);
 assert.match(web,/data\.companySlug!==slug/);
 assert.match(web,/\/api\/manual-payments\/submit/);
 assert.match(web,/\/paiement\//);
 assert.match(web,/method:'POST'/);
});
test('passwords are never transmitted or compared against fabricated network results',()=>{
 assert.match(web,/setTicketPassword\(''\)/);
 assert.match(web,/Aucune donnée n’a été envoyée/);
 assert.match(web,/connexion au MikroTik/);
 assert.doesNotMatch(web,/JSON\.stringify\([^)]*ticketPassword|form\.set\('password'/);
 assert.doesNotMatch(web,/setTicketMessage\('[^']*(?:Accès accordé|Connexion réussie)/);
});
test('demo enrollment does not create fictitious payments and requires a real enterprise',()=>{
 assert.match(web,/if\(demo\)\{setError\('Mode démonstration/);
 assert.match(web,/if\(!selectedSubscription\)/);
 assert.match(web,/Choisissez votre forfait résidentiel/);
 assert.match(web,/Devenir un abonné de \{companyName\}/);
});
test('portal is discoverable from admin and responsive across devices',()=>{
 assert.match(admin,/\/wifi\//);
 assert.match(admin,/https:\/\/zaray\.vercel\.app\/wifi\//);
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('premium welcome displays login, subscribe CTA and offers without scrolling',()=>{
 assert.match(web,/className="zw-simple-screen"/);
 assert.match(web,/className="zw-simple-card"/);
 assert.match(web,/BrandLogo className="zw-simple-logo"/);
 assert.match(web,/id="zw-simple-user"/);
 assert.match(web,/id="zw-simple-password"/);
 assert.match(web,/Se connecter/);
 assert.match(web,/Devenir un abonné de \{companyName\}/);
 assert.match(web,/setOffersDialog\(true\)/);
 assert.match(css,/\.zw-landing\.zw-root\{height:100dvh;min-height:0;overflow:hidden\}/);
 assert.match(css,/\.zw-simple-screen\{flex:1;min-height:0;/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-height:510px\)/);
});
test('real forms remain available after leaving compact home screen',()=>{
 assert.match(web,/mode==='ticket'/);
 assert.match(web,/mode==='subscribe'/);
 assert.match(web,/mode==='order'/);
 assert.match(web,/setEnterpriseDialog\(true\)/);
 assert.match(web,/setOffersDialog\(true\)/);
 assert.match(web,/role="dialog" aria-modal="true"/);
});

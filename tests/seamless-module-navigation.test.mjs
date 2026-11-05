import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('company/site directory requests are coalesced, but never reused after completion', () => {
  const helper = read('src/lib/workspace-directory-request.ts');
  assert.match(helper, /let inFlight: Promise<Response> \| null = null/);
  assert.match(helper, /cache: 'no-store'/);
  assert.match(helper, /inFlight = null/);
  assert.match(helper, /response\.clone\(\)/);
  assert.doesNotMatch(helper, /localStorage|sessionStorage|setTimeout/);
  for (const path of [
    'src/components/app-shell.tsx', 'src/app/sites/page.tsx',
    'src/app/clients/page.tsx', 'src/app/offres/page.tsx',
    'src/app/commandes/page.tsx', 'src/app/abonnements/page.tsx',
    'src/app/tickets/page.tsx', 'src/app/membres/page.tsx',
    'src/app/portail/page.tsx', 'src/app/parametres-paiement/page.tsx',
    'src/app/paiements/verification/page.tsx', 'src/app/gestion-reseau/page.tsx',
  ]) {
    const code=read(path);
    assert.match(code, /fetchWorkspaceDirectory\(\)/, path);
    assert.doesNotMatch(code, /fetch\('\/api\/sites',\{cache:'no-store'\}\)/,path);
  }
});
test('module transitions never replace the workspace with a large loading card', () => {
  const tickets=read('src/app/tickets/page.tsx');
  const commands=read('src/app/commandes/page.tsx');
  const subscriptions=read('src/app/abonnements/page.tsx');
  const methods=read('src/app/parametres-paiement/page.tsx');
  assert.match(tickets,/if\(loading\)return <AppShell/);
  assert.doesNotMatch(tickets,/Chargement des tickets Wi-Fi/);
  assert.doesNotMatch(commands,/Chargement des commandes…/);
  assert.doesNotMatch(subscriptions,/Chargement des abonnements…/);
  assert.doesNotMatch(methods,/Chargement des moyens…|<section className="panel"><p role="status">Chargement/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const component = read('src/components/ui/password-field.tsx');
const styles = read('src/app/form-proportions.css');

test('password visibility is accessible and cannot submit a form', () => {
  assert.match(component, /useState\(false\)/);
  assert.match(component, /type=\{visible \? 'text' : 'password'\}/);
  assert.match(component, /onClick=\{\(\) => setVisible\(value => !value\)\}/);
  assert.match(component, /type="button"/);
  assert.match(component, /aria-label=\{toggleLabel\}/);
  assert.match(component, /aria-pressed=\{visible\}/);
  assert.match(component, /aria-controls=\{id\}/);
  assert.match(component, /label htmlFor=\{id\}/);
  assert.match(component, /useId\(\)/);
  assert.match(component, /EyeOff/);
  assert.match(component, /Eye/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|fetch\(|console\.log|setTimeout/);
});

test('login and registration password fields use the reusable control', () => {
  for (const path of ['src/app/connexion/page.tsx','src/app/inscription/page.tsx']) {
    const page = read(path);
    assert.match(page, /import PasswordField from '@\/components\/ui\/password-field'/, path);
    assert.match(page, /<PasswordField label="Mot de passe" name="password"/, path);
    assert.match(page, /autoComplete="(?:current|new)-password"/, path);
    assert.match(page, /new FormData\(event\.currentTarget\)/, path);
  }
  assert.match(read('src/app/inscription/page.tsx'), /minLength=\{12\}/);
});

test('reset offers independent toggles while keeping confirmation checking', () => {
  const page = read('src/app/reinitialiser-mot-de-passe/page.tsx');
  assert.match(page, /<PasswordField label="Nouveau mot de passe" name="password"/);
  assert.match(page, /<PasswordField label="Confirmer le mot de passe" name="confirmation"/);
  assert.match(page, /password !== confirmation/);
  assert.match(page, /supabase\.auth\.updateUser\(\{ password \}\)/);
});

test('icon fits inside the field without hiding typing and has light/dark support', () => {
  assert.match(styles, /\.zaray-password-control input\{[\s\S]*?padding-right:57px!important/);
  assert.match(styles, /\.zaray-password-control button\.zaray-password-toggle\{[\s\S]*?position:absolute/);
  assert.match(styles, /width:44px/);
  assert.match(styles, /\[data-zaray-theme="light"\].*\.zaray-password-toggle/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

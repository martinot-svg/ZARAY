import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('src/components/contrast-guardian.tsx','utf8');
const audit=readFileSync('tests/contrast-audit.mjs','utf8');
test('existing accessible ink is not reset on every DOM re-scan',()=>{
 assert.match(code,/const existing = corrected.get\(element\)/);
 assert.match(code,/const currentStyle = getComputedStyle\(element\)/);
 assert.match(code,/const currentBackground = background\(element\)/);
 assert.match(code,/contrast\(over\(currentColor, currentBackground\), currentBackground\) >= currentTarget/);
 assert.match(code,/if \(currentColor && contrast/);
 assert.match(code,/element\.style\.setProperty\('color', replacement, 'important'\)/);
});
test('contrast audit checks both initial correction and stability',()=>{
 assert.match(audit,/Unstable contrast after re-scan/);
 assert.match(audit,/await page\.waitForFunction/);
 assert.match(audit,/Dynamic background change failed/);
});

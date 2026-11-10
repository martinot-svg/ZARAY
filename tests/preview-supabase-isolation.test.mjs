import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPreviewSupabaseIsolation} from '../src/lib/supabase/preview-isolation.ts';

const env={
 VERCEL_ENV:'preview',
 ZARAY_PREVIEW_SUPABASE_REF:'abcdefghijklmnopqrst',
 NEXT_PUBLIC_ZARAY_LAB_PROJECT_REF:'abcdefghijklmnopqrst',
 NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
 SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'
};
test('dedicated preview project is accepted only with exactly matching public and server URLs',()=>{
 assert.equal(checkPreviewSupabaseIsolation(env).ok,true);
 assert.equal(checkPreviewSupabaseIsolation({...env,SUPABASE_URL:'https://otherotherotherothe.supabase.co'}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({...env,NEXT_PUBLIC_SUPABASE_URL:'http://abcdefghijklmnopqrst.supabase.co'}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({...env,NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co.evil.example'}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({...env,NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'}).ok,false);
});
test('missing preview ref, production ref and empty environment fail closed',()=>{
 assert.equal(checkPreviewSupabaseIsolation({...env,ZARAY_PREVIEW_SUPABASE_REF:undefined}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({...env,NEXT_PUBLIC_ZARAY_LAB_PROJECT_REF:undefined}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({...env,SUPABASE_URL:undefined}).ok,false);
 assert.equal(checkPreviewSupabaseIsolation({
  ...env,ZARAY_PREVIEW_SUPABASE_REF:'hosyeygtaksbahnxxiqf',
  NEXT_PUBLIC_ZARAY_LAB_PROJECT_REF:'hosyeygtaksbahnxxiqf',
  SUPABASE_URL:'https://hosyeygtaksbahnxxiqf.supabase.co',
  NEXT_PUBLIC_SUPABASE_URL:'https://hosyeygtaksbahnxxiqf.supabase.co'
 }).ok,false);
});
test('production is not blocked by preview-only gate',()=>{
 assert.equal(checkPreviewSupabaseIsolation({VERCEL_ENV:'production'}).ok,true);
});

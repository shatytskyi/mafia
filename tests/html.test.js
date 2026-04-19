import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, html, rawHtml } from '../src/ui/html.js';

test('escapeHtml escapes all dangerous chars', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("it's"), 'it&#39;s');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml handles null/undefined', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('html tagged template escapes interpolations', () => {
  const name = '<img src=x onerror=alert(1)>';
  const out = html`<div>${name}</div>`;
  assert.equal(out, '<div>&lt;img src=x onerror=alert(1)&gt;</div>');
});

test('rawHtml passes through without re-escape', () => {
  const fragment = rawHtml('<span>ok</span>');
  assert.equal(html`<div>${fragment}</div>`, '<div><span>ok</span></div>');
});

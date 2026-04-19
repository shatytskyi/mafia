import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ru } from '../src/i18n/ru.js';
import { uk } from '../src/i18n/uk.js';
import { en } from '../src/i18n/en.js';

function collectPaths(obj, prefix = '', out = []) {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collectPaths(value, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function diff(a, b) {
  const setB = new Set(b);
  return a.filter(x => !setB.has(x));
}

test('ru and uk dictionaries have identical key sets', () => {
  const ruKeys = collectPaths(ru).sort();
  const ukKeys = collectPaths(uk).sort();
  const missingInUk = diff(ruKeys, ukKeys);
  const extraInUk = diff(ukKeys, ruKeys);
  assert.deepEqual(missingInUk, [], `Missing in uk: ${missingInUk.join(', ')}`);
  assert.deepEqual(extraInUk, [], `Extra in uk: ${extraInUk.join(', ')}`);
});

test('ru and en dictionaries have identical key sets', () => {
  const ruKeys = collectPaths(ru).sort();
  const enKeys = collectPaths(en).sort();
  const missingInEn = diff(ruKeys, enKeys);
  const extraInEn = diff(enKeys, ruKeys);
  assert.deepEqual(missingInEn, [], `Missing in en: ${missingInEn.join(', ')}`);
  assert.deepEqual(extraInEn, [], `Extra in en: ${extraInEn.join(', ')}`);
});

test('no empty string values in any locale', () => {
  for (const [name, dict] of [['ru', ru], ['uk', uk], ['en', en]]) {
    const paths = collectPaths(dict);
    for (const p of paths) {
      const parts = p.split('.');
      let node = dict;
      for (const part of parts) node = node[part];
      if (typeof node === 'string') {
        assert.ok(node.length > 0, `${name}.${p} is empty`);
      }
    }
  }
});

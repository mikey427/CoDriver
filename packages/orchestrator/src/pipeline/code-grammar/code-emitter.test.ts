import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCasing, importDefaultIdentifier } from './casing.js';
import { emitCodeFromText } from './code-emitter.js';
import { SYMBOL_MAP } from './symbol-map.js';

function emit(text: string): string {
  const result = emitCodeFromText(text);
  assert.equal(result.success, true, result.explanation);
  return result.text;
}

describe('casing', () => {
  it('camelCase', () => {
    assert.equal(applyCasing(['get', 'user', 'profile'], 'camel'), 'getUserProfile');
  });
  it('PascalCase', () => {
    assert.equal(applyCasing(['get', 'user', 'profile'], 'pascal'), 'GetUserProfile');
  });
  it('snake_case', () => {
    assert.equal(applyCasing(['get', 'user', 'profile'], 'snake'), 'get_user_profile');
  });
  it('kebab-case', () => {
    assert.equal(applyCasing(['get', 'user', 'profile'], 'kebab'), 'get-user-profile');
  });
  it('CONSTANT_CASE', () => {
    assert.equal(applyCasing(['api', 'url'], 'constant'), 'API_URL');
  });
});

describe('variable declarations', () => {
  it('const with await call', () => {
    assert.equal(
      emit('const user equals await get user open paren id close paren'),
      'const user = await getUser(id)',
    );
  });
  it('let count', () => {
    assert.equal(emit('let count equals zero'), 'let count = 0');
  });
  it('const boolean', () => {
    assert.equal(emit('const is loading equals false'), 'const isLoading = false');
  });
  it('empty array/object', () => {
    assert.equal(emit('const items equals empty array'), 'const items = []');
    assert.equal(emit('const config equals empty object'), 'const config = {}');
  });
});

describe('functions', () => {
  it('function signature', () => {
    assert.equal(emit('function get user open paren id close paren'), 'function getUser(id)');
  });
  it('async function', () => {
    assert.equal(emit('async function fetch user open paren id close paren'), 'async function fetchUser(id)');
  });
  it('arrow function', () => {
    assert.equal(emit('arrow function'), '() => ');
  });
  it('async arrow', () => {
    assert.equal(emit('async arrow function'), 'async () => ');
  });
  it('return await chain', () => {
    assert.equal(
      emit('return await response dot json open paren close paren'),
      'return await response.json()',
    );
  });
});

describe('imports/exports', () => {
  it('default import react', () => {
    assert.equal(emit('import react from react'), "import React from 'react'");
  });
  it('named hook import', () => {
    assert.equal(emit('import use state from react'), "import { useState } from 'react'");
  });
  it('path import uses camelCase for services', () => {
    assert.equal(
      emit('import user service from services slash user service'),
      "import userService from 'services/userService'",
    );
  });
  it('export default', () => {
    assert.equal(emit('export default app'), 'export default App');
  });
  it('export function', () => {
    assert.equal(emit('export function get user'), 'export function getUser()');
  });
  it('export type', () => {
    assert.equal(emit('export type user'), 'export type User');
  });
});

describe('control flow', () => {
  it('if/else', () => {
    assert.equal(emit('if user'), 'if (user) {');
    assert.equal(emit('if not user'), 'if (!user) {');
    assert.equal(emit('else'), '} else {');
    assert.equal(emit('else if loading'), '} else if (loading) {');
  });
  it('try catch', () => {
    assert.equal(emit('try catch'), 'try {\n} catch (error) {');
  });
  it('for each', () => {
    assert.equal(emit('for each item in items'), 'items.forEach((item) => {');
  });
});

describe('symbols', () => {
  it('maps required symbols', () => {
    assert.equal(SYMBOL_MAP['open paren'], '(');
    assert.equal(SYMBOL_MAP['optional chain'], '?.');
    assert.equal(SYMBOL_MAP['fat arrow'], '=>');
  });
  it('symbol in phrase', () => {
    assert.equal(emit('open brace'), '{');
  });
});

describe('literals', () => {
  it('boolean and null', () => {
    assert.equal(emit('true'), 'true');
    assert.equal(emit('null'), 'null');
  });
});

describe('realistic coding phrases', () => {
  it('fetch chain', () => {
    assert.equal(
      emit('const response equals await fetch open paren url close paren'),
      'const response = await fetch(url)',
    );
    assert.equal(
      emit('const data equals await response dot json open paren close paren'),
      'const data = await response.json()',
    );
  });
  it('guard clause', () => {
    assert.equal(emit('if not response dot ok'), 'if (!response.ok) {');
  });
  it('throw new Error', () => {
    assert.equal(
      emit('throw new error open paren quote failed quote close paren'),
      "throw new Error('failed')",
    );
  });
  it('async handler', () => {
    assert.equal(
      emit('const handle submit equals async arrow function'),
      'const handleSubmit = async () => ',
    );
  });
  it('state setter and logging', () => {
    assert.equal(emit('set loading open paren false close paren'), 'setLoading(false)');
    assert.equal(emit('console dot log open paren user close paren'), 'console.log(user)');
  });
  it('return null', () => {
    assert.equal(emit('return null'), 'return null');
  });
  it('export interface', () => {
    assert.equal(emit('export interface user profile'), 'export interface UserProfile');
  });
});

describe('casing conventions', () => {
  it('importDefaultIdentifier', () => {
    assert.equal(importDefaultIdentifier(['user', 'service']), 'userService');
    assert.equal(importDefaultIdentifier(['react']), 'React');
  });
});

describe('no AI', () => {
  it('deterministic confidence', () => {
    const r = emitCodeFromText('const x equals one');
    assert.ok(r.confidence >= 0.8);
    assert.equal(r.text, 'const x = 1');
  });
});

// node --test guard.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, firstDefined, replyValue } from './guard.mjs'

test('falsy answers survive exactly; only undefined falls back', () => {
  for (const v of [false, null, 0, '', []]) assert.deepEqual(firstDefined(v, 'fallback'), v)
  assert.equal(firstDefined(undefined, undefined, 'x'), 'x')
  for (const v of [false, null, 0, '', []]) assert.deepEqual(replyValue(v, {}), v)
  assert.deepEqual(replyValue(undefined, {}), {})
})

test('a write is faked, never forwarded, even with no rule', () => {
  assert.deepEqual(decide('DeleteOrg', false, {}, {}), { action: 'answer', how: 'faked', value: undefined })
})

test('a write fake returning false, null or [] is sent as-is', () => {
  for (const v of [false, null, []]) {
    const d = decide('Save', false, {}, { fakes: { Save: () => v } })
    assert.equal(d.action, 'answer'); assert.deepEqual(d.value, v)
  }
})

test('a read answered by a fixture is a fixture, including null and []', () => {
  for (const v of [{ a: 1 }, null, []]) assert.deepEqual(decide('GetInbox', true, {}, { reads: { GetInbox: () => v } }), { action: 'answer', how: 'fixture', value: v })
})

test('an unanswered read is forwarded and marked real', () => {
  assert.deepEqual(decide('GetInbox', true, {}, {}), { action: 'forward', how: 'real' })
  assert.equal(decide('GetMe', true, {}, { allowReal: ['GetMe'] }).how, 'allowed')
  assert.equal(decide('GetMe', true, {}, { patch: { GetMe: d => d } }).how, 'real-patched')
})

test('journey fakes win; undefined falls back to the adapter', () => {
  const rules = { reads: { GetInbox: () => 'adapter' }, journeyFakes: { GetInbox: d => (d.mine ? 'journey' : undefined) } }
  assert.equal(decide('GetInbox', true, { mine: true }, rules).value, 'journey')
  assert.equal(decide('GetInbox', true, {}, rules).value, 'adapter')
})

test('failures answer with an error, and a function can fail only some calls', () => {
  assert.deepEqual(decide('Send', false, {}, { failures: { Send: true } }), { action: 'fail', how: 'failed', failure: {} })
  let n = 0
  const rules = { failures: { Send: () => (n++ === 0 ? { status: 'error' } : undefined) } }
  assert.equal(decide('Send', false, {}, rules).action, 'fail')
  assert.equal(decide('Send', false, {}, rules).how, 'faked')
})

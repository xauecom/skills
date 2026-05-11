import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../lib/cli.js';

test('parse mint command', () => {
  const out = parseArgs(['mint', '--amount', '5']);
  assert.equal(out.command, 'mint');
  assert.equal(out.amount, '5');
});

test('parse status with req-id', () => {
  const out = parseArgs(['status', '--req-id', '42']);
  assert.equal(out.command, 'status');
  assert.equal(out.reqId, '42');
});

test('parse approve with all flags', () => {
  const out = parseArgs(['approve', '--token', 'XAUT', '--amount', '100', '--config', '/tmp/r.yaml']);
  assert.equal(out.command, 'approve');
  assert.equal(out.token, 'XAUT');
  assert.equal(out.amount, '100');
  assert.equal(out.configPath, '/tmp/r.yaml');
});

test('parse list with user override', () => {
  const out = parseArgs(['list', '--user', '0xabc', '--from-block', '17000000']);
  assert.equal(out.command, 'list');
  assert.equal(out.user, '0xabc');
  assert.equal(out.fromBlock, '17000000');
});

test('rejects unknown command', () => {
  assert.throws(() => parseArgs(['teleport']));
});

test('parse set-blacklist with blocked flag', () => {
  const out = parseArgs(['set-blacklist', '--account', '0xdead', '--blocked', 'false']);
  assert.equal(out.command, 'set-blacklist');
  assert.equal(out.account, '0xdead');
  assert.equal(out.blocked, 'false');
});

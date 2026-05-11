import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../lib/config.js';

function writeCfg(dir, content) {
  const p = join(dir, 'router.yaml');
  writeFileSync(p, content);
  return p;
}

const VALID_YAML = `
contracts:
  router: "0x1111111111111111111111111111111111111111"
  nav4626: "0x2222222222222222222222222222222222222222"
tokens:
  XAUT:
    address: "0x68749665FF8D2d112Fa859AA293F07A622782F38"
    decimals: 6
  XAUE:
    address: "0x3333333333333333333333333333333333333333"
    decimals: 6
`;

test('loads valid config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xaue-router-test-'));
  try {
    const p = writeCfg(dir, VALID_YAML);
    const cfg = loadConfig({ override: p });
    assert.equal(cfg.contracts.router, '0x1111111111111111111111111111111111111111');
    assert.equal(cfg.tokens.XAUT.decimals, 6);
  } finally { rmSync(dir, { recursive: true }); }
});

test('throws on REPLACE_ME router address', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xaue-router-test-'));
  try {
    const p = writeCfg(dir, VALID_YAML.replace(
      '0x1111111111111111111111111111111111111111', 'REPLACE_ME',
    ));
    assert.throws(() => loadConfig({ override: p }), /REPLACE_ME|not set/i);
  } finally { rmSync(dir, { recursive: true }); }
});

test('throws on zero address', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xaue-router-test-'));
  try {
    const p = writeCfg(dir, VALID_YAML.replace(
      '0x1111111111111111111111111111111111111111',
      '0x0000000000000000000000000000000000000000',
    ));
    assert.throws(() => loadConfig({ override: p }), /not set|placeholder/i);
  } finally { rmSync(dir, { recursive: true }); }
});

test('throws on invalid address format', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xaue-router-test-'));
  try {
    const p = writeCfg(dir, VALID_YAML.replace(
      '0x1111111111111111111111111111111111111111', 'not-an-address',
    ));
    assert.throws(() => loadConfig({ override: p }), /not a valid/i);
  } finally { rmSync(dir, { recursive: true }); }
});

test('throws when config file does not exist', () => {
  assert.throws(
    () => loadConfig({ override: '/tmp/nonexistent-xaue-router.yaml' }),
    /not found/i,
  );
});

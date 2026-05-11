/**
 * Config loader for xaue-router.
 *
 * Resolution order:
 *   1. --config <path> CLI flag (explicit override)
 *   2. $XAUE_ROUTER_CONFIG environment variable
 *   3. ~/.aurehub/router.yaml (default; shared hub dir)
 *
 * Hardcoded mainnet defaults (override in router.yaml only when testing on a local fork):
 *   XAUT address  : 0x68749665FF8D2d112Fa859AA293F07A622782F38
 *   XAUT decimals : 6
 *   token_rules   : XAUT requires reset-approve (USDT-style); XAUE does not
 *   event_scan    : default_lookback_blocks = 200000
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

const XAUT_MAINNET_ADDRESS = '0x68749665FF8D2d112Fa859AA293F07A622782F38';
const XAUT_DECIMALS        = 6;
const DEFAULT_LOOKBACK     = 200000;

const PLACEHOLDER = new Set(['', 'REPLACE_ME', '0x0000000000000000000000000000000000000000']);

function isAddressPlaceholder(v) {
  return v == null || PLACEHOLDER.has(String(v));
}

function validateAddress(value, label) {
  if (isAddressPlaceholder(value)) {
    throw new Error(
      `Config field "${label}" is not set (got ${JSON.stringify(value)}). ` +
      `Edit ~/.aurehub/router.yaml and fill in the real address.`,
    );
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Config field "${label}" is not a valid 0x-address: ${value}`);
  }
  return value;
}

export function configPath({ override } = {}) {
  if (override) return resolve(override);
  if (process.env.XAUE_ROUTER_CONFIG) return resolve(process.env.XAUE_ROUTER_CONFIG);
  return join(homedir(), '.aurehub', 'router.yaml');
}

export function loadConfig({ override } = {}) {
  const path = configPath({ override });
  if (!existsSync(path)) {
    throw new Error(
      `router.yaml not found at ${path}. ` +
      `Copy config.example.yaml from the skill dir and fill in the addresses.`,
    );
  }
  const raw = readFileSync(path, 'utf8');
  const cfg = yaml.load(raw, { schema: yaml.JSON_SCHEMA });
  if (!cfg || typeof cfg !== 'object') {
    throw new Error(`router.yaml at ${path} is empty or not a YAML object`);
  }

  // Required contract addresses — fail fast if placeholder.
  cfg.contracts = cfg.contracts || {};
  cfg.contracts.router  = validateAddress(cfg.contracts.router,  'contracts.router');
  cfg.contracts.nav4626 = validateAddress(cfg.contracts.nav4626, 'contracts.nav4626');

  // XAUE: address and decimals must be explicit (depend on deployment).
  cfg.tokens = cfg.tokens || {};
  const xaue = cfg.tokens.XAUE;
  if (!xaue) throw new Error('Config missing tokens.XAUE');
  xaue.address = validateAddress(xaue.address, 'tokens.XAUE.address');
  if (!Number.isFinite(xaue.decimals)) {
    throw new Error('Config field "tokens.XAUE.decimals" is missing. Set it explicitly in ~/.aurehub/router.yaml.');
  }

  // XAUT: fall back to hardcoded mainnet values; yaml can override for local fork testing.
  const xaut = cfg.tokens.XAUT || {};
  xaut.address  = isAddressPlaceholder(xaut.address)       ? XAUT_MAINNET_ADDRESS : xaut.address;
  xaut.decimals = Number.isFinite(xaut.decimals)           ? xaut.decimals        : XAUT_DECIMALS;
  cfg.tokens.XAUT = xaut;

  // token_rules: yaml overrides hardcoded defaults.
  cfg.token_rules = {
    XAUT: { requires_reset_approve: true  },
    XAUE: { requires_reset_approve: false },
    ...(cfg.token_rules || {}),
  };

  // event_scan: yaml overrides hardcoded default.
  cfg.event_scan = {
    default_lookback_blocks: DEFAULT_LOOKBACK,
    ...(cfg.event_scan || {}),
  };

  return { ...cfg, _path: path };
}

export function tokenSpec(cfg, symbol) {
  const t = cfg.tokens[symbol];
  if (!t) throw new Error(`Unknown token "${symbol}"`);
  return t;
}

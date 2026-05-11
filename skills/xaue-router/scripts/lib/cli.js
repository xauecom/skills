/**
 * CLI argument parser for router.js — isolated so it can be unit-tested
 * without pulling in ethers / sodium-native.
 */

export const VALID_COMMANDS = new Set([
  'address', 'balance', 'allowance', 'approve',
  'is-blacklisted', 'paused', 'config-show',
  'mint', 'request-redeem', 'status', 'request',
  'claim-xaut', 'claim-rejected', 'list',
  'set-blacklist', 'pause', 'unpause',
]);

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!VALID_COMMANDS.has(command)) {
    throw new Error(`Unknown command "${command}". Valid: ${[...VALID_COMMANDS].join(', ')}`);
  }
  const out = { command };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const val = rest[i + 1];
    switch (flag) {
      case '--amount':     out.amount = val;     i++; break;
      case '--token':      out.token = val;      i++; break;
      case '--req-id':     out.reqId = val;      i++; break;
      case '--account':    out.account = val;    i++; break;
      case '--blocked':    out.blocked = val;    i++; break;
      case '--user':       out.user = val;       i++; break;
      case '--from-block': out.fromBlock = val;  i++; break;
      case '--config':     out.configPath = val; i++; break;
      case '--json':       out.json = true;           break;
      default:
        // Silent ignore unknown flags for forward-compat.
        break;
    }
  }
  return out;
}

/**
 * JSON-RPC provider with automatic fallback.
 *
 * Reads `ETH_RPC_URL` (required) and an optional comma-separated
 * `ETH_RPC_URL_FALLBACK` list from the environment.
 */

import { FallbackProvider, JsonRpcProvider } from 'ethers';

function parseRpcList(envVar) {
  if (!envVar) return [];
  return String(envVar)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createProvider({
  primary = process.env.ETH_RPC_URL,
  fallbacks = parseRpcList(process.env.ETH_RPC_URL_FALLBACK),
} = {}) {
  if (!primary) {
    throw new Error('ETH_RPC_URL is not set. Add it to ~/.aurehub/.env');
  }
  const urls = [primary, ...fallbacks].filter(Boolean);
  if (urls.length === 1) {
    return new JsonRpcProvider(urls[0]);
  }
  const providers = urls.map((u, i) => ({
    provider: new JsonRpcProvider(u),
    priority: i + 1,
    stallTimeout: 2000,
    weight: 1,
  }));
  return new FallbackProvider(providers, undefined, { quorum: 1 });
}

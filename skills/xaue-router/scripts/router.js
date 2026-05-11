#!/usr/bin/env node
/**
 * router.js — CLI for calling the XAUERouter contract.
 *
 * Commands (all emit single-line JSON on stdout; errors go to stderr):
 *   address                                       — wallet address
 *   balance                                       — ETH / XAUT / XAUE balances
 *   allowance      --token XAUT|XAUE              — ERC-20 allowance to router
 *   approve        --token XAUT|XAUE --amount N   — approve router (auto reset for USDT-like)
 *   is-blacklisted --account 0x...                — router blacklist state
 *   paused                                        — router pause state
 *   config-show                                   — dump resolved config (read-only)
 *
 *   mint           --amount N                     — XAUT -> XAUE via router
 *   request-redeem --amount N                     — burn XAUE, create redemption request
 *   status         --req-id N                     — user-visible redemption status
 *   request        --req-id N                     — full routerRedemptions() row
 *   claim-xaut     --req-id N                     — claim XAUT after approval
 *   claim-rejected --req-id N                     — claim XAUE after rejection
 *   list           [--user 0x] [--from-block N]   — scan RedemptionRequestedViaRouter events
 *
 *   set-blacklist  --account 0x... --blocked B    — admin: BLACKLIST_ADMIN_ROLE
 *   pause                                         — admin: PAUSER_ROLE
 *   unpause                                       — admin: PAUSER_ROLE
 *
 * Common flags:
 *   --config <path>   override router.yaml path
 *   --json            force machine-readable output (default)
 *
 * All write ops wait for 1 confirmation and return { txHash, status, gasUsed, ... }.
 */

import process from 'node:process';
import {
  Contract,
  formatUnits,
  parseUnits,
  ZeroAddress,
  isAddress,
} from 'ethers';
import { ROUTER_ABI, ERC20_ABI, ROUTER_STATUS, ROUTER_STATUS_CODES } from './lib/abi.js';
import { loadConfig, tokenSpec } from './lib/config.js';
import { createProvider } from './lib/provider.js';
import { createSigner } from './lib/signer.js';
import { parseArgs } from './lib/cli.js';

export { parseArgs };

// --------------------------------------------------------------------------
// Context builder
// --------------------------------------------------------------------------

async function buildContext({ configPath, needSigner }) {
  const cfg = loadConfig({ override: configPath });
  const provider = createProvider();
  const signerCfg = {
    env: {
      WALLET_MODE:           process.env.WALLET_MODE,
      WDK_VAULT_FILE:        process.env.WDK_VAULT_FILE,
      WDK_PASSWORD_FILE:     process.env.WDK_PASSWORD_FILE,
      WDK_ACCOUNT_INDEX:     process.env.WDK_ACCOUNT_INDEX,
    },
  };
  const signer = needSigner ? await createSigner(signerCfg, provider) : null;

  const routerAddr = cfg.contracts.router;
  const router = new Contract(routerAddr, ROUTER_ABI, signer ?? provider);
  const xaut = new Contract(cfg.tokens.XAUT.address, ERC20_ABI, signer ?? provider);
  const xaue = new Contract(cfg.tokens.XAUE.address, ERC20_ABI, signer ?? provider);

  return { cfg, provider, signer, router, xaut, xaue, routerAddr };
}

function tokenContract(ctx, symbol) {
  const t = tokenSpec(ctx.cfg, symbol);
  if (symbol === 'XAUT') return { contract: ctx.xaut, decimals: t.decimals };
  if (symbol === 'XAUE') return { contract: ctx.xaue, decimals: t.decimals };
  throw new Error(`Unknown token "${symbol}"`);
}

async function walletAddress(ctx) {
  if (!ctx.signer) throw new Error('walletAddress: signer required');
  return (ctx.signer.address ?? await ctx.signer.getAddress());
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function toJsonPrintable(v) {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(toJsonPrintable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toJsonPrintable(v[k]);
    return o;
  }
  return v;
}

function emit(obj) {
  process.stdout.write(JSON.stringify(toJsonPrintable(obj)) + '\n');
}

function needsResetApprove(cfg, symbol) {
  return Boolean(cfg.token_rules?.[symbol]?.requires_reset_approve);
}

async function waitOk(tx, label) {
  const rec = await tx.wait(1);
  if (!rec || rec.status !== 1) throw new Error(`${label}: transaction reverted (${tx.hash})`);
  return {
    txHash: tx.hash,
    gasUsed: rec.gasUsed,
    blockNumber: rec.blockNumber,
  };
}

// --------------------------------------------------------------------------
// Read commands
// --------------------------------------------------------------------------

async function cmdAddress(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  emit({ address: await walletAddress(ctx) });
}

async function cmdBalance(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const addr = await walletAddress(ctx);
  const [eth, xautBal, xaueBal] = await Promise.all([
    ctx.provider.getBalance(addr),
    ctx.xaut.balanceOf(addr),
    ctx.xaue.balanceOf(addr),
  ]);
  emit({
    address: addr,
    ETH: formatUnits(eth, 18),
    XAUT: formatUnits(xautBal, ctx.cfg.tokens.XAUT.decimals),
    XAUE: formatUnits(xaueBal, ctx.cfg.tokens.XAUE.decimals),
  });
}

async function cmdAllowance(args) {
  if (!['XAUT', 'XAUE'].includes(args.token)) throw new Error('--token must be XAUT or XAUE');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const addr = await walletAddress(ctx);
  const { contract, decimals } = tokenContract(ctx, args.token);
  const raw = await contract.allowance(addr, ctx.routerAddr);
  emit({
    address: addr,
    token: args.token,
    spender: ctx.routerAddr,
    allowance: formatUnits(raw, decimals),
    allowanceRaw: raw,
  });
}

async function cmdIsBlacklisted(args) {
  if (!args.account || !isAddress(args.account)) throw new Error('--account must be a valid address');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: false });
  const flag = await ctx.router.blacklist(args.account);
  emit({ account: args.account, blacklisted: Boolean(flag) });
}

async function cmdPaused(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: false });
  let paused = false;
  try { paused = Boolean(await ctx.router.paused()); }
  catch { /* Router might not expose paused() if not Pausable */ paused = null; }
  emit({ paused });
}

async function cmdConfigShow(args) {
  const cfg = loadConfig({ override: args.configPath });
  emit({
    path: cfg._path,
    contracts: cfg.contracts,
    tokens: cfg.tokens,
    token_rules: cfg.token_rules,
    risk: cfg.risk,
    event_scan: cfg.event_scan,
  });
}

// --------------------------------------------------------------------------
// Approve (handles USDT-style reset)
// --------------------------------------------------------------------------

async function cmdApprove(args) {
  if (!['XAUT', 'XAUE'].includes(args.token)) throw new Error('--token must be XAUT or XAUE');
  if (!args.amount) throw new Error('--amount is required');

  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const addr = await walletAddress(ctx);
  const { contract, decimals } = tokenContract(ctx, args.token);
  const amountRaw = parseUnits(String(args.amount), decimals);

  const events = [];
  if (needsResetApprove(ctx.cfg, args.token)) {
    const current = await contract.allowance(addr, ctx.routerAddr);
    if (current > 0n) {
      const reset = await contract.approve(ctx.routerAddr, 0n);
      events.push({ step: 'reset', ...(await waitOk(reset, 'approve reset')) });
    }
  }
  const tx = await contract.approve(ctx.routerAddr, amountRaw);
  const receipt = await waitOk(tx, 'approve');

  emit({
    address: addr,
    token: args.token,
    spender: ctx.routerAddr,
    amount: formatUnits(amountRaw, decimals),
    events,
    ...receipt,
  });
}

// --------------------------------------------------------------------------
// Mint
// --------------------------------------------------------------------------

async function cmdMint(args) {
  if (!args.amount) throw new Error('--amount is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const decimals = ctx.cfg.tokens.XAUT.decimals;
  const amount = parseUnits(String(args.amount), decimals);
  if (amount <= 0n) throw new Error('--amount must be greater than 0');
  const addr = await walletAddress(ctx);

  // Quick safety: blacklist + paused + XAUT balance + allowance
  const [isBlocked, pausedState, xautBal, allowance] = await Promise.all([
    ctx.router.blacklist(addr),
    ctx.router.paused().catch(() => false),
    ctx.xaut.balanceOf(addr),
    ctx.xaut.allowance(addr, ctx.routerAddr),
  ]);
  if (isBlocked) throw new Error('Router: sender is blacklisted — cannot mint');
  if (pausedState) throw new Error('Router: paused — cannot mint');
  if (xautBal < amount) throw new Error(`Insufficient XAUT balance (have ${formatUnits(xautBal, decimals)}, need ${args.amount})`);
  if (allowance < amount) throw new Error(`Insufficient allowance (have ${formatUnits(allowance, decimals)}); run approve first`);

  const xaueBefore = await ctx.xaue.balanceOf(addr);
  const tx = await ctx.router.mint(amount);
  const receipt = await waitOk(tx, 'mint');
  const xaueAfter = await ctx.xaue.balanceOf(addr);
  const xaueDelta = xaueAfter - xaueBefore;

  emit({
    address: addr,
    xautAmount: formatUnits(amount, decimals),
    xaueAmount: formatUnits(xaueDelta, ctx.cfg.tokens.XAUE.decimals),
    ...receipt,
  });
}

// --------------------------------------------------------------------------
// requestRedeem — parse routerReqId / navReqId from event
// --------------------------------------------------------------------------

async function cmdRequestRedeem(args) {
  if (!args.amount) throw new Error('--amount is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const decimals = ctx.cfg.tokens.XAUE.decimals;
  const amount = parseUnits(String(args.amount), decimals);
  if (amount <= 0n) throw new Error('--amount must be greater than 0');
  const addr = await walletAddress(ctx);

  const [isBlocked, pausedState, xaueBal, allowance] = await Promise.all([
    ctx.router.blacklist(addr),
    ctx.router.paused().catch(() => false),
    ctx.xaue.balanceOf(addr),
    ctx.xaue.allowance(addr, ctx.routerAddr),
  ]);
  if (isBlocked) throw new Error('Router: sender is blacklisted — cannot requestRedeem');
  if (pausedState) throw new Error('Router: paused — cannot requestRedeem');
  if (xaueBal < amount) throw new Error(`Insufficient XAUE balance (have ${formatUnits(xaueBal, decimals)}, need ${args.amount})`);
  if (allowance < amount) throw new Error(`Insufficient allowance; run approve first`);

  const tx = await ctx.router.requestRedeem(amount);
  // Wait for confirmation and parse event from the same receipt — no second RPC call.
  const rec = await tx.wait(1);
  if (!rec || rec.status !== 1) throw new Error(`requestRedeem: transaction reverted (${tx.hash})`);

  // Parse RedemptionRequestedViaRouter(routerReqId, navReqId, user, xaueAmount)
  const iface = ctx.router.interface;
  let parsed = null;
  for (const log of rec.logs ?? []) {
    try {
      const d = iface.parseLog(log);
      if (d?.name === 'RedemptionRequestedViaRouter') { parsed = d.args; break; }
    } catch { /* foreign log; skip */ }
  }
  // If the event was not found in the receipt, emit null and ask the user to
  // run `list` to find their routerReqId. Do NOT fall back to nextRouterReqId-1
  // because that value races with concurrent requestRedeem calls from other users.

  emit({
    address: addr,
    xaueAmount: formatUnits(amount, decimals),
    routerReqId: parsed?.routerReqId ?? null,
    ...(parsed === null && { warning: 'routerReqId not found in logs — run `list` to locate your request' }),
    navReqId: parsed?.navReqId ?? null,
    txHash: tx.hash,
    gasUsed: rec.gasUsed,
    blockNumber: rec.blockNumber,
  });
}

// --------------------------------------------------------------------------
// status / request / list
// --------------------------------------------------------------------------

async function readRouterRequest(ctx, reqId) {
  const row = await ctx.router.routerRedemptions(reqId);
  return {
    id: row[0],
    user: row[1],
    navReqId: row[2],
    xaueAmount: row[3],
    requestedAt: row[4],
    xautClaimed: row[5],
    rejectedSharesClaimed: row[6],
  };
}

async function cmdStatus(args) {
  if (args.reqId == null) throw new Error('--req-id is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: false });
  const reqId = BigInt(args.reqId);
  const [row, statusIdx] = await Promise.all([
    readRouterRequest(ctx, reqId),
    ctx.router.getRouterRedemptionStatus(reqId),
  ]);
  if (row.user === ZeroAddress) throw new Error(`Request ${args.reqId} does not exist`);

  const statusName = ROUTER_STATUS[Number(statusIdx)] ?? `Unknown(${statusIdx})`;
  emit({
    routerReqId: reqId,
    navReqId: row.navReqId,
    user: row.user,
    xaueAmount: formatUnits(row.xaueAmount, ctx.cfg.tokens.XAUE.decimals),
    xaueAmountRaw: row.xaueAmount,
    requestedAt: row.requestedAt,
    status: statusName,
    statusCode: Number(statusIdx),
    xautClaimed: row.xautClaimed,
    rejectedSharesClaimed: row.rejectedSharesClaimed,
  });
}

async function cmdRequest(args) {
  if (args.reqId == null) throw new Error('--req-id is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: false });
  const row = await readRouterRequest(ctx, BigInt(args.reqId));
  if (row.user === ZeroAddress) throw new Error(`Request ${args.reqId} does not exist`);
  emit({
    routerReqId: row.id,
    user: row.user,
    navReqId: row.navReqId,
    xaueAmount: formatUnits(row.xaueAmount, ctx.cfg.tokens.XAUE.decimals),
    xaueAmountRaw: row.xaueAmount,
    requestedAt: row.requestedAt,
    xautClaimed: row.xautClaimed,
    rejectedSharesClaimed: row.rejectedSharesClaimed,
  });
}

async function cmdList(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: !args.user });
  const user = args.user || await walletAddress(ctx);
  if (!isAddress(user)) throw new Error(`Invalid --user address: ${user}`);

  const latest = await ctx.provider.getBlockNumber();
  const lookback = BigInt(ctx.cfg.event_scan?.default_lookback_blocks ?? 200000);
  const fromBlock = args.fromBlock ? BigInt(args.fromBlock) : BigInt(latest) - lookback;
  const from = fromBlock < 0n ? 0n : fromBlock;
  const MAX_SCAN_RANGE = 500_000n;
  if (BigInt(latest) - from > MAX_SCAN_RANGE) {
    throw new Error(
      `Block range too large (${BigInt(latest) - from} blocks). ` +
      `Use --from-block with a recent block number, or adjust event_scan.default_lookback_blocks.`,
    );
  }

  const filter = ctx.router.filters.RedemptionRequestedViaRouter(null, null, user);
  const events = await ctx.router.queryFilter(filter, Number(from), latest);

  const rows = events.map((e) => ({
    routerReqId: e.args?.routerReqId,
    navReqId: e.args?.navReqId,
    xaueAmount: formatUnits(e.args?.xaueAmount ?? 0n, ctx.cfg.tokens.XAUE.decimals),
    blockNumber: e.blockNumber,
    txHash: e.transactionHash,
  }));

  emit({ user, fromBlock: from, toBlock: BigInt(latest), count: rows.length, items: rows });
}

// --------------------------------------------------------------------------
// claim-xaut / claim-rejected
// --------------------------------------------------------------------------

async function cmdClaimXaut(args) {
  if (args.reqId == null) throw new Error('--req-id is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const addr = await walletAddress(ctx);
  const reqId = BigInt(args.reqId);

  const row = await readRouterRequest(ctx, reqId);
  if (row.user === ZeroAddress) throw new Error(`Request ${reqId} does not exist`);
  if (row.user.toLowerCase() !== addr.toLowerCase()) throw new Error('Request does not belong to this wallet');
  if (row.xautClaimed) throw new Error('XAUT already claimed for this request');

  const statusIdx = Number(await ctx.router.getRouterRedemptionStatus(reqId));
  if (statusIdx !== ROUTER_STATUS_CODES.Claimable) {
    throw new Error(`Request status is ${ROUTER_STATUS[statusIdx]}; must be Claimable to claim XAUT`);
  }

  const xautBefore = await ctx.xaut.balanceOf(addr);
  const tx = await ctx.router.claimXaut(reqId);
  const receipt = await waitOk(tx, 'claimXaut');
  const xautAfter = await ctx.xaut.balanceOf(addr);
  const delta = xautAfter - xautBefore;

  emit({
    address: addr,
    routerReqId: reqId,
    xautAmount: formatUnits(delta, ctx.cfg.tokens.XAUT.decimals),
    ...receipt,
  });
}

async function cmdClaimRejected(args) {
  if (args.reqId == null) throw new Error('--req-id is required');
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const addr = await walletAddress(ctx);
  const reqId = BigInt(args.reqId);

  const row = await readRouterRequest(ctx, reqId);
  if (row.user === ZeroAddress) throw new Error(`Request ${reqId} does not exist`);
  if (row.user.toLowerCase() !== addr.toLowerCase()) throw new Error('Request does not belong to this wallet');
  if (row.rejectedSharesClaimed) throw new Error('Rejected XAUE already claimed for this request');

  const statusIdx = Number(await ctx.router.getRouterRedemptionStatus(reqId));
  if (statusIdx !== ROUTER_STATUS_CODES.Rejected) {
    throw new Error(`Request status is ${ROUTER_STATUS[statusIdx]}; must be Rejected to claim shares back`);
  }

  const xaueBefore = await ctx.xaue.balanceOf(addr);
  const tx = await ctx.router.claimRejectedShares(reqId);
  const receipt = await waitOk(tx, 'claimRejectedShares');
  const xaueAfter = await ctx.xaue.balanceOf(addr);
  const delta = xaueAfter - xaueBefore;

  emit({
    address: addr,
    routerReqId: reqId,
    xaueAmount: formatUnits(delta, ctx.cfg.tokens.XAUE.decimals),
    ...receipt,
  });
}

// --------------------------------------------------------------------------
// admin: set-blacklist / pause / unpause
// --------------------------------------------------------------------------

async function cmdSetBlacklist(args) {
  if (!args.account || !isAddress(args.account)) throw new Error('--account must be a valid address');
  if (args.blocked == null) throw new Error('--blocked true|false is required');
  const blocked = /^(true|1|yes|on)$/i.test(String(args.blocked));
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const tx = await ctx.router.setBlacklist(args.account, blocked);
  emit({ account: args.account, blocked, ...(await waitOk(tx, 'setBlacklist')) });
}

async function cmdPause(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const tx = await ctx.router.pause();
  emit({ action: 'pause', ...(await waitOk(tx, 'pause')) });
}

async function cmdUnpause(args) {
  const ctx = await buildContext({ configPath: args.configPath, needSigner: true });
  const tx = await ctx.router.unpause();
  emit({ action: 'unpause', ...(await waitOk(tx, 'unpause')) });
}

// --------------------------------------------------------------------------
// Dispatch
// --------------------------------------------------------------------------

const HANDLERS = {
  'address':        cmdAddress,
  'balance':        cmdBalance,
  'allowance':      cmdAllowance,
  'approve':        cmdApprove,
  'is-blacklisted': cmdIsBlacklisted,
  'paused':         cmdPaused,
  'config-show':    cmdConfigShow,
  'mint':           cmdMint,
  'request-redeem': cmdRequestRedeem,
  'status':         cmdStatus,
  'request':        cmdRequest,
  'list':           cmdList,
  'claim-xaut':     cmdClaimXaut,
  'claim-rejected': cmdClaimRejected,
  'set-blacklist':  cmdSetBlacklist,
  'pause':          cmdPause,
  'unpause':        cmdUnpause,
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const handler = HANDLERS[args.command];
  if (!handler) throw new Error(`Unhandled command: ${args.command}`);
  await handler(args);
}

main().catch((err) => {
  const payload = { error: err?.message || String(err) };
  if (err?.code) payload.code = err.code;
  if (err?.info?.error?.message) payload.reason = err.info.error.message;
  process.stderr.write(JSON.stringify(payload) + '\n');
  process.exit(1);
});

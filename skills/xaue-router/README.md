# xaue-router

Mint and redeem XAUE tokens via the XAUERouter contract directly from your AI assistant.

## Prerequisites

- Node.js >= 20.19.0
- xaut-trade installed with WDK wallet setup completed (`~/.aurehub/.wdk_vault`)
- A deployed XAUERouter contract address

## Installation

```bash
npx skills add aurehub/skills
# Select xaue-router in the prompt
```

## First-time setup

xaue-router shares your WDK wallet with xaut-trade — no separate wallet creation needed.

Install xaut-trade first if you haven't already:
```bash
npx skills add aurehub/skills   # select xaut-trade, complete wallet setup
```

Then copy the config template and fill in the contract addresses:
```bash
# Resolve skill directory first
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/skills/xaue-router" ] && SKILL_DIR="$GIT_ROOT/skills/xaue-router"
[ -z "$SKILL_DIR" ] && SKILL_DIR=$(dirname "$(find -L "$HOME" -maxdepth 6 -type f -path "*/xaue-router/config.example.yaml" 2>/dev/null | head -1)")

cp "$SKILL_DIR/config.example.yaml" ~/.aurehub/router.yaml
# Edit ~/.aurehub/router.yaml — fill in router, nav4626, and XAUE token addresses
```

Add `ETH_RPC_URL` to `~/.aurehub/.env` if not already present:
```
ETH_RPC_URL=https://mainnet.infura.io/v3/<key>
```

Then say to your AI assistant:

> "Mint 10 XAUE" or "Check my XAUE balance"

## Usage examples

```
Mint 10 XAUE with XAUT
Redeem 5 XAUE
Check my router redemption status for request 3
Claim XAUT for request 3
```

## Directory

```
xaue-router/
├── SKILL.md                 skill definition (flows + triggers)
├── README.md                this file
├── config.example.yaml      Router / Nav4626 / XAUT / XAUE config template
└── scripts/
    ├── package.json         Node 20+ / ethers ^6 / sodium-native / js-yaml
    ├── router.js            CLI: all contract calls
    └── lib/
        ├── abi.js           Router + Nav4626 + ERC20 ABI
        ├── config.js        router.yaml loader with placeholder validation
        ├── provider.js      ETH_RPC_URL + FallbackProvider
        └── signer.js        self-contained WDK vault decryption
```

## CLI Reference

| Command | Purpose |
|---------|---------|
| `address` / `balance` | Wallet address & ETH/XAUT/XAUE balances |
| `allowance --token XAUT\|XAUE` | ERC-20 allowance to Router |
| `approve --token … --amount N` | Approve Router (XAUT auto reset-to-zero) |
| `is-blacklisted --account 0x…` | Router blacklist lookup |
| `paused` | Router pause state |
| `mint --amount N` | XAUT → XAUE |
| `request-redeem --amount N` | Initiate redeem, returns `routerReqId` + `navReqId` |
| `status --req-id N` | User-visible status (Pending/Claimable/Rejected/Claimed) |
| `request --req-id N` | Full `routerRedemptions()` row |
| `list [--user 0x…] [--from-block N]` | Scan `RedemptionRequestedViaRouter` events |
| `claim-xaut --req-id N` | Claim XAUT after approval |
| `claim-rejected --req-id N` | Reclaim XAUE after rejection |

All commands emit single-line JSON to stdout; errors go to stderr with a non-zero exit code.

## Wallet

WDK mode only: `~/.aurehub/.wdk_vault` + `~/.aurehub/.wdk_password` (chmod 600). Set `WALLET_MODE=wdk` in `~/.aurehub/.env`. Runtime `PRIVATE_KEY` is always rejected.

# Onboarding

xaue-router uses the WDK wallet shared with xaut-trade. No separate wallet creation needed.

## Step 1: Ensure xaut-trade wallet is set up

Check if the vault exists:
```bash
ls ~/.aurehub/.wdk_vault 2>/dev/null && echo EXISTS || echo NOT_FOUND
ls ~/.aurehub/.wdk_password 2>/dev/null && echo EXISTS || echo NOT_FOUND
```

If either is NOT_FOUND: xaut-trade must be installed and its wallet setup completed first.

```bash
npx skills add aurehub/skills   # select xaut-trade
```

Then follow xaut-trade's wallet setup, and return here.

## Step 2: Install dependencies

Resolve the scripts directory first:
```bash
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/skills/xaue-router/scripts" ] && SCRIPTS_DIR="$GIT_ROOT/skills/xaue-router/scripts"
[ -z "$SCRIPTS_DIR" ] && SCRIPTS_DIR=$(dirname "$(find -L "$HOME" -maxdepth 6 -type f -path "*/xaue-router/scripts/router.js" 2>/dev/null | head -1)")
```

Then install:
```bash
cd "$SCRIPTS_DIR" && npm install
```

## Step 3: Configure router.yaml

```bash
cp "$(dirname "$SCRIPTS_DIR")/config.example.yaml" ~/.aurehub/router.yaml
```

Edit `~/.aurehub/router.yaml` — fill in the three `REPLACE_ME` fields:

```yaml
contracts:
  router: "0x..."    # deployed XAUERouter proxy address
  nav4626: "0x..."   # underlying Nav4626 vault address

tokens:
  XAUE:
    address: "0x..."  # XAUE / Nav4626 share token address
```

XAUT mainnet address is pre-filled and does not need to change.

## Step 4: Add ETH_RPC_URL to ~/.aurehub/.env

xaut-trade's setup creates `~/.aurehub/.env` with `WALLET_MODE=wdk`. Add the Ethereum RPC endpoint if not already present:

```
ETH_RPC_URL=https://mainnet.infura.io/v3/<key>
```

Optionally add a fallback:
```
ETH_RPC_URL_FALLBACK=https://eth.llamarpc.com
```

## Step 5: Verify

```bash
source ~/.aurehub/.env
node "$SCRIPTS_DIR/router.js" config-show
node "$SCRIPTS_DIR/router.js" address
node "$SCRIPTS_DIR/router.js" balance
```

Expected: config JSON with real addresses, wallet address, ETH/XAUT/XAUE balances.

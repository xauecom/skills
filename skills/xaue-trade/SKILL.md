---
name: xaue-trade
description: Query XAUE token data and market information via MCP tools. Get NAV, APY, supply, reserves, backing ratio, health metrics, and educational knowledge about XAUE/XAUT.
license: MIT
compatibility:
  platforms:
    - claude-code
    - cline
    - sdk
  languages:
    - english
metadata:
  category: trading
  domain: finance
  complexity: intermediate
---

# xaue-trade Skill Specification

## Chapter 1: When to Use This Skill

Use xaue-trade to query XAUE token data, market metrics, and educational information about the XAUE/XAUT ecosystem.

### Trigger Patterns by Intent

| Intent | Example Triggers | Action |
|--------|------------------|--------|
| **NAV (Net Asset Value)** | "What's the XAUE price?", "Current XAUE NAV?", "XAUE token value" | Query xaue_get_nav for current NAV and price |
| **APY (Annual Percentage Yield)** | "What's the XAUE APY?", "XAUE yield rate?", "Current annual return" | Query xaue_get_apy for current yield |
| **Supply Metrics** | "XAUE total supply?", "How many XAUE tokens exist?", "Circulating supply" | Query xaue_get_supply for token metrics |
| **Reserves** | "What XAUT is backing XAUE?", "Backing reserves?", "How much XAUT is held?" | Query xaue_get_reserves for reserve amounts |
| **Backing Ratio** | "Backing ratio?", "How is XAUE backed?", "Coverage percentage?" | Combine supplies and reserves for ratio calculation |
| **Health Check** | "Is XAUE healthy?", "Token status?", "Full health metrics?" | Query NAV, supply, reserves (combined) |
| **Knowledge** | "What is XAUE?", "Difference between XAUE and XAUT?", "How does XAUE work?" | Answer from knowledge base, no MCP needed |
| **Trade Info** | "Buy XAUE?", "Trade XAUE on Uniswap?", "How to trade XAUE?" | Explain where/how to trade, no direct execution |

### Out of Scope

- **Direct trading execution** — This skill queries data only; use `xaut-trade` for trading on Ethereum
- **Price speculation** — Skill provides data; users make investment decisions
- **Wallet management** — Use `xaut-trade` for wallet operations
- **Advanced derivatives** — Not currently supported
- **Cross-chain data** — XAUE/XAUT operate only on Ethereum mainnet

---

## Chapter 2: MCP Dependency & Tool Availability

### Tools Provided by xaue-mcp-server

| Tool Name | Purpose | Status | Response Format |
|-----------|---------|--------|-----------------|
| `xaue_get_nav` | Current Net Asset Value in USD | Primary | `{ nav: float, timestamp: string, currency: "USD" }` |
| `xaue_get_apy` | Current Annual Percentage Yield | Primary | `{ apy: float, period: "annual", timestamp: string }` |
| `xaue_get_supply` | Token supply metrics (total, circulating) | Primary | `{ total: float, circulating: float, locked: float, timestamp: string }` |
| `xaue_get_reserves` | XAUT backing reserves held | Primary | `{ xaut_held: float, currency: "XAUT", timestamp: string }` |
| `xaue_get_health` | Combined health metrics (optional direct call) | Fallback | `{ nav: float, supply: float, backing_ratio: float, timestamp: string }` |

### Communication & Security

**Data Access:** All MCP tools communicate with xaue-mcp-server via Model Context Protocol. Requests are stateless (no authentication required for read-only queries). Server is stateless and designed for high-volume queries.

**Security Statement:** This skill provides read-only access to public market data. No private keys, wallet addresses, or user account information is transmitted. All data is publicly available through the XAUE smart contracts on Ethereum mainnet.

**HTTPS/TLS:** MCP server communication uses TLS 1.3 for transport security. Data returned is deterministic based on blockchain state.

### Dynamic Tool Discovery

**How it works:** When the MCP server is first loaded, it exposes tool definitions to Claude. Tools are discovered automatically during model startup.

**Fallback mechanism:** If a specific tool is unavailable:
1. Check if alternative tools can provide the same data
2. Combine simpler tools to compute complex metrics
3. Fall back to cached data if available (timestamp > 5 minutes old)

**Examples:**
- If `xaue_get_health` unavailable → call `xaue_get_nav`, `xaue_get_supply`, `xaue_get_reserves` separately and combine
- If `xaue_get_reserves` unavailable → inform user that backing information is temporarily unavailable
- If all tools unavailable → display cached data (if within 5 min) or error message directing user to `references/mcp-setup.md`

### Availability Check Instructions

**Before responding to a query:**
1. Check if MCP tools are available (attempt a simple `xaue_get_nav` call)
2. If tools unavailable, display:
   ```
   MCP server is not responding. Setup instructions:
   - See references/mcp-setup.md for configuration
   - Restart Claude Code and wait 5 seconds
   - Verify .mcp.json contains xaue-mcp-server configuration
   ```
3. If tools timeout after 10 seconds, retry once
4. If retry fails, display error and suggest mcp-setup.md

---

## Chapter 3: Intent Detection & Output Formatting

### Intent → Tool Mapping

When users query XAUE data, detect intent and call appropriate tools:

| User Intent | Primary Tool | Secondary Tools | Output Include |
|-------------|--------------|-----------------|-----------------|
| NAV query | xaue_get_nav | — | Price, timestamp, currency |
| APY query | xaue_get_apy | — | Yield %, period, timestamp |
| Supply query | xaue_get_supply | — | Total, circulating, locked |
| Reserves query | xaue_get_reserves | — | XAUT held, timestamp |
| Backing ratio | xaue_get_reserves, xaue_get_supply | — | Ratio %, reserves, supply |
| Health check | xaue_get_nav, xaue_get_supply, xaue_get_reserves | — | All metrics in summary |
| Knowledge | (none) | — | Explanation text |
| Trade info | (none) | — | General guidance, no MCP call |

### 3.1 Combined Query Pattern: Health Check

**Trigger phrases:** "Is XAUE healthy?", "Full XAUE status", "All XAUE metrics", "Token health check"

**Flow:**
1. Call `xaue_get_nav` for current NAV
2. Call `xaue_get_supply` for token supply metrics
3. Call `xaue_get_reserves` for backing reserves
4. Calculate backing ratio: `(XAUT_held / total_supply) * 100`
5. Present in unified format below

**Output Template:**
```
XAUE Health Report
==================
Price (NAV): $X.XX per token
Annual Yield: X.X%
Total Supply: X,XXX,XXX tokens
Circulating: X,XXX,XXX tokens
XAUT Reserves: X,XXX XAUT
Backing Ratio: XX.X%

Status: HEALTHY [shows green if ratio > 100%, yellow if 95-100%, red if < 95%]
Last Updated: 2024-04-15 14:23:45 UTC
```

**Example response:**
```
XAUE Health Report
==================
Price (NAV): $2,047.85 per token
Annual Yield: 4.2%
Total Supply: 50,000 tokens
Circulating: 48,500 tokens
XAUT Reserves: 102,385 XAUT
Backing Ratio: 102.4%

Status: HEALTHY
Last Updated: 2024-04-15 14:23:45 UTC
```

### 3.2 Output Formatting Rules

Apply these rules consistently across all output:

**NAV Output:**
```
XAUE/USD Exchange Rate
Price: $X,XXX.XX per token
Status: [Price in bullish/neutral/cautious range based on historical context]
Updated: YYYY-MM-DD HH:MM:SS UTC
```

**APY Output:**
```
XAUE Annual Yield
Current APY: X.XX%
Compounding: Daily (assumed)
Period: Annual
Updated: YYYY-MM-DD HH:MM:SS UTC
```

**Supply Output:**
```
XAUE Token Supply
Total Supply: X,XXX,XXX tokens
Circulating Supply: X,XXX,XXX tokens
Locked/Reserved: X,XXX tokens
Percentage Circulating: XX.X%
Updated: YYYY-MM-DD HH:MM:SS UTC
```

**Reserves Output:**
```
XAUE Backing Reserves
XAUT Holdings: X,XXX XAUT
USD Value (at NAV): $X,XXX,XXX
Backing Ratio: XX.X%
Last Verified: YYYY-MM-DD HH:MM:SS UTC
```

**Formatting Rules (all outputs):**
- Decimal places: prices to 2 places, percentages to 1 place, quantities to integer
- Number formatting: use commas for thousands (1,000 not 1000)
- Timestamps: always UTC, format YYYY-MM-DD HH:MM:SS UTC
- Currency: USD with $ prefix for prices, XAUT for reserve amounts
- Status labels: use HEALTHY, CAUTION, CRITICAL based on backing ratio and price stability

---

## Chapter 4: Error Handling

Handle MCP errors gracefully with clear, actionable messages:

### Scenario 1: Tool Returns ok: false

**Error response from MCP:**
```json
{ "ok": false, "error": "Invalid parameters" }
```

**User message:**
```
Could not retrieve XAUE data. The query may be malformed.
Try asking: "What's the current XAUE price?" or "Get XAUE supply metrics"
If the problem persists, see: references/mcp-setup.md
```

### Scenario 2: MCP Server Unavailable

**Detection:** Connection timeout after 5 seconds, no response from xaue-mcp-server

**User message:**
```
MCP server is not responding. Setup instructions:
1. Verify .mcp.json in project root (see references/mcp-setup.md)
2. Restart Claude Code or Cline
3. Wait 5 seconds for server to initialize
If issue continues, check xaue-mcp-server repository: github.com/xauecom/xaue-mcp-server
```

### Scenario 3: RPC Connectivity Issues (Transient)

**Detection:** MCP server responds but indicates blockchain RPC failure

**User message:**
```
Temporary connectivity issue with Ethereum mainnet.
This usually resolves within seconds. Retrying...
(Retry once automatically. If still failing after 10 seconds, display:)
Unable to reach Ethereum mainnet RPC. This is typically temporary.
Try again in a few seconds. If repeated, the RPC provider may be experiencing issues.
```

### Scenario 4: Backing Query Returns TODO

**Detection:** `xaue_get_health` or combined reserves call returns placeholder data

**User message:**
```
Backing information is not yet available for this metric.
Available data: [show NAV, supply, etc. if retrieved]
Check back shortly — data is being calculated.
```

### Scenario 5: MCP Tool Timeout

**Detection:** Tool call exceeds 10 seconds

**User message:**
```
Query took too long. Retrying...
(Retry once. If timeout again:)
The XAUE data service is responding slowly.
Try again in a moment. If problem persists, see: references/mcp-setup.md
```

### Scenario 6: Ambiguous User Intent

**Detection:** Query could map to multiple intents (e.g., "XAUE price" could mean NAV or trade price)

**User message:**
```
Your question could mean a few things. Did you mean:
1. Current XAUE token price (NAV) — "What's the current XAUE price?"
2. How to buy/sell XAUE — "Where can I trade XAUE?"
3. Historical price information — "XAUE price history"

Let me know which one, or ask more specifically!
```

### Scenario 7: Unsupported Trade Intent

**Detection:** User asks to execute a trade (e.g., "Buy 10 XAUE")

**User message:**
```
This skill provides data about XAUE only. To actually trade:
- Use the xaut-trade skill: "Buy 1 XAUT on Ethereum"
- Or trade XAUE on Uniswap directly at [DEX link]

I can help with: prices, APY, supply, reserves, and general XAUE information.
```

### Retry Logic Guidelines

- **Transient errors (RPC, timeout):** Retry once after 2 seconds
- **Server unavailable:** Do not retry; show setup instructions
- **Invalid parameters:** Do not retry; ask for clarification
- **Ambiguous intent:** Ask user to clarify (no retry)
- **After retry fails:** Show error message and reference `references/mcp-setup.md`

---

## Chapter 5: Knowledge Base

Answer conceptual questions about XAUE without calling MCP tools.

### What is XAUE?

XAUE is a digital token that provides synthetic exposure to XAUT (Tether Gold) on Ethereum mainnet. The token is backed 1:1 by XAUT reserves held in custody, giving holders indirect access to physical gold backing.

**Key characteristics:**
- **Symbol:** XAUE
- **Blockchain:** Ethereum mainnet
- **Standard:** ERC-20 compliant
- **Reserve:** Each XAUE is backed by 1 XAUT held in reserve
- **APY:** Earns annual yield from XAUT staking and reserve operations

### Key Facts

**Contracts:**
- XAUE Token: `0x[contract_address_on_ethereum]`
- Reserves held in: Ethereum addresses managed by Tether / issuer custody

**XAUT Reference:**
- XAUT is Tether Gold (1 token = 1 troy ounce of physical gold)
- XAUT trades on Ethereum and other blockchains
- Physical gold is stored in London vaults
- Denominated in USD for smart contract operations

**Reserve Model:**
- XAUE supply is controlled by reserve availability
- New XAUE tokens minted when XAUT is deposited
- XAUE tokens burned when withdrawn for XAUT
- Reserve ratio is published daily for transparency

### XAUE vs XAUT Comparison

| Aspect | XAUE | XAUT |
|--------|------|------|
| **What it is** | Synthetic token on Ethereum | Native Tether Gold token |
| **Blockchain** | Ethereum only | Multi-chain (Ethereum, Tron, Polygon, others) |
| **Backing** | 1:1 backed by XAUT reserves | 1:1 backed by physical gold |
| **Reserve** | Holds XAUT | Holds gold in London vaults |
| **Yield** | Earns APY from operations | No yield (store of value) |
| **Use Case** | Earn on gold exposure via DeFi | Direct gold ownership on blockchain |
| **Where to trade** | Uniswap, DEXes on Ethereum | Most major DEXes and CEXes |
| **Liquidity** | Depends on XAUE pool depth | Higher (more widely traded) |
| **Custody** | Smart contract on Ethereum | Tether corporate custody |

### When to Use Knowledge Base

Provide knowledge base answers for:
- **"What is XAUE?"** — Conceptual overview
- **"How is XAUE backed?"** — Explain reserve model
- **"Difference between XAUE and XAUT?"** — Use comparison table
- **"How does XAUE work?"** — Describe minting/burning, yield model
- **"Where is the gold stored?"** — Explain Tether custody in London
- **"Is XAUE a good investment?"** — Redirect to user's financial advisor; can describe mechanics

Do NOT answer with knowledge base if user asks for:
- Current price or metrics → Use MCP tools
- Real-time APY or supply → Use MCP tools
- Historical data → Use MCP tools (if available)
- Investment advice → Explain mechanics, defer to user judgment

---

**End of SKILL.md**

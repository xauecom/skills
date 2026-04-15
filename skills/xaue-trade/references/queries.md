# Detailed Query Flows for XAUE Data

This document provides step-by-step flows for all 6 query types the xaue-trade skill handles. Each flow shows the user question, MCP tool calls, response handling, and output formatting.

---

## Query 1: NAV (Exchange Rate)

**Trigger phrases:** "What's the XAUE price?", "Current XAUE NAV?", "XAUE/XAUT exchange rate"

### Flow Steps

1. **Detect Intent**
   - User asks for current price or NAV
   - Route to `xaue_get_nav` tool

2. **Call MCP Tool**
   - Tool: `xaue_get_nav` (no parameters required)
   - Check response: `ok: true` before proceeding
   - Extract: `nav` (float), `timestamp` (string)

3. **Handle Response**
   - If `ok: true`: proceed to formatting
   - If `ok: false`: show error message (see Chapter 4 in SKILL.md)
   - If timeout: retry once after 2 seconds

4. **Format and Return**
   - Apply formatting rules: 2 decimals, USD currency, commas for thousands
   - Include timestamp in UTC format
   - Return to user

### Example MCP Response

```json
{
  "ok": true,
  "nav": 2047.85,
  "timestamp": "2024-04-15T14:23:45Z",
  "currency": "USD"
}
```

### Output Template

```
XAUE/USD Exchange Rate
======================
Price: $2,047.85 per token
Updated: 2024-04-15 14:23:45 UTC
```

### Formatting Rules

- NAV to 2 decimal places
- Use comma separators for thousands
- Currency label: USD with $ prefix
- Timestamp: ISO format converted to YYYY-MM-DD HH:MM:SS UTC

---

## Query 2: APY (Annual Percentage Yield)

**Trigger phrases:** "What's the XAUE APY?", "XAUE yield rate?", "Current annual return"

### Flow Steps

1. **Detect Intent**
   - User asks for yield, APY, or annual return
   - Route to `xaue_get_apy` tool

2. **Call MCP Tool**
   - Tool: `xaue_get_apy` (no parameters required)
   - Check response: `ok: true` before proceeding
   - Extract: `apy` (float), `period` (string), `timestamp` (string)

3. **Handle Response**
   - If `ok: true`: proceed to formatting
   - If `ok: false`: show error message
   - If timeout: retry once after 2 seconds

4. **Format and Return**
   - Apply formatting rules: 2 decimals, percentage notation
   - Include timestamp and period
   - Return to user

### Example MCP Response

```json
{
  "ok": true,
  "apy": 4.25,
  "period": "annual",
  "timestamp": "2024-04-15T14:23:45Z"
}
```

### Output Template

```
XAUE Annual Yield
==================
Current APY: 4.25%
Compounding: Daily (assumed)
Period: Annual
Updated: 2024-04-15 14:23:45 UTC
```

### Formatting Rules

- APY to 2 decimal places
- Always show with % symbol
- Period as-is from MCP response (annual, quarterly, etc.)
- Timestamp: YYYY-MM-DD HH:MM:SS UTC

---

## Query 3: Supply (Total Circulating)

**Trigger phrases:** "How much XAUE is in circulation?", "XAUE total supply?", "Circulating tokens"

### Flow Steps

1. **Detect Intent**
   - User asks for supply, circulation, or token metrics
   - Route to `xaue_get_supply` tool

2. **Call MCP Tool**
   - Tool: `xaue_get_supply` (no parameters required)
   - Check response: `ok: true` before proceeding
   - Extract: `total` (float), `circulating` (float), `locked` (float), `timestamp` (string)

3. **Handle Response**
   - If `ok: true`: proceed to formatting
   - If `ok: false`: show error message
   - If timeout: retry once after 2 seconds

4. **Format and Return**
   - Apply formatting rules: integer quantities, comma separators
   - Calculate percentage circulating: (circulating / total) * 100
   - Return to user

### Example MCP Response

```json
{
  "ok": true,
  "total": 50000,
  "circulating": 48500,
  "locked": 1500,
  "timestamp": "2024-04-15T14:23:45Z"
}
```

### Output Template

```
XAUE Token Supply
==================
Total Supply: 50,000 tokens
Circulating Supply: 48,500 tokens
Locked/Reserved: 1,500 tokens
Percentage Circulating: 97.0%
Updated: 2024-04-15 14:23:45 UTC
```

### Formatting Rules

- All quantities as integers (no decimals)
- Use comma separators for thousands
- Percentage to 1 decimal place
- Timestamp: YYYY-MM-DD HH:MM:SS UTC

---

## Query 4: Reserves (XAUt Backing)

**Trigger phrases:** "What are XAUE's reserves?", "How much XAUT is held?", "Backing reserves?"

### Flow Steps

1. **Detect Intent**
   - User asks for reserves, backing, or XAUt holdings
   - Route to `xaue_get_reserves` tool

2. **Call MCP Tool**
   - Tool: `xaue_get_reserves` (no parameters required)
   - Check response: `ok: true` before proceeding
   - Extract: `reserves` (array of objects with address and amount) or `xaut_held` (float), `timestamp` (string)

3. **Handle Response**
   - If `ok: true`: proceed to formatting
   - If `ok: false`: show error message
   - If timeout: retry once after 2 seconds
   - Sum all reserve addresses if multiple

4. **Format and Return**
   - Apply formatting rules: comma separators, 0 decimals for quantities
   - Show per-address breakdown if available
   - Include total and timestamp
   - Return to user

### Example MCP Response

```json
{
  "ok": true,
  "reserves": [
    {
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "amount": 34125.50
    },
    {
      "address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      "amount": 34125.50
    },
    {
      "address": "0xfedcbafedcbafedcbafedcbafedcbafedcbafed",
      "amount": 34134.75
    }
  ],
  "timestamp": "2024-04-15T14:23:45Z"
}
```

### Output Template

```
XAUE Backing Reserves
======================
Reserve Address 1: 34,125.50 XAUT
Reserve Address 2: 34,125.50 XAUT
Reserve Address 3: 34,134.75 XAUT
---
Total XAUT Held: 102,385 XAUT
Last Verified: 2024-04-15 14:23:45 UTC
```

### Formatting Rules

- Individual amounts to 2 decimals
- Total as integer (round if necessary)
- Use comma separators for thousands
- Currency: XAUT (no $ for commodities)
- Timestamp: YYYY-MM-DD HH:MM:SS UTC
- Abbreviate addresses: show first 6 and last 4 chars (0x123456...abcd)

---

## Query 5: Health Check (Combined Metrics)

**Trigger phrases:** "Is XAUE healthy?", "Full XAUE status", "All XAUE metrics", "Token health check"

### Flow Steps

1. **Detect Intent**
   - User asks for overall health, all metrics, or combined view
   - Route to: `xaue_get_nav` + `xaue_get_supply` + `xaue_get_reserves` (call all 3 in parallel)

2. **Call MCP Tools (Parallel)**
   - Call 1: `xaue_get_nav` → extract nav
   - Call 2: `xaue_get_supply` → extract total supply
   - Call 3: `xaue_get_reserves` → sum all reserves
   - Wait for all 3 responses; timeout after 10 seconds total

3. **Collect and Validate**
   - Check: all 3 have `ok: true`
   - If any fails: show partial data with note about missing metric
   - If all fail: show error message

4. **Calculate Backing Ratio**
   - Formula: `(total_xaut_held / total_supply) * 100`
   - Example: (102,385 XAUT / 50,000 XAUE) * 100 = 204.77%
   - Note: Once `xaue_get_backing` is implemented, prefer that tool over this calculation

5. **Format and Return**
   - Combine all metrics in unified output
   - Determine health status:
     - Backing ratio >= 100%: HEALTHY (green)
     - Backing ratio 95-99%: CAUTION (yellow)
     - Backing ratio < 95%: CRITICAL (red)
   - Include all timestamps

### Example MCP Responses

**Call 1 - xaue_get_nav:**
```json
{
  "ok": true,
  "nav": 2047.85,
  "timestamp": "2024-04-15T14:23:45Z",
  "currency": "USD"
}
```

**Call 2 - xaue_get_supply:**
```json
{
  "ok": true,
  "total": 50000,
  "circulating": 48500,
  "locked": 1500,
  "timestamp": "2024-04-15T14:23:44Z"
}
```

**Call 3 - xaue_get_reserves:**
```json
{
  "ok": true,
  "reserves": [
    {"address": "0x1234567890abcdef1234567890abcdef12345678", "amount": 34125.50},
    {"address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", "amount": 34125.50},
    {"address": "0xfedcbafedcbafedcbafedcbafedcbafedcbafed", "amount": 34134.75}
  ],
  "timestamp": "2024-04-15T14:23:43Z"
}
```

### Output Template

```
XAUE Health Report
==================
Price (NAV): $2,047.85 per token
Total Supply: 50,000 tokens
Circulating Supply: 48,500 tokens
XAUT Reserves: 102,385 XAUT
---
Backing Ratio: 204.77%
(102,385 XAUT ÷ 50,000 XAUE = 2.0477 XAUT per token)
---
Status: HEALTHY
Last Updated: 2024-04-15 14:23:45 UTC
```

### Formatting Rules

- NAV to 2 decimals with $ prefix
- Supply quantities as integers with commas
- Reserves total as integer with commas, XAUT suffix
- Backing ratio to 2 decimals with % symbol
- Calculate backing ratio from reserve total / supply total
- Show calculation explicitly: (reserves ÷ supply = ratio per token)
- Status label: HEALTHY, CAUTION, or CRITICAL based on ratio
- Timestamp: Latest of all 3 tool calls, YYYY-MM-DD HH:MM:SS UTC

---

## Query 6: Backing (If Available)

**Trigger phrases:** "XAUE backing ratio?", "Is XAUE fully backed?", "Backing percentage?"

### Flow Steps

1. **Detect Intent**
   - User asks for backing ratio, coverage, or collateralization
   - Route to `xaue_get_backing` tool (currently returns TODO)

2. **Call MCP Tool**
   - Tool: `xaue_get_backing` (no parameters required)
   - Check response structure carefully
   - Extract: `backing_ratio` (float) or `ok` and `error` fields

3. **Handle Response**
   - If `ok: true` and `backing_ratio` present: proceed to formatting
   - If `ok: false` or tool returns TODO/placeholder:
     - Inform user backing tool is not yet implemented
     - Offer alternative: "Would you like a health check instead?" (which calculates backing)
   - If timeout: retry once after 2 seconds

4. **Format and Return**
   - Apply formatting rules: 2 decimals, percentage notation
   - Include status indicator (HEALTHY/CAUTION/CRITICAL)
   - Include timestamp
   - Return to user

### Example MCP Response (Once Implemented)

```json
{
  "ok": true,
  "backing_ratio": 204.77,
  "reserves_xaut": 102385,
  "total_supply": 50000,
  "timestamp": "2024-04-15T14:23:45Z"
}
```

### Current TODO Response

```json
{
  "ok": false,
  "error": "backing_ratio calculation not yet implemented"
}
```

### Output Template (Once Implemented)

```
XAUE Backing Ratio
===================
Backing Ratio: 204.77%
Reserves: 102,385 XAUT
Total Supply: 50,000 XAUE
Status: HEALTHY
Updated: 2024-04-15 14:23:45 UTC
```

### Current Output (TODO State)

```
XAUE Backing Ratio
===================
Backing information is not yet available.

Alternative: Try asking for a "health check" for full metrics:
- Price (NAV)
- Supply details
- Reserve amounts
- Calculated backing ratio
```

### Formatting Rules

- Backing ratio to 2 decimals with % symbol
- Reserves as integer with commas, XAUT suffix
- Supply as integer with commas, XAUE suffix
- Status: HEALTHY (≥100%), CAUTION (95-99%), CRITICAL (<95%)
- Timestamp: YYYY-MM-DD HH:MM:SS UTC

### Implementation Note

Once `xaue_get_backing` tool is fully implemented in xaue-mcp-server:
- Use this dedicated tool instead of calculating backing from health check
- Provides more accurate reserve verification from smart contract state
- Falls back to Query 5 (Health Check) if backing tool fails
- Update this flow to show full response template

---

## Summary Table

| Query | Primary Tool | Alternative | Status | Complexity |
|-------|--------------|-------------|--------|------------|
| NAV | `xaue_get_nav` | — | Ready | Simple |
| APY | `xaue_get_apy` | — | Ready | Simple |
| Supply | `xaue_get_supply` | — | Ready | Simple |
| Reserves | `xaue_get_reserves` | — | Ready | Simple |
| Health | `xaue_get_nav` + `xaue_get_supply` + `xaue_get_reserves` | (parallel) | Ready | Complex |
| Backing | `xaue_get_backing` | Health check (calculated) | TODO | Simple (once implemented) |


---
name: xaue-router
description: "Call XAUERouter contract for retail mint and redeem of XAUE. Supports mint (XAUT→XAUE), requestRedeem, claimXaut, claimRejectedShares, and redemption status queries. Triggers: mint XAUE, buy XAUE with XAUT, redeem XAUE, requestRedeem, claim XAUT, claimXaut, reclaim rejected XAUE, claimRejectedShares, router redemption status, XAUERouter, XAUE Router."
license: MIT
compatibility: "Requires Node.js >= 20.19.0, ~/.aurehub/ config directory (shared with xaut-trade), Ethereum RPC, and a deployed XAUERouter contract address. Wallet via WDK encrypted vault (created by xaut-trade setup)."
metadata:
  author: aurehub
  version: "0.1.0"
---

# xaue-router

基于文档《XAUERouter 合约规格 v0.1》实现的零售入口合约调用 skill。不修改 `Nav4626`，只通过 `XAUERouter` 代理完成散户侧 mint / redeem / claim。

## When to Use

- 用户要把 **XAUT 申购成 XAUE**：走 `mint` 流程
- 用户要**发起 XAUE 赎回**：走 `requestRedeem` 流程
- 底层批准后，用户要**领取 XAUT**：走 `claimXaut`
- 底层拒绝后，用户要**领回 XAUE**：走 `claimRejectedShares`
- 用户要**查询某笔 Router 赎回单的状态**：走 `status` 查询
- 用户不在 `Nav4626` 白名单中，但希望通过 Router 合法地完成上述操作

不适用的场景：代他人申购、代他人赎回、取消 Pending 赎回、rescue / 资金救援、手续费逻辑。首版均不支持。

## External Communications

本 skill 通过 `ETH_RPC_URL` 进行 Ethereum JSON-RPC 调用，会提交链上交易并读取 `XAUERouter` / `Nav4626` 状态。首次运行前告知用户一次即可。

## Environment & Security Declaration

### Wallet

本 skill 自包含钱包实现，支持两种模式：

WDK 模式：解密 `~/.aurehub/.wdk_vault`（XSalsa20-Poly1305 + PBKDF2）。从 `~/.aurehub/.env` 读取 `WALLET_MODE=wdk` 及相关路径变量，拒绝运行时 `PRIVATE_KEY`。vault 由 xaut-trade setup 创建，本 skill 直接复用。

### 配置文件

| 文件 | 用途 | 是否必需 |
|------|------|----------|
| `~/.aurehub/.env` | `WALLET_MODE`, `ETH_RPC_URL`, 密码路径 | 是 |
| `~/.aurehub/router.yaml` | Router 合约与代币地址（本 skill 自有） | 是 |
| `~/.aurehub/.wdk_vault` | WDK 加密 vault（由 xaut-trade setup 创建） | 是 |
| `~/.aurehub/.wdk_password` | WDK 解密密码文件，须 chmod 600（由 xaut-trade setup 创建） | 是 |

### Router 专属配置

| 变量 | 含义 | 来源 |
|------|------|------|
| `router` 合约地址 | 已部署的 `XAUERouter` 代理地址 | `~/.aurehub/router.yaml` |
| `nav4626` 合约地址 | 底层 `Nav4626` 合约地址 | `~/.aurehub/router.yaml` |
| XAUT / XAUE 地址 | ERC-20 代币地址 | `~/.aurehub/router.yaml` |

### Security safeguards

- 只使用 WDK vault，拒绝运行时 `PRIVATE_KEY`
- WDK 密码文件权限校验（必须 chmod 600）
- 所有 RPC 返回值按不可信处理；数字、地址均校验后才入日志
- 写操作（mint / requestRedeem / claimXaut / claimRejectedShares / approve）一律先预览、后执行
- approve 金额超过本次 `amountIn` 的 10 倍时强制二次确认
- 合约未部署（router 地址为 0 或 placeholder）时 hard-stop，绝不默认向未知地址签名

## Environment Readiness Check

每次会话首轮（非知识查询类）先做：

| 步骤 | 检查 | 类型 | 处理 |
|------|------|------|------|
| 1 | `~/.aurehub/.wdk_vault` 存在 | HARD STOP | 加载 [references/onboarding.md](references/onboarding.md)，引导用户完成 xaut-trade 钱包初始化 |
| 2 | `~/.aurehub/.wdk_password` 存在 | HARD STOP | 加载 [references/onboarding.md](references/onboarding.md)，引导用户完成 xaut-trade 钱包初始化 |
| 3 | `~/.aurehub/.env` 存在且含 `ETH_RPC_URL` | HARD STOP | 若不存在或缺少该变量，提示用户在 `~/.aurehub/.env` 中填入 `ETH_RPC_URL` |
| 4 | `~/.aurehub/router.yaml` 存在 | AUTO-FIX | `cp <skill-dir>/config.example.yaml ~/.aurehub/router.yaml` |
| 5 | `router.yaml` 中 `router` / `nav4626` / XAUE 地址不为占位符 | HARD STOP | 提示用户编辑 `~/.aurehub/router.yaml` 填入真实地址 |
| 6 | `<scripts-dir>/node_modules` 存在 | AUTO-FIX | `cd <scripts-dir> && npm install` |
| 7 | `node router.js address` 成功 | HARD STOP | 报出错误 JSON；加载 [references/onboarding.md](references/onboarding.md) |

写操作前额外检查：ETH 余额不足以支付 gas → hard-stop。

**Resolving SCRIPTS_DIR**（本 skill 自身 scripts 目录）：

```bash
# 1. Git repo
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
[ -n "$GIT_ROOT" ] && [ -d "$GIT_ROOT/skills/xaue-router/scripts" ] && SCRIPTS_DIR="$GIT_ROOT/skills/xaue-router/scripts"
# 2. Bounded home search
[ -z "$SCRIPTS_DIR" ] && SCRIPTS_DIR=$(dirname "$(find -L "$HOME" -maxdepth 6 -type f -path "*/xaue-router/scripts/router.js" 2>/dev/null | head -1)")
echo "$SCRIPTS_DIR"
```

**Shell 隔离约定**：每个 Bash 块开头都要 `source ~/.aurehub/.env`，否则 WALLET_MODE 等变量取不到。

### 首次运行依赖安装

```bash
cd "$SCRIPTS_DIR"
[ -d node_modules ] || npm install
```

## Intent Detection

从用户消息判断意图：

- **申购**（"申购"、"mint XAUE"、"把 X XAUT 换成 XAUE"、"buy XAUE with XAUT"）→ mint 流程
- **发起赎回**（"赎回"、"requestRedeem"、"我要赎回 X XAUE"）→ requestRedeem 流程
- **领取 XAUT**（"claimXaut"、"赎回批准了"、"取走 XAUT"）→ claimXaut 流程，需要 routerReqId
- **领回被拒 XAUE**（"claimRejectedShares"、"赎回被拒了"、"退回 XAUE"）→ claimRejectedShares 流程，需要 routerReqId
- **查状态**（"查赎回"、"我的第 N 单"、"status"、"router 赎回状态"）→ status 查询
- **参数不足**：补问 direction / amount / routerReqId，不要擅自执行

## Mint 流程（XAUT → XAUE）

### Step 1 — Pre-flight

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js balance
```

输出 JSON：`{ "address": "0x...", "ETH": "...", "XAUT": "...", "XAUE": "..." }`

检查：
- ETH 余额低于 `risk.min_eth_for_gas` → hard-stop
- XAUT 余额低于用户请求的 `xautAmount` → hard-stop，报出差额
- Router 层黑名单（可选检查）：`node router.js is-blacklisted --account <WALLET>`，命中 → hard-stop

### Step 2 — 授权 XAUT 给 Router

USDT/XAUT 同族（非标准 approve），**需先把 allowance 清零再授权**，router.js 已自动处理：

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js allowance --token XAUT
# 如果不足：
node router.js approve --token XAUT --amount <XAUT_AMOUNT>
```

若 approve 金额 > `amountIn * 10`，强制二次确认。

### Step 3 — 预览

输出给用户：
- Wallet
- Input：`<xautAmount> XAUT`
- 预期产出：对应 XAUE（若 router 暴露 preview 视图则调用；否则标注"以底层 mint 结果为准"）
- Gas 估算
- `command`: `node router.js mint --amount <xautAmount>`

### Step 4 — 执行

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js mint --amount <xautAmount>
```

输出：`{ "address": "0x...", "xautAmount": "...", "xaueAmount": "...", "txHash": "0x...", "status": "success", "gasUsed": "..." }`

执行后一律再跑 `node router.js balance` 做结果验证（XAUE 余额应上涨）。

**错误恢复**：收到 `"status": "unconfirmed"` 或 RPC 报错时，**先查余额再决定是否重试**。XAUT 余额已下降说明交易成功，不要重复签名。

## Redeem 流程（requestRedeem）

### Step 1 — Pre-flight

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js balance
```

检查：
- ETH 足以支付 gas
- XAUE 余额 ≥ `xaueAmount`
- 用户不在 Router 黑名单
- **不校验底层白名单**：Router 才需在底层白名单内，用户侧不要求

### Step 2 — 授权 XAUE 给 Router

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js allowance --token XAUE
node router.js approve --token XAUE --amount <XAUE_AMOUNT>   # 必要时
```

XAUE 按标准 ERC-20 处理（除非 `router.yaml.token_rules.XAUE.requires_reset_approve=true`）。

### Step 3 — 预览

输出：
- Wallet
- Input：`<xaueAmount> XAUE`
- 目标底层合约：`nav4626`
- Gas 估算
- 提醒：赎回是**异步审批**流程，获得 `routerReqId` 后需后续手动 claim
- `command`: `node router.js request-redeem --amount <xaueAmount>`

### Step 4 — 执行

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js request-redeem --amount <xaueAmount>
```

输出：`{ "txHash": "0x...", "routerReqId": "N", "navReqId": "M", "xaueAmount": "...", "status": "success" }`

`routerReqId` 与 `navReqId` 都从 `RedemptionRequestedViaRouter` 事件中解析。把 `routerReqId` 明显提示给用户并写入回执，用户后续 claim 要用。

## 查询赎回状态

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js status --req-id <routerReqId>
```

输出：
```json
{
  "routerReqId": "N",
  "navReqId": "M",
  "user": "0x...",
  "xaueAmount": "...",
  "requestedAt": "1714000000",
  "status": "Pending | Claimable | Rejected | Claimed",
  "xautClaimed": false,
  "rejectedSharesClaimed": false
}
```

映射规则（严格照文档 §8）：

| 底层状态 | `xautClaimed` | `rejectedSharesClaimed` | 用户视角 |
|----------|---------------|------------------------|----------|
| Pending | — | — | `Pending` |
| Executed | false | — | `Claimable` |
| Executed | true | — | `Claimed` |
| Rejected | — | false | `Rejected` |
| Rejected | — | true | `Claimed` |

**本地不镜像底层状态**，每次查询都现查 `Nav4626.redemptions(navReqId)`。

可选列出自己所有请求：`node router.js list --user <address>`（链上遍历事件，建议限制 `--from-block`）。

## 领取已批准赎回的 XAUT（claimXaut）

### Step 1 — 校验

- 先跑 `status`，要求返回 `"status": "Claimable"`
- 请求必须属于当前钱包（`user == msg.sender`）
- 若 `xautClaimed == true`：hard-stop，提示已领取

### Step 2 — 预览

- Wallet
- routerReqId / navReqId
- 预计到账 XAUT 数量（从底层记录读）
- `command`: `node router.js claim-xaut --req-id <routerReqId>`

### Step 3 — 执行

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js claim-xaut --req-id <routerReqId>
```

输出：`{ "txHash": "0x...", "routerReqId": "N", "xautAmount": "...", "status": "success" }`

> 特例（文档 §14 说明 1）：若用户在 Pending 期间被加入 Router 黑名单，仍允许 claim。代码层无需特判，但预览文案说明。

## 领回被拒赎回的 XAUE（claimRejectedShares）

### Step 1 — 校验

- 先跑 `status`，要求返回 `"status": "Rejected"`
- 请求属于当前钱包
- `rejectedSharesClaimed == true` → hard-stop

### Step 2 — 预览 + 执行

```bash
source ~/.aurehub/.env
cd "$SCRIPTS_DIR"
node router.js claim-rejected --req-id <routerReqId>
```

输出：`{ "txHash": "0x...", "routerReqId": "N", "xaueAmount": "...", "status": "success" }`

## Mandatory Safety Gates

- ETH 余额不足：hard-stop 并提示最小补充量
- 合约地址未配置 / 为 placeholder：hard-stop
- 单笔金额 ≥ `risk.large_trade_usd` 或 approve 金额 > `10x amountIn`：双确认
- 黑名单用户发起 mint / requestRedeem：预先在链下检测并 hard-stop，避免白烧 gas
- `claimXaut` 前底层状态不是 Executed：hard-stop
- `claimRejectedShares` 前底层状态不是 Rejected：hard-stop
- 任何本地标记（`xautClaimed` / `rejectedSharesClaimed`）为 true：hard-stop 并提示"已领取"

## Output Format

每次展示至少：

- `Wallet`：钱包地址
- `Stage`：`Preview` 或 `Ready to Execute` 或 `Result`
- `Input`：金额、方向、reqId
- `Contract`：Router / Nav4626 地址（Preview 阶段必显）
- `Quote`：如果能算出预期产出
- `Risk`：大额 / gas / approve 超额 / 黑名单 warning
- `Command`：将要执行的 CLI
- `Result`：txHash + Etherscan 链接 + post-trade 余额或 reqId

Etherscan 链接格式：`https://etherscan.io/tx/<txHash>`

## Error Handling

- 缺少环境变量：提示补全并停止
- RPC 失败：读操作使用 `ETH_RPC_URL_FALLBACK` 顺序重试（router.js 内置 FallbackProvider）；全部失败 → hard-stop
- `revert ERC20: insufficient allowance`：回退到 approve 流程
- `revert Router: blacklisted`：告知用户已被黑名单，仅允许 claim 路径
- `revert Pausable: paused`：告知当前合约已暂停，仅允许 claim 路径
- `revert Router: not owner of request`：reqId 不属于当前钱包
- **"unconfirmed" 状态**：**不要无脑重试**，先查 `balance` / `status`，若链上状态已前进则不要重提交
- 未知 revert：回传原始错误，不自编解释

## Contract ABI Reference

完整 ABI 定义在 [scripts/lib/abi.js](scripts/lib/abi.js)，与规格文档 §10 一一对应：

View：
- `getRouterRedemptionStatus(uint256) → uint8`（0=Pending, 1=Claimable, 2=Rejected, 3=Claimed）
- `getUnderlyingRequestId(uint256) → uint256`
- `blacklist(address) → bool`
- `routerRedemptions(uint256) → (id, user, navReqId, xaueAmount, requestedAt, xautClaimed, rejectedSharesClaimed)`

Write：
- `mint(uint256 xautAmount)`
- `requestRedeem(uint256 xaueAmount) → uint256`
- `claimXaut(uint256 routerReqId)`
- `claimRejectedShares(uint256 routerReqId)`

Events：
- `MintRouted(address indexed user, uint256 xautAmount, uint256 xaueAmount)`
- `RedemptionRequestedViaRouter(uint256 indexed routerReqId, uint256 indexed navReqId, address indexed user, uint256 xaueAmount)`
- `XautClaimed(uint256 indexed routerReqId, address indexed user, uint256 xautAmount)`
- `RejectedSharesClaimed(uint256 indexed routerReqId, address indexed user, uint256 xaueAmount)`

## First-Turn Contract

1. 信息完整：先给 `Preview`，明确列合约地址与参数，再要用户确认；用户确认后再执行。
2. 信息不全：追问关键项（方向 / 金额 / reqId / 模式），绝不自行假设。
3. 合约地址未配置：直接停止并引导用户编辑 `~/.aurehub/router.yaml`，不要用默认/占位地址签名。

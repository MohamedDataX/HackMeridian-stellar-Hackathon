# Demo script and pitch

Target: a 3-minute video, then the 5-slide HackMeridian deck.

## Before recording

1. Import the four demo accounts into Freighter (testnet): `stellar keys show admin`, `fabricant`, `fondeur`, `apporteur`. Rename them Operator, Manufacturer, Foundry, Liquidity provider.
2. `cd app && npx vite`, open http://localhost:5173.
3. As Operator, on **Demo**: click **Back to Reflector**, then open a maturity **in 4 minutes, priced as 360 days**.
4. As Liquidity provider, on **Vault**: deposit 1,000,000 if the vault holds less than 2,000,000.
5. Open Stellar Expert on the `fx_vault` contract in a second tab.

The maturity runs during the recording: start step 3 of the script within a minute of opening it.

## Video script (3 min)

| Time | Screen | Say |
|---|---|---|
| 0:00–0:25 | Hedge page | "A computer maker pays its chips in dollars and sells in euros a year ahead. If the euro falls 5 %, a one-million-euro order loses 55,000 dollars. Bank forwards are opaque and need a credit line. And foundries that pay European suppliers lose when the euro rises: their risks offset, but nothing connects them." |
| 0:25–0:55 | Manufacturer: 1,000,000 EUR, "I receive EUR", quote, **Lock** | "The quote reads the live Reflector rate and adds the interest differential: this is a forward rate, comparable to a bank's. 5 % margin, 0.3 % fee. One signature." |
| 0:55–1:15 | Foundry: "I pay EUR", **Lock**, then **Vault** gauge back to "balanced" | "The foundry hedges the opposite side. Its fee is halved because it balances the maturity. The vault's net exposure is back to zero: it only backs the gap." |
| 1:15–1:50 | Operator on **Demo**: preset **1.0800**. Foundry on **Hedges**: "Under margin", **Start margin call**, countdown, **Top up** | "The euro dips. Each hedge is marked at today's forward rate. The foundry is under its maintenance margin: anyone can start a margin call. The foundry tops up before the deadline; otherwise anyone could close it out, with a penalty to the vault." |
| 1:50–2:30 | Operator: preset **1.0793**. At maturity: **Record fixing**, **Settle** ×2, Stellar Expert | "At maturity, one fixing: the oracle record at T, the same for everyone, whenever it is called. Settlement in seconds: the manufacturer receives 5 % of the order, the foundry pays it from its margin. Both end where they planned. Every step is a Stellar transaction." |
| 2:30–2:50 | **Vault** page | "The vault kept only the fees: the share price went up with no net risk." |
| 2:50–3:00 | README | "Built on Reflector, OpenZeppelin's vault, the Stellar Asset Contract and Scaffold Stellar. Next: a pilot with a regulated FX partner." |

Backup: if the live demo fails, play `e2e/tests/fx-demo.spec.ts` in headed mode (`npx playwright test fx-demo --headed`) and record it.

## Deck (HackMeridian template, 5 slides)

### 1. Cover

**FX Hedge Vault** — Lock your EUR/USD rate from order to delivery. USDC settlement on Stellar.
Genesis track · Stellar Composed · B2B2B.

### 2. The solution

- Companies lock a **forward rate** on a monthly maturity, priced like a bank's, with **5 % margin and no credit line**.
- **Opposite exposures offset**: a maker that receives euros and a foundry that pays euros cancel out. A liquidity vault backs only the gap.
- **Clearing-house rules on-chain**: margin calls, close-out, one oracle fixing per maturity.
- **Settled in seconds in USDC**, with every step visible on Stellar.
- Distributed by a **regulated FX partner** to its business clients.

Why better: transparent price (rate, differential and fee shown before signing), no credit line, the counterparty is another industrial company rather than a bank's book.

### 3. PMF

- The pain: a 5 % euro drop on a 1,000,000 EUR order = **55,000 USD of lost margin**. In semiconductors, orders are priced months to a year before delivery.
- Who: mid-size computer, board and component makers selling in Europe; on the other side, foundries and subcontractors paying European equipment and service suppliers.
- Today: opaque OTC forwards for those with credit lines; repricing that hurts customers; idle cash buffers for the rest.
- Go-to-market: one regulated FX broker that already serves exporters; a pilot needs **one company on each side of the same maturity**.

### 4. Technical workflow

Diagram from the README, plus:

1. `quote` → Reflector EUR/USD (SEP-40) → K = S₀ × (1 + d × t).
2. `open_hedge` → margin to `fx_vault`, fee to `lp_vault` (OpenZeppelin SEP-56).
3. Net exposure per maturity; vault limit 50 % of liquidity; LP withdrawals capped to free liquidity.
4. `margin_call` / `top_up` / `close_out`, marked at today's forward.
5. `fix(T)` stores the oracle record at T once → `settle` pays from the vault or the margin.

Proof: 32 contract tests, a browser end-to-end test with real testnet transactions, contracts on testnet (addresses in the README).

### 5. The team

_To fill in: name, role, three lines each, photo._

## Questions to expect

- **"Isn't this a regulated derivative?"** Yes: an FX forward sold to companies falls under EMIR and MiFID II. That is why the protocol is infrastructure for a licensed partner, which runs KYC and distributes it.
- **"What if everyone is on the same side?"** The vault backs the gap up to 50 % of its liquidity, the fee doubles for the side that widens it, and the partner recruits both sides together. Roadmap: the vault hedges its net with EURC on the Stellar DEX.
- **"Why not just a bank forward?"** Same economics (forward rate with the interest differential), but a transparent price, 5 % margin instead of a credit line, and settlement in seconds.
- **"Who can manipulate the fixing?"** Nobody by timing: the fixing is the oracle record at T, the same whoever calls `fix` and whenever.
- **"Why is the demo rate set by hand?"** The testnet FX feed barely moves. The demo oracle relays Reflector by default; the operator sets the rate only to replay a move of the euro.

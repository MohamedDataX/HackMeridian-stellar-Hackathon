# Zepho — White paper

Version 2 · October 2026 · Stellar testnet prototype

## Summary

Zepho lets companies in the semiconductor supply chain lock a EUR/USD forward rate between the order and the delivery. Each hedge is a forward contract settled in USDC. Companies with opposite exposures offset each other on the same monthly maturity. A liquidity provider vault backs only the part that does not offset, and earns the fees.

The protocol is infrastructure. A regulated partner (FX broker, bank or payment institution) distributes it, runs KYC and holds the licence. The model is B2B2B: protocol, regulated partner, manufacturers, then their European customers, who keep a stable price.

## The problem

A manufacturer that pays its costs in dollars and sells in euros loses margin when the euro falls between the order and the delivery.

In semiconductors, that delay is counted in months. A computer maker pays chips and factories in dollars, but sets its price in euros for European distributors, often a year before delivery. If the euro loses 5 % in the meantime, a 1,000,000 EUR order brings 55,000 USD less than planned.

Current options have three flaws for a mid-size company:

- Bank forwards are negotiated over the counter. The bank's margin is not transparent and access depends on a credit line.
- Repricing moves the risk to the customer and damages the relationship.
- Cash buffers lock up working capital.

In the same chain, other companies have the opposite exposure: they pay suppliers in euros (equipment, chemicals, maintenance) and collect in dollars. Their risks offset, but nothing connects them.

## The solution

The protocol connects companies with opposite exposures on common maturities, and pays the rate difference to the side that loses with the money of the side that gains.

Four principles:

1. **Forward rate, not spot.** The locked rate includes the USD–EUR interest differential, as a bank's would. The price compares directly with a bank offer.
2. **Standard maturities.** Hedges mature on the last business day of each month. Two companies on opposite sides of the same month truly offset. A delivery on 15 March is hedged on the end-of-March maturity.
3. **One fixing per maturity.** At maturity the contract records the oracle rate once. Every hedge of that month settles at that rate, whenever settlement is called.
4. **Margin sized to the risk.** A modest initial margin, plus margin calls if the rate moves against the company, as in a clearing house.

Everything settles in USDC on Stellar. No euro moves on-chain: only the rate difference is paid.

## Mechanism

### The hedge

Each hedge is a cash-settled forward (NDF, non-deliverable forward) with six fields: the company, the EUR notional N, the side (receives or pays EUR), the forward rate K, the monthly maturity T, and the margin M deposited in USDC.

### Forward rate

At opening, the contract reads today's rate S₀ (USD per EUR) from the oracle and computes:

$$K = S_0 \times (1 + d \times t)$$

d is the annual interest differential (USD rate minus EUR rate), published by the operator from central bank rates; t is the time to maturity in days / 360. d is public and shown in the quote, so the company can compare with its bank.

The company signs the K of its quote. The contract accepts it if it is within 0.2 % of its own computation, because the rate moves between the quote and the execution.

### Fixing

After maturity T, anyone can call `fix(T)`. The contract reads the oracle's historical price at timestamp T (`price(asset, timestamp)`, SEP-40), the last record at or before T, and stores it once. A record older than 15 minutes before T is refused. The result is the same whoever calls and whenever they call. An operator bot calls `fix` right after T.

The oracle keeps 24 hours of history. If nobody fixes within that delay, settlements of that maturity are suspended until a documented operator decision.

### Settlement

With S_T the fixing and c the covered move cap:

$$\text{Receives EUR}: N \times (K - S_T) \qquad \text{Pays EUR}: N \times (S_T - K) \qquad |\text{payoff}| \le c \times N \times K$$

A positive payoff is paid by the vault to the company. A negative payoff is taken from its margin. The rest of the margin is returned.

### Margin and margin calls

- **Initial margin**: m_i × N × K, deposited at opening.
- **Unrealized loss** L: the company's loss at today's forward rate for the same maturity. That rate equals K at opening and converges to spot at maturity, so a new hedge has no unrealized loss.
- **Requirement**: the margin must stay at least L + m_m × N × K, with m_m the maintenance margin.
- **Margin call**: anyone can start it when the requirement is not met. The company has 48 hours to top up (minutes in the demo).
- **Close-out**: without a top-up, anyone can close the hedge at today's forward rate. The loss is taken from the margin, a penalty goes to the vault, the rest is returned.

The maintenance margin covers the possible move during the call delay. EUR/USD rarely moves more than 1 % in 48 hours, well under 3 %.

### Worked example

Forward rate K = 1.10. The fixing is 1.045, −5 %. Initial margin 5 %, maintenance 3 %.

| Party | Position | Market value of its euros | Vault settlement | Total in USD |
|---|---|---|---|---|
| Manufacturer | Receives 1,000,000 EUR | 1,045,000 | +55,000 | 1,100,000, as planned |
| Foundry | Pays 1,000,000 EUR | costs 1,045,000 | −55,000 | 1,100,000, as planned |
| Vault | — | — | 0 net | Keeps the fees |

During the hedge, the foundry deposits 55,000 USDC of initial margin. When the forward rate falls below 1.078, its unrealized loss exceeds 22,000 and it gets a margin call. At 1.045 its required margin is 88,000. At maturity it pays 55,000 and gets the rest back.

### Vault protections

- **Net exposure limit per maturity.** For each month m, the vault tracks E_m = receivers − payers of EUR (in N × K). It refuses any hedge that would bring its maximum loss Σ |E_m| × c above a set share of its liquidity.
- **Oracle freshness.** A rate older than 15 minutes blocks opening, margin calls and close-outs.
- **Withdrawal limit.** Liquidity providers only withdraw liquidity not engaged in open hedges.

## Participants

The protocol only works if both exposure sides are present. Company profiles below are targets, with no agreement from any company.

| Participant | Profile | Exposed when | Brings | Receives |
|---|---|---|---|---|
| Regulated partner | FX broker, bank, payment institution | — | Licence, KYC, distribution | A share of fees |
| EUR receiver | Computer and board makers selling in Europe | The euro falls | Hedging demand, fees | Protected margin at a bank-comparable rate |
| EUR payer | Foundry or subcontractor buying equipment and services in euros | The euro rises | The counterparty that balances the maturity | Locked cost, lower fees |
| Liquidity provider | FX market makers and crypto-native funds first; corporate treasuries after audit | The unmatched balance moves against it | USDC backing the payouts | Fees, penalties, later lending yield |
| Operator | The team | Bug or insolvency | Contracts, parameters, fixing, interface | A share of fees |

## Architecture on Stellar

Two Soroban contracts on top of existing building blocks:

| Component | Role | Building block |
|---|---|---|
| `lp_vault` | Deposits, withdrawals, shares; pays winners on `fx_vault`'s order | OpenZeppelin Stellar Contracts, Fungible Token Vault (SEP-56) |
| `fx_vault` | Quotes, forward rate, margins, margin calls, fixing, settlement | Protocol code |
| EUR/USD oracle | Rate at opening, during the hedge, and at fixing | Reflector "Fiat exchange rates" feed (SEP-40, USD base, 14 decimals, 5-minute resolution) |
| Settlement asset | Margins, fees, payouts | USDC through its Stellar Asset Contract (tUSDC on testnet) |
| App | Hedge an order, follow hedges, manage the vault | React app from Scaffold Stellar, Stellar Wallets Kit, Freighter |

Margins live in `fx_vault`, liquidity in `lp_vault`: the OZ share math reads the vault's whole asset balance, so margins in the same contract would inflate the share price.

Why Stellar: settlement in seconds, negligible fees, natively issued USDC and EURC, an FX oracle already live, and anchors to move in and out of bank money.

## Economics

Fees pay liquidity providers, and their schedule pushes each maturity towards balance.

| Parameter | Prototype value | Effect |
|---|---|---|
| Base fee | 0.3 % of N × K | 3,300 USDC for 1,000,000 EUR at 1.10 |
| Fee modulation | ×2 if \|E_m\| grows, ×0.5 if it shrinks | 6,600 USDC for the first receiver, 1,650 for the payer that balances it |
| Interest differential d | Published by the operator | Bank-comparable forward rate |
| Initial margin | 5 % | 55,000 USDC for 1,000,000 EUR at 1.10 |
| Maintenance margin | 3 % | Covers the move during the call delay |
| Margin call delay | 48 h (demo: 2 min) | Time to top up |
| Close-out penalty | 1 % of N × K | Paid to the vault |
| Payout cap c | 20 % | Max payout 220,000 USDC for 1,000,000 EUR at 1.10 |
| Max vault net loss | 50 % of its liquidity | A 2,000,000 USDC vault backs about 5,000,000 USD of unmatched N × K |

## Risks and limits

| Risk | Borne by | Mitigation |
|---|---|---|
| One-sided maturity | Liquidity providers | Net exposure limit, fee modulation, onboarding both sides together; roadmap: hedge the net with EURC on the Stellar DEX |
| Company default | Vault | Initial margin, margin calls, close-out with maintenance buffer |
| Move beyond 20 % | Hedged company | Cap shown before signing |
| Settlement timing games | Vault and counterparties | One fixing per maturity, at the oracle record at T |
| Wrong or stale oracle | All | Freshness check, fallback oracle, documented suspension |
| Smart contract bug | All | Scenario tests, pause, audit before mainnet |
| USDC depeg | All | Disclosed, monitored |
| Regulation | Operator and partner | A forward sold to companies is a derivative in Europe (EMIR, MiFID II); stablecoins fall under MiCA. Distribution only through a regulated partner, legal review before production |

Prototype limits: the forward is not discounted; d is set by hand; KYC is simulated; the demo oracle lets the operator set the rate.

## Roadmap

1. **Prototype (hackathon)**: vault, forwards, margin calls, fixing and settlement on Stellar testnet.
2. **Pilot**: one regulated partner, one EUR receiver and one EUR payer on the same maturity, with a contract audit.
3. **Yield**: idle liquidity and margins lent on Blend.
4. **Flexibility**: voluntary early close-out at today's forward, maturity roll when a delivery slips, EURC settlement.
5. **Net hedging**: the vault hedges its residual exposure with EURC on the Stellar DEX.
6. **Receivables financing**: lend USDC against the receivable of an already hedged order, whose dollar value is known.
7. **More currencies**: TWD and other supply-chain currencies once a reliable feed exists on Stellar.

## Disclaimer

This white paper describes a hackathon prototype. Parameters are indicative. Company profiles are hypothetical targets with no agreement from the companies named, and their FX exposures remain to be verified. This document is neither an offer of a financial instrument nor investment advice.

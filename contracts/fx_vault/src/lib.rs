#![no_std]
//! FX hedges: EUR/USD cash-settled forwards (NDF) paid in USDC.
//!
//! A company opens a hedge on a standard maturity. The contract reads the
//! oracle, computes the forward rate K = S0 × (1 + d × t), takes an initial
//! margin and a fee. Fees go to `lp_vault`; margins stay here. Opposite sides on
//! the same maturity offset each other, and `lp_vault` only backs the net.
//!
//! Units: amounts are i128 with 7 decimals (USDC, and EUR notionals); rates
//! are USD per EUR with 14 decimals; parameters are in basis points.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, symbol_short, token, Address, Env, Symbol, Vec,
};

pub const RATE_DECIMALS: u32 = 14;
pub const RATE_SCALE: i128 = 100_000_000_000_000;
pub const BPS: i128 = 10_000;
/// Money-market year (360 days), in seconds.
pub const YEAR_SECS: i128 = 360 * 86_400;
/// Max gap between the strike a company signs and the contract's strike.
/// K moves with time and the oracle between quote and execution, while the
/// signed transfer amounts must stay exact.
pub const MAX_SLIPPAGE_BPS: i128 = 20;

const DAY_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * DAY_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_LEDGERS;

// ---------- external interfaces ----------

/// SEP-40 asset, as Reflector defines it.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contractclient(name = "OracleClient")]
pub trait Oracle {
    fn lastprice(e: Env, asset: Asset) -> Option<PriceData>;
    fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
    fn decimals(e: Env) -> u32;
}

#[contractclient(name = "LpVaultClient")]
pub trait LpVaultIface {
    fn total_assets(e: Env) -> i128;
    fn pay(e: Env, to: Address, amount: i128);
}

// ---------- types ----------

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    /// Receives EUR, pays USD costs: loses when the euro falls.
    SellEur,
    /// Pays EUR costs: loses when the euro rises.
    BuyEur,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Open,
    Settled,
    ClosedOut,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Params {
    /// Annual USD-EUR interest differential d, used for the forward rate.
    pub carry_bps: i128,
    /// Initial margin m_i, share of N × K.
    pub im_bps: i128,
    /// Maintenance margin m_m, share of N × K.
    pub mm_bps: i128,
    /// Covered variation c: payout cap, share of N × K.
    pub cap_bps: i128,
    /// Max net loss of the LP vault, share of its assets.
    pub max_loss_bps: i128,
    /// Base fee, share of N × K.
    pub fee_bps: i128,
    /// Fee multiplier when the hedge widens the maturity's net exposure.
    pub fee_up_bps: i128,
    /// Fee multiplier when the hedge narrows it.
    pub fee_down_bps: i128,
    /// Margin call delay, seconds.
    pub call_delay: u64,
    /// Close-out penalty, share of N × K.
    pub penalty_bps: i128,
    /// Max oracle price age, seconds. Also the max gap between T and the
    /// oracle record used as fixing.
    pub max_age: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Maturity {
    pub timestamp: u64,
    pub opened_at: u64,
    /// Demo accelerator: time to maturity used for pricing. `None` prices on
    /// the real time left.
    pub pricing_secs: Option<u64>,
    /// Σ N × K of sellers minus buyers, USD. The LP vault backs only this.
    pub net_usd: i128,
    /// Fixing rate S_T, once recorded.
    pub fixing: Option<i128>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Quote {
    pub spot: i128,
    pub strike: i128,
    pub notional_usd: i128,
    pub margin: i128,
    pub fee: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Hedge {
    pub id: u32,
    pub company: Address,
    pub side: Side,
    /// EUR notional N.
    pub notional: i128,
    pub maturity: u64,
    /// Forward rate K.
    pub strike: i128,
    /// N × K, USD.
    pub notional_usd: i128,
    /// Margin currently deposited.
    pub margin: i128,
    pub fee: i128,
    pub status: Status,
    /// Start of the pending margin call, if any.
    pub call_since: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarginStatus {
    /// Unrealized loss at today's forward rate (0 when in profit).
    pub loss: i128,
    /// Margin required: loss + m_m × N × K.
    pub required: i128,
    pub margin: i128,
    /// required − margin, 0 when covered.
    pub shortfall: i128,
    /// Close-out allowed from this time, when a call is pending.
    pub call_deadline: Option<u64>,
}

#[contracttype]
enum DataKey {
    Admin,
    Token,
    Oracle,
    RateDecimals,
    LpVault,
    Params,
    Paused,
    NextId,
    Maturities,
    Maturity(u64),
    Hedge(u32),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FxError {
    Paused = 1,
    InvalidParams = 2,
    InvalidAmount = 3,
    UnknownMaturity = 4,
    MaturityExists = 5,
    MaturityPassed = 6,
    NoPrice = 7,
    StalePrice = 8,
    ExposureLimit = 9,
    UnknownHedge = 10,
    TooEarly = 11,
    AlreadyFixed = 12,
    NotFixed = 13,
    NotOpen = 14,
    NoFixingPrice = 15,
    NotUnderMargin = 16,
    NotCalled = 17,
    CallPending = 18,
    PriceMoved = 19,
}

// ---------- events ----------

#[contractevent]
pub struct MaturityOpened {
    #[topic]
    pub maturity: u64,
    pub pricing_secs: Option<u64>,
}

#[contractevent]
pub struct Fixed {
    #[topic]
    pub maturity: u64,
    pub rate: i128,
}

#[contractevent]
pub struct HedgeSettled {
    #[topic]
    pub id: u32,
    #[topic]
    pub company: Address,
    /// Paid to the company (> 0) or taken from its margin (< 0).
    pub payoff: i128,
    pub margin_returned: i128,
}

#[contractevent]
pub struct MarginCalled {
    #[topic]
    pub id: u32,
    #[topic]
    pub company: Address,
    pub required: i128,
    pub deadline: u64,
}

#[contractevent]
pub struct MarginToppedUp {
    #[topic]
    pub id: u32,
    pub amount: i128,
    pub margin: i128,
    pub call_cleared: bool,
}

#[contractevent]
pub struct HedgeClosedOut {
    #[topic]
    pub id: u32,
    #[topic]
    pub company: Address,
    pub payoff: i128,
    pub penalty: i128,
    pub margin_returned: i128,
}

#[contractevent]
pub struct HedgeOpened {
    #[topic]
    pub id: u32,
    #[topic]
    pub company: Address,
    pub side: Side,
    pub notional: i128,
    pub maturity: u64,
    pub strike: i128,
    pub margin: i128,
    pub fee: i128,
}

// ---------- contract ----------

#[contract]
pub struct FxVault;

#[contractimpl]
impl FxVault {
    pub fn __constructor(
        e: Env,
        admin: Address,
        token: Address,
        oracle: Address,
        lp_vault: Address,
        params: Params,
    ) {
        check_params(&e, &params);
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::LpVault, &lp_vault);
        s.set(&DataKey::Params, &params);
        s.set(&DataKey::NextId, &0u32);
        s.set(&DataKey::Maturities, &Vec::<u64>::new(&e));
        set_oracle(&e, &oracle);
    }

    // ----- admin -----

    pub fn set_params(e: Env, params: Params) {
        admin(&e).require_auth();
        check_params(&e, &params);
        e.storage().instance().set(&DataKey::Params, &params);
        bump(&e);
    }

    pub fn set_oracle(e: Env, oracle: Address) {
        admin(&e).require_auth();
        set_oracle(&e, &oracle);
        bump(&e);
    }

    pub fn pause(e: Env) {
        admin(&e).require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        admin(&e).require_auth();
        e.storage().instance().remove(&DataKey::Paused);
    }

    /// Open a standard maturity. `pricing_secs` is the demo accelerator.
    pub fn open_maturity(e: Env, timestamp: u64, pricing_secs: Option<u64>) {
        admin(&e).require_auth();
        if timestamp <= e.ledger().timestamp() {
            panic_with_error!(&e, FxError::MaturityPassed);
        }
        let key = DataKey::Maturity(timestamp);
        if e.storage().persistent().has(&key) {
            panic_with_error!(&e, FxError::MaturityExists);
        }
        let m = Maturity {
            timestamp,
            opened_at: e.ledger().timestamp(),
            pricing_secs,
            net_usd: 0,
            fixing: None,
        };
        put_maturity(&e, &m);
        let mut list = maturities(&e);
        list.push_back(timestamp);
        e.storage().instance().set(&DataKey::Maturities, &list);
        bump(&e);
        MaturityOpened {
            maturity: timestamp,
            pricing_secs,
        }
        .publish(&e);
    }

    // ----- hedges -----

    /// Price a hedge without writing anything.
    pub fn quote(e: Env, notional: i128, side: Side, maturity: u64) -> Quote {
        let m = open_maturity_of(&e, maturity);
        quote(&e, &params(&e), &m, notional, side)
    }

    /// Open a hedge at `strike`, the K of a recent quote: fix K, take the
    /// initial margin and the fee. Refused if K moved more than 0.2 %.
    pub fn open_hedge(
        e: Env,
        company: Address,
        notional: i128,
        side: Side,
        maturity: u64,
        strike: i128,
    ) -> u32 {
        company.require_auth();
        if e.storage().instance().has(&DataKey::Paused) {
            panic_with_error!(&e, FxError::Paused);
        }
        let p = params(&e);
        let mut m = open_maturity_of(&e, maturity);
        let current = quote(&e, &p, &m, notional, side);
        if (current.strike - strike).abs() * BPS > current.strike * MAX_SLIPPAGE_BPS {
            panic_with_error!(&e, FxError::PriceMoved);
        }
        let q = terms(&p, &m, current.spot, strike, notional, side);

        let new_net = m.net_usd + signed(side, q.notional_usd);
        if new_net.abs() > m.net_usd.abs() {
            let added = (new_net.abs() - m.net_usd.abs()) * p.cap_bps / BPS;
            let limit = lp_vault(&e).total_assets() * p.max_loss_bps / BPS;
            if Self::engaged(e.clone()) + added > limit {
                panic_with_error!(&e, FxError::ExposureLimit);
            }
        }

        let token = token::Client::new(&e, &token_address(&e));
        token.transfer(&company, &e.current_contract_address(), &q.margin);
        token.transfer(&company, &lp_vault_address(&e), &q.fee);

        m.net_usd = new_net;
        put_maturity(&e, &m);

        let id: u32 = e.storage().instance().get(&DataKey::NextId).unwrap();
        e.storage().instance().set(&DataKey::NextId, &(id + 1));
        let hedge = Hedge {
            id,
            company: company.clone(),
            side,
            notional,
            maturity,
            strike: q.strike,
            notional_usd: q.notional_usd,
            margin: q.margin,
            fee: q.fee,
            status: Status::Open,
            call_since: None,
        };
        put_hedge(&e, &hedge);
        bump(&e);

        HedgeOpened {
            id,
            company,
            side,
            notional,
            maturity,
            strike: q.strike,
            margin: q.margin,
            fee: q.fee,
        }
        .publish(&e);
        id
    }

    /// Record the fixing S_T of a maturity, once. The rate is the oracle
    /// record at T, so it is the same whoever calls and whenever they call.
    pub fn fix(e: Env, maturity: u64) -> i128 {
        let mut m = maturity_of(&e, maturity);
        if m.fixing.is_some() {
            panic_with_error!(&e, FxError::AlreadyFixed);
        }
        if e.ledger().timestamp() < m.timestamp {
            panic_with_error!(&e, FxError::TooEarly);
        }
        let data = OracleClient::new(&e, &oracle_address(&e))
            .price(&eur(), &m.timestamp)
            .unwrap_or_else(|| panic_with_error!(&e, FxError::NoFixingPrice));
        if data.timestamp > m.timestamp || m.timestamp - data.timestamp > params(&e).max_age {
            panic_with_error!(&e, FxError::NoFixingPrice);
        }
        let rate = normalize(&e, data.price);
        m.fixing = Some(rate);
        put_maturity(&e, &m);
        bump(&e);
        Fixed { maturity, rate }.publish(&e);
        rate
    }

    /// Settle a hedge at the recorded fixing. Anyone can call it.
    /// Returns the payoff: paid to the company (> 0) or taken from its margin (< 0).
    pub fn settle(e: Env, id: u32) -> i128 {
        let mut h = Self::get_hedge(e.clone(), id);
        if h.status != Status::Open {
            panic_with_error!(&e, FxError::NotOpen);
        }
        let mut m = maturity_of(&e, h.maturity);
        let rate = m
            .fixing
            .unwrap_or_else(|| panic_with_error!(&e, FxError::NotFixed));
        let payoff = payoff(&params(&e), &h, rate);
        let margin_returned = close(&e, &mut m, &mut h, payoff, 0);
        h.status = Status::Settled;
        put_hedge(&e, &h);
        bump(&e);
        HedgeSettled {
            id,
            company: h.company,
            payoff,
            margin_returned,
        }
        .publish(&e);
        payoff
    }

    // ----- margin calls -----

    /// Margin position of an open hedge at the current rate.
    pub fn margin_status(e: Env, id: u32) -> MarginStatus {
        let h = open_hedge_of(&e, id);
        let p = params(&e);
        margin_status(&p, &h, mark(&e, &p, h.maturity))
    }

    /// Start a margin call on an under-margined hedge. Anyone can call it.
    /// If the hedge is covered again, a pending call is cleared and `None`
    /// is returned. Returns the close-out deadline otherwise.
    pub fn margin_call(e: Env, id: u32) -> Option<u64> {
        let mut h = open_hedge_of(&e, id);
        unfixed(&e, h.maturity);
        let p = params(&e);
        let st = margin_status(&p, &h, mark(&e, &p, h.maturity));
        if st.shortfall == 0 {
            if h.call_since.is_none() {
                panic_with_error!(&e, FxError::NotUnderMargin);
            }
            h.call_since = None;
            put_hedge(&e, &h);
            return None;
        }
        let since = match h.call_since {
            Some(since) => since,
            None => {
                let now = e.ledger().timestamp();
                h.call_since = Some(now);
                put_hedge(&e, &h);
                MarginCalled {
                    id,
                    company: h.company.clone(),
                    required: st.required,
                    deadline: now + p.call_delay,
                }
                .publish(&e);
                now
            }
        };
        bump(&e);
        Some(since + p.call_delay)
    }

    /// Add margin. Clears a pending call once the requirement is met.
    pub fn top_up(e: Env, id: u32, amount: i128) -> i128 {
        let mut h = open_hedge_of(&e, id);
        h.company.require_auth();
        if amount <= 0 {
            panic_with_error!(&e, FxError::InvalidAmount);
        }
        token::Client::new(&e, &token_address(&e)).transfer(
            &h.company,
            &e.current_contract_address(),
            &amount,
        );
        h.margin += amount;
        let mut call_cleared = false;
        if h.call_since.is_some() {
            let p = params(&e);
            if let Some(spot) = try_spot(&e, &p) {
                let m = maturity_of(&e, h.maturity);
                if margin_status(&p, &h, forward(&e, &p, &m, spot)).shortfall == 0 {
                    h.call_since = None;
                    call_cleared = true;
                }
            }
        }
        put_hedge(&e, &h);
        bump(&e);
        MarginToppedUp {
            id,
            amount,
            margin: h.margin,
            call_cleared,
        }
        .publish(&e);
        h.margin
    }

    /// Close an under-margined hedge whose call delay has passed, at today's
    /// forward rate, with a penalty to the vault. Anyone can call it.
    /// Returns the payoff (negative: taken from the margin).
    pub fn close_out(e: Env, id: u32) -> i128 {
        let mut h = open_hedge_of(&e, id);
        unfixed(&e, h.maturity);
        let since = h
            .call_since
            .unwrap_or_else(|| panic_with_error!(&e, FxError::NotCalled));
        let p = params(&e);
        if e.ledger().timestamp() < since + p.call_delay {
            panic_with_error!(&e, FxError::CallPending);
        }
        let rate = mark(&e, &p, h.maturity);
        if margin_status(&p, &h, rate).shortfall == 0 {
            panic_with_error!(&e, FxError::NotUnderMargin);
        }
        let payoff = payoff(&p, &h, rate);
        let penalty = h.notional_usd * p.penalty_bps / BPS;
        let mut m = maturity_of(&e, h.maturity);
        let margin_returned = close(&e, &mut m, &mut h, payoff, penalty);
        h.status = Status::ClosedOut;
        h.call_since = None;
        put_hedge(&e, &h);
        bump(&e);
        HedgeClosedOut {
            id,
            company: h.company,
            payoff,
            penalty,
            margin_returned,
        }
        .publish(&e);
        payoff
    }

    // ----- reads -----

    pub fn get_hedge(e: Env, id: u32) -> Hedge {
        e.storage()
            .persistent()
            .get(&DataKey::Hedge(id))
            .unwrap_or_else(|| panic_with_error!(&e, FxError::UnknownHedge))
    }

    pub fn hedge_count(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::NextId).unwrap()
    }

    pub fn maturities(e: Env) -> Vec<u64> {
        maturities(&e)
    }

    pub fn maturity(e: Env, timestamp: u64) -> Maturity {
        maturity_of(&e, timestamp)
    }

    /// Liquidity `lp_vault` must keep: Σ |net_usd| × c over all maturities.
    pub fn engaged(e: Env) -> i128 {
        let cap = params(&e).cap_bps;
        let mut total = 0;
        for t in maturities(&e).iter() {
            total += maturity_of(&e, t).net_usd.abs() * cap / BPS;
        }
        total
    }

    /// Current oracle rate, 14 decimals, freshness-checked.
    pub fn spot(e: Env) -> i128 {
        spot(&e, &params(&e))
    }

    pub fn params(e: Env) -> Params {
        params(&e)
    }

    pub fn paused(e: Env) -> bool {
        e.storage().instance().has(&DataKey::Paused)
    }
}

// ---------- internals ----------

fn quote(e: &Env, p: &Params, m: &Maturity, notional: i128, side: Side) -> Quote {
    if notional <= 0 {
        panic_with_error!(e, FxError::InvalidAmount);
    }
    let spot = spot(e, p);
    terms(p, m, spot, forward(e, p, m, spot), notional, side)
}

/// Amounts of a hedge at a given strike.
fn terms(p: &Params, m: &Maturity, spot: i128, strike: i128, notional: i128, side: Side) -> Quote {
    let notional_usd = notional * strike / RATE_SCALE;
    let margin = notional_usd * p.im_bps / BPS;

    let new_net = m.net_usd + signed(side, notional_usd);
    let mult = if new_net.abs() > m.net_usd.abs() {
        p.fee_up_bps
    } else {
        p.fee_down_bps
    };
    let fee = notional_usd * p.fee_bps / BPS * mult / BPS;
    Quote {
        spot,
        strike,
        notional_usd,
        margin,
        fee,
    }
}

fn spot(e: &Env, p: &Params) -> i128 {
    let data = OracleClient::new(e, &oracle_address(e))
        .lastprice(&eur())
        .unwrap_or_else(|| panic_with_error!(e, FxError::NoPrice));
    if e.ledger().timestamp() > data.timestamp + p.max_age {
        panic_with_error!(e, FxError::StalePrice);
    }
    normalize(e, data.price)
}

/// Time to maturity used for pricing, seconds. With the demo accelerator,
/// the declared duration shrinks in proportion to the real time left.
fn remaining_secs(e: &Env, m: &Maturity) -> i128 {
    let left = m.timestamp.saturating_sub(e.ledger().timestamp()) as i128;
    match m.pricing_secs {
        Some(ps) => ps as i128 * left / (m.timestamp - m.opened_at) as i128,
        None => left,
    }
}

/// Forward rate for the maturity: spot × (1 + d × t).
fn forward(e: &Env, p: &Params, m: &Maturity, spot: i128) -> i128 {
    spot + spot * p.carry_bps * remaining_secs(e, m) / (BPS * YEAR_SECS)
}

/// Mark-to-market rate of a hedge: today's forward rate to its maturity.
/// It equals K at opening and converges to the spot at maturity.
fn mark(e: &Env, p: &Params, maturity: u64) -> i128 {
    forward(e, p, &maturity_of(e, maturity), spot(e, p))
}

/// Like `spot`, but `None` instead of an error.
fn try_spot(e: &Env, p: &Params) -> Option<i128> {
    let data = OracleClient::new(e, &oracle_address(e)).lastprice(&eur())?;
    if e.ledger().timestamp() > data.timestamp + p.max_age {
        return None;
    }
    Some(normalize(e, data.price))
}

fn margin_status(p: &Params, h: &Hedge, rate: i128) -> MarginStatus {
    let loss = (-payoff(p, h, rate)).max(0);
    let required = loss + h.notional_usd * p.mm_bps / BPS;
    MarginStatus {
        loss,
        required,
        margin: h.margin,
        shortfall: (required - h.margin).max(0),
        call_deadline: h.call_since.map(|since| since + p.call_delay),
    }
}

/// Oracle price to 14 decimals.
fn normalize(e: &Env, price: i128) -> i128 {
    let d: u32 = e.storage().instance().get(&DataKey::RateDecimals).unwrap();
    if d >= RATE_DECIMALS {
        price / 10_i128.pow(d - RATE_DECIMALS)
    } else {
        price * 10_i128.pow(RATE_DECIMALS - d)
    }
}

/// Company payoff at `rate`, capped at c × N × K.
fn payoff(p: &Params, h: &Hedge, rate: i128) -> i128 {
    let raw = match h.side {
        Side::SellEur => h.notional * (h.strike - rate) / RATE_SCALE,
        Side::BuyEur => h.notional * (rate - h.strike) / RATE_SCALE,
    };
    let cap = h.notional_usd * p.cap_bps / BPS;
    raw.clamp(-cap, cap)
}

/// Move the money of a closing hedge and remove it from the maturity's net
/// exposure. A gain is paid by `lp_vault`; a loss and `penalty` are taken from
/// the margin and sent to `lp_vault`. Returns the margin given back.
fn close(e: &Env, m: &mut Maturity, h: &mut Hedge, payoff: i128, penalty: i128) -> i128 {
    m.net_usd -= signed(h.side, h.notional_usd);
    put_maturity(e, m);

    let token = token::Client::new(e, &token_address(e));
    let this = e.current_contract_address();
    if payoff > 0 {
        lp_vault(e).pay(&h.company, &payoff);
    }
    // A loss beyond the margin is absorbed by the vault.
    let taken = (penalty - payoff.min(0)).min(h.margin);
    if taken > 0 {
        token.transfer(&this, &lp_vault_address(e), &taken);
    }
    let returned = h.margin - taken;
    if returned > 0 {
        token.transfer(&this, &h.company, &returned);
    }
    h.margin = 0;
    returned
}

fn signed(side: Side, usd: i128) -> i128 {
    match side {
        Side::SellEur => usd,
        Side::BuyEur => -usd,
    }
}

fn eur() -> Asset {
    Asset::Other(symbol_short!("EUR"))
}

fn check_params(e: &Env, p: &Params) {
    let ok = p.im_bps > p.mm_bps
        && p.mm_bps > 0
        && p.cap_bps > 0
        && p.cap_bps <= BPS
        && p.max_loss_bps > 0
        && p.max_loss_bps <= BPS
        && p.fee_bps >= 0
        && p.fee_up_bps >= 0
        && p.fee_down_bps >= 0
        && p.penalty_bps >= 0
        && p.max_age > 0;
    if !ok {
        panic_with_error!(e, FxError::InvalidParams);
    }
}

fn set_oracle(e: &Env, oracle: &Address) {
    let decimals = OracleClient::new(e, oracle).decimals();
    e.storage().instance().set(&DataKey::Oracle, oracle);
    e.storage().instance().set(&DataKey::RateDecimals, &decimals);
}

fn admin(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Admin).unwrap()
}

fn params(e: &Env) -> Params {
    e.storage().instance().get(&DataKey::Params).unwrap()
}

fn token_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Token).unwrap()
}

fn oracle_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Oracle).unwrap()
}

fn lp_vault_address(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::LpVault).unwrap()
}

fn lp_vault(e: &Env) -> LpVaultClient<'_> {
    LpVaultClient::new(e, &lp_vault_address(e))
}

fn maturities(e: &Env) -> Vec<u64> {
    e.storage().instance().get(&DataKey::Maturities).unwrap()
}

fn maturity_of(e: &Env, timestamp: u64) -> Maturity {
    e.storage()
        .persistent()
        .get(&DataKey::Maturity(timestamp))
        .unwrap_or_else(|| panic_with_error!(e, FxError::UnknownMaturity))
}

fn open_hedge_of(e: &Env, id: u32) -> Hedge {
    let h: Hedge = e
        .storage()
        .persistent()
        .get(&DataKey::Hedge(id))
        .unwrap_or_else(|| panic_with_error!(e, FxError::UnknownHedge));
    if h.status != Status::Open {
        panic_with_error!(e, FxError::NotOpen);
    }
    h
}

/// Margin calls stop once the maturity is fixed: the hedge is then settled.
fn unfixed(e: &Env, maturity: u64) {
    if maturity_of(e, maturity).fixing.is_some() {
        panic_with_error!(e, FxError::AlreadyFixed);
    }
}

/// A maturity that still accepts new hedges.
fn open_maturity_of(e: &Env, timestamp: u64) -> Maturity {
    let m = maturity_of(e, timestamp);
    if e.ledger().timestamp() >= m.timestamp {
        panic_with_error!(e, FxError::MaturityPassed);
    }
    m
}

fn put_maturity(e: &Env, m: &Maturity) {
    let key = DataKey::Maturity(m.timestamp);
    e.storage().persistent().set(&key, m);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

fn put_hedge(e: &Env, h: &Hedge) {
    let key = DataKey::Hedge(h.id);
    e.storage().persistent().set(&key, h);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

fn bump(e: &Env) {
    e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}

#[cfg(test)]
mod test;

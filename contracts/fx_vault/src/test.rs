extern crate std;

use super::*;
use lp_vault::{LpVault, LpVaultClient as LpClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Env, String,
};

/// Oracle stand-in with a price history, 14 decimals. `price(t)` returns the
/// latest record at or before `t`, like a Reflector round.
#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    pub fn set(e: Env, price: i128, timestamp: u64) {
        let mut h: soroban_sdk::Vec<PriceData> =
            e.storage().instance().get(&0u32).unwrap_or(soroban_sdk::Vec::new(&e));
        h.push_back(PriceData { price, timestamp });
        e.storage().instance().set(&0u32, &h);
    }
    pub fn lastprice(e: Env, _asset: Asset) -> Option<PriceData> {
        let h: soroban_sdk::Vec<PriceData> = e.storage().instance().get(&0u32)?;
        h.last()
    }
    pub fn price(e: Env, _asset: Asset, timestamp: u64) -> Option<PriceData> {
        let h: soroban_sdk::Vec<PriceData> = e.storage().instance().get(&0u32)?;
        h.iter().filter(|p| p.timestamp <= timestamp).last()
    }
    pub fn decimals(_e: Env) -> u32 {
        14
    }
}

/// One USDC (or one EUR of notional), 7 decimals.
const U: i128 = 10_000_000;
const M: i128 = 1_000_000 * U;
const NOW: u64 = 1_000_000;
const T1: u64 = NOW + 600;
const SPOT: i128 = 111_930_000_000_000; // 1.1193
const STRIKE_360D: i128 = 113_608_950_000_000; // 1.1193 × 1.015

fn demo_params() -> Params {
    Params {
        carry_bps: 150,
        im_bps: 500,
        mm_bps: 300,
        cap_bps: 2_000,
        max_loss_bps: 5_000,
        fee_bps: 30,
        fee_up_bps: 20_000,
        fee_down_bps: 5_000,
        call_delay: 120,
        penalty_bps: 100,
        max_age: 900,
    }
}

struct Setup {
    e: Env,
    fx: FxVaultClient<'static>,
    lp: LpClient<'static>,
    usdc: TokenClient<'static>,
    oracle: MockOracleClient<'static>,
    fabricant: Address,
    fondeur: Address,
}

fn setup() -> Setup {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(NOW);
    let admin = Address::generate(&e);

    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let usdc = TokenClient::new(&e, &sac.address());
    let mint = StellarAssetClient::new(&e, &sac.address());

    let oracle_id = e.register(MockOracle, ());
    let oracle = MockOracleClient::new(&e, &oracle_id);
    oracle.set(&SPOT, &NOW);

    let lp_id = e.register(
        LpVault,
        (
            admin.clone(),
            sac.address(),
            String::from_str(&e, "FX Vault Share"),
            String::from_str(&e, "FXV"),
        ),
    );
    let lp = LpClient::new(&e, &lp_id);

    let fx_id = e.register(
        FxVault,
        (admin.clone(), sac.address(), oracle_id, lp_id.clone(), demo_params()),
    );
    let fx = FxVaultClient::new(&e, &fx_id);
    lp.set_hedge(&fx_id);

    let apporteur = Address::generate(&e);
    let fabricant = Address::generate(&e);
    let fondeur = Address::generate(&e);
    for a in [&apporteur, &fabricant, &fondeur] {
        mint.mint(a, &(3 * M));
    }
    lp.deposit(&(2 * M), &apporteur, &apporteur, &apporteur);

    // Demo maturity: 10 minutes away, priced as 360 days.
    fx.open_maturity(&T1, &Some(YEAR_SECS as u64));

    Setup { e, fx, lp, usdc, oracle, fabricant, fondeur }
}

/// Open at the current quote, like the app does.
fn open(s: &Setup, company: &Address, notional: &i128, side: &Side, maturity: &u64) -> u32 {
    let k = s.fx.quote(notional, side, maturity).strike;
    s.fx.open_hedge(company, notional, side, maturity, &k)
}

fn try_open(
    s: &Setup,
    company: &Address,
    notional: &i128,
    side: &Side,
    maturity: &u64,
) -> Result<Result<u32, soroban_sdk::ConversionError>, Result<soroban_sdk::Error, soroban_sdk::InvokeError>> {
    let k = STRIKE_360D;
    s.fx.try_open_hedge(company, notional, side, maturity, &k)
}

#[test]
fn strike_is_the_forward_rate() {
    let s = setup();
    let q = s.fx.quote(&M, &Side::SellEur, &T1);
    assert_eq!(q.spot, SPOT);
    assert_eq!(q.strike, STRIKE_360D);
    assert_eq!(q.notional_usd, 11_360_895_000_000); // 1 136 089.5
    assert_eq!(q.margin, 568_044_750_000); // 56 804.475, 5 %
    assert_eq!(q.fee, 68_165_370_000); // 6 816.537 = 0.3 % × 2
}

#[test]
fn real_time_pricing_without_accelerator() {
    let s = setup();
    let t2 = NOW + 180 * 86_400;
    s.fx.open_maturity(&t2, &None);
    // 180 days at 1.5 % a year: K = S × 1.0075.
    assert_eq!(s.fx.quote(&M, &Side::SellEur, &t2).strike, 112_769_475_000_000);
}

#[test]
fn open_hedge_takes_margin_and_fee() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    assert_eq!(id, 0);

    let h = s.fx.get_hedge(&id);
    assert_eq!(h.strike, STRIKE_360D);
    assert_eq!(h.margin, 568_044_750_000);
    assert_eq!(h.status, Status::Open);

    assert_eq!(s.usdc.balance(&s.fabricant), 3 * M - 568_044_750_000 - 68_165_370_000);
    assert_eq!(s.usdc.balance(&s.fx.address), 568_044_750_000);
    assert_eq!(s.lp.total_assets(), 2 * M + 68_165_370_000);

    assert_eq!(s.fx.maturity(&T1).net_usd, 11_360_895_000_000);
    assert_eq!(s.fx.engaged(), 2_272_179_000_000); // 20 % of 1 136 089.5
    assert_eq!(s.lp.engaged(), s.fx.engaged());
}

#[test]
fn opposite_hedge_pays_less_and_nets_out() {
    let s = setup();
    open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);

    assert_eq!(s.fx.get_hedge(&id).fee, 17_041_342_500); // 1 704.134 = 0.3 % × 0.5
    assert_eq!(s.fx.maturity(&T1).net_usd, 0);
    assert_eq!(s.fx.engaged(), 0);
    // 2 000 000 + 6 816.537 + 1 704.134 of fees
    assert_eq!(s.lp.total_assets(), 2 * M + 68_165_370_000 + 17_041_342_500);
}

#[test]
fn stale_price_refused() {
    let s = setup();
    s.oracle.set(&SPOT, &(NOW - 901));
    assert_eq!(
        try_open(&s, &s.fabricant, &M, &Side::SellEur, &T1),
        Err(Ok(FxError::StalePrice.into()))
    );
    s.oracle.set(&SPOT, &(NOW - 900));
    open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
}

#[test]
fn exposure_limit() {
    let s = setup();
    // Limit: 50 % of ~2 000 000 = ~1 000 000 USD of engaged liquidity,
    // so ~5 000 000 USD of net N × K at a 20 % cap.
    open(&s, &s.fabricant, &(4 * M), &Side::SellEur, &T1);
    assert!(s.fx.try_quote(&M, &Side::SellEur, &T1).is_ok());
    assert_eq!(
        try_open(&s, &s.fondeur, &M, &Side::SellEur, &T1),
        Err(Ok(FxError::ExposureLimit.into()))
    );
    // The opposite side narrows the exposure, so it is always accepted.
    open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
}

#[test]
fn maturity_rules() {
    let s = setup();
    assert_eq!(
        try_open(&s, &s.fabricant, &M, &Side::SellEur, &(T1 + 1)),
        Err(Ok(FxError::UnknownMaturity.into()))
    );
    assert_eq!(
        s.fx.try_open_maturity(&T1, &None),
        Err(Ok(FxError::MaturityExists.into()))
    );
    assert_eq!(
        try_open(&s, &s.fabricant, &0, &Side::SellEur, &T1),
        Err(Ok(FxError::InvalidAmount.into()))
    );
    s.e.ledger().set_timestamp(T1);
    s.oracle.set(&SPOT, &T1);
    assert_eq!(
        try_open(&s, &s.fabricant, &M, &Side::SellEur, &T1),
        Err(Ok(FxError::MaturityPassed.into()))
    );
}

#[test]
fn pause_blocks_new_hedges() {
    let s = setup();
    s.fx.pause();
    assert_eq!(
        try_open(&s, &s.fabricant, &M, &Side::SellEur, &T1),
        Err(Ok(FxError::Paused.into()))
    );
    s.fx.unpause();
    open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
}

#[test]
fn lp_withdrawal_limited_by_open_hedges() {
    let s = setup();
    open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let free = s.lp.total_assets() - s.fx.engaged();
    assert_eq!(s.lp.free_liquidity(), free);
}

// ---------- step 5: fixing and settlement ----------

const MARGIN: i128 = 568_044_750_000; // 5 % of N × K
const FIVE_PCT: i128 = 568_044_750_000; // 5 % of N × K, the demo move
const FEE_UP: i128 = 68_165_370_000;
const FEE_DOWN: i128 = 17_041_342_500;

/// Move the euro to `rate` just before T, then fix.
fn fix_at(s: &Setup, rate: i128) {
    s.oracle.set(&rate, &(T1 - 10));
    s.e.ledger().set_timestamp(T1 + 60);
    s.fx.fix(&T1);
}

#[test]
fn euro_down_5_pct_seller_receives() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    fix_at(&s, STRIKE_360D * 95 / 100);
    assert_eq!(s.fx.settle(&id), FIVE_PCT);
    // Gets the margin back plus 5 %: only the fee is spent.
    assert_eq!(s.usdc.balance(&s.fabricant), 3 * M - FEE_UP + FIVE_PCT);
    assert_eq!(s.fx.get_hedge(&id).status, Status::Settled);
    assert_eq!(s.fx.engaged(), 0);
}

#[test]
fn euro_up_5_pct_seller_pays_from_margin() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let lp_before = s.lp.total_assets();
    fix_at(&s, STRIKE_360D * 105 / 100);
    assert_eq!(s.fx.settle(&id), -FIVE_PCT);
    assert_eq!(s.usdc.balance(&s.fabricant), 3 * M - FEE_UP - MARGIN);
    assert_eq!(s.lp.total_assets(), lp_before + FIVE_PCT);
    assert_eq!(s.usdc.balance(&s.fx.address), 0);
}

#[test]
fn euro_down_25_pct_payout_capped_at_20() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    fix_at(&s, STRIKE_360D * 75 / 100);
    assert_eq!(s.fx.settle(&id), 4 * FIVE_PCT); // 20 % of N × K
}

#[test]
fn matched_pair_vault_keeps_only_fees() {
    let s = setup();
    let a = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let b = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    fix_at(&s, STRIKE_360D * 95 / 100);
    assert_eq!(s.fx.settle(&a), FIVE_PCT);
    assert_eq!(s.fx.settle(&b), -FIVE_PCT);
    assert_eq!(s.lp.total_assets(), 2 * M + FEE_UP + FEE_DOWN);
    // Each side ends where it planned: fee spent, 5 % gained or paid.
    assert_eq!(s.usdc.balance(&s.fabricant), 3 * M - FEE_UP + FIVE_PCT);
    assert_eq!(s.usdc.balance(&s.fondeur), 3 * M - FEE_DOWN - FIVE_PCT);
    assert_eq!(s.usdc.balance(&s.fx.address), 0);
}

#[test]
fn fixing_rules() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    assert_eq!(s.fx.try_settle(&id), Err(Ok(FxError::NotFixed.into())));
    s.e.ledger().set_timestamp(T1 - 1);
    assert_eq!(s.fx.try_fix(&T1), Err(Ok(FxError::TooEarly.into())));

    // Last oracle record is older than max_age before T: no fixing yet.
    s.e.ledger().set_timestamp(T1 + 10);
    s.oracle.set(&SPOT, &(T1 - 901));
    assert_eq!(s.fx.try_fix(&T1), Err(Ok(FxError::NoFixingPrice.into())));

    s.oracle.set(&SPOT, &(T1 - 5));
    assert_eq!(s.fx.fix(&T1), SPOT);
    assert_eq!(s.fx.try_fix(&T1), Err(Ok(FxError::AlreadyFixed.into())));
    s.fx.settle(&id);
    assert_eq!(s.fx.try_settle(&id), Err(Ok(FxError::NotOpen.into())));
}

#[test]
fn fixing_ignores_prices_after_t() {
    let s = setup();
    let id = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    s.oracle.set(&(STRIKE_360D * 95 / 100), &(T1 - 10));
    // The euro rebounds after T: a later caller cannot pick this price.
    s.oracle.set(&(STRIKE_360D * 105 / 100), &(T1 + 200));
    s.e.ledger().set_timestamp(T1 + 300);
    s.fx.fix(&T1);
    assert_eq!(s.fx.settle(&id), FIVE_PCT);
}

// ---------- step 6: margin calls ----------

const MAINT: i128 = 340_826_850_000; // 3 % of N × K = 34 082.685
const DEMO_DIP: i128 = 108_000_000_000_000; // 1.08
/// At NOW the forward is 1.08 × 1.015 = 1.0962: loss 1 000 000 × (K − 1.0962).
const LOSS_AT_DIP: i128 = 398_895_000_000;
const PENALTY: i128 = 113_608_950_000; // 1 % of N × K

/// Euro moves to `rate` now, with a fresh oracle record.
fn move_to(s: &Setup, rate: i128) {
    let now = s.e.ledger().timestamp();
    s.oracle.set(&rate, &now);
}

fn advance(s: &Setup, secs: u64) {
    let now = s.e.ledger().timestamp() + secs;
    s.e.ledger().set_timestamp(now);
}

#[test]
fn covered_at_open_marked_at_forward() {
    let s = setup();
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    let st = s.fx.margin_status(&id);
    assert_eq!(st.loss, 0);
    assert_eq!(st.required, MAINT);
    assert_eq!(st.shortfall, 0);
    assert_eq!(
        s.fx.try_margin_call(&id),
        Err(Ok(FxError::NotUnderMargin.into()))
    );
}

#[test]
fn late_hedge_priced_on_time_left() {
    let s = setup();
    advance(&s, 300); // half of the demo maturity: 180 priced days left
    move_to(&s, SPOT);
    assert_eq!(s.fx.quote(&M, &Side::SellEur, &T1).strike, 112_769_475_000_000);
}

#[test]
fn euro_dip_calls_the_buyer_only() {
    let s = setup();
    let seller = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let buyer = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    move_to(&s, DEMO_DIP);

    let st = s.fx.margin_status(&buyer);
    assert_eq!(st.loss, LOSS_AT_DIP);
    assert_eq!(st.required, LOSS_AT_DIP + MAINT); // 73 972.185
    assert_eq!(st.shortfall, LOSS_AT_DIP + MAINT - MARGIN); // 17 167.71

    assert_eq!(s.fx.margin_call(&buyer), Some(NOW + 120));
    assert_eq!(s.fx.margin_status(&buyer).call_deadline, Some(NOW + 120));
    // A second call keeps the first deadline.
    advance(&s, 30);
    move_to(&s, DEMO_DIP);
    assert_eq!(s.fx.margin_call(&buyer), Some(NOW + 120));

    assert_eq!(
        s.fx.try_margin_call(&seller),
        Err(Ok(FxError::NotUnderMargin.into()))
    );
}

#[test]
fn top_up_clears_the_call() {
    let s = setup();
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    move_to(&s, DEMO_DIP);
    s.fx.margin_call(&id);
    let shortfall = s.fx.margin_status(&id).shortfall;

    assert_eq!(s.fx.top_up(&id, &shortfall), MARGIN + shortfall);
    assert_eq!(s.e.auths()[0].0, s.fondeur);
    let h = s.fx.get_hedge(&id);
    assert_eq!(h.call_since, None);
    assert_eq!(h.margin, LOSS_AT_DIP + MAINT);

    advance(&s, 200);
    move_to(&s, DEMO_DIP);
    assert_eq!(s.fx.try_close_out(&id), Err(Ok(FxError::NotCalled.into())));
}

#[test]
fn close_out_after_the_delay() {
    let s = setup();
    let seller = open(&s, &s.fabricant, &M, &Side::SellEur, &T1);
    let buyer = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    move_to(&s, DEMO_DIP);
    s.fx.margin_call(&buyer);

    advance(&s, 119);
    move_to(&s, DEMO_DIP);
    assert_eq!(s.fx.try_close_out(&buyer), Err(Ok(FxError::CallPending.into())));

    advance(&s, 1);
    move_to(&s, DEMO_DIP);
    // 120 s of 600 gone: 288 priced days left, forward 1.08 × 1.012.
    let loss = s.fx.margin_status(&buyer).loss;
    assert_eq!(loss, 431_295_000_000);
    let lp_before = s.lp.total_assets();
    let fondeur_before = s.usdc.balance(&s.fondeur);
    assert_eq!(s.fx.close_out(&buyer), -loss);

    let h = s.fx.get_hedge(&buyer);
    assert_eq!(h.status, Status::ClosedOut);
    assert_eq!(h.margin, 0);
    // Loss and penalty go to the vault, the rest of the margin comes back.
    assert_eq!(s.lp.total_assets(), lp_before + loss + PENALTY);
    assert_eq!(
        s.usdc.balance(&s.fondeur),
        fondeur_before + MARGIN - loss - PENALTY
    );
    // The vault now backs the seller alone.
    assert_eq!(s.fx.maturity(&T1).net_usd, 11_360_895_000_000);
    assert_eq!(s.fx.engaged(), 2_272_179_000_000);
    assert_eq!(s.fx.get_hedge(&seller).status, Status::Open);
}

#[test]
fn recovery_cancels_the_call() {
    let s = setup();
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    move_to(&s, DEMO_DIP);
    s.fx.margin_call(&id);

    advance(&s, 200);
    move_to(&s, SPOT);
    assert_eq!(
        s.fx.try_close_out(&id),
        Err(Ok(FxError::NotUnderMargin.into()))
    );
    assert_eq!(s.fx.margin_call(&id), None);
    assert_eq!(s.fx.get_hedge(&id).call_since, None);
}

#[test]
fn no_margin_calls_after_fixing() {
    let s = setup();
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    fix_at(&s, DEMO_DIP);
    move_to(&s, DEMO_DIP);
    assert_eq!(s.fx.try_margin_call(&id), Err(Ok(FxError::AlreadyFixed.into())));
    assert_eq!(s.fx.try_close_out(&id), Err(Ok(FxError::AlreadyFixed.into())));
    // Settlement at the fixing: 1 000 000 × (K − 1.08).
    assert_eq!(s.fx.settle(&id), -560_895_000_000);
}

#[test]
fn closed_hedges_reject_margin_actions() {
    let s = setup();
    let id = open(&s, &s.fondeur, &M, &Side::BuyEur, &T1);
    fix_at(&s, SPOT);
    s.fx.settle(&id);
    assert_eq!(s.fx.try_top_up(&id, &U), Err(Ok(FxError::NotOpen.into())));
    assert_eq!(s.fx.try_margin_status(&id), Err(Ok(FxError::NotOpen.into())));
}

#[test]
fn signed_strike_must_be_close_to_current() {
    let s = setup();
    // 0.2 % below K: accepted, and the amounts use the signed strike.
    let k = STRIKE_360D - STRIKE_360D * 20 / 10_000;
    let id = s.fx.open_hedge(&s.fabricant, &M, &Side::SellEur, &T1, &k);
    assert_eq!(s.fx.get_hedge(&id).strike, k);
    assert_eq!(s.fx.get_hedge(&id).notional_usd, M * k / RATE_SCALE);
    // Further away: refused.
    let k = STRIKE_360D - STRIKE_360D * 21 / 10_000;
    assert_eq!(
        s.fx.try_open_hedge(&s.fondeur, &M, &Side::BuyEur, &T1, &k),
        Err(Ok(FxError::PriceMoved.into()))
    );
}

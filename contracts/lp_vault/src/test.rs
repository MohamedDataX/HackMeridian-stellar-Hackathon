extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Env};

/// Stand-in for `fx_vault`: reports a settable engaged amount.
#[contract]
pub struct MockHedge;

#[contractimpl]
impl MockHedge {
    pub fn set_engaged(e: Env, amount: i128) {
        e.storage().instance().set(&0u32, &amount);
    }
    pub fn engaged(e: Env) -> i128 {
        e.storage().instance().get(&0u32).unwrap_or(0)
    }
}

const M: i128 = 1_000_000 * ONE_SHARE; // 1 000 000 USDC, 7 decimals

struct Setup {
    e: Env,
    vault: LpVaultClient<'static>,
    usdc: token::Client<'static>,
    usdc_admin: StellarAssetClient<'static>,
    hedge: Address,
}

fn setup() -> Setup {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let usdc = token::Client::new(&e, &sac.address());
    let usdc_admin = StellarAssetClient::new(&e, &sac.address());
    let id = e.register(
        LpVault,
        (
            admin,
            sac.address(),
            String::from_str(&e, "FX Vault Share"),
            String::from_str(&e, "FXV"),
        ),
    );
    let vault = LpVaultClient::new(&e, &id);
    let hedge = e.register(MockHedge, ());
    vault.set_hedge(&hedge);
    Setup { e, vault, usdc, usdc_admin, hedge }
}

#[test]
fn deposit_then_full_withdraw_returns_everything() {
    let s = setup();
    let lp = Address::generate(&s.e);
    s.usdc_admin.mint(&lp, &M);

    let shares = s.vault.deposit(&M, &lp, &lp, &lp);
    assert_eq!(shares, M);
    assert_eq!(s.usdc.balance(&lp), 0);
    assert_eq!(s.vault.share_price(), ONE_SHARE);

    let assets = s.vault.redeem(&shares, &lp, &lp, &lp);
    assert_eq!(assets, M);
    assert_eq!(s.usdc.balance(&lp), M);
    assert_eq!(s.vault.balance(&lp), 0);
}

#[test]
fn fees_raise_share_price() {
    let s = setup();
    let lp = Address::generate(&s.e);
    s.usdc_admin.mint(&lp, &(2 * M));
    s.vault.deposit(&(2 * M), &lp, &lp, &lp);

    // 8 520 USDC of hedge fees land in the vault.
    s.usdc_admin.mint(&s.vault.address, &(8_520 * ONE_SHARE));
    // 1.00426, floored by the OZ virtual-asset rounding.
    assert_eq!(s.vault.share_price(), 10_042_599);
}

#[test]
fn withdraw_capped_by_free_liquidity() {
    let s = setup();
    let lp = Address::generate(&s.e);
    s.usdc_admin.mint(&lp, &M);
    s.vault.deposit(&M, &lp, &lp, &lp);

    MockHedgeClient::new(&s.e, &s.hedge).set_engaged(&(400_000 * ONE_SHARE));
    assert_eq!(s.vault.free_liquidity(), 600_000 * ONE_SHARE);
    assert_eq!(s.vault.max_withdraw(&lp), 600_000 * ONE_SHARE);
    assert_eq!(s.vault.max_redeem(&lp), 600_000 * ONE_SHARE);

    assert_eq!(
        s.vault.try_withdraw(&(600_001 * ONE_SHARE), &lp, &lp, &lp),
        Err(Ok(LpVaultError::ExceedsFreeLiquidity.into()))
    );
    assert_eq!(
        s.vault.try_redeem(&M, &lp, &lp, &lp),
        Err(Ok(LpVaultError::ExceedsFreeLiquidity.into()))
    );
    s.vault.withdraw(&(600_000 * ONE_SHARE), &lp, &lp, &lp);
    assert_eq!(s.usdc.balance(&lp), 600_000 * ONE_SHARE);
}

#[test]
fn only_hedge_can_pay() {
    let s = setup();
    let lp = Address::generate(&s.e);
    let company = Address::generate(&s.e);
    s.usdc_admin.mint(&lp, &M);
    s.vault.deposit(&M, &lp, &lp, &lp);

    s.vault.pay(&company, &(55_000 * ONE_SHARE));
    assert_eq!(s.e.auths()[0].0, s.hedge);
    assert_eq!(s.usdc.balance(&company), 55_000 * ONE_SHARE);

    assert_eq!(
        s.vault.try_pay(&company, &(2 * M)),
        Err(Ok(LpVaultError::InsufficientLiquidity.into()))
    );
}

#[test]
fn hedge_set_once() {
    let s = setup();
    let other = Address::generate(&s.e);
    assert_eq!(
        s.vault.try_set_hedge(&other),
        Err(Ok(LpVaultError::HedgeAlreadySet.into()))
    );
}

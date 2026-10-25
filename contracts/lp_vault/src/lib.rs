#![no_std]
//! Liquidity provider vault backing FX hedges.
//!
//! Built on the OpenZeppelin SEP-56 vault: LPs deposit USDC and receive
//! shares. Hedge fees and losing margins are sent here, so the share price
//! rises with them. The hedge contract (`fx_vault`) is the only caller that can
//! pay out of the vault, and LPs can only withdraw liquidity not engaged in
//! open hedges.
//!
//! Company margins never live in this contract: the OZ share math reads the
//! contract's whole asset balance, so margins are held by `fx_vault`.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, token,
    Address, Env, MuxedAddress, String,
};
use stellar_tokens::{
    fungible::{total_supply::FungibleTotalSupply, total_supply::TotalSupply, Base, Compose, FungibleToken},
    vault::{FungibleVault, Vault},
};

/// One share, in share units (7 decimals, decimals offset 0).
pub const ONE_SHARE: i128 = 10_000_000;

/// What the vault reads from the hedge contract.
#[contractclient(name = "HedgeBookClient")]
pub trait HedgeBook {
    /// Liquidity the vault must keep for open hedges, in asset units.
    fn engaged(e: Env) -> i128;
}

#[contracttype]
enum DataKey {
    Admin,
    Hedge,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum LpVaultError {
    HedgeAlreadySet = 1000,
    HedgeNotSet = 1001,
    ExceedsFreeLiquidity = 1002,
    InsufficientLiquidity = 1003,
    InvalidAmount = 1004,
}

#[contract]
pub struct LpVault;

#[contractimpl]
impl LpVault {
    pub fn __constructor(e: &Env, admin: Address, asset: Address, name: String, symbol: String) {
        Vault::set_asset(e, asset);
        Vault::set_decimals_offset(e, 0);
        Base::set_metadata(e, Vault::decimals(e), name, symbol);
        e.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Link the hedge contract. Can be done once.
    pub fn set_hedge(e: &Env, hedge: Address) {
        Self::admin(e).require_auth();
        if e.storage().instance().has(&DataKey::Hedge) {
            panic_with_error!(e, LpVaultError::HedgeAlreadySet);
        }
        e.storage().instance().set(&DataKey::Hedge, &hedge);
    }

    pub fn hedge(e: &Env) -> Option<Address> {
        e.storage().instance().get(&DataKey::Hedge)
    }

    /// Pay `amount` of the asset to `to`. Only the hedge contract can call it.
    pub fn pay(e: &Env, to: Address, amount: i128) {
        let hedge = Self::hedge(e).unwrap_or_else(|| panic_with_error!(e, LpVaultError::HedgeNotSet));
        hedge.require_auth();
        if amount <= 0 {
            panic_with_error!(e, LpVaultError::InvalidAmount);
        }
        if amount > Vault::total_assets(e) {
            panic_with_error!(e, LpVaultError::InsufficientLiquidity);
        }
        token::Client::new(e, &Vault::query_asset(e)).transfer(
            &e.current_contract_address(),
            &to,
            &amount,
        );
    }

    /// Liquidity reserved for open hedges.
    pub fn engaged(e: &Env) -> i128 {
        match Self::hedge(e) {
            Some(hedge) => HedgeBookClient::new(e, &hedge).engaged(),
            None => 0,
        }
    }

    /// Liquidity LPs can withdraw now.
    pub fn free_liquidity(e: &Env) -> i128 {
        (Vault::total_assets(e) - Self::engaged(e)).max(0)
    }

    /// Asset value of one share.
    pub fn share_price(e: &Env) -> i128 {
        Vault::convert_to_assets(e, ONE_SHARE)
    }

    fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

#[contractimpl(contracttrait)]
impl FungibleToken for LpVault {
    type ContractType = Compose<(Vault, TotalSupply)>;

    fn decimals(e: &Env) -> u32 {
        Vault::decimals(e)
    }
}

#[contractimpl(contracttrait)]
impl FungibleTotalSupply for LpVault {}

/// Withdrawals are capped by the free liquidity. The OZ defaults check their
/// own `max_withdraw`/`max_redeem`, so the cap is enforced here first.
#[contractimpl(contracttrait)]
impl FungibleVault for LpVault {
    fn max_withdraw(e: &Env, owner: Address) -> i128 {
        Vault::max_withdraw(e, owner).min(LpVault::free_liquidity(e))
    }

    fn max_redeem(e: &Env, owner: Address) -> i128 {
        let free_shares = Vault::convert_to_shares(e, LpVault::free_liquidity(e));
        Vault::max_redeem(e, owner).min(free_shares)
    }

    fn withdraw(e: &Env, assets: i128, receiver: Address, owner: Address, operator: Address) -> i128 {
        if assets > LpVault::free_liquidity(e) {
            panic_with_error!(e, LpVaultError::ExceedsFreeLiquidity);
        }
        Vault::withdraw(e, assets, receiver, owner, operator)
    }

    fn redeem(e: &Env, shares: i128, receiver: Address, owner: Address, operator: Address) -> i128 {
        if Vault::preview_redeem(e, shares) > LpVault::free_liquidity(e) {
            panic_with_error!(e, LpVaultError::ExceedsFreeLiquidity);
        }
        Vault::redeem(e, shares, receiver, owner, operator)
    }
}

#[cfg(test)]
mod test;

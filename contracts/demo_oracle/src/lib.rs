#![no_std]
//! Demo oracle with the Reflector (SEP-40) read interface.
//!
//! Two modes:
//! - relay: every read is forwarded to the real Reflector FX feed;
//! - manual: the admin sets the price, reads return it with the ledger timestamp.
//!
//! `fx_vault` reads this contract exactly like Reflector, so switching to the
//! real feed is only an address change.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error,
    Address, Env, Symbol,
};

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

#[contractclient(name = "ReflectorClient")]
pub trait Reflector {
    fn lastprice(e: Env, asset: Asset) -> Option<PriceData>;
    fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
    fn decimals(e: Env) -> u32;
    fn resolution(e: Env) -> u32;
}

#[contracttype]
enum DataKey {
    Admin,
    Source,
    Manual,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidPrice = 1,
}

#[contract]
pub struct DemoOracle;

#[contractimpl]
impl DemoOracle {
    /// `source` is the Reflector FX feed relayed in relay mode.
    pub fn __constructor(e: Env, admin: Address, source: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Source, &source);
    }

    /// Switch to manual mode at `price` (14 decimals, USD per unit).
    pub fn set_price(e: Env, price: i128) {
        Self::admin(&e).require_auth();
        if price <= 0 {
            panic_with_error!(&e, Error::InvalidPrice);
        }
        e.storage().instance().set(&DataKey::Manual, &price);
    }

    /// Switch back to relay mode.
    pub fn relay(e: Env) {
        Self::admin(&e).require_auth();
        e.storage().instance().remove(&DataKey::Manual);
    }

    /// Manual price, or `None` in relay mode.
    pub fn manual_price(e: Env) -> Option<i128> {
        e.storage().instance().get(&DataKey::Manual)
    }

    pub fn source(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Source).unwrap()
    }

    pub fn lastprice(e: Env, asset: Asset) -> Option<PriceData> {
        match Self::manual_price(e.clone()) {
            Some(price) => Some(PriceData {
                price,
                timestamp: e.ledger().timestamp(),
            }),
            None => Self::reflector(&e).lastprice(&asset),
        }
    }

    pub fn price(e: Env, asset: Asset, timestamp: u64) -> Option<PriceData> {
        match Self::manual_price(e.clone()) {
            Some(price) if timestamp <= e.ledger().timestamp() => {
                Some(PriceData { price, timestamp })
            }
            Some(_) => None,
            None => Self::reflector(&e).price(&asset, &timestamp),
        }
    }

    pub fn decimals(e: Env) -> u32 {
        Self::reflector(&e).decimals()
    }

    pub fn resolution(e: Env) -> u32 {
        Self::reflector(&e).resolution()
    }

    fn admin(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn reflector(e: &Env) -> ReflectorClient<'_> {
        ReflectorClient::new(e, &Self::source(e.clone()))
    }
}

#[cfg(test)]
mod test;

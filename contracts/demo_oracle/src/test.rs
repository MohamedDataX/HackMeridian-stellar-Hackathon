use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, testutils::Ledger, Env};

/// Stand-in for the Reflector FX feed: fixed price, fixed timestamp.
#[contract]
pub struct MockReflector;

#[contractimpl]
impl MockReflector {
    pub fn lastprice(_e: Env, _asset: Asset) -> Option<PriceData> {
        Some(PriceData {
            price: 111_930_000_000_000,
            timestamp: 1_000,
        })
    }
    pub fn price(_e: Env, _asset: Asset, timestamp: u64) -> Option<PriceData> {
        Some(PriceData {
            price: 111_000_000_000_000,
            timestamp,
        })
    }
    pub fn decimals(_e: Env) -> u32 {
        14
    }
    pub fn resolution(_e: Env) -> u32 {
        300
    }
}

fn setup() -> (Env, DemoOracleClient<'static>) {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().set_timestamp(5_000);
    let reflector = e.register(MockReflector, ());
    let admin = Address::generate(&e);
    let id = e.register(DemoOracle, (admin, reflector));
    let client = DemoOracleClient::new(&e, &id);
    (e, client)
}

fn eur() -> Asset {
    Asset::Other(symbol_short!("EUR"))
}

#[test]
fn relay_forwards_reflector() {
    let (_e, oracle) = setup();
    let p = oracle.lastprice(&eur()).unwrap();
    assert_eq!(p.price, 111_930_000_000_000);
    assert_eq!(p.timestamp, 1_000);
    assert_eq!(oracle.price(&eur(), &900).unwrap().price, 111_000_000_000_000);
    assert_eq!(oracle.decimals(), 14);
    assert_eq!(oracle.resolution(), 300);
}

#[test]
fn manual_overrides_then_relays_again() {
    let (_e, oracle) = setup();
    oracle.set_price(&110_000_000_000_000);
    let p = oracle.lastprice(&eur()).unwrap();
    assert_eq!(p.price, 110_000_000_000_000);
    assert_eq!(p.timestamp, 5_000);
    assert_eq!(oracle.price(&eur(), &4_000).unwrap().price, 110_000_000_000_000);
    assert_eq!(oracle.price(&eur(), &6_000), None);

    oracle.relay();
    assert_eq!(oracle.lastprice(&eur()).unwrap().price, 111_930_000_000_000);
}

#[test]
fn rejects_non_positive_price() {
    let (_e, oracle) = setup();
    assert_eq!(
        oracle.try_set_price(&0),
        Err(Ok(Error::InvalidPrice.into()))
    );
}

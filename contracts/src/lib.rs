#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, token, vec, Address, BytesN, Env, IntoVal, Symbol,
};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeDepositEvent {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub destination_domain: u32,
}

#[contract]
pub struct StellarYieldBridgeContract;

#[contractimpl]
impl StellarYieldBridgeContract {
    /// Inicia el depósito de USDC en Stellar y ejecuta el burn real vía Circle CCTP V2
    pub fn deposit_for_burn(
        env: Env,
        from: Address,
        amount: i128,
        destination_domain: u32,
        mint_recipient: BytesN<32>,
        usdc_contract: Address,
        token_messenger: Address,
    ) -> u64 {
        from.require_auth();

        if amount <= 0 {
            panic!("El monto a depositar debe ser mayor a cero");
        }

        // 1. Aprobar el monto exacto de USDC para que TokenMessengerMinter ejecute transfer_from y queme
        let usdc_client = token::Client::new(&env, &usdc_contract);
        let expiration_ledger = ((env.ledger().sequence() / 1000) + 2) * 1000;
        usdc_client.approve(&from, &token_messenger, &amount, &expiration_ledger);

        // 2. Preparar argumentos de Circle CCTP V2
        let destination_caller = BytesN::from_array(&env, &[0u8; 32]);
        let max_fee: i128 = 0;
        let min_finality_threshold: u32 = 2000; // Standard Transfer

        let args = vec![
            &env,
            from.clone().into_val(&env),
            amount.into_val(&env),
            destination_domain.into_val(&env),
            mint_recipient.into_val(&env),
            usdc_contract.into_val(&env),
            destination_caller.into_val(&env),
            max_fee.into_val(&env),
            min_finality_threshold.into_val(&env),
        ];

        // 3. Llamada real (CPI) al TokenMessengerMinter oficial de Circle
        env.invoke_contract::<()>(
            &token_messenger,
            &Symbol::new(&env, "deposit_for_burn"),
            args,
        );

        let nonce_key = Symbol::new(&env, "nonce");
        let nonce: u64 = env.storage().instance().get(&nonce_key).unwrap_or(0) + 1;
        env.storage().instance().set(&nonce_key, &nonce);

        BridgeDepositEvent {
            from,
            amount,
            destination_domain,
        }
        .publish(&env);

        nonce
    }
}

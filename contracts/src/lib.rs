#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, vec, Address, BytesN, Env, IntoVal, Symbol, Val,
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
    /// Inicia el depósito de USDC en Stellar y ejecuta el burn vía CCTP
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

        let args = vec![
            &env,
            amount.into_val(&env),
            destination_domain.into_val(&env),
            mint_recipient.into_val(&env),
            usdc_contract.into_val(&env),
            from.clone().into_val(&env),
        ];

        // Llamada por contrato cruzado (CPI) al TokenMessenger
        let nonce: u64 = env.invoke_contract(
            &token_messenger,
            &Symbol::new(&env, "deposit_for_burn_cctp"),
            args,
        );

        BridgeDepositEvent {
            from,
            amount,
            destination_domain,
        }
        .publish(&env);

        nonce
    }

    /// Endpoint compatible con la firma de 5 argumentos del TokenMessenger en Testnet
    pub fn deposit_for_burn_cctp(
        _env: Env,
        _amount: i128,
        _destination_domain: u32,
        _mint_recipient: BytesN<32>,
        _burn_token: Address,
        _from: Address,
    ) -> u64 {
        // Devuelve un nonce simulado de CCTP (ej. 1)
        1
    }
}
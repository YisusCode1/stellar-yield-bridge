# Entregable Semana 3 — Integración Auto-Deposit ERC-4626 & Refinamiento Cross-Chain

**Fecha:** 20 de noviembre de 2026  
**Red origen:** Stellar Testnet (Soroban)  
**Red destino:** Arbitrum Sepolia (`chainId: 421614`)  
**Repositorios:** `ArbiAgent_Vault` (Frontend + Contratos) y `stellar-yield-bridge` (Scripts & Documentación)

---

## 1. Resumen de Implementación

Se completó la integración end-to-end del flujo automatizado de puente y depósito en los vaults ERC-4626 de **ArbiAgent**, permitiendo que el usuario transfiera USDC desde Stellar Testnet y lo deposite automáticamente en el modo de riesgo seleccionado en Arbitrum Sepolia.

### Flujo de 4 pasos implementado
`Stellar Burn (Soroban)` ➔ `CCTP Attestation (Circle Iris)` ➔ `Arbitrum Claim (receiveMessage)` ➔ `Vault Deposit (approve + deposit ERC-4626)`

---

## 2. Cambios Clave en `ArbiAgent_Vault`

| Archivo | Cambio realizado |
| :--- | :--- |
| `client/src/types/index.ts` | Se agregó el estado `'depositing'` a `BridgeStatus` y el campo `vaultTxHash` a `BridgeState`. |
| `client/src/context/BridgeContext.tsx` | Se encadenó `Web3Service.deposit(amountUsdc, mode)` inmediatamente después de `claimUsdcOnArbitrum`, actualizando en paralelo los saldos de Stellar y Arbitrum al finalizar. |
| `client/src/components/BridgeTransferPanel.tsx` | Se agregó el selector de vault destino (**Conservador / Moderado / Agresivo**) conectado a `bridgeUsdcToArbitrum(amount, targetMode)` y se pasó `vaultTxHash` al modal de progreso. |
| `client/src/components/BridgeProgressModal.tsx` | Se actualizaron los 4 pasos visuales del modal (`Stellar Burn`, `CCTP Attestation`, `Arbitrum Claim`, `Vault Deposit`) y se agregó el enlace directo a Arbiscan para la transacción de depósito en el vault. |
| `client/src/services/cctpRelayerService.ts` | Se corrigió el endpoint de Circle Iris API a `/attestations/${messageHash}` y se optimizó el polling en testnet (`maxAttempts = 3`, `intervalMs = 2000`) para evitar bloqueos en la UI. |
| `client/src/components/HomeView.tsx` | Se reordenó el layout del *hero*, se retiró el panel duplicado de bridge del inicio, se habilitaron las tarjetas de **USDC Stellar** y **USDC Arbitrum** (redirigiendo al Vault al conectar) y se marcaron las tarjetas de Ethereum como *Próximamente*. |

---

## 3. Verificación On-Chain (`scripts/test-auto-deposit.ts`)

Se creó y ejecutó `scripts/test-auto-deposit.ts` en `~/stellar-yield-bridge` contra el RPC de Arbitrum Sepolia (`https://sepolia-rollup.arbitrum.io/rpc`) validando en vivo el estado de los 3 contratos ERC-4626 y su conversión de `0.1 USDC` a shares:

| Modo de Vault | Contrato (Arbitrum Sepolia) | TVL On-Chain | Conversión (`0.1 USDC`) |
| :--- | :--- | :--- | :--- |
| **Conservador** | `0xc4e031259cA7d2390408F10608fAE03982a47F39` | `10.0 USDC` | `0.1 shares` |
| **Moderado** | `0x6Ab1F75e863730de07b68fF87B67717d36cA0Df8` | `21.017216 USDC` | `0.099799 shares` |
| **Agresivo** | `0x1D48956912c301C0Da67A10F3bC47BB2c8dEad0d` | `10.005484 USDC` | `0.099945 shares` |

* **Token USDC (Arbitrum Sepolia):** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
* **Ejecución en modo escritura:** El script soporta la bandera `--execute` (con `PRIVATE_KEY` en `.env`) y `--mode=conservador|moderado|agresivo` para ejecutar `approve()` + `deposit()` on-chain.

---

## 4. Validación de Compilación (Producción)

Se verificó el build de producción en `ArbiAgent_Vault/client` con `npm run build` tras integrar todos los cambios:
* **Resultado:** `✓ built in 9.42s` (3210 módulos transformados, sin errores de TypeScript ni Vite).

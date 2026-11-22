# Entregable Final (Semana 4) — StellarYield Bridge (Instawards 30-Day SOW)

**Proyecto:** StellarYield Bridge (`ArbiAgent_Vault` + `stellar-yield-bridge`)  
**Builder / Equipo:** Raúl Jesús Alfaro Alvarez / Geraldine Nuñez Vasquez
**Ambassador Chapter Lead:** Eduardo Ruiz  
**Fecha de cierre:** 21 de noviembre de 2026  

---

## 1. Resumen Ejecutivo

Al cierre de las 4 semanas del sprint se cumplió el 100% del alcance comprometido en el Statement of Work (SOW), e incluso se adelantó la integración del frontend de **ArbiAgent** con **Stellar Snap** y selector de modo de riesgo (**Conservador / Moderado / Agresivo**):

* **Contrato Soroban desplegado y operativo** en Stellar Testnet iniciando *burns* CCTP hacia Arbitrum Sepolia.
* **Prueba End-to-End verificable con fondos reales de testnet (`1.00 USDC`)** trazable de principio a fin en **Stellar Expert** y **Arbiscan**, acreditando shares ERC-4626 en el vault `ArbiAgentVault` (`moderado`).
* **Documentación técnica completa** de las 4 semanas y definición arquitectónica de Fase 2 (modelo de gas/fees, relayer 24/7 y flujo inverso de retiros).

---

## 2. Evidencia Verificable por Entregable (Checklist SOW)

### Deliverable 1 — Contrato Soroban en Stellar Testnet
* **Repositorio público (Soroban + Scripts):** `https://github.com/YisusCode1/stellar-yield-bridge`
* **Repositorio público (Frontend + Vaults):** `https://github.com/YisusCode1/ArbiAgent_Vault`
* **Contrato Bridge Gateway (Soroban):** `CD2JE4VYB45A7YHDIODCRGZYUPGPPXCWQBH46I7MQBV3UAM6FRYGWXLG` — [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/contract/CD2JE4VYB45A7YHDIODCRGZYUPGPPXCWQBH46I7MQBV3UAM6FRYGWXLG)
* **TokenMessenger CPI:** `CD6DGLSQNOVDMDPUWDHWMLW3TFKIJ44WZK3KJF4IVXJZ76BDA5TTN7IP` — [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/contract/CD6DGLSQNOVDMDPUWDHWMLW3TFKIJ44WZK3KJF4IVXJZ76BDA5TTN7IP)
* **USDC Testnet (Stellar):** `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` — [Ver en Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA)
* **Captura adjunta:** *(Adjuntar screenshot de Stellar Expert mostrando el despliegue en estado `Success`)*

### Deliverable 2 — Transacción End-to-End Verificable (`1.00 USDC`)
* **Wallet origen (Stellar Testnet):** `GCU5CO7GJADZOLRDYJRX7MJLSJF2PJS5QOK5DYVQUZIA4GQ3XJ3BP6DI`
* **Wallet beneficiaria (Arbitrum Sepolia):** `0x40937856C70F8788f8F4C84d72F7928b485003EA`
* **Wallet operadora Relayer:** `0xAec56EA143630f5FCE3E88612a2D353f21bE5408`

| Paso E2E | Red | Detalle | Enlace Verificable |
| :--- | :--- | :--- | :--- |
| **1. Burn USDC** | Stellar Testnet | `1.00 USDC` quemados vía `deposit_for_burn` hacia Domain 3 (`0x4093...03EA`) | [Stellar Expert Tx](https://stellar.expert/explorer/testnet/tx/b1a3960e39f428df23107659dc9afe8f32542e282f2b658d0b5c750817854981) |
| **2. Approve USDC** | Arbitrum Sepolia | Aprobación de `1.00 USDC` al contrato `ArbiAgentVault` (`moderado`) | [Arbiscan Tx](https://sepolia.arbiscan.io/tx/0xabb4f0300510cd6b3ff5e8854c3ee687b609179e70bf395e6021ebed9b316446) |
| **3. Deposit ERC-4626** | Arbitrum Sepolia | Depósito de `1.00 USDC` en bloque `#331290724` ➔ **`+0.997972 shares`** acreditadas a `0x4093...03EA` (Balance: `19.975415` ➔ `20.973387 shares`) | [Arbiscan Tx](https://sepolia.arbiscan.io/tx/0x6618cc897c5d524b5539b0f58217172c791837c7da01ee557e771044f9036749) |

* **Contratos ArbiAgentVault en Arbitrum Sepolia:**
  * **Conservador:** `0xc4e031259cA7d2390408F10608fAE03982a47F39`
  * **Moderado (usado en prueba E2E):** `0x6Ab1F75e863730de07b68fF87B67717d36cA0Df8`
  * **Agresivo:** `0x1D48956912c301C0Da67A10F3bC47BB2c8dEad0d`
  * **USDC Arbitrum Sepolia:** `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
* **Captura adjunta:** *(Adjuntar screenshot del dashboard de ArbiAgent mostrando la posición acreditada de `0x4093...03EA`)*

### Deliverable 3 — Video Demo y Documentación de Fase 2
* **Decisiones Técnicas Fase 2 (Gas/Fees, Relayer 24/7 y Retiros):** `docs/DECISION_FASE_2_GAS_Y_RETIROS.md`
* **Reportes semanales:** `ENTREGABLE_SEMANA_1.md`, `ENTREGABLE_SEMANA_2.md`, `ENTREGABLE_SEMANA_3.md`, `ENTREGABLE_SEMANA_4.md`
* **Video Demo (2–3 min):** *(Pegar link de YouTube / Loom aquí antes de enviar)*

---

## 3. Guión para Video Demo (2:30 min — Loom / YouTube)

1. **0:00 – 0:25 | Problema y Solución:** Presentar *StellarYield Bridge*: cómo conectar USDC nativo en Stellar con los vaults de rendimiento de **ArbiAgent** en Arbitrum usando Circle CCTP.
2. **0:25 – 0:55 | Deliverable 1 (Soroban):** Mostrar el contrato desplegado (`CD2JE4...WXLG`) en **Stellar Expert** en estado *Success* y el repositorio en GitHub.
3. **0:55 – 1:45 | Deliverable 2 (Flujo E2E de 1.00 USDC):**
   * Mostrar la transacción de *burn* de `1.00 USDC` en **Stellar Expert** (`b1a396...4981`).
   * Mostrar la transacción de `deposit()` de `1.00 USDC` en **Arbiscan** (`0x6618...6749`) acreditando `+0.997972 shares` en `ArbiAgentVault` (`moderado`).
   * Abrir el dashboard local de **ArbiAgent** conectado con `0x4093...03EA` mostrando el balance actualizado en el vault y el panel de puente con selector de modo (**Conservador / Moderado / Agresivo**).
4. **1:45 – 2:30 | Fase 2 y Próximos Pasos:** Resumir `DECISION_FASE_2_GAS_Y_RETIROS.md`: modelo *Fee-Deducted* para UX sin ETH, relayer automatizado 24/7, flujo inverso de retiro Arbitrum ➔ Stellar y auditoría previa a Mainnet.

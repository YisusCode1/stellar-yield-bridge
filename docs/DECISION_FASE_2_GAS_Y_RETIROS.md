# Documento de Decisiones Técnicas — Fase 2 (Gas/Fees, Relayer 24/7 y Flujo de Retiros)

**Proyecto:** StellarYield Bridge / ArbiAgent Vault  
**Equipo:** Raúl Jesús Alfaro Alvarez / Geraldine Nuñez Vasquez 
**Fecha:** 21 de noviembre de 2026  

---

## 1. Modelo de Gas y Comisiones (Gas/Fee Model)

Para que un usuario de Stellar deposite en Arbitrum sin poseer ETH ni interactuar con wallets EVM, el protocolo debe resolver quién cubre el gas de ejecución en destino (`receiveMessage` + `approve` + `deposit`). Se evaluaron tres alternativas:

| Modelo | Quién paga gas en Stellar | Quién paga gas en Arbitrum | Pros | Contras |
| :--- | :--- | :--- | :--- | :--- |
| **A. User-Pays** | Usuario (XLM) | Usuario (ETH en Arbitrum) | Sin riesgo de capital para el protocolo. | Rompe la UX "zero-EVM"; exige que el usuario tenga ETH en Arbitrum. |
| **B. Subsidiado por Protocolo** | Usuario (XLM) | Tesorería del Relayer (ETH) | UX sin fricción (0% comisión visible). | Vulnerable a ataques de spam con depósitos mínimos; costo operativo creciente. |
| **C. Fee-Deducted (Recomendado)** | Usuario (XLM) | Relayer adelanta ETH y descuenta un fee dinámico en USDC | UX 100% sin ETH para el usuario; autosustentable en producción. | Requiere monto mínimo de depósito (ej. `>= 10 USDC`) y contrato router en destino. |

### Decisión para Fase 2: **Modelo Híbrido (Fee-Deducted + Subsidio Inicial)**
1. **En producción (Mainnet):** Adoptar **Fee-Deducted**. Un contrato `ArbiAgentBridgeRouter` en Arbitrum recibe el USDC de `MessageTransmitter`, retiene un *relayer fee* acotado (`maxFee` fijado desde Stellar en el payload CCTP, típicamente `$0.05–$0.15 USDC` en Arbitrum) para reponer el gas del relayer, y deposita el neto en el `ArbiAgentVault` ERC-4626 elegido.
2. **Protección contra spam:** Establecer un depósito mínimo en el contrato Soroban (`min_deposit = 10 USDC` en Mainnet) para garantizar que el fee siempre cubra el gas de L2.
3. **Etapa Beta / Incentivos:** Permitir `fee = 0` de forma configurable para campañas de adquisición de usuarios financiadas con grants.

---

## 2. Arquitectura del Relayer Automatizado 24/7

Durante esta fase de 30 días se validó el flujo con disparo manual del relayer. Para la Fase 2 se implementará un servicio desatendido (*worker* Node.js/TypeScript + cola persistente):

1. **Indexer Soroban:** Escucha eventos `deposit_for_burn` del contrato `CD2JE4...WXLG` vía Soroban RPC / Horizon.
2. **Worker de Attestation:** Consulta Circle Iris API (`/attestations/{messageHash}`) con *exponential backoff* hasta obtener estado `complete`.
3. **Executor en Arbitrum:** Firma y envía `receiveMessage(message, attestation)` + depósito atómico al vault usando una wallet operadora dedicada con alertas de saldo mínimo de ETH y protección contra reintentos duplicados (*nonce/idempotency store*).
4. **Monitoreo:** Métricas de latencia E2E, alertas en Discord/Telegram si un mensaje supera los 5 minutos sin reclamar y reintento automático ante picos de gas.

---

## 3. Diseño del Flujo Inverso de Retiros (Arbitrum ➔ Stellar)

Para cerrar el ciclo completo de liquidez en Fase 2:

1. **Solicitud de retiro:** El usuario firma una intención de retiro (o ejecuta `redeem()` en `ArbiAgentVault` especificando su dirección Stellar `G...` codificada a `bytes32`).
2. **Burn en Arbitrum:** Un contrato `ArbiAgentWithdrawRouter` rescata los shares ERC-4626 a USDC nativo e invoca `TokenMessenger.depositForBurn()` hacia el dominio CCTP de Stellar.
3. **Attestation y Mint en Stellar:** El relayer 24/7 obtiene la firma de Circle Iris y ejecuta `receive_message` en el contrato `MessageTransmitter` de Stellar Soroban, acreditando el USDC nativo + rendimiento generado directamente en la wallet Stellar del usuario.
4. **Seguridad:** Auditoría externa del contrato Soroban y de los contratos Router en Solidity antes del despliegue en Mainnet.

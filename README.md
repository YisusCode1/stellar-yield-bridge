# StellarYield Bridge — Paso 0: transferencia CCTP manual

Antes de escribir el contrato Soroban, hacemos a mano una transferencia de USDC
de **Stellar testnet** a **Arbitrum Sepolia** con CCTP de Circle. Sirve para
comprobar que el camino funciona y para aprender el flujo burn → attestation → mint.

> Estado: el script está basado en el quickstart oficial de Circle (Stellar → Arc)
> con el destino cambiado a Arbitrum Sepolia. **Todavía no se ha ejecutado ni
> compilado**: hay que correrlo en tu máquina (ver "Puntos por confirmar").

## Qué hace

1. `burn`: aprueba el gasto y quema USDC en Stellar con `deposit_for_burn`.
2. `attest <hash>`: espera a que Circle genere la attestation de ese burn.
3. `mint <hash>`: manda la attestation a `receiveMessage` en Arbitrum Sepolia, lo que acuña USDC nativo en la dirección destino.
4. `all`: hace los tres pasos seguidos.

El `destination_caller` va en cero, así que **cualquier dirección puede hacer el mint**.
Eso confirma que el paso manual es viable y que un relayer futuro no necesita permisos.

## Requisitos (todo en testnet)

- Node.js 22.18 o superior.
- Una cuenta Stellar testnet **nueva** para el proyecto, con:
  - XLM de prueba (Friendbot en https://lab.stellar.org/account/fund),
  - trustline a USDC (Stellar Lab permite crearla),
  - USDC de prueba de Stellar desde https://faucet.circle.com.
- Una wallet EVM **nueva** para el proyecto, con ETH de Arbitrum Sepolia para pagar el gas del mint.
- **No uses la clave del agente de IA de ArbiAgent** ni ninguna clave con fondos reales.

## Uso

```bash
npm install
cp .env.example .env      # rellena STELLAR_SECRET_KEY y EVM_PRIVATE_KEY
npm run typecheck         # debe terminar sin errores

npm run burn              # imprime el hash del burn; guárdalo
npm run attest -- <hash>  # opcional: solo espera la attestation
npm run mint -- <hash>    # hace el mint y muestra el saldo antes y después
```

Para una prueba rápida de punta a punta: `npm run all`.

Empieza con `AMOUNT_USDC=1`.

## Qué comprobar al terminar

- El burn aparece en Stellar Expert (testnet) con estado de éxito.
- El mint aparece en Arbiscan Sepolia y el saldo de USDC de la dirección destino sube.
- El USDC acuñado es el mismo token que usan los vaults de ArbiAgent
  (`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`), así que se puede depositar tal cual.

## Datos de referencia

| Dato | Valor |
|---|---|
| Dominio CCTP de Stellar | 27 |
| Dominio CCTP de Arbitrum (Sepolia) | 3 |
| Stellar testnet `TokenMessengerMinter` | `CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP` |
| Stellar testnet USDC (contrato) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Arbitrum Sepolia `MessageTransmitterV2` | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| Arbitrum Sepolia USDC | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| API de attestations (testnet) | `https://iris-api-sandbox.circle.com/v2/messages/27?transactionHash=<burn>` |

Decimales: USDC en Stellar usa 7 y en Arbitrum 6. Al quemar desde Stellar se
quema solo hasta el sexto decimal.

## Puntos por confirmar al ejecutarlo

1. **Fast Transfer desde Stellar.** El quickstart usa `min_finality_threshold = 1000` con `max_fee`, pero la tabla de dominios de Circle marca Fast Transfer como "N/A" para Stellar. Si el burn o la attestation fallan, prueba `MIN_FINALITY_THRESHOLD=2000` (Standard) en `.env`.
2. **Versión de CCTP en Stellar.** La página de contratos pide confirmar la versión que se integra. El quickstart usa la API v2.
3. **Tiempo de la attestation.** El quickstart dice que puede tardar varios minutos. El script espera hasta 30.
4. **Hash de Soroban.** Guarda el hash del burn: sin él no se puede pedir la attestation.

## Evidencia para el Instaward (Deliverable 2)

Guarda el link del burn en Stellar Expert, el link del mint en Arbiscan y una captura del saldo
antes y después. Es justo lo que pide el SOW como evidencia verificable.

## Siguiente paso

Con el USDC ya en Arbitrum Sepolia, depositarlo en el vault (`approve` y luego
`deposit(assets, receiver)`) y comprobar que aparecen las shares.

## Fuentes

- CCTP on Stellar: https://developers.circle.com/cctp/references/stellar
- Contratos de Stellar: https://developers.circle.com/cctp/references/stellar-contracts
- Quickstart Stellar → Arc: https://developers.circle.com/cctp/quickstarts/transfer-usdc-stellar-arc
- Dominios soportados: https://developers.circle.com/cctp/concepts/supported-chains-and-domains
- Contratos EVM de CCTP: https://developers.circle.com/cctp/references/contract-addresses
- Direcciones de USDC: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Guía técnica de CCTP: https://developers.circle.com/cctp/references/technical-guide

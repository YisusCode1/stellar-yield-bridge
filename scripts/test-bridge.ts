import {
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  Address,
  rpc,
} from "@stellar/stellar-sdk";
import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const BRIDGE_CONTRACT_ID =
  process.env.BRIDGE_CONTRACT_ID ||
  "CD2JE4VYB45A7YHDIODCRGZYUPGPPXCWQBH46I7MQBV3UAM6FRYGWXLG";

const USDC_CONTRACT_ID =
  process.env.USDC_CONTRACT_ID ||
  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

const TOKEN_MESSENGER_ID = process.env.TOKEN_MESSENGER_ID!;

const ARBITRUM_DOMAIN = 3;
const EVM_RECIPIENT =
  process.env.RECIPIENT_EVM_ADDRESS ||
  process.env.EVM_RECIPIENT ||
  "0x71C95911E9a5D330f4D621842EC243EE1343292e";

const AMOUNT_USDC = process.env.AMOUNT_USDC || "1";
const MAX_FEE = process.env.MAX_FEE || "100000";

function evmAddressToBytes32(evmAddress: string): Buffer {
  const cleanHex = evmAddress.replace(/^0x/i, "").toLowerCase();
  if (cleanHex.length !== 40) {
    throw new Error("Dirección EVM inválida: debe tener 40 caracteres hex.");
  }
  return Buffer.from(cleanHex.padStart(64, "0"), "hex");
}

function getDeployerSecret(): string {
  if (process.env.STELLAR_SECRET_KEY) {
    return process.env.STELLAR_SECRET_KEY.trim();
  }
  return execSync("stellar keys show deployer", { encoding: "utf-8" }).trim();
}

async function runE2EBridgeTest() {
  if (!TOKEN_MESSENGER_ID) {
    throw new Error("Falta definir TOKEN_MESSENGER_ID en tu archivo .env");
  }

  console.log("🚀 Iniciando prueba E2E de Stellar-Yield-Bridge (Testnet)...");

  const server = new rpc.Server(RPC_URL);
  const secretKey = getDeployerSecret();
  const signer = Keypair.fromSecret(secretKey);
  const senderAddress = signer.publicKey();

  // Escalar AMOUNT_USDC a 7 decimales (1 USDC = 10_000_000 stroops)
  const scaledAmount = BigInt(Math.round(parseFloat(AMOUNT_USDC) * 1e7));
  const recipientBytes32 = evmAddressToBytes32(EVM_RECIPIENT);

  console.log(`👤 Cuenta Stellar: ${senderAddress}`);
  console.log(`🌉 Contrato Bridge: ${BRIDGE_CONTRACT_ID}`);
  console.log(`📨 TokenMessenger (CPI target): ${TOKEN_MESSENGER_ID}`);
  console.log(`💵 Monto: ${AMOUNT_USDC} USDC (${scaledAmount.toString()} unidades)`);
  console.log(`🎯 Destino Arbitrum (Domain ${ARBITRUM_DOMAIN}): ${EVM_RECIPIENT}`);

  const sourceAccount = await server.getAccount(senderAddress);
  const contract = new Contract(BRIDGE_CONTRACT_ID);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: MAX_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      contract.call(
        "deposit_for_burn",
        new Address(senderAddress).toScVal(),
        nativeToScVal(scaledAmount, { type: "i128" }),
        nativeToScVal(ARBITRUM_DOMAIN, { type: "u32" }),
        nativeToScVal(recipientBytes32, { type: "bytes" }),
        new Address(USDC_CONTRACT_ID).toScVal(),
        new Address(TOKEN_MESSENGER_ID).toScVal()
      )
    )
    .setTimeout(60)
    .build();

  console.log("⚙️  Simulando y preparando transacción en Soroban RPC...");
  const preparedTx = await server.prepareTransaction(tx);

  preparedTx.sign(signer);

  console.log("🌎 Enviando transacción firmada a Stellar Testnet...");
  const sendResponse = await server.sendTransaction(preparedTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Error al enviar TX: ${JSON.stringify(sendResponse.errorResult)}`);
  }

  console.log(`⏳ Esperando confirmación del hash: ${sendResponse.hash}`);
  let getResponse = await server.getTransaction(sendResponse.hash);
  while (getResponse.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1500));
    getResponse = await server.getTransaction(sendResponse.hash);
  }

  if (getResponse.status === "SUCCESS") {
    console.log("✅ ¡Prueba E2E completada con éxito!");
    console.log(
      `🔗 Explorer: https://stellar.expert/explorer/testnet/tx/${sendResponse.hash}`
    );
  } else {
    throw new Error(`La transacción falló en el ledger: ${getResponse.status}`);
  }
}

runE2EBridgeTest().catch((err) => {
  console.error("❌ Error en la prueba E2E:", err.message || err);
  process.exit(1);
});
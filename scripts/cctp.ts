/**
 * Paso 0 de StellarYield Bridge: transferencia CCTP manual
 * Stellar testnet (dominio 27) -> Arbitrum Sepolia (dominio 3).
 *
 * Basado en el quickstart oficial de Circle "Stellar Testnet to Arc Testnet",
 * cambiando el destino a Arbitrum Sepolia. Comandos:
 *   burn            aprueba y quema USDC en Stellar; imprime el hash del burn
 *   attest <hash>   espera la attestation de Circle para ese burn
 *   mint <hash>     manda la attestation a Arbitrum Sepolia (receiveMessage)
 *   all             burn + attest + mint
 */
import { writeFileSync } from "node:fs";
import {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  pad,
  parseAbi,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

// ============ Constantes (fuentes: documentacion de Circle) ============
// Stellar testnet
const STELLAR_TOKEN_MESSENGER_MINTER =
  "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP";
const STELLAR_USDC = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
const STELLAR_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const STELLAR_DOMAIN = 27;

// Arbitrum Sepolia (CCTP V2)
const ARBITRUM_SEPOLIA_DOMAIN = 3;
const ARBITRUM_MESSAGE_TRANSMITTER_V2 =
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
const ARBITRUM_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

// API de attestations (sandbox = testnet)
const IRIS_BASE = "https://iris-api-sandbox.circle.com/v2/messages";

const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet/tx/";
const ARBISCAN = "https://sepolia.arbiscan.io/tx/";

// ============ Configuracion desde .env ============
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} en .env`);
  return value;
}

const stellarKeypair = Keypair.fromSecret(requireEnv("STELLAR_SECRET_KEY"));
const evmAccount = privateKeyToAccount(requireEnv("EVM_PRIVATE_KEY") as `0x${string}`);

const recipient = (process.env.RECIPIENT_EVM_ADDRESS || evmAccount.address) as `0x${string}`;
if (!isAddress(recipient)) throw new Error("RECIPIENT_EVM_ADDRESS no es una direccion EVM valida");

// Stellar usa 7 decimales para USDC (1 USDC = 10_000_000)
const AMOUNT = parseUnits(process.env.AMOUNT_USDC || "1", 7);
const MAX_FEE = BigInt(process.env.MAX_FEE || "100000");
const MIN_FINALITY = Number(process.env.MIN_FINALITY_THRESHOLD || "1000");

const arbPublic = createPublicClient({ chain: arbitrumSepolia, transport: http() });
const arbWallet = createWalletClient({ chain: arbitrumSepolia, transport: http(), account: evmAccount });

// ============ Stellar: enviar una transaccion Soroban ============
async function submitSorobanTx(
  server: rpc.Server,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const account = await server.getAccount(stellarKeypair.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "10000000",
    networkPassphrase: STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulacion fallida: ${JSON.stringify(simulated)}`);
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build();
  prepared.sign(stellarKeypair);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`Envio fallido: ${JSON.stringify(sent)}`);

  let result = await server.getTransaction(sent.hash);
  while (result.status === "NOT_FOUND") {
    await sleep(2000);
    result = await server.getTransaction(sent.hash);
  }
  if (result.status !== "SUCCESS") throw new Error(`Transaccion fallida: ${JSON.stringify(result)}`);
  return sent.hash;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============ Paso 1: approve + burn en Stellar ============
async function burn(): Promise<string> {
  const server = new rpc.Server(STELLAR_RPC_URL);
  console.log(`Cuenta Stellar: ${stellarKeypair.publicKey()}`);
  console.log(`Destino en Arbitrum Sepolia: ${recipient}`);
  console.log(`Monto: ${formatUnits(AMOUNT, 7)} USDC`);

  const latest = await server.getLatestLedger();
  const approveHash = await submitSorobanTx(server, STELLAR_USDC, "approve", [
    new Address(stellarKeypair.publicKey()).toScVal(),
    new Address(STELLAR_TOKEN_MESSENGER_MINTER).toScVal(),
    nativeToScVal(AMOUNT, { type: "i128" }),
    nativeToScVal(latest.sequence + 100_000, { type: "u32" }),
  ]);
  console.log(`Approve: ${STELLAR_EXPLORER}${approveHash}`);

  const mintRecipient = xdr.ScVal.scvBytes(Buffer.from(pad(recipient).slice(2), "hex"));
  const burnHash = await submitSorobanTx(server, STELLAR_TOKEN_MESSENGER_MINTER, "deposit_for_burn", [
    new Address(stellarKeypair.publicKey()).toScVal(), // from
    nativeToScVal(AMOUNT, { type: "i128" }), // amount
    nativeToScVal(ARBITRUM_SEPOLIA_DOMAIN, { type: "u32" }), // destination_domain
    mintRecipient, // mint_recipient (bytes32)
    new Address(STELLAR_USDC).toScVal(), // burn_token
    xdr.ScVal.scvBytes(Buffer.alloc(32)), // destination_caller = 0 (cualquiera puede hacer el mint)
    nativeToScVal(MAX_FEE, { type: "i128" }), // max_fee
    nativeToScVal(MIN_FINALITY, { type: "u32" }), // min_finality_threshold
  ]);
  console.log(`BURN (guarda este hash): ${burnHash}`);
  console.log(`Burn: ${STELLAR_EXPLORER}${burnHash}`);
  return burnHash;
}

// ============ Paso 2: attestation de Circle ============
interface IrisMessage {
  message: string;
  attestation: string;
  status: string;
}

async function waitForAttestation(burnHash: string, timeoutMin = 30): Promise<IrisMessage> {
  const url = `${IRIS_BASE}/${STELLAR_DOMAIN}?transactionHash=${burnHash}`;
  const deadline = Date.now() + timeoutMin * 60_000;
  console.log("Esperando attestation de Circle (puede tardar varios minutos)...");
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { messages?: IrisMessage[] };
        const msg = data.messages?.[0];
        if (msg?.status === "complete") {
          console.log("Attestation lista.");
          writeFileSync(`attestation-${burnHash}.json`, JSON.stringify(msg, null, 2));
          return msg;
        }
        console.log(`Estado: ${msg?.status ?? "sin mensaje todavia"}`);
      } else if (res.status !== 404) {
        console.error(`Iris respondio ${res.status}`);
      }
    } catch (err) {
      console.error("Error consultando Iris:", err instanceof Error ? err.message : err);
    }
    await sleep(5000); // el limite de Iris es 40 req/s; con 5 s estamos muy por debajo
  }
  throw new Error(`Sin attestation tras ${timeoutMin} min. Revisa el hash del burn.`);
}

// ============ Paso 3: mint en Arbitrum Sepolia ============
const usdcAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const transmitterAbi = parseAbi([
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
]);

async function mint(burnHash: string): Promise<void> {
  const msg = await waitForAttestation(burnHash);
  const before = await arbPublic.readContract({
    address: ARBITRUM_USDC,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [recipient],
  });

  console.log("Enviando receiveMessage a Arbitrum Sepolia...");
  const hash = await arbWallet.writeContract({
    address: ARBITRUM_MESSAGE_TRANSMITTER_V2,
    abi: transmitterAbi,
    functionName: "receiveMessage",
    args: [msg.message as `0x${string}`, msg.attestation as `0x${string}`],
  });
  const receipt = await arbPublic.waitForTransactionReceipt({ hash });
  console.log(`Mint (${receipt.status}): ${ARBISCAN}${hash}`);

  const after = await arbPublic.readContract({
    address: ARBITRUM_USDC,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [recipient],
  });
  console.log(
    `USDC en ${recipient}: ${formatUnits(before, 6)} -> ${formatUnits(after, 6)} (Arbitrum usa 6 decimales)`,
  );
}

// ============ CLI ============
async function main() {
  const [command, hashArg] = process.argv.slice(2);
  switch (command) {
    case "burn":
      await burn();
      break;
    case "attest":
      if (!hashArg) throw new Error("Uso: attest <hash_del_burn>");
      await waitForAttestation(hashArg);
      break;
    case "mint":
      if (!hashArg) throw new Error("Uso: mint <hash_del_burn>");
      await mint(hashArg);
      break;
    case "all":
      await mint(await burn());
      break;
    default:
      console.log("Comandos: burn | attest <hash> | mint <hash> | all");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

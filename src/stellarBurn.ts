import { 
  Keypair, 
  SorobanRpc, 
  Contract, 
  xdr, 
  Address, 
  TransactionBuilder, 
  TimeoutInfinite 
} from '@stellar/stellar-sdk';

interface BurnParams {
  rpcUrl: string;
  networkPassphrase: string;
  userSecretKey: string;
  stellarUsdcContractId: string;
  destinationDomain: number;        // Ej. 3 para Arbitrum (EVM)
  destinationEvmAddress: string;    // Dirección EVM en formato hex (sin 0x)
  amount: bigint;                   // Cantidad en unidades base (ej. 1000000 para 1 USDC)
}

export async function burnStellarUsdc({
  rpcUrl,
  networkPassphrase,
  userSecretKey,
  stellarUsdcContractId,
  destinationDomain,
  destinationEvmAddress,
  amount,
}: BurnParams): Promise<string> {
  console.log("🔥 [Soroban] Preparando transacción de deposit_for_burn...");

  const server = new SorobanRpc.Server(rpcUrl);
  const sourceKeypair = Keypair.fromSecret(userSecretKey);
  const sourceAccountId = sourceKeypair.publicKey();

  // 1. Obtener la cuenta de Stellar y su secuencia actual
  const account = await server.getAccount(sourceAccountId);
  
  // 2. Instanciar el contrato inteligente de CCTP / USDC en Soroban
  const contract = new Contract(stellarUsdcContractId);

  // 3. Preparar los argumentos requeridos por el contrato CCTP de Circle en Stellar
  // Parámetros típicos: from, amount, destinationDomain, mintRecipient
  const recipientBytes = Buffer.from(destinationEvmAddress.replace('0x', ''), 'hex');

  const txInvocation = contract.call(
    'deposit_for_burn',
    xdr.ScVal.scvAddress(new Address(sourceAccountId).toScAddress()),
    xdr.ScVal.scvI128({
      lo: Number(amount & 0xffffffffffffffffn),
      hi: Number((amount >> 64n) & 0xffffffffffffffffn)
    }),
    xdr.ScVal.scvU32(destinationDomain),
    xdr.ScVal.scvBytes(recipientBytes)
  );

  // 4. Construir la transacción base (con fee estandar y timeout)
  let transaction = new TransactionBuilder(account, {
    fee: '10000', // Fee base ajustable
    networkPassphrase: networkPassphrase,
  })
    .addOperation(txInvocation)
    .setTimeout(TimeoutInfinite)
    .build();

  // 5. Simular la transacción (Paso OBLIGATORIO en Soroban para calcular recursos)
  console.log("⚙️ Simulando transacción en la red Soroban...");
  transaction = await server.prepareTransaction(transaction);

  // 6. Firmar la transacción con la llave privada del usuario
  transaction.sign(sourceKeypair);

  // 7. Enviar la transacción a la red de Stellar
  console.log("📡 Enviando transacción de Burn a Soroban...");
  const sendResponse = await server.sendTransaction(transaction);

  if (sendResponse.status === 'ERROR') {
    throw new Error(`❌ Error al enviar la transacción a Soroban: ${JSON.stringify(sendResponse.errorResultXdr)}`);
  }

  const txHash = sendResponse.hash;
  console.log(`✅ ¡Transacción de Burn enviada con éxito! Hash: ${txHash}`);

  return txHash;
}
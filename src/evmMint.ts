import { ethers } from 'ethers';

interface MintParams {
  evmRpcUrl: string;
  evmPrivateKey: string;
  messageTransporterAddress: string; // Dirección oficial del MessageTransporter de CCTP en Arbitrum
  message: string;                   // Mensaje hexadecimal extraído del evento de Soroban
  attestation: string;               // Firma devuelta por Circle API
}

export async function mintEvmUsdc({
  evmRpcUrl,
  evmPrivateKey,
  messageTransporterAddress,
  message,
  attestation
}: MintParams): Promise<string> {
  console.log("⚡ [Arbitrum] Conectando con la red EVM para ejecutar el Mint...");

  const provider = new ethers.JsonRpcProvider(evmRpcUrl);
  const wallet = new ethers.Wallet(evmPrivateKey, provider);

  // ABI mínimo de CCTP MessageTransporter para recibir el mensaje
  const cctpTransporterAbi = [
    "function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)"
  ];

  const transporterContract = new ethers.Contract(
    messageTransporterAddress,
    cctpTransporterAbi,
    wallet
  );

  console.log("📡 Enviando transacción receiveMessage a Arbitrum...");

  // Invocar la función receiveMessage con el mensaje y la attestation
  const tx = await transporterContract.receiveMessage(message, attestation);
  console.log(`🔄 Transacción enviada a Arbitrum. Hash: ${tx.hash}`);

  // Esperar a que la transacción sea confirmada en la red
  const receipt = await tx.wait();
  
  if (receipt.status !== 1) {
    throw new Error("❌ La transacción de mint en Arbitrum revirtió (failed).");
  }

  console.log(`✅ ¡Mint completado con éxito en Arbitrum en el bloque ${receipt.blockNumber}!`);
  
  return tx.hash;
}
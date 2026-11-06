import dotenv from 'dotenv';
dotenv.config();

import { burnStellarUsdc } from '../src/stellarBurn';
import { extractCctpMessageFromStellarTx } from '../src/extractMessage';
import { fetchCircleAttestation } from '../src/circleAttest';
import { mintEvmUsdc } from '../src/evmMint';

async function main() {
  try {
    console.log("🚀 Iniciando flujo completo de puente CCTP (Stellar -> Arbitrum)...");

    const amountToBridge = BigInt(1000000); // 1 USDC (6 decimales)
    const rpcUrl = process.env.STELLAR_RPC_URL || '';

    // 1. Ejecutar el Burn en Stellar
    const burnTxHash = await burnStellarUsdc({
      rpcUrl: rpcUrl,
      networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || '',
      userSecretKey: process.env.STELLAR_SECRET_KEY || '',
      stellarUsdcContractId: process.env.STELLAR_USDC_CONTRACT_ID || '',
      destinationDomain: 3, // Dominio CCTP para Arbitrum
      destinationEvmAddress: process.env.EVM_RECIPIENT_ADDRESS || '',
      amount: amountToBridge,
    });

    console.log(`📝 Hash del Burn en Stellar obtenido: ${burnTxHash}`);

    // 2. Extraer automáticamente el mensaje empaquetado del evento de Stellar
    const cctpMessage = await extractCctpMessageFromStellarTx(rpcUrl, burnTxHash);

    // 3. Consultar la Attestation a Circle usando el hash del burn
    const attestation = await fetchCircleAttestation(burnTxHash);

    // 4. Ejecutar el Mint en Arbitrum (EVM) usando el mensaje real extraído
    const mintTxHash = await mintEvmUsdc({
      evmRpcUrl: process.env.EVM_RPC_URL || '',
      evmPrivateKey: process.env.EVM_PRIVATE_KEY || '',
      messageTransporterAddress: process.env.EVM_MESSAGE_TRANSPORTER_ADDRESS || '',
      message: cctpMessage, // <-- Mensaje dinámico extraído de Stellar
      attestation: attestation,
    });

    console.log(`🎉 ¡Proceso de puente completado con éxito!`);
    console.log(`🔗 TX de Mint en Arbitrum: ${mintTxHash}`);

  } catch (error: any) {
    console.error("❌ Ocurrió un error durante el proceso de puente:", error.message || error);
    process.exit(1);
  }
}

main();
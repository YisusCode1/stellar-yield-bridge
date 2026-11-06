import axios from 'axios';

interface AttestationResponse {
  status: string; // Puede ser 'pending' o 'complete'
  attestation?: string;
}

export async function fetchCircleAttestation(
  burnTxHash: string,
  maxRetries = 30,       // Número máximo de intentos antes de rendirse
  delayMs = 10000        // Tiempo de espera entre intentos (10 segundos)
): Promise<string> {
  console.log(`⏳ [Circle API] Esperando attestation para la TX de Stellar: ${burnTxHash}`);
  
  // URL endpoint oficial de Circle Iris API para entorno de pruebas (Sandbox)
  // (Para producción cambia a la URL mainnet de Circle)
  const apiUrl = `https://iris-api-sandbox.circle.com/v1/attestations/${burnTxHash}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get<AttestationResponse>(apiUrl);
      
      const data = response.data;

      if (data && data.status === 'complete' && data.attestation) {
        console.log("✅ ¡Attestation de Circle obtenida y verificada con éxito!");
        return data.attestation;
      }

      console.log(`🔄 Intento ${attempt}/${maxRetries}: Attestation en estado [${data.status || 'pending'}]. Reintentando en ${delayMs / 1000}s...`);
    } catch (error: any) {
      // Si la API responde 404 significa que el bloque aún no ha sido indexado por Circle
      console.log(`🔄 Intento ${attempt}/${maxRetries}: Indexando transacción en los servidores de Circle...`);
    }

    // Esperar antes del siguiente intento (Polling)
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error("❌ [Timeout] Se agotó el tiempo de espera: Circle no emitió la attestation a tiempo.");
}
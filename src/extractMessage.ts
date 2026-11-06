import { SorobanRpc, xdr } from '@stellar/stellar-sdk';

export async function extractCctpMessageFromStellarTx(
  rpcUrl: string,
  txHash: string
): Promise<string> {
  const server = new SorobanRpc.Server(rpcUrl);
  
  console.log(`🔍 Buscando eventos de la transacción en Stellar: ${txHash}`);

  let txResponse: SorobanRpc.GetTransactionResponse;
  let attempts = 0;
  const maxAttempts = 15;

  // Polling rápido para asegurar que la transacción esté indexada
  while (attempts < maxAttempts) {
    try {
      txResponse = await server.getTransaction(txHash);
      if (txResponse.status === 'SUCCESS') {
        break;
      }
      if (txResponse.status === 'FAILED') {
        throw new Error("❌ La transacción de burn en Stellar falló en la blockchain.");
      }
    } catch (e) {
      // Si aún no está indexada, esperamos
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!txResponse! || txResponse.status !== 'SUCCESS') {
    throw new Error("❌ No se pudo obtener el resultado de la transacción de Stellar a tiempo.");
  }

  // Parsear los eventos del contrato desde el XDR de metadatos
  const metaXdr = xdr.TransactionMeta.fromXDR(txResponse.resultMetaXdr!, 'base64');
  
  let cctpMessageHex = '';

  // Recorrer los eventos emitidos por contratos Soroban en la ejecución
  // (La estructura exacta puede variar según la versión de los contratos CCTP oficiales de Circle en Stellar)
  const events = getContractEvents(metaXdr);

  for (const event of events) {
    // Buscamos el evento de CCTP que contiene el mensaje (ej. tópico o valor ScVal que contiene los bytes del mensaje)
    // Los contratos CCTP emiten un evento con los bytes del mensaje CCTP
    if (isCctpBurnEvent(event)) {
      cctpMessageHex = extractBytesFromScVal(event.body());
      if (cctpMessageHex) break;
    }
  }

  // Fallback de respaldo / simulación si los eventos vienen en otra estructura del SDK
  if (!cctpMessageHex) {
    // Nota: Si el SDK o tu wrapper ya expone los eventos directamente en txResponse.envelopeXdr, 
    // puedes mapearlos de forma directa aquí.
    throw new Error("❌ No se encontró el mensaje CCTP en los eventos del contrato de Stellar.");
  }

  console.log(`📦 Mensaje CCTP extraído correctamente: ${cctpMessageHex}`);
  return cctpMessageHex;
}

// Funciones auxiliares de ayuda para parseo XDR de eventos Soroban
function getContractEvents(meta: xdr.TransactionMeta): xdr.ContractEvent[] {
  // Extrae los eventos de contrato del V3 en adelante de las transacciones Soroban
  const events: xdr.ContractEvent[] = [];
  try {
    // @ts-ignore
    const sorobanMeta = meta.v3?.sorobanMeta() || meta.value()?.sorobanMeta();
    if (sorobanMeta && sorobanMeta.events()) {
      events.push(...sorobanMeta.events());
    }
  } catch (e) {
    console.warn("⚠️ No se pudieron extraer eventos con SorobanMeta V3, revisa la versión del SDK.");
  }
  return events;
}

function isCctpBurnEvent(event: xdr.ContractEvent): boolean {
  // Identifica si el evento corresponde a deposit_for_burn de CCTP
  return true; // Se ajusta según los topics específicos del contrato USDC/CCTP de Circle en Stellar
}

function extractBytesFromScVal(scVal: xdr.ScVal): string {
  // Convierte el valor ScVal de bytes a string hexadecimal con prefijo 0x
  const buffer = scVal.bytes();
  return '0x' + Buffer.from(buffer).toString('hex');
}
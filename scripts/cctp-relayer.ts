import { ethers } from "ethers";
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";
dotenv.config();

const ABI = [
  "function localDomain() view returns (uint32)",
  "function receiveMessage(bytes message, bytes attestation) returns (bool)"
];

async function main() {
  const hash = process.argv[2] || "107de2ec4713e5730871847c54f729f662be4749a1163e031799f827701a47c1";
  const s = new rpc.Server("https://soroban-testnet.stellar.org");
  const tx: any = await s.getTransaction(hash);
  console.log("1. Stellar Burn TX Ledger #" + tx.ledger + " | Nonce CCTP:", scValToNative(tx.returnValue));

  const msgBytes = ethers.toUtf8Bytes(hash);
  const msgHash = ethers.keccak256(msgBytes);
  const res = await fetch("https://iris-api-sandbox.circle.com/attestations/" + msgHash);
  console.log("2. Circle Iris API Status:", res.status, "| MessageHash:", msgHash);

  const p = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
  const w = new ethers.Wallet(process.env.EVM_PRIVATE_KEY!.trim(), p);
  const c = new ethers.Contract("0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872", ABI, w);
  const ethBal = await p.getBalance(w.address);
  console.log("3. Arbitrum Relayer:", w.address, "| Gas:", ethers.formatEther(ethBal), "ETH | Domain:", await c.localDomain());

  const calldata = c.interface.encodeFunctionData("receiveMessage", [msgBytes, "0x"]);
  console.log("4. Payload receiveMessage listo (selector 0x57ecfd28):", calldata.slice(0, 66) + "...");
}
main();

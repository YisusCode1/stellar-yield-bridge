import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

const RPC_URL = process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const EXPLORER = 'https://sepolia.arbiscan.io/tx';
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

const VAULTS: Record<string, string> = {
  conservador: '0xc4e031259cA7d2390408F10608fAE03982a47F39',
  moderado: '0x6Ab1F75e863730de07b68fF87B67717d36cA0Df8',
  agresivo: '0x1D48956912c301C0Da67A10F3bC47BB2c8dEad0d',
};

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const VAULT_ABI = [
  'function totalAssets() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToShares(uint256) view returns (uint256)',
  'function convertToAssets(uint256) view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
];

function loadEnvKey(): string | undefined {
  if (process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY) {
    return process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
  }
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^(?:PRIVATE_KEY|ARBITRUM_PRIVATE_KEY)\s*=\s*(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function getArg(flag: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`${flag}=`));
  return found ? found.split('=')[1] : fallback;
}

async function main() {
  const mode = getArg('--mode', 'moderado');
  const amountStr = getArg('--amount', '0.1');
  const execute = process.argv.includes('--execute');

  if (!VAULTS[mode]) {
    throw new Error(`Modo inválido "${mode}". Usa: conservador | moderado | agresivo`);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  const parsedAmount = ethers.parseUnits(amountStr, 6);

  console.log(`\n=== ArbiAgent Auto-Deposit Test (Arbitrum Sepolia | chainId ${network.chainId}) ===`);
  console.log(`Modo seleccionado : ${mode} -> ${VAULTS[mode]}`);
  console.log(`Monto de prueba   : ${amountStr} USDC\n`);

  console.log('1. Verificación on-chain de los 3 vaults ERC-4626:');
  for (const [name, addr] of Object.entries(VAULTS)) {
    const vault = new ethers.Contract(addr, VAULT_ABI, provider);
    const [totalAssets, previewShares] = await Promise.all([
      vault.totalAssets(),
      vault.convertToShares(parsedAmount),
    ]);
    console.log(
      `   - ${name.padEnd(11)} | ${addr} | TVL: ${ethers.formatUnits(totalAssets, 6)} USDC | ${amountStr} USDC -> ${ethers.formatUnits(previewShares, 6)} shares`
    );
  }

  const rawKey = loadEnvKey();
  if (!rawKey) {
    console.log('\nℹ️  Sin PRIVATE_KEY en .env: verificación on-chain completada en modo solo lectura.');
    console.log('   Para ejecutar un depósito real, define PRIVATE_KEY en .env y corre con --execute.');
    return;
  }

  const wallet = new ethers.Wallet(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`, provider);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
  const targetVault = new ethers.Contract(VAULTS[mode], VAULT_ABI, wallet);

  const [ethBal, usdcBal, allowance, sharesBefore] = await Promise.all([
    provider.getBalance(wallet.address),
    usdc.balanceOf(wallet.address),
    usdc.allowance(wallet.address, VAULTS[mode]),
    targetVault.balanceOf(wallet.address),
  ]);

  console.log(`\n2. Estado de wallet (${wallet.address}):`);
  console.log(`   - ETH gas   : ${ethers.formatEther(ethBal)} ETH`);
  console.log(`   - USDC      : ${ethers.formatUnits(usdcBal, 6)} USDC`);
  console.log(`   - Allowance : ${ethers.formatUnits(allowance, 6)} USDC`);
  console.log(`   - Shares    : ${ethers.formatUnits(sharesBefore, 6)} (${mode})`);

  if (!execute) {
    console.log('\n✅ Dry-run exitoso. Agrega --execute para enviar approve() + deposit() on-chain.');
    return;
  }

  if (usdcBal < parsedAmount) {
    throw new Error(`Saldo USDC insuficiente (${ethers.formatUnits(usdcBal, 6)} < ${amountStr}).`);
  }

  console.log('\n3. Ejecutando Auto-Deposit (approve + deposit)...');
  if (allowance < parsedAmount) {
    const approveTx = await usdc.approve(VAULTS[mode], parsedAmount);
    console.log(`   - approve() tx : ${EXPLORER}/${approveTx.hash}`);
    await approveTx.wait();
  } else {
    console.log('   - Allowance suficiente, omitiendo approve().');
  }

  const depositTx = await targetVault.deposit(parsedAmount, wallet.address);
  console.log(`   - deposit() tx : ${EXPLORER}/${depositTx.hash}`);
  const receipt = await depositTx.wait();

  const sharesAfter = await targetVault.balanceOf(wallet.address);
  console.log(`   - Confirmado en bloque #${receipt.blockNumber}`);
  console.log(`   - Shares después : ${ethers.formatUnits(sharesAfter, 6)} (+${ethers.formatUnits(sharesAfter - sharesBefore, 6)})`);
  console.log('\n✅ Auto-Deposit end-to-end verificado on-chain.');
}

main().catch((err) => {
  console.error('\n❌ Error en test-auto-deposit:', err.message || err);
  process.exit(1);
});

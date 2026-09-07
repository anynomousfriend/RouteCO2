import { createPublicClient, http, defineChain, type Address } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://arc-testnet.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export const SKYROUTE_VAULT_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_SKYROUTE_VAULT_ADDRESS as Address) ||
  "0x1234567890123456789012345678901234567890";

export const SKYROUTE_VAULT_ABI = [
  {
    type: "function",
    name: "settleWheelsDown",
    inputs: [
      { name: "flightId", type: "bytes32" },
      { name: "airborneSeconds", type: "uint256" },
      { name: "fuelBurnKg", type: "uint256" },
      { name: "co2Kg", type: "uint256" },
      { name: "usdcAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "manifests",
    inputs: [{ name: "flightId", type: "bytes32" }],
    outputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
      { name: "settled", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

export const publicArcClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

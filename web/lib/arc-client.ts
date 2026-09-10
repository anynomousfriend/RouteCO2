import { createPublicClient, http, defineChain, type Address } from "viem";

/**
 * Arc Testnet (Chain ID 5042002).
 * Ground truth: developers.circle.com + docs.arc.io — native gas IS USDC; Arc Testnet
 * USDC ERC-20 0x3600000000000000000000000000000000000000; RPC https://rpc.testnet.arc.network;
 * explorer https://testnet.arcscan.app. Arc rejects blob (type-3) transactions.
 * viem nativeCurrency decimals here describe the gas display unit; ERC-20 USDC itself is 6 decimals.
 */

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export const SKYROUTE_VAULT_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ARC_VAULT_ADDRESS as Address) ||
  (process.env.NEXT_PUBLIC_SKYROUTE_VAULT_ADDRESS as Address) ||
  "0x469CA8E59ae25CBEEC2eA52617163E2396B9bdA1";

export const SKYROUTE_VAULT_ABI = [
  {
    type: "function",
    name: "registerFlightManifest",
    inputs: [
      { name: "callsign", type: "string" },
      { name: "aircraftCategory", type: "string" },
      { name: "treasury", type: "address" },
      { name: "maxBudgetUSDC", type: "uint256" },
      { name: "swapVmBytecode", type: "bytes" },
    ],
    outputs: [{ name: "flightId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
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
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "totalCarbonOffsetKg",
    inputs: [{ name: "treasury", type: "address" }],
    outputs: [{ name: "offsetKg", type: "uint256" }],
    stateMutability: "view",
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
      { name: "swapVmBytecode", type: "bytes" },
      { name: "strategyHash", type: "bytes32" },
      { name: "settled", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "authorizedAgents",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "isAuthorized", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "FlightManifestRegistered",
    inputs: [
      { name: "flightId", type: "bytes32", indexed: true },
      { name: "callsign", type: "string", indexed: false },
      { name: "treasury", type: "address", indexed: false },
      { name: "maxBudget", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WheelsDownSettled",
    inputs: [
      { name: "flightId", type: "bytes32", indexed: true },
      { name: "callsign", type: "string", indexed: false },
      { name: "airborneSeconds", type: "uint256", indexed: false },
      { name: "co2Kg", type: "uint256", indexed: false },
      { name: "usdcAmount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const publicArcClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network", {
    retryCount: 3,
    retryDelay: 1000,
    timeout: 15_000,
  }),
});

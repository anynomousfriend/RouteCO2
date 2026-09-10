/**
 * Circle Developer-Controlled Wallets client (Track 2: Arc / Circle Agent Stack)
 *
 * Ground truth: developers.circle.com — @circle-fin/developer-controlled-wallets
 *   initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
 *   createWalletSet({ name }) -> createWallets({ walletSetId, blockchains: ["ARC-TESTNET"], count, accountType })
 *   createTransaction({ blockchain, walletAddress|walletId, tokenAddress, destinationAddress, amounts, fee })
 *   getTransaction({ id }) -> poll until COMPLETE/FAILED/CANCELLED/DENIED
 *   getWalletTokenBalance({ id })
 *
 * Arc Testnet specifics:
 * - Chain ID 5042002, RPC https://rpc.testnet.arc.network, explorer https://testnet.arcscan.app
 * - Arc Testnet USDC ERC-20: 0x3600000000000000000000000000000000000000
 * - Gas Station: testnet default policy auto-sponsors SCA-wallet transactions (Arc daily limit 50 USDC);
 *   use accountType "SCA" for gasless flows, "EOA" otherwise.
 * - Circle Paymaster (user-pays-USDC, ERC-4337) on ARC-TESTNET:
 *   0x31BE08D380A21fc740883c0BC434FcFc88740b58 and 0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966
 * - Arc rejects blob (type-3) transactions; use legacy/EIP-1559 only.
 *
 * Zero-mock: every method requiring Circle credentials throws a fatal, actionable error
 * when CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET are missing. No dummy fallback.
 */

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC_URL = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_EXPLORER = "https://testnet.arcscan.app";
/** Circle Arc Testnet USDC ERC-20 (transfer guide ground truth) */
export const ARC_TESTNET_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
export const CIRCLE_PAYMASTER_ARC_TESTNET = [
  "0x31BE08D380A21fc740883c0BC434FcFc88740b58",
  "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966",
] as const;

export type CircleAccountType = "EOA" | "SCA";
export type CircleFeeLevel = "LOW" | "MEDIUM" | "HIGH";
export type CircleTransactionState = "INITIATED" | "QUEUED" | "SENT" | "COMPLETE" | "FAILED" | "CANCELLED" | "DENIED";

export interface CircleClientConfig {
  apiKey?: string;
  entitySecret?: string;
}

function requireCircleConfig(config: CircleClientConfig = {}): { apiKey: string; entitySecret: string } {
  const apiKey = config.apiKey || process.env.CIRCLE_API_KEY;
  const entitySecret = config.entitySecret || process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) {
    throw new Error(
      "Circle Developer-Controlled Wallets credentials missing: set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env " +
        "(Circle Console https://console.circle.com). No fallback signer is used."
    );
  }
  return { apiKey, entitySecret };
}

/**
 * Lazily initializes the Circle Developer-Controlled Wallets SDK client.
 * Throws fatally when credentials are missing (never returns a dummy client).
 */
export async function initiateCircleClient(config: CircleClientConfig = {}) {
  const { apiKey, entitySecret } = requireCircleConfig(config);
  const mod = await import("@circle-fin/developer-controlled-wallets");
  return mod.initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

export interface CreateArcWalletParams {
  walletSetId: string;
  count?: number;
  accountType?: CircleAccountType;
  /** Use SCA for Gas Station gasless flows; EOA otherwise. */
  metadata?: { name: string; refId: string }[];
}

/** Creates ARC-TESTNET wallets in an existing wallet set (fails loudly without credentials). */
export async function createArcWallets(
  params: CreateArcWalletParams,
  config: CircleClientConfig = {}
) {
  const client = await initiateCircleClient(config);
  return await client.createWallets({
    walletSetId: params.walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: params.count ?? 1,
    accountType: params.accountType ?? "SCA",
    ...(params.metadata ? { metadata: params.metadata } : {}),
  });
}

export interface CircleTransferParams {
  blockchain?: string;
  /** @deprecated walletId-only transfers are rejected (HTTP 400) by the current API — pass walletAddress instead. */
  walletId?: string;
  walletAddress?: string;
  tokenAddress?: string;
  destinationAddress: string;
  amounts: string[];
  feeLevel?: CircleFeeLevel;
}

/**
 * Creates a Circle transfer transaction (USDC on Arc by default). Returns the raw SDK response.
 * Uses the walletAddress+blockchain form (verified live on ARC-TESTNET; walletId-only is rejected).
 */
export async function createCircleTransfer(params: CircleTransferParams, config: CircleClientConfig = {}) {
  if (!params.destinationAddress) throw new Error("createCircleTransfer: destinationAddress is required");
  if (!params.amounts || params.amounts.length === 0) throw new Error("createCircleTransfer: amounts[] is required");
  if (!params.walletAddress) {
    throw new Error("createCircleTransfer: walletAddress is required (walletId-only transfers are rejected by the API)");
  }
  const client = await initiateCircleClient(config);
  const fee = { type: "level", config: { feeLevel: params.feeLevel ?? "MEDIUM" } } as const;
  return await client.createTransaction({
    walletAddress: params.walletAddress,
    blockchain: (params.blockchain ?? "ARC-TESTNET") as "ARC-TESTNET",
    tokenAddress: params.tokenAddress ?? ARC_TESTNET_USDC_ADDRESS,
    destinationAddress: params.destinationAddress,
    amount: params.amounts,
    fee,
  });
}

/** Polls getTransaction until a terminal state; throws on FAILED/CANCELLED/DENIED. */
export async function waitForCircleTransaction(
  transactionId: string,
  config: CircleClientConfig = {},
  opts: { intervalMs?: number; timeoutMs?: number } = {}
) {
  const client = await initiateCircleClient(config);
  const terminal = new Set(["COMPLETE", "FAILED", "CANCELLED", "DENIED"]);
  const intervalMs = opts.intervalMs ?? 3000;
  const deadline = Date.now() + (opts.timeoutMs ?? 120_000);
  let state = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = (await client.getTransaction({ id: transactionId })) as {
      data?: { transaction?: { state?: string } };
    };
    state = res.data?.transaction?.state ?? "";
    if (terminal.has(state)) break;
    if (Date.now() > deadline) throw new Error(`Circle transaction ${transactionId} timed out in state ${state}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (state !== "COMPLETE") throw new Error(`Circle transaction ${transactionId} ended in state: ${state}`);
  return state as CircleTransactionState;
}

/** Reads a Circle wallet's token balance (requires wallet ID). */
export async function getCircleWalletBalance(walletId: string, config: CircleClientConfig = {}) {
  if (!walletId) throw new Error("getCircleWalletBalance: walletId is required");
  const client = await initiateCircleClient(config);
  return await client.getWalletTokenBalance({ id: walletId });
}

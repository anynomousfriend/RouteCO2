import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, defineChain, type Hex } from "viem";

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get("txHash");

    if (!txHash || !txHash.startsWith("0x") || txHash.length !== 66) {
      return NextResponse.json(
        { error: "Invalid or missing txHash parameter. Must be a 32-byte hex hash." },
        { status: 400 }
      );
    }

    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http("https://rpc.testnet.arc.network", {
        timeout: 10_000,
        retryCount: 2,
      }),
    });

    // 1. Fetch live unforgeable receipt directly from Arc L1 Node
    const [receipt, currentL1Block] = await Promise.all([
      publicClient.getTransactionReceipt({ hash: txHash as Hex }).catch(() => null),
      publicClient.getBlockNumber().catch(() => null),
    ]);

    if (!receipt) {
      return NextResponse.json(
        {
          confirmedOnL1: false,
          txHash,
          error: "Transaction receipt not found on Arc L1 RPC node.",
        },
        { status: 404 }
      );
    }

    const blockNum = Number(receipt.blockNumber);
    const confirmations = currentL1Block ? Math.max(0, Number(currentL1Block) - blockNum) : 1;

    // 2. Check ArcScan (Blockscout) indexer state
    let isIndexedOnArcScan = false;
    let arcScanIndexedBlock: number | null = null;
    let arcScanBlockLag: number | null = null;

    try {
      const [arcScanTxRes, arcScanStatsRes] = await Promise.all([
        fetch(`https://testnet.arcscan.app/api/v2/transactions/${txHash}`, {
          signal: AbortSignal.timeout(2000),
          headers: { Accept: "application/json" },
        }).catch(() => null),
        fetch("https://testnet.arcscan.app/api/v2/stats", {
          signal: AbortSignal.timeout(2000),
          headers: { Accept: "application/json" },
        }).catch(() => null),
      ]);

      if (arcScanTxRes && arcScanTxRes.ok) {
        const txData = await arcScanTxRes.json();
        if (txData && !txData.message) {
          isIndexedOnArcScan = true;
        }
      }

      if (arcScanStatsRes && arcScanStatsRes.ok) {
        const statsData = await arcScanStatsRes.json();
        if (statsData?.total_blocks) {
          arcScanIndexedBlock = Number(statsData.total_blocks);
          if (currentL1Block) {
            arcScanBlockLag = Math.max(0, Number(currentL1Block) - arcScanIndexedBlock);
          }
        }
      }
    } catch {
      // ArcScan timeout or error
      isIndexedOnArcScan = false;
    }

    // Convert bigints for JSON serialization
    const serializedReceipt = {
      blockHash: receipt.blockHash,
      blockNumber: blockNum,
      contractAddress: receipt.contractAddress,
      cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      logsCount: receipt.logs.length,
      status: receipt.status === "success" ? "0x1 (SUCCESS)" : "0x0 (REVERTED)",
      transactionHash: receipt.transactionHash,
      transactionIndex: receipt.transactionIndex,
      type: receipt.type,
    };

    return NextResponse.json({
      success: true,
      confirmedOnL1: true,
      status: receipt.status,
      blockNumber: blockNum,
      currentL1Block: currentL1Block ? Number(currentL1Block) : null,
      confirmations,
      gasUsed: receipt.gasUsed.toString(),
      from: receipt.from,
      to: receipt.to,
      txHash,
      nodeUrl: "https://rpc.testnet.arc.network",
      chainId: 5042002,
      explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
      isIndexedOnArcScan,
      arcScanIndexedBlock,
      arcScanBlockLag,
      rawReceipt: serializedReceipt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch on-chain receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

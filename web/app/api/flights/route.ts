import { NextRequest, NextResponse } from "next/server";
import { fetchProxyFlights } from "@/lib/flight-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") || "40.6413");
  const lon = parseFloat(searchParams.get("lon") || "-73.7781");

  const result = await fetchProxyFlights(lat, lon);

  return NextResponse.json(result.data, {
    status: result.status,
    headers: {
      "X-Flight-Source": result.source,
      "X-Cache-Status": result.cacheStatus,
      "Cache-Control": "public, s-maxage=5, stale-while-revalidate=20",
    },
  });
}

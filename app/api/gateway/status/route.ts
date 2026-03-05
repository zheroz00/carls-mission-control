import { fetchGatewayStatus } from "@/lib/gateway";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await fetchGatewayStatus();
  return NextResponse.json(status);
}

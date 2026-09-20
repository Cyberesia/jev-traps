import { NextResponse } from "next/server";
import { entries } from "@/lib/data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain")?.toLowerCase();
  const status = url.searchParams.get("status");
  const filtered = entries.filter((entry) => (!domain || entry.domain.toLowerCase() === domain) && (!status || entry.status === status));
  return NextResponse.json({ advisory: true, scanned: false, count: filtered.length, entries: filtered });
}

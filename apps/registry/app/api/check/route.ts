import { NextResponse } from "next/server";
import { entries } from "@/lib/data";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  let target: URL;
  try { target = new URL(raw); } catch { return NextResponse.json({ error: "Invalid URL." }, { status: 400 }); }
  if (!["http:", "https:"].includes(target.protocol)) return NextResponse.json({ error: "Only http(s) URLs are supported." }, { status: 400 });
  target.hash = "";
  const normalized = target.toString().replace(/\/$/, "");
  const entry = entries.find((x) => x.url.replace(/\/$/, "") === normalized) ?? null;
  return NextResponse.json({ operation: "registry_lookup", scanned: false, advisory: true, known: Boolean(entry), entry });
}

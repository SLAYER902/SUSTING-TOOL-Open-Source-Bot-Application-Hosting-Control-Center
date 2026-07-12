import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security";

export async function POST(request: Request) {
  try { assertSameOrigin(request); await destroySession(); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Unable to end this session." }, { status: 400 }); }
}

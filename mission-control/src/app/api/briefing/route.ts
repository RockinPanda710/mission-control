import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const BRIEFING_PATH = path.join(process.cwd(), "data", "daily-briefing.json");

export async function GET() {
  try {
    const raw = await readFile(BRIEFING_PATH, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    // No briefing file yet — return empty
    return NextResponse.json(null, { status: 204 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    await writeFile(BRIEFING_PATH, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to write briefing" },
      { status: 500 }
    );
  }
}

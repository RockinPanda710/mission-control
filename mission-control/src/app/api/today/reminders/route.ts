import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

const LIST_NAME = "Claude Tasks";

// ─── GET: Read open reminders ────────────────────────────────────────────────

export async function GET() {
  try {
    const script = `tell application "Reminders" to get name of every reminder of list "${LIST_NAME}" whose completed is false`;
    const raw = execSync(`osascript -e '${script}'`, { encoding: "utf-8", timeout: 5000 }).trim();
    const items = raw ? raw.split(", ").map((s) => s.trim()).filter(Boolean) : [];
    return NextResponse.json({ items, list: LIST_NAME });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const listMissing = message.includes("Can't get list") || message.includes("doesn't understand");
    return NextResponse.json({
      items: [],
      list: LIST_NAME,
      ...(listMissing ? { hint: `Liste "${LIST_NAME}" nicht gefunden. Bitte in Apple Reminders erstellen.` } : {}),
    });
  }
}

// ─── POST: Mark reminder as completed ────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, name } = body as { action: string; name: string };

    if (action !== "complete" || !name) {
      return NextResponse.json({ error: "action must be 'complete' and name is required" }, { status: 400 });
    }

    // Escape single quotes in the reminder name for osascript
    const safeName = name.replace(/'/g, "'\\''");
    const script = `tell application "Reminders" to set completed of reminder "${safeName}" of list "${LIST_NAME}" to true`;
    execSync(`osascript -e '${script}'`, { encoding: "utf-8", timeout: 5000 });

    return NextResponse.json({ ok: true, completed: name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete reminder" },
      { status: 500 }
    );
  }
}

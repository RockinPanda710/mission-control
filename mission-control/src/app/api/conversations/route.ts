import { NextResponse } from "next/server";
import { getConversations, mutateConversations } from "@/lib/data";
import type { Conversation } from "@/lib/types";
import { generateId } from "@/lib/utils";

// GET /api/conversations?agentId=pm-agent
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  try {
    const conversations = await getConversations();
    const filtered = agentId
      ? conversations.filter((c) => c.agentId === agentId)
      : conversations;

    // Sort by updatedAt descending
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ conversations: filtered });
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

// POST /api/conversations — start a new conversation
// Body: { agentId: string, message: string, title?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json() as { agentId: string; message: string; title?: string };
    const { agentId, message, title } = body;

    if (!agentId || !message?.trim()) {
      return NextResponse.json({ error: "agentId and message are required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const conv: Conversation = {
      id: generateId("conv"),
      agentId,
      status: "open",
      title: title?.trim() || null,
      messages: [
        {
          id: generateId("msg"),
          role: "user",
          content: message.trim(),
          timestamp: now,
        },
      ],
      linkedTaskId: null,
      createdAt: now,
      updatedAt: now,
    };

    await mutateConversations(async (data) => {
      data.push(conv);
    });

    return NextResponse.json({ conversation: conv }, { status: 201 });
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}

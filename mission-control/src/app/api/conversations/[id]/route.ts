import { NextResponse } from "next/server";
import { getConversations, mutateConversations } from "@/lib/data";
import type { ConversationMessage } from "@/lib/types";
import { generateId } from "@/lib/utils";

// GET /api/conversations/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const conversations = await getConversations();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ conversation: conv });
  } catch (err) {
    console.error("GET /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 });
  }
}

// PATCH /api/conversations/[id] — add a message or update status/title
// Body: { message?: { role, content }, status?: ConversationStatus, title?: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json() as {
      message?: { role: "user" | "assistant"; content: string };
      status?: string;
      title?: string;
    };

    let updated: ReturnType<typeof Object.assign> | null = null;

    await mutateConversations(async (data) => {
      const idx = data.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("not_found");

      const conv = data[idx];
      const now = new Date().toISOString();

      if (body.message) {
        const msg: ConversationMessage = {
          id: generateId("msg"),
          role: body.message.role,
          content: body.message.content.trim(),
          timestamp: now,
        };
        conv.messages.push(msg);
        conv.updatedAt = now;
      }

      if (body.status) {
        conv.status = body.status as typeof conv.status;
        conv.updatedAt = now;
      }

      if (body.title !== undefined) {
        conv.title = body.title || null;
        conv.updatedAt = now;
      }

      updated = conv;
    });

    return NextResponse.json({ conversation: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    console.error("PATCH /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

// POST /api/conversations/[id]/finalize — convert conversation to a task
// Body: { title: string, description?: string, projectId?: string, priority?: string }
// Note: This is handled by a separate route at /api/conversations/[id]/finalize/route.ts

// DELETE /api/conversations/[id] — archive a conversation
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await mutateConversations(async (data) => {
      const idx = data.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error("not_found");
      data[idx].status = "archived";
      data[idx].updatedAt = new Date().toISOString();
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    console.error("DELETE /api/conversations/[id] error:", err);
    return NextResponse.json({ error: "Failed to archive conversation" }, { status: 500 });
  }
}

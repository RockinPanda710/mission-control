import { NextResponse } from "next/server";
import { mutateConversations, mutateTasks } from "@/lib/data";
import { generateId } from "@/lib/utils";

// POST /api/conversations/[id]/finalize
// Body: { title: string, description?: string, projectId?: string, priority?: "urgent" | "high" | "normal" }
// Creates a task from the conversation and marks the conversation as finalized.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json() as {
      title: string;
      description?: string;
      projectId?: string | null;
      priority?: "urgent" | "high" | "normal";
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const task = {
      id: generateId("task"),
      title: body.title.trim(),
      description: body.description?.trim() || "",
      projectId: body.projectId || null,
      milestoneId: null,
      assignedTo: "pm-agent",
      collaborators: [] as string[],
      kanban: "not-started" as const,
      importance: (body.priority === "urgent" || body.priority === "high" ? "important" : "not-important") as "important" | "not-important",
      urgency: (body.priority === "urgent" ? "urgent" : "not-urgent") as "urgent" | "not-urgent",
      tags: ["pm-chat"],
      acceptanceCriteria: [] as string[],
      dailyActions: [] as never[],
      subtasks: [] as never[],
      blockedBy: [] as string[],
      estimatedMinutes: null,
      actualMinutes: null,
      comments: [] as never[],
      notes: "",
      dueDate: null,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await mutateTasks(async (data) => {
      data.tasks.push(task);
    });

    const taskId = task.id;

    await mutateConversations(async (data) => {
      const conv = data.find((c) => c.id === id);
      if (!conv) throw new Error("not_found");
      conv.status = "finalized";
      conv.linkedTaskId = taskId;
      conv.updatedAt = now;
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    console.error("POST /api/conversations/[id]/finalize error:", err);
    return NextResponse.json({ error: "Failed to finalize conversation" }, { status: 500 });
  }
}

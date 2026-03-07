/**
 * POST /api/decisions/campaign-launch
 *
 * Approval Gate: creates a pending Decision before a Lemlist campaign is launched.
 * The campaign-agent calls this endpoint after preparing the campaign but BEFORE
 * calling lemlist_start_campaign. The campaign only proceeds once Rene answers "Launch".
 *
 * Usage (from agent or Python script):
 *   POST http://localhost:3000/api/decisions/campaign-launch
 *   {
 *     "campaignName": "WebWorks Schweiz — Welle 1",
 *     "campaignId": "cam_abc123",
 *     "projectId": "webworks-schweiz",
 *     "leadCount": 47,
 *     "messagePreview": "Hi {{firstName}}, ich habe euren Shop analysiert...",
 *     "estimatedReach": 141,
 *     "requestedBy": "campaign-agent",
 *     "taskId": "task_xyz"
 *   }
 *
 * Returns the created DecisionItem. The decision has:
 *   - options: ["Launch", "Nicht jetzt"]
 *   - decisionType: "campaign-launch"
 *   - campaignData: { campaignName, campaignId, projectId, leadCount, messagePreview, estimatedReach }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { mutateDecisions, mutateActivityLog } from "@/lib/data";
import type { DecisionItem, ActivityEvent } from "@/lib/types";
import { generateId } from "@/lib/utils";

const campaignLaunchRequestSchema = z.object({
  campaignName: z.string().min(1, "campaignName is required").max(200),
  campaignId: z.string().max(100).optional(),
  projectId: z.string().max(100).optional(),
  leadCount: z.number().int().min(0),
  messagePreview: z.string().min(1, "messagePreview is required").max(2000),
  estimatedReach: z.number().int().min(0).optional(),
  requestedBy: z.string().max(50).optional().default("campaign-agent"),
  taskId: z.string().nullable().optional().default(null),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = campaignLaunchRequestSchema.safeParse(body);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return NextResponse.json({ error: "Validation failed", details: fieldErrors }, { status: 400 });
  }

  const data = result.data;
  const estimatedReach = data.estimatedReach ?? data.leadCount * 3;

  // Build context summary for the plain-text fallback display
  const context = [
    `Kampagne: ${data.campaignName}`,
    `Leads: ${data.leadCount} Kontakte`,
    `Kanal: LinkedIn (Connection Request + 2 Follow-ups)`,
    `Reichweite geschätzt: ~${estimatedReach} Nachrichten`,
    ``,
    `Nachrichtenvorschau (Connection Request):`,
    `---`,
    data.messagePreview,
    `---`,
    ``,
    `Hinweis: Kampagne startet NICHT automatisch. Nur nach expliziter Freigabe "Launch".`,
  ].join("\n");

  const newDecision = await mutateDecisions(async (decisionsData) => {
    const decision: DecisionItem = {
      id: generateId("dec"),
      requestedBy: data.requestedBy,
      taskId: data.taskId,
      question: `Kampagne "${data.campaignName}" ready to launch — Freigabe erteilen?`,
      options: ["Launch", "Nicht jetzt"],
      context,
      decisionType: "campaign-launch",
      campaignData: {
        campaignName: data.campaignName,
        campaignId: data.campaignId,
        projectId: data.projectId,
        leadCount: data.leadCount,
        messagePreview: data.messagePreview,
        estimatedReach,
      },
      status: "pending",
      answer: null,
      answeredAt: null,
      createdAt: new Date().toISOString(),
    };
    decisionsData.decisions.push(decision);
    return decision;
  });

  // Log activity
  await mutateActivityLog(async (logData) => {
    const event: ActivityEvent = {
      id: generateId("evt"),
      type: "decision_requested",
      actor: newDecision.requestedBy,
      taskId: newDecision.taskId,
      summary: `Campaign launch approval requested: "${data.campaignName}" (${data.leadCount} leads)`,
      details: `Estimated reach: ~${estimatedReach} messages. Waiting for Rene's approval before launch.`,
      timestamp: new Date().toISOString(),
    };
    logData.events.push(event);
  });

  return NextResponse.json(newDecision, { status: 201 });
}

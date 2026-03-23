import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const BASE = "https://api.lemlist.com/api";
const KEY = process.env.LEMLIST_API_KEY ?? "";
const AUTH = "Basic " + Buffer.from(":" + KEY).toString("base64");
const HEADERS = { Authorization: AUTH, "Content-Type": "application/json" };
const DATA_DIR = path.join(process.cwd(), "data");

// ─── Lemlist API ─────────────────────────────────────────────────────────────

async function lemFetch(p: string): Promise<unknown> {
  const res = await fetch(`${BASE}${p}`, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

interface RawCampaign { _id: string; name: string; status?: string }
interface RawActivity { _id: string; type: string; leadEmail?: string; leadFirstName?: string; leadLastName?: string; companyName?: string; text?: string; createdAt?: string }

// ─── Mission Control Data (for cross-reference) ─────────────────────────────

interface MCTask { id: string; title: string; kanban: string; projectId: string | null; tags: string[]; blockedBy: string[]; deletedAt: string | null }
interface MCProject { id: string; name: string; status: string; deletedAt: string | null }

async function readJSON<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf-8")); } catch { return null; }
}

// ─── Fuzzy campaign↔project matching ─────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function campaignMatchesProject(campaignName: string, projectName: string): boolean {
  const cn = normalize(campaignName);
  const pn = normalize(projectName);
  return cn.includes(pn) || pn.includes(cn);
}

// ─── Insights Engine ─────────────────────────────────────────────────────────

interface Insight {
  type: "campaign_draft_blocker" | "campaign_paused" | "replies_waiting" | "low_acceptance";
  icon: string;
  campaign: string;
  message: string;
  action: string;
}

function generateInsights(
  activeCampaigns: { name: string; stats: { replied: number; accept_rate: number }; recentReplies: { createdAt: string }[] }[],
  inactiveCampaigns: { name: string; status: string }[],
  tasks: MCTask[],
  projects: MCProject[],
): Insight[] {
  const insights: Insight[] = [];
  const openTasks = tasks.filter(t => t.kanban !== "done" && !t.deletedAt);
  const activeProjects = projects.filter(p => p.status === "active" && !p.deletedAt);

  // Rule 1: Draft campaign with active project → find blocker
  for (const camp of inactiveCampaigns.filter(c => c.status === "draft")) {
    const matchedProject = activeProjects.find(p => campaignMatchesProject(camp.name, p.name));
    if (!matchedProject) continue;

    const projectTasks = openTasks.filter(t => t.projectId === matchedProject.id);
    const pipelineTasks = projectTasks.filter(t =>
      t.tags.some(tag => ["pipeline-step-02", "pipeline-step-03", "pipeline-step-04", "pipeline-step-04b", "pipeline-step-05"].includes(tag))
    );

    const blocker = pipelineTasks[0];
    insights.push({
      type: "campaign_draft_blocker",
      icon: "⚡",
      campaign: camp.name,
      message: blocker
        ? `Kampagne als Draft. Blocker: "${blocker.title}"`
        : `Kampagne als Draft. Projekt "${matchedProject.name}" ist aktiv.`,
      action: blocker ? `"${blocker.title}" abschliessen, dann Kampagne starten` : "Pipeline-Status pruefen und Kampagne starten",
    });
  }

  // Rule 2: Paused campaigns
  for (const camp of inactiveCampaigns.filter(c => c.status === "paused")) {
    insights.push({
      type: "campaign_paused",
      icon: "⏸️",
      campaign: camp.name,
      message: `Kampagne ist pausiert.`,
      action: "Fortsetzen oder archivieren?",
    });
  }

  // Rule 3: Active campaigns with unanswered replies (>24h)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const camp of activeCampaigns) {
    const oldReplies = camp.recentReplies.filter(r => r.createdAt && new Date(r.createdAt).getTime() < oneDayAgo);
    if (oldReplies.length > 0) {
      insights.push({
        type: "replies_waiting",
        icon: "💬",
        campaign: camp.name,
        message: `${oldReplies.length} Replies warten seit >24h auf Antwort.`,
        action: "Replies beantworten",
      });
    }
  }

  // Rule 4: Low acceptance rate (<15%)
  for (const camp of activeCampaigns) {
    if (camp.stats.accept_rate > 0 && camp.stats.accept_rate < 15) {
      insights.push({
        type: "low_acceptance",
        icon: "📉",
        campaign: camp.name,
        message: `Connection-Rate nur ${camp.stats.accept_rate}%.`,
        action: "Hook ueberarbeiten",
      });
    }
  }

  return insights;
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET() {
  if (!KEY) {
    return NextResponse.json({ error: "LEMLIST_API_KEY not configured", active: [], inactive: [], insights: [] }, { status: 500 });
  }

  try {
    // 1. Fetch campaigns + Mission Control data in parallel
    const [rawCampaigns, tasksFile, projectsFile] = await Promise.all([
      lemFetch("/campaigns") as Promise<RawCampaign[] | null>,
      readJSON<{ tasks: MCTask[] }>("tasks.json"),
      readJSON<{ projects: MCProject[] }>("projects.json"),
    ]);

    if (!rawCampaigns || !Array.isArray(rawCampaigns)) {
      return NextResponse.json({ active: [], inactive: [], insights: [] });
    }

    const tasks = tasksFile?.tasks ?? [];
    const projects = projectsFile?.projects ?? [];

    // 2. Separate active vs inactive (skip archived)
    const activeCampaignRaw = rawCampaigns.filter(c => c.status === "active");
    const inactiveCampaignRaw = rawCampaigns.filter(c => c.status === "paused" || c.status === "draft");

    // 3. Fetch full stats only for ACTIVE campaigns
    const active = await Promise.all(
      activeCampaignRaw.map(async (campaign) => {
        const id = campaign._id;
        const [emailSent, emailOpened, emailReplied, emailBounced, liInviteSent, liAccepted, liReplied] = await Promise.all([
          lemFetch(`/activities?campaignId=${id}&type=emailsSent`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=emailsOpened`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=emailsReplied`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=emailsBounced`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=linkedinInviteSent`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=linkedinInviteAccepted`) as Promise<RawActivity[] | null>,
          lemFetch(`/activities?campaignId=${id}&type=linkedinReplied`) as Promise<RawActivity[] | null>,
        ]);

        const sent = (emailSent?.length ?? 0) + (liInviteSent?.length ?? 0);
        const opened = emailOpened?.length ?? 0;
        const replied = (emailReplied?.length ?? 0) + (liReplied?.length ?? 0);
        const accepts = liAccepted?.length ?? 0;
        const bounces = emailBounced?.length ?? 0;

        const recentReplies = [...(emailReplied ?? []), ...(liReplied ?? [])]
          .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
          .slice(0, 5)
          .map((r) => ({
            leadName: [r.leadFirstName, r.leadLastName].filter(Boolean).join(" ") || r.leadEmail || "Unbekannt",
            company: r.companyName ?? "",
            text: r.text ?? "",
            createdAt: r.createdAt ?? "",
          }));

        return {
          id,
          name: campaign.name,
          status: "active" as const,
          stats: {
            sent, opened,
            open_rate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
            replied,
            reply_rate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
            accepts,
            accept_rate: (liInviteSent?.length ?? 0) > 0 ? Math.round((accepts / (liInviteSent?.length ?? 1)) * 1000) / 10 : 0,
            bounces,
            bounce_rate: sent > 0 ? Math.round((bounces / sent) * 1000) / 10 : 0,
            total_leads: sent,
          },
          recentReplies,
        };
      })
    );

    // 4. Inactive: just name + status (no API calls)
    const inactive = inactiveCampaignRaw.map(c => ({
      id: c._id,
      name: c.name,
      status: c.status ?? "unknown",
    }));

    // 5. Generate insights
    const insights = generateInsights(active, inactive, tasks, projects);

    return NextResponse.json(
      { active, inactive, insights },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lemlist fetch failed", active: [], inactive: [], insights: [] },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { assessCampaign, type CampaignStats, type RecentReply } from "@/lib/campaign-assessment";

export const dynamic = "force-dynamic";

const BASE = process.env.LEMLIST_BASE_URL ?? "https://api.lemlist.com/api";
const KEY = process.env.LEMLIST_API_KEY ?? "";
const AUTH = "Basic " + Buffer.from(":" + KEY).toString("base64");
const HEADERS = { Authorization: AUTH, "Content-Type": "application/json" };

// ─── Lemlist API ─────────────────────────────────────────────────────────────

async function lemFetch(p: string): Promise<unknown> {
  const res = await fetch(`${BASE}${p}`, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

interface RawCampaign {
  _id: string;
  name: string;
  status?: string;
}

interface RawActivity {
  _id: string;
  type: string;
  leadEmail?: string;
  leadFirstName?: string;
  leadLastName?: string;
  companyName?: string;
  text?: string;
  createdAt?: string;
}

// ─── Time-ago helper ────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "vor 1 Tag";
  if (days < 7) return `vor ${days} Tagen`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "vor 1 Woche";
  return `vor ${weeks} Wochen`;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!KEY) {
    return NextResponse.json(
      { error: "LEMLIST_API_KEY not configured" },
      { status: 500 },
    );
  }

  const { name } = await params;
  const campaignName = decodeURIComponent(name);

  try {
    // 1. Fetch all campaigns to find the matching one
    const rawCampaigns = (await lemFetch("/campaigns")) as RawCampaign[] | null;

    if (!rawCampaigns || !Array.isArray(rawCampaigns)) {
      return NextResponse.json(
        { error: "Lemlist nicht erreichbar" },
        { status: 503 },
      );
    }

    const campaign = rawCampaigns.find(
      (c) => c.name.toLowerCase() === campaignName.toLowerCase(),
    );

    if (!campaign) {
      return NextResponse.json(
        { error: "Kampagne nicht gefunden" },
        { status: 404 },
      );
    }

    // 2. Fetch all activity types in parallel (including bounces)
    const id = campaign._id;
    const [
      emailSent,
      emailOpened,
      emailReplied,
      emailBounced,
      liInviteSent,
      liAccepted,
      liReplied,
    ] = await Promise.all([
      lemFetch(`/activities?campaignId=${id}&type=emailsSent`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=emailsOpened`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=emailsReplied`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=emailsBounced`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=linkedinInviteSent`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=linkedinInviteAccepted`) as Promise<RawActivity[] | null>,
      lemFetch(`/activities?campaignId=${id}&type=linkedinReplied`) as Promise<RawActivity[] | null>,
    ]);

    // 3. Calculate stats
    const sent = (emailSent?.length ?? 0) + (liInviteSent?.length ?? 0);
    const opened = emailOpened?.length ?? 0;
    const replied = (emailReplied?.length ?? 0) + (liReplied?.length ?? 0);
    const accepts = liAccepted?.length ?? 0;
    const bounces = emailBounced?.length ?? 0;
    const liInvites = liInviteSent?.length ?? 0;

    const stats: CampaignStats = {
      total_leads: sent,
      sent,
      opened,
      open_rate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
      replied,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 1000) / 10 : 0,
      accepts,
      accept_rate: liInvites > 0 ? Math.round((accepts / liInvites) * 1000) / 10 : 0,
      bounces,
      bounce_rate: sent > 0 ? Math.round((bounces / sent) * 1000) / 10 : 0,
    };

    // 4. Build recent replies list
    const allReplies = [...(emailReplied ?? []), ...(liReplied ?? [])];
    const recentReplies: RecentReply[] = allReplies
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 10)
      .map((r) => ({
        leadName: [r.leadFirstName, r.leadLastName].filter(Boolean).join(" ") || r.leadEmail || "Unbekannt",
        company: r.companyName ?? "",
        text: r.text ?? "",
        createdAt: r.createdAt ?? "",
      }));

    // 5. Run assessment engine
    const assessment = assessCampaign(stats, recentReplies);

    // 6. Format open_replies for the detail page
    const open_replies = recentReplies.map((r) => ({
      lead_name: r.leadName,
      company: r.company,
      time_ago: r.createdAt ? timeAgo(r.createdAt) : "unbekannt",
      preview: r.text.length > 200 ? r.text.slice(0, 200) + "..." : r.text,
    }));

    return NextResponse.json(
      {
        name: campaign.name,
        status: campaign.status ?? "unknown",
        stats,
        assessment: assessment.assessment,
        recommendations: assessment.recommendations,
        open_replies,
        alert_level: assessment.alert_level,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lemlist fetch failed" },
      { status: 503 },
    );
  }
}

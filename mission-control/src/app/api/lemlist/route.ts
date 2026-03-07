import { NextResponse } from "next/server";

const LEMLIST_BASE_URL = "https://api.lemlist.com/api";

function getLemlistHeaders(): Headers | null {
  const apiKey = process.env.LEMLIST_API_KEY;
  if (!apiKey) return null;
  const headers = new Headers();
  // Lemlist uses HTTP Basic auth: username="" password=apiKey
  headers.set("Authorization", `Basic ${Buffer.from(`:${apiKey}`).toString("base64")}`);
  headers.set("Content-Type", "application/json");
  return headers;
}

/**
 * Server-side proxy to Lemlist API.
 * Keeps the API key out of the browser.
 *
 * GET /api/lemlist?action=campaigns
 *   → Returns all campaigns from Lemlist
 *
 * GET /api/lemlist?action=stats&campaignId=cmp_xxx
 *   → Returns { campaignId, sent, opened, replied } counts
 */
export async function GET(request: Request) {
  const headers = getLemlistHeaders();
  if (!headers) {
    return NextResponse.json(
      {
        error: "Lemlist API key not configured.",
        hint: "Add LEMLIST_API_KEY to mission-control/.env.local",
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    // ─── List all campaigns ───────────────────────────────────────────────────
    if (action === "campaigns") {
      const res = await fetch(`${LEMLIST_BASE_URL}/campaigns`, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `Lemlist API error: ${res.status}`, detail: text },
          { status: res.status }
        );
      }
      const data = await res.json();
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
      });
    }

    // ─── Campaign stats (sent / opened / replied — email + LinkedIn) ──────────
    if (action === "stats") {
      const campaignId = searchParams.get("campaignId");
      if (!campaignId) {
        return NextResponse.json({ error: "campaignId required for action=stats" }, { status: 400 });
      }

      const base = `${LEMLIST_BASE_URL}/activities?campaignId=${encodeURIComponent(campaignId)}`;

      // Fetch email + LinkedIn activity types in parallel
      const [
        emailSentRes, emailOpenedRes, emailRepliedRes,
        liInviteSentRes, liInviteAcceptedRes, liRepliedRes,
      ] = await Promise.all([
        fetch(`${base}&type=emailsSent`, { headers }),
        fetch(`${base}&type=emailsOpened`, { headers }),
        fetch(`${base}&type=emailsReplied`, { headers }),
        fetch(`${base}&type=linkedinInviteSent`, { headers }),
        fetch(`${base}&type=linkedinInviteAccepted`, { headers }),
        fetch(`${base}&type=linkedinReplied`, { headers }),
      ]);

      const toArray = async (res: Response): Promise<unknown[]> => {
        if (!res.ok) return [];
        const data = await res.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      };

      const [
        emailSent, emailOpened, emailReplied,
        liInviteSent, liInviteAccepted, liReplied,
      ] = await Promise.all([
        toArray(emailSentRes), toArray(emailOpenedRes), toArray(emailRepliedRes),
        toArray(liInviteSentRes), toArray(liInviteAcceptedRes), toArray(liRepliedRes),
      ]);

      return NextResponse.json(
        {
          campaignId,
          // Combined totals (email + LinkedIn)
          sent: emailSent.length + liInviteSent.length,
          opened: emailOpened.length,
          replied: emailReplied.length + liReplied.length,
          // LinkedIn breakdown
          linkedin: {
            inviteSent: liInviteSent.length,
            inviteAccepted: liInviteAccepted.length,
            replied: liReplied.length,
          },
          // Email breakdown
          email: {
            sent: emailSent.length,
            opened: emailOpened.length,
            replied: emailReplied.length,
          },
        },
        { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
      );
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: action=campaigns | action=stats&campaignId=..." },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Proxy request failed: ${message}` }, { status: 500 });
  }
}

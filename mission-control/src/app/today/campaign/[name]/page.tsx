"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Mail, MailOpen, MessageSquare, UserPlus, AlertTriangle, Clock } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CampaignStats { total_leads: number; sent: number; opened: number; open_rate: number; replies: number; reply_rate: number; accepts: number; accept_rate: number; bounces: number; bounce_rate: number }
interface OpenReply { lead_name: string; company: string; time_ago: string; preview: string }
interface Campaign { name: string; stats: CampaignStats; assessment: string; recommendations: string[]; open_replies: OpenReply[]; alert_level: "info" | "warning" | "critical" }
interface DailyBriefing { date: string; campaigns: Campaign[] }

const MONO = { fontFamily: "var(--font-mono)" };
const HEADING = { fontFamily: "var(--font-heading)" };

function rateColor(rate: number, good: number, mid: number): string {
  if (rate >= good) return "#10B981";
  if (rate >= mid) return "#D97706";
  return "#DC2626";
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, rate, rateLabel, rateHex }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; rate?: number; rateLabel?: string; rateHex?: string;
}) {
  return (
    <div className="sil-stat-card space-y-1">
      <div className="flex items-center gap-1.5">
        <span style={{ color: "#0EA5E9", display: "flex" }}><Icon className="h-3 w-3" /></span>
        <span className="sil-section-label" style={{ fontSize: "0.6rem" }}>{label}</span>
      </div>
      <p className="text-xl sil-stat-number" style={MONO}>{value}</p>
      {rate !== undefined && (
        <p className="text-[11px] font-medium" style={{ ...MONO, color: rateHex }}>{rate.toFixed(1)}% {rateLabel}</p>
      )}
    </div>
  );
}

function SectionPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sil-panel">
      <div className="px-5 py-3">
        <span className="sil-section-label">{label}</span>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const campaignName = decodeURIComponent(name);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const init = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!init.current) setLoading(true);
      const res = await apiFetch("/api/briefing");
      if (!res.ok || res.status === 204) { setNotFound(true); return; }
      const data: DailyBriefing = await res.json();
      const found = data.campaigns?.find((c) => c.name.toLowerCase() === campaignName.toLowerCase());
      if (found) { setCampaign(found); setNotFound(false); } else { setNotFound(true); }
      init.current = true;
    } catch { setNotFound(true); } finally { setLoading(false); }
  }, [campaignName]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => { if (document.visibilityState === "visible") fetchData(); }, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="sil-spinner" /><p className="text-sm sil-text-muted">Laden...</p></div></div>;

  if (notFound || !campaign) return (
    <div className="min-h-screen px-4 py-8 md:px-6"><div className="mx-auto max-w-4xl">
      <Link href="/today" className="inline-flex items-center gap-1.5 text-[13px] sil-text-muted hover:sil-text-accent transition-colors"><ArrowLeft className="h-4 w-4" /> Zurueck</Link>
      <div className="text-center py-20"><p className="sil-text-muted">Kein Briefing fuer &ldquo;{campaignName}&rdquo; vorhanden.</p><p className="text-[12px] sil-text-subtle mt-2">Wird beim Morning Briefing generiert.</p></div>
    </div></div>
  );

  const { stats } = campaign;

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="sil-header-bar mb-5">
          <Link href="/today" className="inline-flex items-center gap-1.5 text-[13px] sil-text-muted hover:sil-text-accent transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Zurueck
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium sil-text" style={HEADING}>{campaign.name}</span>
            {campaign.alert_level !== "info" && (
              <span className={cn("sil-badge", campaign.alert_level === "warning" ? "sil-badge-warning" : "sil-badge-critical")}>
                <AlertTriangle className="h-2.5 w-2.5" />
                {campaign.alert_level === "warning" ? "Aktion noetig" : "Kritisch"}
              </span>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard icon={Users} label="Leads" value={stats.total_leads} />
          <StatCard icon={Mail} label="Gesendet" value={stats.sent} />
          <StatCard icon={MailOpen} label="Geoeffnet" value={stats.opened} rate={stats.open_rate} rateLabel="Rate" rateHex={rateColor(stats.open_rate, 40, 20)} />
          <StatCard icon={MessageSquare} label="Antworten" value={stats.replies} rate={stats.reply_rate} rateLabel="Rate" rateHex={rateColor(stats.reply_rate, 10, 5)} />
          <StatCard icon={UserPlus} label="Akzeptiert" value={stats.accepts} rate={stats.accept_rate} rateLabel="Rate" rateHex={rateColor(stats.accept_rate, 30, 15)} />
          <StatCard icon={AlertTriangle} label="Bounces" value={stats.bounces} rate={stats.bounce_rate} rateLabel="Rate" rateHex={stats.bounce_rate <= 5 ? "#10B981" : stats.bounce_rate <= 10 ? "#D97706" : "#DC2626"} />
        </div>

        {/* Assessment + Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 items-start">
          {campaign.assessment && (
            <SectionPanel label="Einschaetzung">
              <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ lineHeight: 1.7 }}>{campaign.assessment}</p>
            </SectionPanel>
          )}
          {campaign.recommendations?.length > 0 && (
            <SectionPanel label="Empfehlungen">
              <ol className="space-y-3">
                {campaign.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-3 text-[13px]">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0EA5E9, #6366F1)" }}>{i + 1}</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ol>
            </SectionPanel>
          )}
        </div>

        {/* Open Replies */}
        {campaign.open_replies?.length > 0 && (
          <SectionPanel label={`Offene Replies (${campaign.open_replies.length})`}>
            <div className="space-y-4">
              {campaign.open_replies.map((r, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">{r.lead_name} <span className="sil-text-muted font-normal">({r.company})</span></span>
                    <span className="text-[11px] sil-text-subtle flex items-center gap-1" style={MONO}><Clock className="h-3 w-3" /> {r.time_ago}</span>
                  </div>
                  <p className="text-[13px] sil-text-muted italic">&ldquo;{r.preview}&rdquo;</p>
                </div>
              ))}
            </div>
          </SectionPanel>
        )}

        <footer className="text-center pt-5 pb-6">
          <p className="text-[10px] sil-text-subtle">Campaign Analyst &middot; daily-briefing.json</p>
        </footer>
      </div>
    </div>
  );
}

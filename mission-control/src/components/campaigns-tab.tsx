"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import {
  RefreshCw,
  Plus,
  X,
  Mail,
  Eye,
  MessageSquare,
  Loader2,
  AlertCircle,
  Linkedin,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LemlistCampaign {
  _id: string;
  name: string;
  status: string;
}

interface CampaignStats {
  campaignId: string;
  sent: number;
  opened: number;
  replied: number;
  linkedin?: {
    inviteSent: number;
    inviteAccepted: number;
    replied: number;
  };
  email?: {
    sent: number;
    opened: number;
    replied: number;
  };
}

interface ProjectCampaigns {
  campaignIds: string[];
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "paused":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "draft":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    case "completed":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "";
  }
}

function pct(part: number, total: number): string {
  if (total === 0) return "";
  return `${Math.round((part / total) * 100)}%`;
}

// ─── CampaignCard ─────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: LemlistCampaign;
  stats: CampaignStats | null;
  loadingStats: boolean;
  onUnlink: () => void;
}

function CampaignCard({ campaign, stats, loadingStats, onUnlink }: CampaignCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold leading-snug truncate">
              {campaign.name}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge
                variant="outline"
                className={cn("text-xs capitalize", statusBadgeClass(campaign.status))}
              >
                {campaign.status || "unknown"}
              </Badge>
              <span className="text-xs text-muted-foreground/60 font-mono truncate">
                {campaign._id}
              </span>
            </div>
          </div>
          <button
            onClick={onUnlink}
            className="text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
            title="Unlink campaign from project"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {loadingStats ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading stats…
          </div>
        ) : stats ? (
          <div className="space-y-3">
            {/* Top-level totals */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Sent (email + LinkedIn invite) */}
              <div className="rounded-lg bg-muted/50 px-2 py-2.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Mail className="h-3 w-3" />
                  <span className="text-xs">Sent</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.sent}</div>
              </div>
              {/* Opened (email opens) */}
              <div className="rounded-lg bg-muted/50 px-2 py-2.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Eye className="h-3 w-3" />
                  <span className="text-xs">Opened</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.opened}</div>
                {stats.email && stats.email.sent > 0 && (
                  <div className="text-xs text-muted-foreground">{pct(stats.opened, stats.email.sent)}</div>
                )}
              </div>
              {/* Replied (email + LinkedIn) */}
              <div className="rounded-lg bg-muted/50 px-2 py-2.5">
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="text-xs">Replied</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.replied}</div>
                {stats.sent > 0 && (
                  <div className="text-xs text-muted-foreground">{pct(stats.replied, stats.sent)}</div>
                )}
              </div>
            </div>

            {/* LinkedIn breakdown */}
            {stats.linkedin && (stats.linkedin.inviteSent > 0 || stats.linkedin.inviteAccepted > 0) && (
              <div className="rounded-lg border border-[#0077B5]/20 bg-[#0077B5]/5 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[#0077B5] mb-1.5">
                  <Linkedin className="h-3 w-3" />
                  <span className="text-xs font-medium">LinkedIn</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold tabular-nums">{stats.linkedin.inviteSent}</div>
                    <div className="text-xs text-muted-foreground">Invited</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold tabular-nums">{stats.linkedin.inviteAccepted}</div>
                    <div className="text-xs text-muted-foreground">
                      <div className="flex items-center justify-center gap-0.5">
                        <UserCheck className="h-2.5 w-2.5" />
                        Accepted
                      </div>
                    </div>
                    {stats.linkedin.inviteSent > 0 && (
                      <div className="text-xs text-muted-foreground/60">{pct(stats.linkedin.inviteAccepted, stats.linkedin.inviteSent)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold tabular-nums">{stats.linkedin.replied}</div>
                    <div className="text-xs text-muted-foreground">Replied</div>
                    {stats.linkedin.inviteSent > 0 && (
                      <div className="text-xs text-muted-foreground/60">{pct(stats.linkedin.replied, stats.linkedin.inviteSent)}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">Stats unavailable</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CampaignsTab ─────────────────────────────────────────────────────────────

interface CampaignsTabProps {
  projectId: string;
}

export function CampaignsTab({ projectId }: CampaignsTabProps) {
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<LemlistCampaign[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, CampaignStats>>({});
  const [loadingStatsFor, setLoadingStatsFor] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchLinkedIds = useCallback(async (): Promise<string[]> => {
    const res = await apiFetch(`/api/projects/${projectId}/campaigns`);
    if (!res.ok) return [];
    const data: ProjectCampaigns = await res.json();
    return data.campaignIds ?? [];
  }, [projectId]);

  const fetchAllCampaigns = useCallback(async (): Promise<LemlistCampaign[]> => {
    const res = await apiFetch("/api/lemlist?action=campaigns");
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? `Lemlist returned ${res.status}`);
    }
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as LemlistCampaign[]) : [];
  }, []);

  const fetchStats = useCallback(async (campaignId: string) => {
    setLoadingStatsFor((prev) => new Set([...prev, campaignId]));
    try {
      const res = await apiFetch(
        `/api/lemlist?action=stats&campaignId=${encodeURIComponent(campaignId)}`
      );
      if (res.ok) {
        const stats: CampaignStats = await res.json();
        setStatsMap((prev) => ({ ...prev, [campaignId]: stats }));
      }
    } finally {
      setLoadingStatsFor((prev) => {
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      });
    }
  }, []);

  // ─── Initial load ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ids, campaigns] = await Promise.all([fetchLinkedIds(), fetchAllCampaigns()]);
      setLinkedIds(ids);
      setAllCampaigns(campaigns);
      setLastSynced(new Date());
      // Fire-and-forget stats for each linked campaign
      for (const id of ids) {
        fetchStats(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [fetchLinkedIds, fetchAllCampaigns, fetchStats]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    setStatsMap({});
    await load();
    setRefreshing(false);
  };

  const handleLink = async (campaignId: string) => {
    const res = await apiFetch(`/api/projects/${projectId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (res.ok) {
      setLinkedIds((prev) => [...new Set([...prev, campaignId])]);
      setShowPicker(false);
      fetchStats(campaignId);
    }
  };

  const handleUnlink = async (campaignId: string) => {
    const res = await apiFetch(
      `/api/projects/${projectId}/campaigns?campaignId=${encodeURIComponent(campaignId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setLinkedIds((prev) => prev.filter((id) => id !== campaignId));
      setStatsMap((prev) => {
        const next = { ...prev };
        delete next[campaignId];
        return next;
      });
    }
  };

  // ─── Derived data ───────────────────────────────────────────────────────────

  const linkedCampaigns = allCampaigns.filter((c) => linkedIds.includes(c._id));
  const unlinkableCampaigns = allCampaigns.filter((c) => !linkedIds.includes(c._id));

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Connecting to Lemlist…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Lemlist connection failed</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">
                Make sure{" "}
                <code className="font-mono bg-muted px-1 rounded">LEMLIST_API_KEY</code> is set
                in{" "}
                <code className="font-mono bg-muted px-1 rounded">mission-control/.env.local</code>
              </p>
              <Button size="sm" variant="outline" className="mt-2" onClick={load}>
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {linkedCampaigns.length} campaign{linkedCampaigns.length !== 1 ? "s" : ""} linked
          {lastSynced && (
            <span className="ml-2 text-muted-foreground/60">
              · synced {lastSynced.toLocaleTimeString()}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPicker((v) => !v)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Link Campaign
          </Button>
        </div>
      </div>

      {/* ── Campaign picker ── */}
      {showPicker && (
        <Card className="border-dashed">
          <CardContent className="py-3">
            {unlinkableCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                {allCampaigns.length === 0
                  ? "No campaigns found in Lemlist."
                  : "All campaigns are already linked."}
              </p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2 px-1">
                  Pick a campaign to link:
                </p>
                {unlinkableCampaigns.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => handleLink(c._id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left gap-3"
                  >
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize flex-shrink-0",
                        statusBadgeClass(c.status)
                      )}
                    >
                      {c.status || "unknown"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Linked campaigns ── */}
      {linkedCampaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No campaigns linked to this project yet.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Link your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {linkedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign._id}
              campaign={campaign}
              stats={statsMap[campaign._id] ?? null}
              loadingStats={loadingStatsFor.has(campaign._id)}
              onUnlink={() => handleUnlink(campaign._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Users, FileText, UserSearch, MessageSquare, Send, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ProjectPipelineMetrics } from "@/app/api/pipeline-metrics/route";

interface FunnelStage {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  pipelineStep?: string;
  color: string;
}

function pct(value: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((value / total) * 100)}%`;
}

function stepStatus(status: string | undefined): "done" | "active" | "pending" {
  if (status === "done") return "done";
  if (status === "in-progress") return "active";
  return "pending";
}

interface SingleProjectFunnelProps {
  project: ProjectPipelineMetrics;
}

function SingleProjectFunnel({ project }: SingleProjectFunnelProps) {
  const { stats, pipeline } = project;

  const stages: FunnelStage[] = [
    {
      key: "leads",
      label: "Leads",
      value: stats.totalLeads ?? 0,
      icon: Users,
      pipelineStep: pipeline.step2_leads,
      color: "text-blue-500",
    },
    {
      key: "dossiers",
      label: "Dossiers",
      value: stats.dossiersCreated ?? 0,
      icon: FileText,
      pipelineStep: pipeline.step3_dossiers,
      color: "text-violet-500",
    },
    {
      key: "contacts",
      label: "Contacts",
      value: stats.contactsFound ?? 0,
      icon: UserSearch,
      pipelineStep: pipeline.step4_contacts,
      color: "text-amber-500",
    },
    {
      key: "messages",
      label: "Outreach",
      value: stats.messagesGenerated ?? 0,
      icon: MessageSquare,
      pipelineStep: pipeline.step5_outreach,
      color: "text-orange-500",
    },
    {
      key: "campaign",
      label: "In Lemlist",
      value: stats.campaignCreated ? (stats.messagesGenerated ?? 0) : 0,
      icon: Send,
      pipelineStep: pipeline.step7_campaign,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-foreground">{project.client ?? project.name}</p>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Typ A</Badge>
      </div>

      <div className="flex items-stretch gap-0">
        {stages.map((stage, i) => {
          const status = stepStatus(stage.pipelineStep);
          const conversionFromPrev = i === 0
            ? null
            : pct(stage.value, stages[i - 1].value);
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className={cn(
                "flex-1 rounded-lg p-2 text-center border transition-colors min-w-0",
                status === "done" && "border-green-500/20 bg-green-500/5",
                status === "active" && "border-blue-500/20 bg-blue-500/5",
                status === "pending" && "border-border bg-muted/20",
              )}>
                <Icon className={cn("h-3.5 w-3.5 mx-auto mb-0.5", stage.color, status === "pending" && "opacity-40")} />
                <p className={cn(
                  "text-base font-bold tabular-nums leading-tight",
                  status === "pending" && "text-muted-foreground",
                )}>
                  {stage.value.toLocaleString()}
                </p>
                <p className={cn(
                  "text-[10px] leading-tight truncate",
                  status === "pending" ? "text-muted-foreground/60" : "text-muted-foreground",
                )}>
                  {stage.label}
                </p>
                {conversionFromPrev !== null && stage.value > 0 && (
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">{conversionFromPrev}</p>
                )}
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="flex gap-0.5 mt-1.5">
        {stages.map((stage) => {
          const status = stepStatus(stage.pipelineStep);
          return (
            <div
              key={stage.key}
              className={cn(
                "h-1 flex-1 rounded-full",
                status === "done" && "bg-green-500",
                status === "active" && "bg-blue-500",
                status === "pending" && "bg-muted",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PipelineFunnelCard() {
  const [projects, setProjects] = useState<ProjectPipelineMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pipeline-metrics")
      .then((r) => r.json())
      .then((data: { projects: ProjectPipelineMetrics[] }) => {
        setProjects(data.projects ?? []);
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Outbound Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Outbound Pipeline
          </span>
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground font-normal">
            View projects →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {projects.map((project) => (
            <SingleProjectFunnel key={project.id} project={project} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

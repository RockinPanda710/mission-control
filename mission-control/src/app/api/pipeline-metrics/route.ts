import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

interface ProjectStats {
  totalLeads: number;
  aLeads?: number;
  bLeads?: number;
  cLeads?: number;
  dossiersCreated: number;
  contactsFound: number;
  messagesGenerated: number;
  campaignCreated: boolean;
}

interface PipelineStatus {
  step1_icp?: string;
  step2_leads?: string;
  step3_dossiers?: string;
  step4_contacts?: string;
  step5_outreach?: string;
  step6_quality?: string;
  step7_campaign?: string;
  [key: string]: string | undefined;
}

export interface ProjectPipelineMetrics {
  id: string;
  name: string;
  client?: string;
  type: string;
  status: string;
  stats: ProjectStats;
  pipeline: PipelineStatus;
}

export interface PipelineMetricsResponse {
  projects: ProjectPipelineMetrics[];
}

export async function GET() {
  const projectsDir = path.join(process.cwd(), "data", "projects");

  try {
    const folders = await readdir(projectsDir);
    const results: ProjectPipelineMetrics[] = [];

    for (const folder of folders) {
      try {
        const metaPath = path.join(projectsDir, folder, "meta.json");
        const raw = await readFile(metaPath, "utf-8");
        const meta = JSON.parse(raw) as ProjectPipelineMetrics;
        if (meta.type === "typ-a-outbound" && meta.status === "active") {
          results.push({
            id: meta.id,
            name: meta.name,
            client: meta.client,
            type: meta.type,
            status: meta.status,
            stats: meta.stats,
            pipeline: meta.pipeline,
          });
        }
      } catch {
        // No meta.json or not parseable — skip folder
      }
    }

    return NextResponse.json({ projects: results } satisfies PipelineMetricsResponse);
  } catch {
    // projects directory doesn't exist yet
    return NextResponse.json({ projects: [] } satisfies PipelineMetricsResponse);
  }
}

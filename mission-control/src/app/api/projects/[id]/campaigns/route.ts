import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const PROJECTS_DATA_DIR = path.join(process.cwd(), "data", "projects");

interface ProjectCampaigns {
  campaignIds: string[];
  updatedAt: string;
}

async function readCampaigns(projectId: string): Promise<ProjectCampaigns> {
  const filePath = path.join(PROJECTS_DATA_DIR, projectId, "lemlist-campaigns.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as ProjectCampaigns;
  } catch {
    return { campaignIds: [], updatedAt: new Date().toISOString() };
  }
}

async function writeCampaigns(projectId: string, data: ProjectCampaigns): Promise<void> {
  const dir = path.join(PROJECTS_DATA_DIR, projectId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "lemlist-campaigns.json"), JSON.stringify(data, null, 2), "utf-8");
}

/** GET /api/projects/[id]/campaigns — Return linked Lemlist campaign IDs */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const data = await readCampaigns(projectId);
  return NextResponse.json(data);
}

/** POST /api/projects/[id]/campaigns — Link a Lemlist campaign to this project */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let body: { campaignId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { campaignId } = body;
  if (!campaignId || typeof campaignId !== "string") {
    return NextResponse.json({ error: "campaignId (string) required in body" }, { status: 400 });
  }

  const data = await readCampaigns(projectId);
  if (!data.campaignIds.includes(campaignId)) {
    data.campaignIds.push(campaignId);
    data.updatedAt = new Date().toISOString();
    await writeCampaigns(projectId, data);
  }

  return NextResponse.json(data);
}

/** DELETE /api/projects/[id]/campaigns?campaignId=xxx — Unlink a campaign */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId query param required" }, { status: 400 });
  }

  const data = await readCampaigns(projectId);
  data.campaignIds = data.campaignIds.filter((id) => id !== campaignId);
  data.updatedAt = new Date().toISOString();
  await writeCampaigns(projectId, data);

  return NextResponse.json(data);
}

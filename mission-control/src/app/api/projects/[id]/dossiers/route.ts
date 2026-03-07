import { NextResponse } from "next/server";
import { getProjectDossiers, mutateProjectDossiers } from "@/lib/data";
import type { Dossier } from "@/lib/types";

// ─── GET /api/projects/[id]/dossiers ──────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const data = await getProjectDossiers(projectId);
  return NextResponse.json({ dossiers: data.dossiers, total: data.dossiers.length });
}

// ─── POST /api/projects/[id]/dossiers ─────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.companyName?.trim()) {
    return NextResponse.json({ error: "companyName is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const dossier: Dossier = {
    id: `dossier_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    companyName: body.companyName.trim(),
    herkunft: (body.herkunft ?? "").trim(),
    statusQuo: (body.statusQuo ?? "").trim(),
    ansatzpunkte: (body.ansatzpunkte ?? "").trim(),
    hook: (body.hook ?? "").trim(),
    pdfPath: body.pdfPath?.trim() || null,
    leadId: body.leadId?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  await mutateProjectDossiers(projectId, async (data) => {
    data.dossiers.push(dossier);
  });

  return NextResponse.json(dossier, { status: 201 });
}

// ─── DELETE /api/projects/[id]/dossiers?dossierId=xxx ─────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const dossierId = searchParams.get("dossierId");

  if (!dossierId) {
    return NextResponse.json({ error: "dossierId required" }, { status: 400 });
  }

  const removed = await mutateProjectDossiers(projectId, async (data) => {
    const idx = data.dossiers.findIndex((d) => d.id === dossierId);
    if (idx === -1) return false;
    data.dossiers.splice(idx, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

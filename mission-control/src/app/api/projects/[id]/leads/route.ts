import { NextResponse } from "next/server";
import { getProjectLeads, mutateProjectLeads, projectLeadsFileExists } from "@/lib/data";
import type { Lead } from "@/lib/types";

// Simple ID generator for leads
function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── GET /api/projects/[id]/leads ─────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const exists = await projectLeadsFileExists(projectId);
  if (!exists) {
    return NextResponse.json({ error: "No leads data for this project" }, { status: 404 });
  }
  const data = await getProjectLeads(projectId);
  return NextResponse.json({ leads: data.leads, total: data.leads.length });
}

// ─── POST /api/projects/[id]/leads ────────────────────────────────────────────
// Two modes:
//   action=import-csv  → body is raw CSV text (Content-Type: text/plain)
//   (default)          → body is JSON for a single lead

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "import-csv") {
    return handleCsvImport(request, projectId);
  }

  return handleSingleCreate(request, projectId);
}

// ─── DELETE /api/projects/[id]/leads?leadId=xxx ───────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const removed = await mutateProjectLeads(projectId, async (data) => {
    const idx = data.leads.findIndex((l) => l.id === leadId);
    if (idx === -1) return false;
    data.leads.splice(idx, 1);
    return true;
  });

  if (!removed) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function handleSingleCreate(request: Request, projectId: string) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const lead: Lead = {
    id: generateLeadId(),
    firstName: (body.firstName ?? "").trim(),
    lastName: (body.lastName ?? "").trim(),
    company: (body.company ?? "").trim(),
    linkedinUrl: (body.linkedinUrl ?? "").trim(),
    linkedinStatus: body.linkedinUrl?.trim() ? "found" : "pending",
    email: (body.email ?? "").trim(),
    dossierStatus: "none",
    notes: (body.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  await mutateProjectLeads(projectId, async (data) => {
    data.leads.push(lead);
  });

  return NextResponse.json(lead, { status: 201 });
}

async function handleCsvImport(request: Request, projectId: string) {
  let csvText: string;
  try {
    csvText = await request.text();
  } catch {
    return NextResponse.json({ error: "Could not read CSV body" }, { status: 400 });
  }

  const parsed = parseCsv(csvText);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No valid rows in CSV" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const imported: Lead[] = [];
  const skipped: number[] = [];

  parsed.rows.forEach((row, rowIdx) => {
    const email = (row.email ?? row.Email ?? "").trim();
    const firstName = (row.firstName ?? row.first_name ?? row["First Name"] ?? "").trim();
    const lastName = (row.lastName ?? row.last_name ?? row["Last Name"] ?? "").trim();
    const company = (row.company ?? row.companyName ?? row.Company ?? row["Company Name"] ?? "").trim();
    const linkedinUrl = (row.linkedinUrl ?? row.linkedin_url ?? row.LinkedIn ?? row["LinkedIn URL"] ?? "").trim();

    // email is required
    if (!email) {
      skipped.push(rowIdx + 2); // +2 for 1-based + header row
      return;
    }

    const lead: Lead = {
      id: generateLeadId(),
      firstName,
      lastName,
      company,
      linkedinUrl,
      linkedinStatus: linkedinUrl ? "found" : "pending",
      email,
      dossierStatus: "none",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    imported.push(lead);
  });

  if (imported.length === 0) {
    return NextResponse.json({ error: "No leads with valid email addresses found in CSV" }, { status: 400 });
  }

  await mutateProjectLeads(projectId, async (data) => {
    // Deduplicate by email — skip leads that already exist
    const existingEmails = new Set(data.leads.map((l) => l.email.toLowerCase()));
    const newLeads = imported.filter((l) => !existingEmails.has(l.email.toLowerCase()));
    data.leads.push(...newLeads);
    return newLeads.length;
  });

  return NextResponse.json({
    imported: imported.length,
    skippedRows: skipped,
    total: imported.length,
  });
}

// Minimal CSV parser — handles quoted fields, comma delimiter
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue; // skip blank rows
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

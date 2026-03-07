import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { mutateSkillsLibrary, getAgents, mutateAgents } from "@/lib/data";
import { matchSkillToAgents } from "@/lib/skill-matcher";
import type { SkillDefinition } from "@/lib/types";

export const dynamic = "force-dynamic";

// Workspace skills directory relative to the Next.js app root (process.cwd())
const WORKSPACE_SKILLS_DIR = path.resolve(process.cwd(), "../../Skills/skills");

interface ParsedSkill {
  folderId: string;
  name: string;
  description: string;
  content: string;
}

/**
 * Parse a SKILL.md file: extract YAML frontmatter (name, description) and full content.
 */
function parseSkillMd(raw: string, folderId: string): ParsedSkill {
  let name = folderId;
  let description = "";
  let content = raw;

  // Try to extract YAML frontmatter between --- delimiters
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const frontmatter = fmMatch[1];
    content = raw.slice(fmMatch[0].length).trim();

    // Parse name
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();

    // Parse description (supports multi-line YAML block scalar with |)
    const descBlockMatch = frontmatter.match(/^description:\s*\|\s*\n((?:[ \t]+.+\n?)*)/m);
    if (descBlockMatch) {
      description = descBlockMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ");
    } else {
      const singleLineDesc = frontmatter.match(/^description:\s*(?!\|)(.+)$/m);
      if (singleLineDesc) description = singleLineDesc[1].trim();
    }
  }

  return { folderId, name, description, content };
}

export async function POST(request: Request) {
  let autoAssign = false;
  try {
    const body = await request.json() as { autoAssign?: boolean };
    autoAssign = body.autoAssign === true;
  } catch {
    // No body or invalid JSON — defaults to autoAssign=false
  }

  // 1. Read all SKILL.md files from workspace
  let skillDirs: string[];
  try {
    const entries = await readdir(WORKSPACE_SKILLS_DIR, { withFileTypes: true });
    skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot read workspace skills directory: ${WORKSPACE_SKILLS_DIR}`, details: String(err) },
      { status: 500 },
    );
  }

  // 2. Parse each SKILL.md
  const parsed: ParsedSkill[] = [];
  for (const dir of skillDirs) {
    // Skip .skill extension directories (duplicates like "rene-writing-style.skill")
    if (dir.endsWith(".skill")) continue;

    const skillPath = path.join(WORKSPACE_SKILLS_DIR, dir, "SKILL.md");
    try {
      const raw = await readFile(skillPath, "utf-8");
      parsed.push(parseSkillMd(raw, dir));
    } catch {
      // No SKILL.md in this directory — skip
    }
  }

  // 3. Load agents for matching
  const agentsData = await getAgents();

  // 4. Upsert into skills-library.json
  const report = { created: 0, updated: 0, unchanged: 0, total: parsed.length, assignments: [] as { skillId: string; agentIds: string[] }[] };

  await mutateSkillsLibrary(async (data) => {
    const now = new Date().toISOString();

    for (const p of parsed) {
      const skillId = `skill-${p.folderId}`;
      const existing = data.skills.find((s) => s.id === skillId);

      // Determine agent assignments
      const suggestedAgentIds = matchSkillToAgents(
        { id: skillId, name: p.name, description: p.description, content: p.content },
        agentsData.agents,
      );

      if (existing) {
        // Check if anything changed
        const changed =
          existing.name !== p.name ||
          existing.description !== p.description ||
          existing.content !== p.content;

        if (changed) {
          existing.name = p.name;
          existing.description = p.description;
          existing.content = p.content;
          existing.updatedAt = now;
          report.updated++;
        } else {
          report.unchanged++;
        }

        // Auto-assign: merge suggested agents with existing
        if (autoAssign && suggestedAgentIds.length > 0) {
          const merged = new Set([...existing.agentIds, ...suggestedAgentIds]);
          existing.agentIds = Array.from(merged);
        }
      } else {
        // New skill
        const skill: SkillDefinition = {
          id: skillId,
          name: p.name,
          description: p.description,
          content: p.content,
          agentIds: autoAssign ? suggestedAgentIds : [],
          tags: [],
          createdAt: now,
          updatedAt: now,
        };
        data.skills.push(skill);
        report.created++;
      }

      if (suggestedAgentIds.length > 0) {
        report.assignments.push({ skillId, agentIds: suggestedAgentIds });
      }
    }
  });

  // 5. If autoAssign, also update agents.json skillIds
  if (autoAssign && report.assignments.length > 0) {
    await mutateAgents(async (agentsFile) => {
      for (const { skillId, agentIds } of report.assignments) {
        for (const agentId of agentIds) {
          const agent = agentsFile.agents.find((a) => a.id === agentId);
          if (agent && !agent.skillIds.includes(skillId)) {
            agent.skillIds.push(skillId);
          }
        }
      }
    });
  }

  return NextResponse.json(report);
}

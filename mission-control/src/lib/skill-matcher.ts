import type { AgentDefinition } from "./types";

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  content: string;
}

/**
 * Known skill → agent mappings.
 * Takes priority over keyword matching.
 */
const KNOWN_MAPPINGS: Record<string, string[]> = {
  "skill-hook-research": ["dossier-agent", "research-agent"],
  "skill-company-dossier-generator": ["dossier-agent"],
  "skill-icp-builder": ["pm-agent", "research-agent"],
  "skill-rene-writing-style": ["outreach-agent", "team-lead"],
  "skill-outreach-generator": ["outreach-agent"],
  "skill-linkedin-enrichment": ["contact-agent"],
  "skill-lemlist-import": ["campaign-agent"],
  "skill-lemlist-mcp": ["campaign-agent"],
  "skill-sales-pipeline": ["pm-agent", "team-lead"],
  "skill-sales-pitch-generator": ["outreach-agent"],
  "skill-angebots-generator": ["pm-agent"],
  "skill-wat-pipeline-sync": ["coding-agent"],
  "skill-slide-pdf-generator": ["coding-agent"],
  "skill-webworks-outreach": ["outreach-agent", "campaign-agent"],
};

/**
 * Keyword → agent mapping for fuzzy matching.
 */
const KEYWORD_AGENTS: [RegExp, string[]][] = [
  [/research|analyse|audit|dossier|hook/i, ["research-agent", "dossier-agent"]],
  [/outreach|message|writing|cold|linkedin.*message/i, ["outreach-agent"]],
  [/campaign|lemlist|import|send|email/i, ["campaign-agent"]],
  [/contact|enrichment|linkedin.*url/i, ["contact-agent"]],
  [/icp|customer.*profile|scoring|pipeline/i, ["pm-agent"]],
  [/code|script|build|deploy|sync/i, ["coding-agent"]],
];

/**
 * Match a skill to agents using known mappings first, then keyword matching.
 * Returns an array of agent IDs.
 */
export function matchSkillToAgents(skill: SkillInfo, agents: AgentDefinition[]): string[] {
  const agentIds = new Set<string>();
  const validIds = new Set(agents.map((a) => a.id));

  // 1. Check known mappings
  const known = KNOWN_MAPPINGS[skill.id];
  if (known) {
    for (const id of known) {
      if (validIds.has(id)) agentIds.add(id);
    }
  }

  // 2. Keyword matching on skill name + description
  if (agentIds.size === 0) {
    const text = `${skill.name} ${skill.description}`;
    for (const [pattern, ids] of KEYWORD_AGENTS) {
      if (pattern.test(text)) {
        for (const id of ids) {
          if (validIds.has(id)) agentIds.add(id);
        }
      }
    }
  }

  return Array.from(agentIds);
}

# Sales Intelligence Lab — Mission Control Operations Manual

## Kontext

**Rene Sulski** — Gründer von **Lass mal machen (LMM)**, operiert als **Sales Intelligence Lab**.
Das Lab baut kritische Vertriebsinfrastruktur für B2B-Unternehmen: CRM-Aufbau, Sales-Prozesse, Outbound-Systematik, Sales-Content. Aufgebaut in 6 Monaten, dann ist der Kunde autark.

Mission Control ist das lokale Betriebssystem dafür: Aufgaben, Projekte, Agent-Orchestrierung — keine Cloud, kein Firestore, alles JSON-lokal.

## Quick Start for AI Agents

- Read `mission-control/data/ai-context.md` FIRST for current state snapshot
- For full data, read the JSON files in `mission-control/data/`
- **Communication**: All agent communication happens through JSON files — see Agent Communication Protocol below
- **Sprache:** Kommunikation mit Rene auf Deutsch. Code, Commits, Dateinamen auf Englisch.

## Workspace Map

```
mission-control/              — Dieses Repo (Mission Control App + Daemon)
mission-control/mission-control/  — Next.js 15 App
mission-control/mission-control/data/  — JSON data files (THE source of truth)
mission-control/scripts/      — Daemon + utility scripts
mission-control/commands/     — Slash commands (Claude Code)
mission-control/skills/       — Auto-generated skill files from skills-library.json
```

Das übergeordnete Workspace-Repo liegt in `Claude Code Projekte/` auf Google Drive:
```
Claude Code Projekte/
├── CLAUDE.md                    — Master workspace instructions
├── Skills/                      — WAT Framework (tools/, workflows/, skills/)
├── Outreach/Lemlist/            — Lemlist Import-Scripts + Templates
├── Kunden/WebWorks Schweiz/     — Aktives Projekt (Typ A Outbound)
├── Kunden/FG Bau/               — Aktives Projekt (Typ B CRM)
└── mission-control/             — Dieses Repo
```

## WAT Framework — Pipeline

Das System arbeitet nach dem WAT-Prinzip: **Workflows → Agents → Tools**.

### Pipeline-Schritte (Typ A — Sales Outbound)

| # | Schritt | Agent | Primärtool |
|---|---------|-------|-----------|
| 01 | ICP & Hook definieren | pm-agent | `workflows/01_icp_builder.md` |
| 02 | Lead Sourcing | research-agent | Web-Recherche |
| 03 | Dossiers & Hook Research | dossier-agent | `tools/generate_dossier_pdf.py` |
| 04 | Ansprechpartner finden | contact-agent | `skills/linkedin-enrichment/` |
| 05 | Outreach-Nachrichten | outreach-agent | `skills/rene-writing-style/` |
| 06 | Lemlist-Übergabe & Versand | campaign-agent | `Outreach/Lemlist/dossier_to_lemlist.py` + Lemlist MCP |

**Primärkanal: LinkedIn.** Drei Nachrichten pro Lead: Connection Request, Follow-up 1, Follow-up 2.

### Aktive Projekte

| Projekt | Typ | Status | Nächster Schritt |
|---------|-----|--------|-----------------|
| WebWorks Schweiz | Typ A Outbound | Step 4 (Contacts) | LinkedIn Enrichment |
| FG Bau | Typ B CRM | Starting KW10/2026 | HubSpot Setup |

## Agent Registry

Agents are managed through `mission-control/data/agents.json`. Rene (id: `me`) ist immer der Freigeber.

| ID | Name | Handles | Assign when... |
|----|------|---------|----------------|
| `me` | Rene | Decisions, approvals, final sign-off | Requires human judgment |
| `pm-agent` | PM Agent | Project coordination, ICP-Building, Workflow-Planung | Orchestrierung, Planung |
| `research-agent` | Research Agent | Lead Sourcing, Marktanalyse, Webrecherche | Investigative Aufgaben |
| `dossier-agent` | Dossier Agent | Company Dossiers, Shop Audits, Hook Research | Unternehmensanalyse |
| `contact-agent` | Contact Agent | LinkedIn Enrichment, Kontaktrecherche | Ansprechpartner finden |
| `outreach-agent` | Outreach Agent | Personalisierte Nachrichten nach Renes Schreibstil | Texterstellung Outreach |
| `campaign-agent` | Campaign Agent | Lemlist Import, Kampagnen-Setup, Versandlogik | Lemlist-Übergabe |
| `team-lead` | Team Lead | Multi-Agent Koordination, Qualitätssicherung (Jasper) | Agenten koordinieren |
| `coding-agent` | Coding Agent | Python-Scripts, Next.js, TypeScript, Debugging | Technische Aufgaben |

### Skills Library

Skills sind in `mission-control/data/skills-library.json` verwaltet. Relevante Skills:

| Skill ID | Beschreibung |
|----------|-------------|
| `skill-rene-writing-style` | Renes Tonalität für Outreach (KEINE KI-Bindestriche!) |
| `skill-icp-builder` | Ideal Customer Profile Workshop |
| `skill-hook-research` | Outreach-Hook-Framework (E-Commerce SEO, etc.) |
| `skill-linkedin-enrichment` | LinkedIn-URL-Recherche für Lead-Listen |
| `skill-lemlist-import` | Dossier-Excel → Lemlist-CSV |
| `sop-typ-a-outbound` | Kompletter Typ-A-Outbound-Workflow |

## Schreibregeln (kritisch für Outreach)

- **KEINE KI-Bindestriche** in Sales-Texten: kein "Shop-Performance-Audit", kein "Content-Marketing-Strategie"
- Stattdessen: Komma, "und", oder neuer Satz
- Details in `Skills/skills/rene-writing-style/SKILL.md`

## Data Schema Reference

### tasks.json — `{ "tasks": Task[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"task_{timestamp}"` |
| title | string | Short, action-oriented |
| description | string | What needs to be done |
| importance | `"important"` \| `"not-important"` | Eisenhower Y-axis |
| urgency | `"urgent"` \| `"not-urgent"` | Eisenhower X-axis |
| kanban | `"not-started"` \| `"in-progress"` \| `"done"` | Workflow status |
| projectId | string \| null | Links to project |
| milestoneId | string \| null | Links to goal/milestone |
| assignedTo | AgentRole \| null | Lead agent assignment |
| collaborators | string[] | Additional team members (agent IDs) |
| dailyActions | `DailyAction[]` | Sub-steps: `{ id, title, done, date }` |
| subtasks | `Subtask[]` | Checkable sub-items: `{ id, title, done }` |
| blockedBy | string[] | Task IDs this depends on |
| estimatedMinutes | number \| null | Estimated work time |
| actualMinutes | number \| null | Actual work time |
| acceptanceCriteria | string[] | Definition of done |
| tags | string[] | Freeform labels |
| notes | string | Additional context |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |
| completedAt | ISO 8601 \| null | When marked done |

### goals.json — `{ "goals": Goal[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"goal_{timestamp}"` or `"mile_{id}"` for milestones |
| title | string | Goal description |
| type | `"long-term"` \| `"medium-term"` | Strategic goal vs milestone |
| timeframe | string | `"Q1 2026"` or `"YYYY-MM-DD"` |
| parentGoalId | string \| null | Milestones point to parent goal |
| projectId | string \| null | Linked project |
| status | `"not-started"` \| `"in-progress"` \| `"completed"` | Progress |
| milestones | string[] | Child milestone IDs (long-term goals) |
| tasks | string[] | Linked task IDs |
| createdAt | ISO 8601 | When created |

### projects.json — `{ "projects": Project[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | Slug (z.B. `"webworks-schweiz"`) |
| name | string | Project name |
| description | string | What this project is |
| status | `"active"` \| `"paused"` \| `"completed"` \| `"archived"` | Lifecycle |
| color | string | Hex color for UI |
| teamMembers | string[] | Assigned agent IDs |
| tags | string[] | Freeform labels |
| createdAt | ISO 8601 | When created |
| deletedAt | ISO 8601 \| null | Soft delete |

### agents.json — `{ "agents": AgentDefinition[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | URL-safe slug (e.g. `"research-agent"`) |
| name | string | Display name |
| icon | string | Lucide icon name |
| description | string | What this agent handles |
| instructions | string | Full system prompt |
| capabilities | string[] | What this agent can do |
| skillIds | string[] | Links to skills-library entries |
| status | `"active"` \| `"inactive"` | Agent lifecycle |

### brain-dump.json — `{ "entries": BrainDumpEntry[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"bd_{timestamp}"` |
| content | string | Raw idea/note |
| capturedAt | ISO 8601 | When captured |
| processed | boolean | Has been triaged? |
| convertedTo | string \| null | Task ID if converted |
| tags | string[] | Freeform labels |

### inbox.json, decisions.json, activity-log.json
→ See original schema in `/mission-control/mission-control/src/lib/types.ts`

## Eisenhower Matrix
- **DO** (important + urgent) — Work on immediately
- **SCHEDULE** (important + not-urgent) — Block time, protect from neglect
- **DELEGATE** (not-important + urgent) — Assign to an AI agent
- **ELIMINATE** (not-important + not-urgent) — Drop or defer

## Agent Write Strategy

**Prefer API endpoints for writes.** The API routes include:
- Zod validation (prevents malformed data)
- Mutex locking (prevents concurrent write corruption)
- Side effects (auto-delegation, activity logging)

**Direct file reads are fine for speed.** Reading JSON files directly is safe and faster than API calls.

**Error recovery:** If a task fails mid-execution:
1. Mark the task as `in-progress` with a note explaining the failure
2. Post a partial report to inbox (type: `"report"`, subject: `"Blocked: <task-title>"`)
3. Log a `task_updated` event to activity-log with error details
4. Do NOT mark the task as done

## Agent Communication Protocol

### How to Post a Completion Report
```
1. Read mission-control/data/inbox.json
2. Add a new message:
   {
     "id": "msg_{Date.now()}",
     "from": "<your-agent-id>",
     "to": "me",
     "type": "report",
     "taskId": "<task-id-if-applicable>",
     "subject": "Completed: <task-title>",
     "body": "<summary>",
     "status": "unread",
     "createdAt": "<ISO timestamp>",
     "readAt": null
   }
3. Write the updated inbox.json back
```

### How to Request a Decision
```
1. Read mission-control/data/decisions.json
2. Add a new decision:
   {
     "id": "dec_{Date.now()}",
     "requestedBy": "<your-agent-id>",
     "taskId": "<task-id-if-applicable>",
     "question": "<what you need decided>",
     "options": ["Option A", "Option B"],
     "context": "<background info>",
     "status": "pending",
     "answer": null,
     "answeredAt": null,
     "createdAt": "<ISO timestamp>"
   }
```

### How to Update Task Progress
```
1. Read mission-control/data/tasks.json
2. Find the task by ID
3. Update fields (kanban, subtasks, actualMinutes, etc.)
4. Always update "updatedAt" to current ISO timestamp
5. If marking done: set "completedAt" to current timestamp
6. Write the updated tasks.json back
7. Log a "task_updated" or "task_completed" event in activity-log.json
```

## Tech Stack & Commands

- Node.js LTS + **pnpm** (NOT npm or yarn)
- Next.js 15 App Router + TypeScript strict + Tailwind CSS v4 + shadcn/ui
- Local JSON file storage — no external databases
- Path alias: `@/` maps to `src/` (inside mission-control/)

**Run inside `mission-control/mission-control/`:**
- Dev: `pnpm dev`
- Build: `pnpm build`
- Typecheck: `pnpm tsc --noEmit`
- Daemon start: `pnpm daemon:start`
- Daemon stop: `pnpm daemon:stop`
- Daemon status: `pnpm daemon:status`
- Generate AI context: `pnpm gen:context`

**Production server** läuft via launchd (`com.salesintelligencelab.mission-control`) auf Port 3000.
Nach Code-Änderungen: `pnpm build` → `pkill -f "next-server"` → `launchctl start com.salesintelligencelab.mission-control`

## Agent Daemon

Der Daemon ist ein autonomer Hintergrundprozess der `tasks.json` pollt, Claude Code Sessions spawnt und deren Health überwacht.

### Konfiguration — `data/daemon-config.json`
- `claudeBinaryPath`: Pfad zur Claude-Binary (`~/.local/bin/claude` → Wrapper zu aktuellem Version)
- `maxParallelAgents`: Max gleichzeitige Sessions (aktuell: 6)
- `skipPermissions`: **false** (Rene gibt immer frei — Level 1)
- `polling.intervalMinutes`: 5 Minuten

### Security Model
- **Binary whitelist** — only `claude`/`claude.cmd`/`claude.exe` can be spawned
- **Safe env** — child processes only receive PATH, HOME, TEMP
- **`skipPermissions`** defaults to `false`

## Sicherheitsregeln (aus dem Workspace)

1. **NICHTS LÖSCHEN.** Kein `rm`, kein `delete`. Nicht-mehr-Aktives → `Archiv/` verschieben.
2. **Vor destruktiven Operationen immer fragen.**
3. **Commits und Pushes nur auf explizite Anweisung von Rene.**
4. **End-of-Day:** GitHub Push auf BEIDE Repos (`claude-code-projekte` UND `mission-control`).

# Today Dashboard — Backlog

Stand: 2026-03-23 (Ende Session)

---

## Was in dieser Session gebaut wurde

### Dateien (alle in `mission-control/mission-control/`)

**Neue Dateien:**
| Datei | Was |
|-------|-----|
| `src/app/today/page.tsx` | Hauptseite — Tasks, Insights, Kampagnen, Kalender, Reminders, Quick-Add |
| `src/app/today/layout.tsx` | Nested Layout — Space Grotesk + JetBrains Mono Fonts, SIL Background, SVG Gradient |
| `src/app/today/today.css` | SIL Design System — Panels, Glassmorphism-lite, Animations, Badges, Progress Ring |
| `src/app/today/campaign/[name]/page.tsx` | Kampagnen-Detailseite — Stats, AI Assessment, Empfehlungen, Replies |
| `src/app/api/today/lemlist/route.ts` | Lemlist API — Nur aktive Kampagnen fetchen, Cross-Referenz Insights |
| `src/app/api/today/calendar/route.ts` | macOS Calendar via osascript — Events aus `rene@lassmalmachen.work` |
| `src/app/api/today/reminders/route.ts` | Apple Reminders via osascript — Lesen (GET) + Abhaken (POST) bidirektional |
| `src/app/api/briefing/route.ts` | daily-briefing.json API — GET + PUT (fuer Orchestrator Morning Briefing) |
| `data/daily-briefing.json` | Seed-Daten (wird vom Orchestrator ueberschrieben) |
| `public/logo-silabs.png` | SIL Logo (200x200, 17KB) |

**Geaenderte Dateien:**
| Datei | Was |
|-------|-----|
| `src/components/layout-shell.tsx` | Standalone-Modus fuer `/today` Routen (kein Sidebar, kein Command Bar) |

**Neue Agents:**
| Datei | Was |
|-------|-----|
| `.claude/agents/campaign-analyst.md` | Lemlist Performance-Analyst (sonnet, read-only, rene-writing-style) |

**Geaenderter Orchestrator:**
| Was |
|-----|
| `campaign-analyst` in Agent-Tools aufgenommen |
| Apple Reminders Integration (Morning Briefing) |
| daily-briefing.json Referenz + Today-Page Link |

---

## Offene Punkte (naechste Session)

### Muss gemacht werden

- [ ] **Apple Reminders Liste erstellen:** "Claude Tasks" in Apple Reminders App anlegen. Dann funktioniert Siri + bidirektionaler Sync.
- [ ] **macOS Calendar pruefen:** Ist `rene@lassmalmachen.work` als Google-Account in Systemeinstellungen → Internetaccounts konfiguriert? Kalender muss syncen damit `/api/today/calendar` Events liefert.
- [ ] **Commits:** 30 geaenderte Dateien, 1362 Insertions. Noch nicht committed. `git add` + `git commit` steht aus.

### Design-Verfeinerungen

- [ ] **Campaign Detail Page (`/today/campaign/[name]`)** hat noch das alte Panel-Design — sollte den gleichen Hero-Header Stil bekommen wie die Hauptseite
- [ ] **Leere Zustaende verschoenern:** Wenn keine aktiven Kampagnen, kein Kalender, keine Reminders → aktuell verschwinden die Sektionen einfach. Besser: Dezenter Hinweis ("Keine aktiven Kampagnen" / "Kalender nicht verbunden")
- [ ] **Kampagnen-Detail braucht Live-Daten:** Aktuell liest die Kampagnen-Detailseite aus `daily-briefing.json`. Besser: Direkt aus `/api/today/lemlist` lesen (gleiche Datenquelle wie Hauptseite)
- [ ] **Progress Ring Label:** Aktuell zeigt der Ring "0%" wenn keine Tasks erledigt. Koennte bei 0 Tasks auch ausgeblendet werden.

### Feature-Ideen

- [ ] **Lemlist Replies direkt beantworten:** Button neben Reply → oeffnet Claude Code mit Draft-Antwort im rene-writing-style
- [ ] **Task von Insight erstellen:** Insight "Lead-Liste pruefen" → Button "Als Task anlegen" → POST /api/tasks
- [ ] **Kalender: Naechstes Event Countdown:** "WebWorks Review in 2h 15min"
- [ ] **Tages-Zusammenfassung am Abend:** Automatisch wenn Rene "Feierabend" sagt → Orchestrator generiert EOD-Report und aktualisiert daily-briefing.json
- [ ] **Inbox-Sektion:** Gmail-Highlights (Lead-Antworten, Kundenanfragen). Braucht Gmail API Route analog zu Calendar.
- [ ] **Reminder-Erstellung vom Dashboard:** Input-Feld das direkt in Apple Reminders "Claude Tasks" schreibt (osascript: `make new reminder with properties {name:"..."}`)
- [ ] **Dark Mode Toggle:** SIL Design System ist aktuell nur Light. Dark-Variante waere nice-to-have.

### Technische Schulden

- [ ] **Lemlist Rate Limiting:** Aktuell keine explizite Rate-Limit-Behandlung. Bei vielen aktiven Kampagnen koennten 429er kommen. Loesung: Sequential statt parallel, oder Cache-Layer.
- [ ] **Calendar osascript Robustheit:** Das AppleScript ist komplex. Edge Cases: Ganztaegige Events, Events ohne Endzeit, Kalender mit Sonderzeichen.
- [ ] **Inline Styles aufloesen:** Einige Komponenten nutzen noch `style={{ color: "#0EA5E9" }}` statt CSS-Klassen. Konsistenter waere alles ueber `today.css`.
- [ ] **Mission Control Git:** Changes im Submodule `mission-control/` separat committen.

---

## Architektur-Ueberblick

```
localhost:3000/today
  ├── layout.tsx (Fonts + SIL Background)
  ├── page.tsx (Dashboard — fetcht 4 APIs parallel)
  │     ├── /api/dashboard        → tasks.json, projects.json (Mission Control)
  │     ├── /api/today/lemlist    → Lemlist REST API + Insights Engine
  │     ├── /api/today/calendar   → macOS Calendar (osascript)
  │     └── /api/today/reminders  → Apple Reminders (osascript, bidirektional)
  └── campaign/[name]/page.tsx (Detail — /api/briefing)

layout-shell.tsx
  └── Standalone-Modus fuer /today/* (kein Sidebar, kein Command Bar)

.claude/agents/
  ├── orchestrator.md (campaign-analyst + Apple Reminders + daily-briefing.json)
  └── campaign-analyst.md (Lemlist Performance-Analyse)
```

---

## Insight-Regeln (deterministisch, `/api/today/lemlist`)

| Regel | Trigger | Insight |
|-------|---------|---------|
| Draft + aktives Projekt | Kampagne=draft, Projekt=active, Pipeline-Tasks offen | "Kampagne X als Draft. Blocker: [Task]" |
| Pausiert | Kampagne=paused | "Kampagne X ist pausiert. Fortsetzen oder archivieren?" |
| Replies >24h | replied>0, letzte Reply >24h alt | "[N] Replies warten auf Antwort" |
| Niedrige Akzeptanz | accept_rate <15% | "Connection-Rate nur X%. Hook ueberarbeiten?" |

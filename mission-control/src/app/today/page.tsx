"use client";

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from "react";
import { Check, Plus, ArrowRight, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Task, Project } from "@/lib/types";

// ─── Daily Quotes ────────────────────────────────────────────────────────────

const QUOTES: { text: string; author: string }[] = [
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "If you want to go fast, go alone. If you want to go far, go together.", author: "Afrikanisches Sprichwort" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Culture eats strategy for breakfast.", author: "Peter Drucker" },
  { text: "The obstacle is the way.", author: "Marcus Aurelius" },
  { text: "Revenue solves all known problems.", author: "Jason Lemkin" },
  { text: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { text: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "It is not the strongest of the species that survives, but the most adaptable.", author: "Charles Darwin" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "If you're not embarrassed by the first version, you shipped too late.", author: "Reid Hoffman" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinesisches Sprichwort" },
  { text: "Think big, start small, learn fast.", author: "Eric Ries" },
  { text: "People don't buy what you do; they buy why you do it.", author: "Simon Sinek" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Work hard in silence, let success be your noise.", author: "Frank Ocean" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupery" },
  { text: "Fall seven times, stand up eight.", author: "Japanisches Sprichwort" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupery" },
];

function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return QUOTES[dayOfYear % QUOTES.length];
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEvent { title: string; start: string; end: string; location: string }

interface LemlistCampaign {
  id: string; name: string; status: string;
  stats: { sent: number; opened: number; open_rate: number; replied: number; reply_rate: number; accepts: number; accept_rate: number; bounces: number; bounce_rate: number; total_leads: number };
  recentReplies: { leadName: string; company: string; text: string; createdAt: string }[];
}

interface LemlistInactive { id: string; name: string; status: string }

interface Insight { type: string; icon: string; campaign: string; message: string; action: string }

interface LemlistData { active: LemlistCampaign[]; inactive: LemlistInactive[]; insights: Insight[] }

interface ReminderData { items: string[]; hint?: string }

interface PrioritizedTask { task: Task; score: number; reason: string }

const POLL_INTERVAL = 30_000;
const MONO = { fontFamily: "var(--font-mono)" };
const HEADING = { fontFamily: "var(--font-heading)" };

function formatDate(): string {
  return new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function getGreeting(): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 12) return { text: "Guten Morgen", emoji: "☀️" };
  if (h < 18) return { text: "Guten Tag", emoji: "🔥" };
  return { text: "Guten Abend", emoji: "🌙" };
}

function ProgressRing({ done, total, size = 36 }: { done: number; total: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={size} height={size} className="sil-progress-ring" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#sil-icon-gradient)" strokeWidth={3} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SectionHeader({ label, count, dotColor }: { label: string; count?: number; dotColor?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-2">
        {dotColor && <div className="sil-dot" style={{ background: dotColor }} />}
        <span className="sil-section-label">{label}</span>
      </div>
      {count !== undefined && count > 0 && <span className="sil-count-badge">{count}</span>}
    </div>
  );
}

function TaskRow({ task, project, onToggle }: { task: Task; project?: Project; onToggle: (id: string, done: boolean) => void }) {
  const done = task.kanban === "done";
  return (
    <button onClick={() => onToggle(task.id, !done)} className={cn("sil-task-item group flex items-start gap-3 w-full text-left px-5 py-2.5", done && "opacity-45")}>
      <div className="mt-0.5">
        {done ? (
          <div className="sil-checkbox sil-checkbox-done flex items-center justify-center">
            <Check className="h-2.5 w-2.5" style={{ color: "#10B981" }} />
          </div>
        ) : (
          <div className="sil-checkbox" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] leading-snug", done && "line-through sil-text-subtle")}>{task.title}</p>
        {project && <span className="text-[11px] sil-text-subtle">{project.name}</span>}
      </div>
      {task.estimatedMinutes && <span className="text-[11px] sil-text-subtle mt-0.5" style={MONO}>~{task.estimatedMinutes}m</span>}
    </button>
  );
}

function QuickAdd({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  const submit = () => { const t = v.trim(); if (t) { onAdd(t); setV(""); } };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };
  return (
    <div className="sil-quick-add">
      <Plus className="h-3.5 w-3.5 sil-text-subtle flex-shrink-0" />
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={onKey} placeholder="Task hinzufuegen..." />
      {v.trim() && <button onClick={submit} className="sil-text-accent"><ArrowRight className="h-3.5 w-3.5" /></button>}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [top3, setTop3] = useState<PrioritizedTask[]>([]);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [lemlist, setLemlist] = useState<LemlistData>({ active: [], inactive: [], insights: [] });
  const [reminders, setReminders] = useState<ReminderData>({ items: [] });
  const [loading, setLoading] = useState(true);
  const init = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      if (!init.current) setLoading(true);
      const [dashRes, calRes, lemRes, remRes] = await Promise.all([
        apiFetch("/api/dashboard"),
        apiFetch("/api/today/calendar").catch(() => null),
        apiFetch("/api/today/lemlist").catch(() => null),
        apiFetch("/api/today/reminders").catch(() => null),
      ]);
      if (dashRes.ok) {
        const j = await dashRes.json();
        setTasks(j.tasks ?? []);
        setProjects(j.projects ?? []);
        setTop3(j.top3 ?? []);
      }
      if (calRes?.ok) { const j = await calRes.json(); setCalEvents(j.events ?? []); }
      if (lemRes?.ok) { const j: LemlistData = await lemRes.json(); setLemlist(j); }
      if (remRes?.ok) { const j = await remRes.json(); setReminders(j); }
      init.current = true;
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  // Complete a reminder (bidirectional sync)
  const completeReminder = useCallback(async (name: string) => {
    // Optimistic remove
    setReminders(prev => ({ ...prev, items: prev.items.filter(i => i !== name) }));
    try {
      await apiFetch("/api/today/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", name }),
      });
    } catch { fetchData(); }
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(() => { if (document.visibilityState === "visible") fetchData(); }, POLL_INTERVAL);
    const vis = () => { if (document.visibilityState === "visible") fetchData(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); };
  }, [fetchData]);

  const toggle = useCallback(async (id: string, done: boolean) => {
    setTasks((p) => p.map((t) => t.id === id ? { ...t, kanban: done ? "done" : "not-started", completedAt: done ? new Date().toISOString() : null } : t));
    try { await apiFetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, kanban: done ? "done" : "not-started" }), retries: 1 }); } catch { fetchData(); }
  }, [fetchData]);

  const addTask = useCallback(async (title: string) => {
    try {
      const r = await apiFetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: "", importance: "important", urgency: "urgent", kanban: "not-started", projectId: null, milestoneId: null, assignedTo: "me", collaborators: [], dailyActions: [], subtasks: [], blockedBy: [], estimatedMinutes: null, actualMinutes: null, acceptanceCriteria: [], comments: [], tags: [], notes: "" }) });
      if (r.ok) { const t = await r.json(); setTasks((p) => [...p, t]); }
    } catch { /* */ }
  }, []);

  const active = tasks.filter((t) => !t.deletedAt);
  const pm = new Map(projects.map((p) => [p.id, p]));
  const doTasks = active.filter((t) => t.importance === "important" && t.urgency === "urgent" && t.kanban !== "done");
  const scheduleTasks = active.filter((t) => t.importance === "important" && t.urgency === "not-urgent" && t.kanban !== "done");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const done = active.filter((t) => t.kanban === "done" && t.completedAt && new Date(t.completedAt) >= today);
  const openCount = active.filter((t) => t.kanban !== "done").length;
  const activeProjects = projects.filter(p => p.status === "active" && !p.deletedAt);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="sil-spinner" /><p className="text-sm sil-text-muted">Laden...</p></div></div>;
  }

  return (
    <div className="min-h-screen px-4 py-5 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* ── Hero Header ── */}
        {(() => {
          const g = getGreeting();
          const q = getDailyQuote();
          const totalTasks = openCount + done.length;
          return (
            <div className="sil-hero sil-animate sil-delay-1 mb-6">
              <Image src="/logo-silabs.png" alt="SI Labs" width={48} height={48} className="rounded-lg mx-auto mb-3" />
              <h1 className="sil-heading text-2xl font-bold mb-1" style={HEADING}>
                <span className="sil-gradient-text">{g.text}, Rene</span> {g.emoji}
              </h1>
              <p className="text-[14px] sil-text-muted mb-3">{formatDate()}</p>

              <div className="flex items-center justify-center gap-3 mb-4">
                {totalTasks > 0 && (
                  <div className="relative flex items-center justify-center">
                    <ProgressRing done={done.length} total={totalTasks} size={40} />
                    <span className="absolute text-[10px] font-bold sil-text" style={MONO}>
                      {Math.round((done.length / totalTasks) * 100)}%
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="sil-stat-pill"><span className="font-semibold sil-text" style={MONO}>{openCount}</span> <span className="sil-text-muted">offen</span></span>
                  <span className="sil-stat-pill"><span className="font-semibold" style={{ ...MONO, color: "#10B981" }}>{done.length}</span> <span className="sil-text-muted">erledigt</span></span>
                </div>
              </div>

              <p className="text-[13px] italic sil-text-muted leading-relaxed">
                &ldquo;{q.text}&rdquo; <span className="sil-text-subtle not-italic">&mdash; {q.author}</span>
              </p>
            </div>
          );
        })()}

        {/* ── Main Grid: Focus 7 / Context 5 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* ── FOCUS Panel ── */}
          <div className="lg:col-span-7 sil-panel sil-animate sil-delay-2">

            {/* AI Top 3 Recommendation */}
            <SectionHeader label="Empfehlung" count={top3.length} dotColor="url(#sil-icon-gradient)" />
            {top3.length > 0 ? (
              <div className="pb-1">
                {top3.map((p, i) => (
                  <button
                    key={p.task.id}
                    onClick={() => toggle(p.task.id, true)}
                    className="sil-top3-item group w-full text-left"
                  >
                    <div className="sil-top3-rank">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] leading-snug">{p.task.title}</p>
                        <Check className="h-3 w-3 sil-text-subtle sil-check-hint flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="sil-top3-reason">{p.reason}</p>
                    </div>
                    {p.task.estimatedMinutes && <span className="text-[11px] sil-text-subtle mt-0.5 flex-shrink-0" style={MONO}>~{p.task.estimatedMinutes}m</span>}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine offenen Tasks fuer Priorisierung.</p>
            )}

            <div className="sil-divider" />

            {/* Insights (proactive cross-reference) */}
            <SectionHeader label="Insights" count={lemlist.insights.length} dotColor="#F59E0B" />
            {lemlist.insights.length > 0 ? (
              <>
                <div className="pb-1">
                  {lemlist.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 px-5 py-2">
                      <span className="text-[14px] mt-0.5 flex-shrink-0">{insight.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{insight.campaign} <span className="font-normal sil-text-muted">&mdash; {insight.message}</span></p>
                        <p className="text-[12px] sil-text-accent mt-0.5">{insight.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="px-5 pb-4 text-[12px] sil-text-subtle">Alles im gruenen Bereich. Keine Auffaelligkeiten.</p>
            )}

            <div className="sil-divider" />

            <SectionHeader label="Top Prioritaet" count={doTasks.length} dotColor="#EF4444" />
            {doTasks.length > 0 ? (
              <div className="pb-1">
                {doTasks.map((t) => <TaskRow key={t.id} task={t} project={t.projectId ? pm.get(t.projectId) : undefined} onToggle={toggle} />)}
              </div>
            ) : (
              <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine dringenden Tasks. Guter Tag.</p>
            )}

            <div className="sil-divider" />

            <SectionHeader label="Nice to Have" count={scheduleTasks.length} dotColor="#0EA5E9" />
            {scheduleTasks.length > 0 ? (
              <div className="pb-1">
                {scheduleTasks.map((t) => <TaskRow key={t.id} task={t} project={t.projectId ? pm.get(t.projectId) : undefined} onToggle={toggle} />)}
              </div>
            ) : (
              <p className="px-5 pb-4 text-[12px] sil-text-subtle">Nichts im Schedule.</p>
            )}

            <QuickAdd onAdd={addTask} />
          </div>

          {/* ── CONTEXT Sidebar ── */}
          <div className="lg:col-span-5 space-y-4">

            {/* Calendar (live from macOS Calendar) */}
            <div className="sil-panel sil-animate sil-delay-3">
              <SectionHeader label="Kalender" count={calEvents.length} dotColor="#6366F1" />
              {calEvents.length > 0 ? (
                <div className="pb-2">
                  {calEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-1.5">
                      <span className="text-[11px] w-16 flex-shrink-0 font-medium sil-text-accent" style={MONO}>{e.start}–{e.end}</span>
                      <span className="text-[13px]">{e.title}</span>
                      {e.location && <span className="text-[11px] sil-text-subtle ml-auto truncate max-w-[120px]">{e.location}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine Termine heute. Freier Tag fuer Deep Work.</p>
              )}
            </div>

            {/* Campaigns (live from Lemlist — only active) */}
            <div className="sil-panel sil-animate sil-delay-4">
              <SectionHeader label="Aktive Kampagnen" count={lemlist.active.length} dotColor="#F59E0B" />
              {lemlist.active.length > 0 ? (
                <div className="px-3 pb-3">
                  {lemlist.active.map((c) => (
                    <Link key={c.id} href={`/today/campaign/${encodeURIComponent(c.name)}`} className="sil-campaign-link group">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">{c.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 sil-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-[11px] sil-text-muted" style={MONO}>{c.stats.accept_rate}% Accept</span>
                        <span className="text-[11px] sil-text-muted" style={MONO}>{c.stats.reply_rate}% Reply</span>
                        <span className="text-[11px] sil-text-muted" style={MONO}>{c.stats.total_leads} Leads</span>
                      </div>
                      {c.recentReplies.length > 0 && (
                        <p className="text-[11px] font-medium mt-1.5" style={{ color: "#D97706" }}>
                          {c.recentReplies.length} neue Replies
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine aktiven Kampagnen.</p>
              )}
            </div>

            {/* Reminders (live from Apple Reminders — bidirectional) */}
            <div className="sil-panel sil-animate sil-delay-5">
              <SectionHeader label="Mobile Inbox" count={reminders.items.length} dotColor="#8B5CF6" />
              {reminders.items.length > 0 ? (
                <div className="pb-2">
                  {reminders.items.map((item, i) => (
                    <button key={i} onClick={() => completeReminder(item)} className="sil-task-item group flex items-center gap-3 w-full text-left px-5 py-1.5">
                      <div className="sil-checkbox" />
                      <span className="text-[11px] flex-shrink-0">📱</span>
                      <span className="text-[13px] flex-1">{item}</span>
                      <Check className="h-3 w-3 sil-text-subtle sil-check-hint" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine offenen Reminders.</p>
              )}
            </div>

            {/* Projects (from Mission Control) */}
            <div className="sil-panel sil-animate sil-delay-5">
              <SectionHeader label="Projekte" count={activeProjects.length} dotColor="#10B981" />
              {activeProjects.length > 0 ? (
                <div className="pb-2">
                  {activeProjects.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-1.5">
                      <span className="text-[13px] font-medium">{p.name}</span>
                      <span className="text-[10px] sil-text-accent" style={MONO}>{p.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 pb-4 text-[12px] sil-text-subtle">Keine aktiven Projekte.</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Completed Strip ── */}
        {done.length > 0 && (
          <div className="sil-completed-strip">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: "#10B981" }} />
            <span className="text-[11px] font-medium" style={{ color: "#10B981" }}>Heute erledigt:</span>
            {done.map((t) => (
              <button key={t.id} onClick={() => toggle(t.id, false)} className="sil-completed-strip .sil-completed-item text-[11px] sil-text-muted line-through hover:no-underline hover:sil-text-accent transition-colors">
                {t.title}
              </button>
            ))}
          </div>
        )}

        <footer className="text-center pt-4 pb-6">
          <p className="text-[10px] sil-text-subtle">Mission Control &middot; Auto-Refresh 30s</p>
        </footer>
      </div>
    </div>
  );
}

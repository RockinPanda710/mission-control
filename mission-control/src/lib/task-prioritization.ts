// ─── Task Prioritization Engine ──────────────────────────────────────────────
// Deterministic scoring algorithm. Returns top 3 with German reason strings.

import type { Task, Project } from "@/lib/types";

export interface PrioritizedTask {
  task: Task;
  score: number;
  reason: string;
}

// ─── Scoring Factors ────────────────────────────────────────────────────────

function quadrantScore(importance: string, urgency: string): number {
  if (importance === "important" && urgency === "urgent") return 100;
  if (importance === "important" && urgency === "not-urgent") return 60;
  if (importance === "not-important" && urgency === "urgent") return 40;
  return 10;
}

function dueDateBonus(dueDate: string | null): { score: number; label: string | null } {
  if (!dueDate) return { score: 0, label: null };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86_400_000);

  if (diffDays < 0) return { score: 50, label: "ueberfaellig" };
  if (diffDays === 0) return { score: 40, label: "faellig heute" };
  if (diffDays <= 7) return { score: 20, label: "faellig diese Woche" };
  if (diffDays <= 14) return { score: 5, label: "faellig naechste Woche" };
  return { score: 0, label: null };
}

function blockingOthersBonus(taskId: string, allTasks: Task[]): { score: number; count: number } {
  const blocked = allTasks.filter(
    (t) => t.kanban !== "done" && !t.deletedAt && t.blockedBy.includes(taskId),
  );
  return { score: blocked.length > 0 ? 30 : 0, count: blocked.length };
}

function isBlocked(task: Task, allTasks: Task[]): boolean {
  if (task.blockedBy.length === 0) return false;
  return task.blockedBy.some((blockerId) => {
    const blocker = allTasks.find((t) => t.id === blockerId);
    return blocker && blocker.kanban !== "done" && !blocker.deletedAt;
  });
}

function projectBonus(projectId: string | null, projects: Project[]): { score: number; projectName: string | null } {
  if (!projectId) return { score: 0, projectName: null };
  const project = projects.find((p) => p.id === projectId && p.status === "active" && !p.deletedAt);
  return project ? { score: 10, projectName: project.name } : { score: 0, projectName: null };
}

function inProgressBonus(kanban: string): number {
  return kanban === "in-progress" ? 15 : 0;
}

function quickWinBonus(estimatedMinutes: number | null): boolean {
  return estimatedMinutes !== null && estimatedMinutes > 0 && estimatedMinutes <= 30;
}

// ─── Reason Generator ───────────────────────────────────────────────────────

interface ScoringBreakdown {
  dueLabel: string | null;
  blockingCount: number;
  projectName: string | null;
  isInProgress: boolean;
  isQuickWin: boolean;
  importance: string;
  urgency: string;
}

function generateReason(breakdown: ScoringBreakdown): string {
  const parts: string[] = [];

  // Due date is the most impactful signal
  if (breakdown.dueLabel) {
    parts.push(breakdown.dueLabel.charAt(0).toUpperCase() + breakdown.dueLabel.slice(1));
  }

  // Blocking others is critical context
  if (breakdown.blockingCount > 0) {
    parts.push(`blockiert ${breakdown.blockingCount} andere${breakdown.blockingCount === 1 ? "n Task" : " Tasks"}`);
  }

  // In progress = momentum
  if (breakdown.isInProgress) {
    parts.push("in Bearbeitung");
  }

  // Project context
  if (breakdown.projectName) {
    parts.push(`gehoert zu ${breakdown.projectName}`);
  }

  // Quick win
  if (breakdown.isQuickWin) {
    parts.push("unter 30 Min machbar");
  }

  // Fallback: just the quadrant
  if (parts.length === 0) {
    if (breakdown.importance === "important" && breakdown.urgency === "urgent") {
      return "Wichtig und dringend";
    }
    if (breakdown.importance === "important") {
      return "Wichtig, sollte eingeplant werden";
    }
    return "Offen";
  }

  // Join with comma, capitalize first letter
  const result = parts.join(", ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ─── Main Function ──────────────────────────────────────────────────────────

export function prioritizeTasks(
  tasks: Task[],
  projects: Project[],
  maxResults: number = 3,
): PrioritizedTask[] {
  // Only consider non-done, non-deleted tasks
  const openTasks = tasks.filter((t) => t.kanban !== "done" && !t.deletedAt);

  const scored: PrioritizedTask[] = openTasks.map((task) => {
    const base = quadrantScore(task.importance, task.urgency);
    const due = dueDateBonus(task.dueDate);
    const blocking = blockingOthersBonus(task.id, openTasks);
    const proj = projectBonus(task.projectId, projects);
    const inProg = inProgressBonus(task.kanban);
    const qw = quickWinBonus(task.estimatedMinutes);
    const blocked = isBlocked(task, openTasks);

    const score =
      base +
      due.score +
      blocking.score +
      (blocked ? -80 : 0) +
      proj.score +
      inProg +
      (qw ? 5 : 0);

    const reason = generateReason({
      dueLabel: due.label,
      blockingCount: blocking.count,
      projectName: proj.projectName,
      isInProgress: inProg > 0,
      isQuickWin: qw,
      importance: task.importance,
      urgency: task.urgency,
    });

    return { task, score, reason };
  });

  // Filter out blocked tasks for the top results, sort by score descending
  return scored
    .filter((s) => !isBlocked(s.task, openTasks))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

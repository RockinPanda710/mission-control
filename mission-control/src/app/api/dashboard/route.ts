import { NextResponse } from "next/server";
import { getTasks, getGoals, getProjects, getBrainDump, getInbox, getDecisions, getActivityLog, getAgents } from "@/lib/data";
import { prioritizeTasks } from "@/lib/task-prioritization";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  // Read all data files in parallel (reads are safe, no locking needed)
  const [tasksData, goalsData, projectsData, brainDumpData, inboxData, decisionsData, activityData, agentsData] = await Promise.all([
    getTasks(),
    getGoals(),
    getProjects(),
    getBrainDump(),
    getInbox(),
    getDecisions(),
    getActivityLog(),
    getAgents(),
  ]);

  const agents = agentsData.agents.filter((a) => a.status === "active");

  // Filter soft-deleted
  const tasks = tasksData.tasks.filter((t) => !t.deletedAt);
  const goals = goalsData.goals.filter((g) => !g.deletedAt);
  const projects = projectsData.projects.filter((p) => !p.deletedAt);
  const entries = brainDumpData.entries;
  const messages = inboxData.messages;
  const decisions = decisionsData.decisions;
  const events = activityData.events;

  // Stats
  const doneTasks = tasks.filter((t) => t.kanban === "done");
  const inProgressTasks = tasks.filter((t) => t.kanban === "in-progress");
  const unprocessedEntries = entries.filter((e) => !e.processed);
  const longTermGoals = goals.filter((g) => g.type === "long-term");
  const milestones = goals.filter((g) => g.type === "medium-term");
  const activeProjects = projects.filter((p) => p.status === "active");

  // Comms
  const unreadMessages = messages.filter((m) => m.status === "unread");
  const pendingDecisions = decisions.filter((d) => d.status === "pending");
  const recentEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // Eisenhower counts
  const eisenhowerCounts = {
    do: tasks.filter((t) => t.importance === "important" && t.urgency === "urgent" && t.kanban !== "done").length,
    schedule: tasks.filter((t) => t.importance === "important" && t.urgency === "not-urgent" && t.kanban !== "done").length,
    delegate: tasks.filter((t) => t.importance === "not-important" && t.urgency === "urgent" && t.kanban !== "done").length,
    eliminate: tasks.filter((t) => t.importance === "not-important" && t.urgency === "not-urgent" && t.kanban !== "done").length,
  };

  // Attention items
  const doQuadrantMyTasks = tasks.filter(
    (t) => t.importance === "important" && t.urgency === "urgent" && t.assignedTo === "me" && t.kanban === "not-started"
  );
  const unreadReports = messages.filter((m) => m.status === "unread" && m.type === "report");

  // AI-driven task prioritization (top 3 with reasons)
  const top3 = prioritizeTasks(tasks, projects);

  return NextResponse.json(
    {
      top3,
      stats: {
        totalTasks: tasks.length,
        inProgressTasks: inProgressTasks.length,
        doneTasks: doneTasks.length,
        totalGoals: longTermGoals.length,
        completedMilestones: milestones.filter((m) => m.status === "completed").length,
        totalMilestones: milestones.length,
        activeProjects: activeProjects.length,
        unprocessedBrainDump: unprocessedEntries.length,
      },
      attention: {
        pendingDecisions: pendingDecisions.length,
        unreadReports: unreadReports.length,
        doQuadrantNotStarted: doQuadrantMyTasks.length,
      },
      eisenhowerCounts,
      unreadMessages: unreadMessages.slice(0, 5),
      pendingDecisionsList: pendingDecisions.slice(0, 5),
      recentActivity: recentEvents,
      tasks,
      goals,
      projects,
      agents,
      entries: unprocessedEntries.slice(0, 5),
      messages: unreadMessages.slice(0, 50),
      decisions: pendingDecisions,
    },
    { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=5" } },
  );
  } catch {
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}

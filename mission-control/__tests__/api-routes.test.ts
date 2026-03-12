/**
 * API Route Tests — Dashboard, Tasks, Agents
 *
 * Tests the core API routes by calling their handler functions directly.
 * Uses backup/restore for data isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { backupDataFiles, restoreDataFiles, createTestTask, createTestProject } from "./helpers";

// We test via HTTP fetch against the running dev server or by importing route handlers.
// Since Next.js route handlers need NextRequest, we test via the data layer + validation.
import { getTasks, getGoals, getProjects, getAgents, mutateTasks } from "@/lib/data";
import { taskCreateSchema, taskUpdateSchema, agentCreateSchema } from "@/lib/validations";

let backups: Record<string, string>;

beforeAll(async () => {
  backups = await backupDataFiles();
});

afterAll(async () => {
  await restoreDataFiles(backups);
});

// ─── Dashboard Data Aggregation ────────────────────────────────────────────

describe("Dashboard data aggregation", () => {
  it("should read all data files without errors", async () => {
    const [tasks, goals, projects, agents] = await Promise.all([
      getTasks(),
      getGoals(),
      getProjects(),
      getAgents(),
    ]);

    expect(tasks).toBeDefined();
    expect(tasks).toHaveProperty("tasks");
    expect(Array.isArray(tasks.tasks)).toBe(true);

    expect(goals).toBeDefined();
    expect(goals).toHaveProperty("goals");

    expect(projects).toBeDefined();
    expect(projects).toHaveProperty("projects");

    expect(agents).toBeDefined();
    expect(agents).toHaveProperty("agents");
  });

  it("should have valid agent definitions", async () => {
    const { agents } = await getAgents();

    for (const agent of agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.status).toMatch(/^(active|inactive)$/);
    }
  });

  it("should have at least the built-in agent 'me'", async () => {
    const { agents } = await getAgents();
    const me = agents.find((a) => a.id === "me");
    expect(me).toBeDefined();
    expect(me?.name).toBeTruthy();
  });
});

// ─── Task CRUD ─────────────────────────────────────────────────────────────

describe("Task CRUD operations", () => {
  it("should validate a valid task create payload", () => {
    const payload = createTestTask();
    const result = taskCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should reject a task without title", () => {
    const payload = createTestTask({ title: "" });
    const result = taskCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject a task with invalid kanban status", () => {
    const payload = createTestTask({ kanban: "invalid-status" });
    const result = taskCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should accept a task with long title (within schema limits)", () => {
    const payload = createTestTask({ title: "x".repeat(120) });
    const result = taskCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should validate a valid task update payload", () => {
    const payload = { id: "task_123", kanban: "in-progress" as const };
    const result = taskUpdateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should create and retrieve a task via data layer", async () => {
    const taskData = createTestTask({ title: "API Test Task" });

    const created = await mutateTasks(async (data) => {
      const newTask = {
        id: `task_test_${Date.now()}`,
        ...taskData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      };
      data.tasks.push(newTask as never);
      return newTask;
    });

    expect(created).toBeDefined();
    expect(created.title).toBe("API Test Task");

    // Verify it's persisted
    const { tasks } = await getTasks();
    const found = tasks.find((t) => t.id === created.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe("API Test Task");
  });
});

// ─── Agent Validation ──────────────────────────────────────────────────────

describe("Agent validation", () => {
  it("should validate a valid agent create payload", () => {
    const payload = {
      id: "test-agent",
      name: "Test Agent",
      icon: "Bot",
      description: "A test agent",
      capabilities: ["testing"],
      skillIds: [],
      status: "active" as const,
    };
    const result = agentCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should reject an agent with invalid id format", () => {
    const payload = {
      id: "Invalid Agent ID!",
      name: "Test Agent",
    };
    const result = agentCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject an agent without name", () => {
    const payload = {
      id: "test-agent",
      name: "",
    };
    const result = agentCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should have all WAT framework agents registered", async () => {
    const { agents } = await getAgents();
    const agentIds = agents.map((a) => a.id);

    // Core WAT agents from agents.json
    const expectedAgents = ["me", "pm-agent", "research-agent", "dossier-agent",
      "contact-agent", "outreach-agent", "campaign-agent", "team-lead", "coding-agent"];

    for (const expected of expectedAgents) {
      expect(agentIds).toContain(expected);
    }
  });
});

// ─── Project Data Integrity ────────────────────────────────────────────────

describe("Project data integrity", () => {
  it("should have at least one active project", async () => {
    const { projects } = await getProjects();
    const active = projects.filter((p) => p.status === "active");
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it("should have valid project structure", async () => {
    const { projects } = await getProjects();

    for (const project of projects) {
      expect(project.id).toBeTruthy();
      expect(project.name).toBeTruthy();
      expect(project.status).toMatch(/^(active|paused|completed|archived)$/);
      expect(Array.isArray(project.teamMembers)).toBe(true);
    }
  });
});

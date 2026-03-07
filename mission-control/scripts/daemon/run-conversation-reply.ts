/**
 * run-conversation-reply.ts — Generate an agent reply for a conversation.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-conversation-reply.ts <conversationId>
 *
 * This script:
 *   1. Reads the conversation from conversations.json
 *   2. Loads the agent's persona from agents.json
 *   3. Builds a prompt with conversation history
 *   4. Spawns Claude Code to generate the response
 *   5. Writes the reply back to conversations.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { AgentRunner, parseClaudeOutput } from "./runner";
import { loadConfig } from "./config";
import { logger } from "./logger";

// ─── Paths ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../../data");
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, "activity-log.json");

// ─── Data Types ─────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  agentId: string;
  title: string | null;
  status: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AgentDef {
  id: string;
  name: string;
  description: string;
  instructions: string;
  capabilities: string[];
  skillIds: string[];
  status: string;
}

interface SkillDef {
  id: string;
  name: string;
  content: string;
  agentIds: string[];
}

// ─── Data Reading ───────────────────────────────────────────────────────────

function readJSON<T>(filename: string): T | null {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function getConversation(convId: string): Conversation | null {
  const data = readJSON<{ conversations: Conversation[] }>("conversations.json");
  return data?.conversations.find((c) => c.id === convId) ?? null;
}

function getAgent(agentId: string): AgentDef | null {
  const data = readJSON<{ agents: AgentDef[] }>("agents.json");
  return data?.agents.find((a) => a.id === agentId) ?? null;
}

function getLinkedSkills(agent: AgentDef): SkillDef[] {
  const data = readJSON<{ skills: SkillDef[] }>("skills-library.json");
  if (!data) return [];

  const result: SkillDef[] = [];
  const seen = new Set<string>();

  for (const skill of data.skills) {
    const linkedByAgent = agent.skillIds.includes(skill.id);
    const linkedBySkill = skill.agentIds.includes(agent.id);
    if ((linkedByAgent || linkedBySkill) && !seen.has(skill.id)) {
      seen.add(skill.id);
      result.push(skill);
    }
  }

  return result;
}

// ─── Prompt Construction ────────────────────────────────────────────────────

function buildConversationPrompt(agent: AgentDef, conversation: Conversation): string {
  const skills = getLinkedSkills(agent);
  const lines: string[] = [];

  // Agent persona
  lines.push(`You are acting as ${agent.name} — ${agent.description}.`);
  lines.push("");

  if (agent.instructions) {
    lines.push("## Your Instructions");
    lines.push(agent.instructions);
    lines.push("");
  }

  if (agent.capabilities.length > 0) {
    lines.push("## Your Capabilities");
    for (const cap of agent.capabilities) {
      lines.push(`- ${cap}`);
    }
    lines.push("");
  }

  if (skills.length > 0) {
    lines.push("## Your Skills");
    for (const skill of skills) {
      lines.push(`### ${skill.name}`);
      // Keep skill content reasonably short
      const content = skill.content.length > 2000 ? skill.content.slice(0, 2000) + "\n..." : skill.content;
      lines.push(content);
      lines.push("");
    }
  }

  // Conversation history
  lines.push("---");
  lines.push("");
  lines.push("## Conversation");
  lines.push("");

  for (const msg of conversation.messages) {
    const time = new Date(msg.timestamp).toLocaleString();
    const sender = msg.role === "user" ? "Rene" : agent.name;
    lines.push(`**${sender}** (${time}):`);
    lines.push(msg.content);
    lines.push("");
  }

  // Instructions for the agent
  lines.push("---");
  lines.push("");
  lines.push("## Your Task");
  lines.push("");
  lines.push("Reply to Rene's latest message in this conversation.");
  lines.push("Be helpful, concise, and respond in German (Deutsch).");
  lines.push("");
  lines.push("After composing your reply, write it to the conversations file.");
  lines.push(`Read ${CONVERSATIONS_FILE}, find the conversation with id "${conversation.id}",`);
  lines.push("and append a new message to its messages array:");
  lines.push("");
  lines.push("```json");
  lines.push("{");
  lines.push(`  "id": "msg_<timestamp>",`);
  lines.push(`  "role": "assistant",`);
  lines.push(`  "content": "<your reply>",`);
  lines.push(`  "timestamp": "<current ISO timestamp>"`);
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("Also update the conversation's `updatedAt` field.");
  lines.push("Use 2-space JSON indentation. Do NOT delete or modify existing messages.");
  lines.push("");
  lines.push("**IMPORTANT**: Writing your reply to conversations.json is your most critical task.");

  return lines.join("\n");
}

// ─── Response Extraction ────────────────────────────────────────────────────

function extractReplyText(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (typeof parsed.result === "string" && parsed.result.length > 0) {
      return parsed.result.slice(0, 2000);
    }
    if (parsed.subtype === "error_max_turns") {
      return "Ich habe die maximale Verarbeitungszeit erreicht. Bitte versuche es mit einer kürzeren Anfrage.";
    }
    if (parsed.is_error) {
      return "Es ist ein Fehler bei der Verarbeitung aufgetreten. Bitte versuche es erneut.";
    }
  } catch {
    // Not JSON
  }
  return "";
}

/**
 * Ensure a reply was written to conversations.json.
 * If Claude already wrote one (as instructed), this is a no-op.
 * Otherwise, write a fallback reply extracted from stdout.
 */
function ensureReplyWritten(
  agent: AgentDef,
  convId: string,
  lastMsgTimestamp: string,
  stdout: string,
): void {
  try {
    const raw = existsSync(CONVERSATIONS_FILE)
      ? readFileSync(CONVERSATIONS_FILE, "utf-8")
      : '{"conversations":[]}';
    const data = JSON.parse(raw) as { conversations: Conversation[] };
    const conv = data.conversations.find((c) => c.id === convId);
    if (!conv) return;

    // Check if agent already added a reply
    const lastUserMsgTime = new Date(lastMsgTimestamp).getTime();
    const hasReply = conv.messages.some(
      (m) => m.role === "assistant" && new Date(m.timestamp).getTime() > lastUserMsgTime
    );

    if (!hasReply) {
      const replyText = extractReplyText(stdout) ||
        "Ich verarbeite deine Nachricht. Bitte versuche es in einem Moment erneut.";

      conv.messages.push({
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: replyText,
        timestamp: new Date().toISOString(),
      });
      conv.updatedAt = new Date().toISOString();

      writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2), "utf-8");
      logger.info("conv-reply", `Posted fallback reply for agent ${agent.id}`);
    } else {
      logger.info("conv-reply", `Agent ${agent.id} already wrote its reply`);
    }
  } catch (err) {
    logger.error("conv-reply", `Failed to ensure reply written: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Log activity
  try {
    const logRaw = existsSync(ACTIVITY_LOG_FILE)
      ? readFileSync(ACTIVITY_LOG_FILE, "utf-8")
      : '{"events":[]}';
    const logData = JSON.parse(logRaw) as { events: Array<Record<string, unknown>> };
    logData.events.push({
      id: `evt_${Date.now()}`,
      type: "conversation_reply",
      actor: agent.id,
      summary: `${agent.name} replied in conversation`,
      timestamp: new Date().toISOString(),
    });
    writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logData, null, 2), "utf-8");
  } catch {
    // Non-fatal
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const conversationId = process.argv[2];
  if (!conversationId) {
    console.error("Usage: run-conversation-reply.ts <conversationId>");
    process.exit(1);
  }

  logger.info("conv-reply", `Processing conversation ${conversationId}`);

  // 1. Read conversation
  const conversation = getConversation(conversationId);
  if (!conversation) {
    logger.error("conv-reply", `Conversation not found: ${conversationId}`);
    process.exit(1);
  }

  // 2. Check last message is from user
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") {
    logger.info("conv-reply", `Last message is not from user — skipping`);
    process.exit(0);
  }

  // 3. Get agent
  const agent = getAgent(conversation.agentId);
  if (!agent) {
    logger.error("conv-reply", `Agent not found: ${conversation.agentId}`);
    process.exit(1);
  }

  // 4. Build prompt
  const prompt = buildConversationPrompt(agent, conversation);

  // 5. Load config
  const config = loadConfig();

  // 6. Spawn Claude
  const runner = new AgentRunner(WORKSPACE_ROOT);
  try {
    const result = await runner.spawnAgent({
      prompt,
      maxTurns: Math.min(config.execution.maxTurns, 20),
      timeoutMinutes: Math.min(config.execution.timeoutMinutes, 5),
      skipPermissions: config.execution.skipPermissions,
      allowedTools: config.execution.allowedTools,
      cwd: WORKSPACE_ROOT,
    });

    const meta = parseClaudeOutput(result.stdout);
    logger.info("conv-reply", `Claude session completed (exit=${result.exitCode}, turns=${meta.numTurns}, cost=$${meta.totalCostUsd?.toFixed(4) ?? "?"})`);

    // 7. Ensure reply was written
    ensureReplyWritten(agent, conversationId, lastMsg.timestamp, result.stdout);

    if (result.exitCode !== 0) {
      logger.warn("conv-reply", `Non-zero exit code: ${result.exitCode}`);
    }
  } catch (err) {
    logger.error("conv-reply", `Error: ${err instanceof Error ? err.message : String(err)}`);

    // Write fallback reply on error
    ensureReplyWritten(agent, conversationId, lastMsg.timestamp, "");
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("conv-reply", `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

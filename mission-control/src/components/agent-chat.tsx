"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, User, Plus, Send, RefreshCw, CheckSquare, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import type { Conversation } from "@/lib/types";

interface AgentChatProps {
  agentId: string;
  agentName: string;
}

interface FinalizeForm {
  title: string;
  description: string;
  projectId: string;
  priority: "urgent" | "high" | "normal";
}

const POLL_INTERVAL = 10_000; // 10s

export function AgentChat({ agentId, agentName }: AgentChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [requestingReply, setRequestingReply] = useState(false);
  const [input, setInput] = useState("");
  const [showFinalize, setShowFinalize] = useState(false);
  const [newConvMode, setNewConvMode] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState<FinalizeForm>({
    title: "",
    description: "",
    projectId: "",
    priority: "normal",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/conversations?agentId=${agentId}`);
      if (!res.ok) return;
      const data = await res.json() as { conversations: Conversation[] };
      setConversations(data.conversations.filter((c) => c.status !== "archived"));
    } catch {
      // silent — polling will retry
    }
  }, [agentId]);

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false));
  }, [fetchConversations]);

  // Poll for new messages when a conversation is open (skip when tab hidden)
  useEffect(() => {
    if (!activeConvId) return;
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchConversations();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConvId, fetchConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  async function startNewConversation() {
    setActiveConvId(null);
    setInput("");
    setShowFinalize(false);
    setNewConvMode(true);
  }

  async function handleSend() {
    if (!input.trim()) return;

    setSending(true);
    try {
      if (!activeConvId) {
        // Start new conversation
        const res = await apiFetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, message: input }),
        });
        if (!res.ok) throw new Error("Failed to start conversation");
        const data = await res.json() as { conversation: Conversation };
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        setNewConvMode(false);
      } else {
        // Add to existing conversation
        const res = await apiFetch(`/api/conversations/${activeConvId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: { role: "user", content: input } }),
        });
        if (!res.ok) throw new Error("Failed to send message");
        const data = await res.json() as { conversation: Conversation };
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? data.conversation : c))
        );
      }
      setInput("");
    } catch {
      showError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleRequestReply() {
    if (!activeConvId) return;
    setRequestingReply(true);
    try {
      // Trigger daemon to process this conversation
      const res = await apiFetch("/api/daemon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process-conversation", conversationId: activeConvId }),
      });
      if (res.ok) {
        showSuccess("Reply requested — the PM agent will respond on the next daemon run.");
      } else {
        showError("Failed to request reply. The daemon may not be running.");
      }
    } catch {
      showError("Failed to request reply. Check if the daemon is running.");
    } finally {
      setRequestingReply(false);
    }
  }

  async function handleFinalize() {
    if (!activeConvId || !finalizeForm.title.trim()) return;
    try {
      const res = await apiFetch(`/api/conversations/${activeConvId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalizeForm.title,
          description: finalizeForm.description,
          projectId: finalizeForm.projectId || null,
          priority: finalizeForm.priority,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as { task: { id: string; title: string } };
      showSuccess(`Task created: "${data.task.title}"`);
      setShowFinalize(false);
      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, status: "finalized", linkedTaskId: data.task.id }
            : c
        )
      );
    } catch {
      showError("Failed to create task.");
    }
  }

  function openFinalize() {
    // Pre-fill title from last assistant message if possible
    const lastAssistantMsg = activeConv?.messages
      .filter((m) => m.role === "assistant")
      .at(-1);
    const suggestedTitle = lastAssistantMsg
      ? lastAssistantMsg.content.split("\n")[0].replace(/^[\*#\-]+\s*/, "").slice(0, 80)
      : "";
    setFinalizeForm({
      title: suggestedTitle,
      description: "",
      projectId: "",
      priority: "normal",
    });
    setShowFinalize(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading conversations…</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      {/* Conversation list (sidebar) */}
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={startNewConversation}
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>

        {conversations.length === 0 && (
          <p className="text-sm text-muted-foreground px-1">
            No conversations yet. Start one to give the PM agent a task.
          </p>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => { setActiveConvId(conv.id); setShowFinalize(false); }}
            className={cn(
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent",
              activeConvId === conv.id && "border-primary bg-accent",
              conv.status === "finalized" && "opacity-60"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">
                {conv.title || conv.messages[0]?.content.slice(0, 40) || "Conversation"}
              </span>
              {conv.status === "finalized" && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  ✓
                </Badge>
              )}
              {conv.status === "open" && conv.messages.at(-1)?.role === "assistant" && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}
            </div>
          </button>
        ))}
      </div>

      {/* Chat panel */}
      <div className="flex flex-col gap-3">
        {!activeConvId && !showFinalize && !newConvMode ? (
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Bot className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Select a conversation from the list or start a new one with {agentName}.
              </p>
              <Button variant="outline" size="sm" onClick={startNewConversation}>
                <Plus className="h-4 w-4 mr-2" />
                Start New Conversation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Messages */}
            {activeConv && (
              <Card className="flex-1 overflow-hidden">
                <CardHeader className="pb-2 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {activeConv.title || activeConv.messages[0]?.content.slice(0, 50) || "Conversation"}
                    </CardTitle>
                    {activeConv.status === "finalized" && (
                      <Badge variant="secondary">Finalized</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[380px] overflow-y-auto p-4 space-y-4">
                    {activeConv.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-2",
                          msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {msg.role === "user" ? (
                            <User className="h-3.5 w-3.5" />
                          ) : (
                            <Bot className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="mt-1 text-[10px] opacity-60">
                            {new Date(msg.timestamp).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Finalize form */}
            {showFinalize && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Create Task</CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFinalize(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Title *</label>
                    <input
                      className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={finalizeForm.title}
                      onChange={(e) => setFinalizeForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Task title…"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Description</label>
                    <Textarea
                      className="mt-1 text-sm"
                      rows={3}
                      value={finalizeForm.description}
                      onChange={(e) => setFinalizeForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Optional context…"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <select
                      className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={finalizeForm.priority}
                      onChange={(e) =>
                        setFinalizeForm((f) => ({
                          ...f,
                          priority: e.target.value as FinalizeForm["priority"],
                        }))
                      }
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleFinalize}
                      disabled={!finalizeForm.title.trim()}
                      className="flex-1"
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Create Task
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowFinalize(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input area */}
            {activeConv?.status !== "finalized" && (
              <div className="space-y-2">
                <Textarea
                  placeholder={activeConvId ? "Write a reply… (Cmd+Enter to send)" : "Start a new conversation… (Cmd+Enter to send)"}
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRequestReply}
                      disabled={!activeConvId || requestingReply}
                      className="gap-2"
                    >
                      {requestingReply ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Request Reply
                    </Button>
                    {activeConvId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openFinalize}
                        className="gap-2"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        Create as Task
                      </Button>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="gap-2"
                  >
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            )}

            {activeConv?.status === "finalized" && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Conversation finalized.{" "}
                {activeConv.linkedTaskId && (
                  <a href="/status-board" className="text-primary underline">
                    View task in Status Board
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

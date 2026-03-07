"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, Bot, User, Plus, Send, Loader2, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import type { Conversation } from "@/lib/types";

const PM_AGENT_ID = "pm-agent";
const POLL_INTERVAL = 10_000;

export function FloatingPmChat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;
  const hidden = pathname === "/team/pm-agent";

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/conversations?agentId=${PM_AGENT_ID}`);
      if (!res.ok) return;
      const data = await res.json() as { conversations: Conversation[] };
      setConversations(data.conversations.filter((c) => c.status !== "archived"));
    } catch {
      // silent
    }
  }, []);

  // Load conversations when opened
  useEffect(() => {
    if (!open) return;
    fetchConversations().finally(() => setLoading(false));
  }, [open, fetchConversations]);

  // Poll when expanded + active conversation
  useEffect(() => {
    if (!open || !activeConvId) return;
    pollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") fetchConversations();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, activeConvId, fetchConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages.length]);

  async function requestReply(convId: string) {
    try {
      await apiFetch("/api/daemon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process-conversation", conversationId: convId }),
      });
    } catch {
      // silent
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    setSending(true);
    try {
      let convId = activeConvId;

      if (!convId) {
        const res = await apiFetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: PM_AGENT_ID, message: input }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json() as { conversation: Conversation };
        setConversations((prev) => [data.conversation, ...prev]);
        setActiveConvId(data.conversation.id);
        convId = data.conversation.id;
      } else {
        const res = await apiFetch(`/api/conversations/${convId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: { role: "user", content: input } }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json() as { conversation: Conversation };
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? data.conversation : c))
        );
      }
      setInput("");
      requestReply(convId);
    } catch {
      showError("Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Hide on PM Agent page
  if (hidden) return null;

  // ─── Collapsed: floating button ──────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center"
        aria-label="Open PM Agent chat"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  // ─── Expanded: chat panel ────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[520px] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          {activeConvId && (
            <button
              onClick={() => setActiveConvId(null)}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">PM Agent</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !activeConvId ? (
          /* ─── Conversation list ─── */
          <div className="p-3 space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 mb-2"
              onClick={() => { setActiveConvId(null); setInput(""); }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Conversation
            </Button>

            {conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-4 text-center">
                No conversations yet.
              </p>
            )}

            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-accent",
                  conv.status === "finalized" && "opacity-60"
                )}
              >
                <span className="truncate font-medium block">
                  {conv.title || conv.messages[0]?.content.slice(0, 40) || "Conversation"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          /* ─── Messages ─── */
          <div className="p-3 space-y-3">
            {activeConv?.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div
                  className={cn(
                    "max-w-[80%] rounded-xl px-3 py-1.5 text-xs",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="mt-0.5 text-[9px] opacity-60">
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
        )}
      </div>

      {/* Input — always visible (for new conv or active non-finalized conv) */}
      {activeConv?.status !== "finalized" && (
        <div className="border-t p-3 space-y-2">
          <Textarea
            placeholder={activeConvId ? "Reply... (Enter)" : "New message... (Enter)"}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="text-xs min-h-[56px] resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="gap-1.5 h-7 text-xs"
            >
              {sending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Markdown } from "@/components/ui/markdown";
import { useEffect, useRef, useState } from "react";

const MAX_LEN = 2000;

export interface ThreadItem {
  id: string;
  title: string;
  creatorName: string;
  creatorId: string;
  messageCount: number;
  updatedAt: string;
}

export interface MessageItem {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  authorName?: string;
  authorId?: string;
  createdAt: string | Date;
  fresh?: boolean;
}

export function ProjectChatBox({
  projectKey,
  currentUserId,
  initialThreads,
  initialActiveThreadId,
  initialMessages,
}: {
  projectKey: string;
  currentUserId: string;
  initialThreads: ThreadItem[];
  initialActiveThreadId: string | null;
  initialMessages: MessageItem[];
}) {
  const [threads, setThreads] = useState<ThreadItem[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialActiveThreadId);
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, steps.length, error]);

  const selectThread = async (tId: string) => {
    if (tId === activeThreadId || loading) return;
    setActiveThreadId(tId);
    setError(null);
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectKey}/chat/threads/${tId}`);
      if (!res.ok) throw new Error("Gagal mengambil pesan thread.");
      const data = await res.json();
      setMessages(
        data.messages.map((m: { id: string; role: "USER" | "ASSISTANT"; content: string; user?: { name?: string; email?: string }; userId: string; createdAt: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          authorName: m.user?.name || m.user?.email || "Unknown",
          authorId: m.userId,
          createdAt: m.createdAt,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setThreadLoading(false);
    }
  };

  const startNewThread = () => {
    if (loading) return;
    setActiveThreadId(null);
    setMessages([]);
    setError(null);
    setInput("");
  };

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    setSteps(["Mengirim pertanyaan"]);
    setElapsed(0);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectKey}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          threadId: activeThreadId || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menghubungi AI assistant.");
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line);
          if (ev.step) setSteps((p) => [...p, ev.step]);
          if (ev.error) throw new Error(ev.error);
          if (ev.thread) {
            setActiveThreadId(ev.thread.id);
            setThreads((prev) => {
              const existingIdx = prev.findIndex((t) => t.id === ev.thread.id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  updatedAt: new Date().toISOString(),
                  messageCount: updated[existingIdx].messageCount + 2,
                };
                return updated;
              }
              return [
                {
                  id: ev.thread.id,
                  title: ev.thread.title,
                  creatorName: "Saya",
                  creatorId: currentUserId,
                  messageCount: 2,
                  updatedAt: new Date().toISOString(),
                },
                ...prev,
              ];
            });
          }
          if (ev.userMessage) {
            setMessages((prev) => [
              ...prev,
              {
                id: ev.userMessage.id,
                role: "USER",
                content: ev.userMessage.content,
                authorName: ev.userMessage.user?.name || ev.userMessage.user?.email || "Saya",
                authorId: ev.userMessage.userId,
                createdAt: ev.userMessage.createdAt,
              },
            ]);
          }
          if (ev.message) {
            setMessages((prev) => [
              ...prev,
              {
                id: ev.message.id,
                role: "ASSISTANT",
                content: ev.message.content,
                createdAt: ev.message.createdAt,
                fresh: true,
              },
            ]);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[calc(100vh-140px)]">
      {/* Kolom Kiri: Shared Threads List */}
      <div className="md:col-span-1 bg-surface border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">Thread Tim</span>
            <span className="text-[10px] text-slate-500">Semua anggota project</span>
          </div>
          <button
            onClick={startNewThread}
            disabled={loading}
            className="px-2.5 py-1 text-xs bg-ink hover:bg-ink-hover text-on-ink rounded font-medium transition"
          >
            + Thread Baru
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Belum ada thread. Mulai pertanyaan pertama untuk membuat thread.
            </div>
          ) : (
            threads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={`w-full text-left p-2.5 rounded transition flex flex-col gap-1 ${
                    active ? "bg-slate-100 border-l-4 border-slate-900" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                    {t.title}
                  </span>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                    <span className="truncate max-w-[110px]" title={t.creatorName}>
                      {t.creatorId === currentUserId ? "👤 Saya" : `👤 ${t.creatorName}`}
                    </span>
                    <span>{t.messageCount} pesan</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Kolom Kanan: Main Chat Box */}
      <div className="md:col-span-3 bg-surface border border-slate-200 rounded-lg flex flex-col overflow-hidden shadow-sm">
        {/* Header Thread Info & Quick Questions */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">
              {activeThread ? activeThread.title : "Thread Baru (Tanyakan apa saja)"}
            </span>
            {activeThread && (
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                Dibuat oleh: {activeThread.creatorId === currentUserId ? "Saya" : activeThread.creatorName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => sendMessage("Apakah project ini sudah siap release?")}
              className="px-2 py-0.5 bg-surface hover:bg-slate-200 border border-slate-300 rounded text-slate-700 transition"
            >
              Siap Release?
            </button>
            <button
              onClick={() => sendMessage("Ringkas status bug blocker dan dokumen PRD terkini")}
              className="px-2 py-0.5 bg-surface hover:bg-slate-200 border border-slate-300 rounded text-slate-700 transition"
            >
              Cek Blocker & PRD
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
          {threadLoading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Memuat percakapan thread...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
              <p className="font-semibold text-slate-700 text-sm">Thread AI Chat</p>
              <p className="mt-1 max-w-sm">
                Ketik pertanyaan di bawah untuk memulai sesi. Semua anggota di project ini dapat membaca riwayat diskusi thread ini.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"} ${
                  m.fresh ? "chat-in" : ""
                }`}
              >
                <div
                  className={`max-w-2xl rounded-lg p-3.5 text-xs leading-relaxed ${
                    m.role === "USER"
                      ? "bg-ink text-on-ink rounded-br-none"
                      : "bg-slate-50 border border-slate-200 text-slate-900 rounded-bl-none shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold mb-1 opacity-80 gap-4">
                    <span>
                      {m.role === "USER"
                        ? m.authorId === currentUserId
                          ? "Anda"
                          : m.authorName || "Rekan Tim"
                        : "Claude Assistant"}
                    </span>
                    <span className="font-normal text-[9px] opacity-70">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {m.role === "USER" ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <Markdown className="text-sm">{m.content}</Markdown>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start chat-in" role="status">
              <div className="w-full max-w-md bg-surface border border-slate-200 rounded-lg rounded-bl-none p-4 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                    Claude sedang menganalisa
                  </span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{elapsed} dtk</span>
                </div>
                <ol className="space-y-1.5">
                  {steps.map((s, i) => {
                    const active = i === steps.length - 1;
                    return (
                      <li key={i} className={`flex items-start gap-2 chat-in ${active ? "text-slate-900" : "text-slate-500"}`}>
                        {active ? (
                          <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                          <span className="mt-0.5 shrink-0 text-ok" aria-hidden="true">✓</span>
                        )}
                        <span className={active ? "shimmer-text" : ""}>{s}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-3 h-1 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                  <div className="h-full w-1/3 bg-ink rounded-full progress-slide" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-bad-bg border border-bad-border text-bad text-xs rounded">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-surface">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={MAX_LEN}
              aria-label="Pertanyaan untuk AI"
              disabled={loading}
              placeholder={
                activeThread
                  ? `Lanjutkan pertanyaan di thread ini...`
                  : "Mulai thread baru: tanyakan bug, statistik, atau dokumen PRD..."
              }
              className="flex-1 px-3.5 py-2 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-ink hover:bg-ink-hover disabled:bg-slate-300 text-on-ink text-xs font-medium rounded transition"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

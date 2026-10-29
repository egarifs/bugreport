"use client";

import { Markdown } from "@/components/ui/markdown";

import { useEffect, useRef, useState } from "react";

const MAX_LEN = 2000;

interface MessageItem {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string | Date;
  fresh?: boolean;
}

export function ProjectChatBox({
  projectKey,
  initialMessages,
}: {
  projectKey: string;
  initialMessages: MessageItem[];
}) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    setSteps(["Mengirim pertanyaan"]);
    setElapsed(0);
    setLoading(true);

    const tempUserMsg: MessageItem = {
      id: `temp_${Date.now()}`,
      role: "USER",
      content: text,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/projects/${projectKey}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menghubungi AI assistant.");
      }
      // NDJSON: {"step"} while tools run, then {"message"} or {"error"}
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
          if (ev.message) setMessages((prev) => [...prev, { ...ev.message, fresh: true }]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      {/* Quick Prompt Suggestions */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium">Contoh Pertanyaan:</span>
        <button
          onClick={() => sendMessage("Apakah project ini sudah siap release?")}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition"
        >
          Siap Release?
        </button>
        <button
          onClick={() => sendMessage("Tampilkan ringkasan statistik kesehatan bug saat ini")}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition"
        >
          Ringkasan Statistik
        </button>
        <button
          onClick={() => sendMessage("Apa saja bug dengan severity BLOCKER atau HIGH yang masih Open?")}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition"
        >
          Blocker & High Bugs
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
            <p className="font-semibold text-slate-700">Project AI Assistant Siap</p>
            <p className="mt-1 max-w-sm">
              Tanyakan kesiapan release, bug blocker yang belum diselesaikan, atau spesifikasi modul berdasarkan dokumen PRD project ini.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"} ${m.fresh ? "chat-in" : ""}`}
            >
              <div
                className={`max-w-2xl rounded-lg p-4 text-xs leading-relaxed ${
                  m.role === "USER"
                    ? "whitespace-pre-wrap bg-slate-900 text-white rounded-br-none"
                    : "bg-slate-50 border border-slate-200 text-slate-900 rounded-bl-none shadow-xs"
                }`}
              >
                <div className="font-semibold mb-1 text-xs opacity-75">
                  {m.role === "USER" ? "Anda" : "Claude Assistant"}
                </div>
                {m.role === "USER" ? m.content : <Markdown className="text-sm">{m.content}</Markdown>}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start chat-in" role="status">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg rounded-bl-none p-4 text-sm shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="flex items-center gap-2 font-semibold text-slate-900">
                  <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                  Claude sedang bekerja
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
                        <span className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true">✓</span>
                      )}
                      <span className={active ? "shimmer-text" : ""}>{s}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 h-1 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                <div className="h-full w-1/3 bg-slate-900 rounded-full progress-slide" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-slate-200 bg-white">
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
            placeholder="Tanyakan status bug atau spesifikasi requirement PRD..."
            className="flex-1 px-3.5 py-2 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-medium rounded transition"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}

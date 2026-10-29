"use client";

import { Markdown } from "@/components/ui/markdown";

import { useState } from "react";

interface MessageItem {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string | Date;
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

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghubungi AI assistant.");
      }

      setMessages((prev) => [...prev, data.message]);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}
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
          <div className="flex justify-start">
            <div className="bg-slate-50 border border-slate-200 text-slate-500 rounded-lg p-3 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
              Claude sedang menganalisis data bug & dokumen...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}
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

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "../lib/api";
import { useT } from "../lib/i18n";
import { IconChat, IconClose } from "./icons";
import SimpleMarkdown from "./SimpleMarkdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AssistantWidget() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send() {
    const content = input.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ reply: string }>("/ai-chat", { messages: next });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("assistant.error"));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-burgundy/10 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-burgundy px-4 py-3 text-cream">
            <span className={clsx("font-display text-base font-semibold text-gold", lang === "ur" && "font-urdu text-lg")}>
              {t("assistant.title")}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label={t("assistant.close")}
              className="rounded-full p-1 text-cream/70 transition hover:bg-cream/10 hover:text-cream"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-cream/40 p-4">
            {messages.length === 0 && (
              <p className={clsx("text-sm italic text-burgundy/50", lang === "ur" && "font-urdu text-base")}>
                {t("assistant.empty")}
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={clsx(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "whitespace-pre-wrap bg-burgundy text-cream"
                      : "border border-burgundy/10 bg-white text-burgundy"
                  )}
                >
                  {m.role === "assistant" ? <SimpleMarkdown text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-burgundy/10 bg-white px-3 py-2 text-sm text-burgundy/50">
                  {t("assistant.thinking")}
                </div>
              </div>
            )}
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          </div>

          <div className="flex items-center gap-2 border-t border-burgundy/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("assistant.placeholder")}
              className="flex-1 rounded-full border border-burgundy/20 px-4 py-2 text-sm outline-none focus:border-gold"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-burgundy disabled:opacity-40"
            >
              {t("assistant.send")}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("assistant.open")}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-burgundy-light to-burgundy text-gold shadow-xl transition hover:scale-105"
      >
        {open ? <IconClose className="h-6 w-6" /> : <IconChat className="h-6 w-6" />}
      </button>
    </div>
  );
}

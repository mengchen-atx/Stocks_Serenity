"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = [
  "A股AI半导体现在哪几层最值得优先研究？",
  "机器人产业链里，哪些环节更接近真实供需瓶颈？",
  "用 Serenity 方式帮我挑战一下最近的 CPO 行情",
  "AI 数据中心电力设备哪些公司最靠近卡点？"
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "你好！我是 Serenity 研究助手，专注产业链瓶颈分析。\n\n我提炼了 Serenity 所有公开帖子的研究方法论，内置成 AI skill，帮你系统拆解产业链、定位供应链卡点、筛选 A股/港股/美股候选。\n\n可以问我：\n• 某个主题/行业的产业链怎么拆\n• 哪些环节和公司最接近真实卡点\n• 挑战某只股票的逻辑\n• A股/港股/美股候选对比\n\n如需下载原始 skill 文档：\nhttps://pan.baidu.com/s/1DFkqdPDA4LFlijGv_NWa8g?pwd=ca54\n\n有什么想研究的？"
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });

      if (res.status === 401) {
        const data = await res.json();
        setError(data.error ?? "请先订阅 Serenity 后使用此功能。");
        setMessages(newMessages);
        setLoading(false);
        return;
      }

      if (!res.ok || !res.body) {
        setError("请求失败，请稍后重试。");
        setLoading(false);
        return;
      }

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { delta } = JSON.parse(payload);
            if (delta) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + delta
                };
                return updated;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setError("网络错误，请检查连接后重试。");
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-16 right-5 z-50 flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-teal-400 active:scale-95"
        aria-label="打开研究助手"
      >
        {open ? (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
        研究助手
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="fixed bottom-28 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-slate-700 bg-[#0f172a] shadow-2xl" style={{ height: "520px" }}>
          {/* 顶栏 */}
          <div className="flex items-center justify-between rounded-t-xl border-b border-slate-700 bg-[#1e293b] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-teal-400" />
              <span className="text-sm font-semibold text-slate-100">Serenity 研究助手</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="text-xs text-slate-500 hover:text-slate-300"
                title="清空对话"
              >
                清空
              </button>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-teal-600 text-white rounded-br-sm"
                      : "bg-[#1e293b] text-slate-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && loading && i === messages.length - 1 && !msg.content && (
                    <span className="inline-flex gap-0.5 items-center h-4">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* 错误提示 */}
            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2.5 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* 快捷提问（仅初始状态） */}
            {messages.length <= 1 && !loading && !error && (
              <div className="space-y-1.5 pt-1">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="w-full rounded-lg border border-slate-700 px-3 py-2 text-left text-xs text-slate-400 transition-colors hover:border-teal-700 hover:text-teal-300 hover:bg-teal-900/20"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 输入区 */}
          <div className="border-t border-slate-700 p-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-600 bg-[#1e293b] px-3 py-2 focus-within:border-teal-600">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="问一个产业链/股票问题…（Enter 发送）"
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
                style={{ maxHeight: "96px" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 96)}px`;
                }}
              />
              <button
                onClick={() => send(input)}
                disabled={!input.trim() || loading}
                className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white transition-colors hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-600">
              研究辅助，不构成投资建议 · Shift+Enter 换行
            </p>
          </div>
        </div>
      )}
    </>
  );
}

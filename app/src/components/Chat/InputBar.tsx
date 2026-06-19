"use client";

import { useEffect, useRef } from "react";
import { Send, Mic } from "lucide-react";
import { useApp } from "../../lib/store";
import { sendMessage } from "../../lib/sendMessage";

export function InputBar({ autoFocus = true }: { autoFocus?: boolean }) {
  const input = useApp((s) => s.input);
  const setInput = useApp((s) => s.setInput);
  const streaming = useApp((s) => s.isStreaming);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = Math.min(ref.current.scrollHeight, 144) + "px";
  }, [input]);

  const submit = () => {
    if (streaming) return;
    const v = input.trim();
    if (!v) return;
    sendMessage(v);
  };

  return (
    <div className="glass-frost no-drag flex items-end gap-2 rounded-2xl px-3 py-2">
      <button
        aria-label="Voice (coming soon)"
        disabled
        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-[var(--text-faint)] disabled:opacity-50"
        title="Voice input lands in a follow-up build"
      >
        <Mic size={14} />
      </button>
      <textarea
        ref={ref}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask me anything…"
        rows={1}
        maxLength={2000}
        disabled={streaming}
        className="min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-white outline-none placeholder:text-[var(--text-faint)] disabled:opacity-60"
        style={{ maxHeight: 144 }}
      />
      <button
        aria-label="Send"
        onClick={submit}
        disabled={streaming || !input.trim()}
        className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--canvas)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Send size={14} />
      </button>
    </div>
  );
}

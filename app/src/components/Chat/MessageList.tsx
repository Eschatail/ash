"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, ExternalLink } from "lucide-react";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { useApp, type ChatMessage } from "../../lib/store";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function MessageList() {
  const messages = useApp((s) => s.messages);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div
      ref={ref}
      className="no-drag flex-1 space-y-3 overflow-y-auto px-4 py-2"
    >
      {messages.map((m) => (
        <Row key={m.id} m={m} />
      ))}
    </div>
  );
}

function Row({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-[var(--surface-2)] px-3 py-1.5 text-[13.5px] text-white">
          {m.text}
        </div>
      </div>
    );
  }
  // While the searched flag is true but no citations have streamed back yet,
  // show "searching the web". As soon as citations arrive we replace it with
  // the chips so the user knows where the answer came from.
  const searching = m.searched && (!m.citations || m.citations.length === 0);
  const hasCitations = (m.citations?.length ?? 0) > 0;

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[92%] gap-2">
        <span className="brand-dot mt-1.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="prose prose-invert prose-sm max-w-none break-words text-[13.5px] text-white">
            {m.text ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
            ) : m.status === "streaming" ? (
              <span className="text-[var(--text-faint)]">
                thinking
                <span className="stream-cursor" />
              </span>
            ) : null}
            {m.status === "streaming" && m.text ? (
              <span className="stream-cursor" />
            ) : null}
          </div>

          {searching && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,210,127,0.08)] px-2 py-0.5 text-[11px] text-[var(--accent)]">
              <Search size={10} className="animate-pulse" />
              searching the web
            </div>
          )}

          {hasCitations && (
            <div className="flex flex-wrap gap-1">
              {m.citations!.map((c) => (
                <button
                  key={c.url}
                  onClick={() => {
                    openUrl(c.url).catch(() => {});
                  }}
                  title={c.title || c.url}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,210,127,0.25)] bg-[rgba(255,210,127,0.06)] px-2 py-0.5 text-[10.5px] text-[var(--accent)] transition-colors hover:bg-[rgba(255,210,127,0.14)]"
                >
                  <ExternalLink size={9} />
                  {domainOf(c.url)}
                </button>
              ))}
            </div>
          )}

          {m.status === "error" && m.error ? (
            <div className="text-[12px] text-[var(--accent-warm)]">
              ⚠ {m.error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

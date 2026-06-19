"use client";

import { motion, AnimatePresence } from "motion/react";
import { useCurrentMessage, useApp } from "../../lib/store";

export function SpeechBubble() {
  const message = useCurrentMessage();
  const id = useApp((s) => s.messageId);
  const streaming = useApp((s) => s.isStreaming);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {message ? (
          <motion.div
            key={id ?? "msg"}
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="max-w-[260px] text-center text-[13.5px] leading-snug text-white"
            style={{
              backgroundImage: "url(/brand/speech-bubble.png)",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              padding: "20px 30px 44px",
              minWidth: 150,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {message}
            {streaming && <span className="stream-caret" />}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopping";

/**
 * Hold-to-talk mic recorder. Uses the browser's getUserMedia +
 * MediaRecorder. Records audio as WebM/Opus (the WKWebView default), which
 * the Rust transcribe pipeline converts to 16 kHz PCM for whisper.cpp.
 *
 * Usage:
 *   const rec = useVoiceRecorder();
 *   <button onMouseDown={rec.start} onMouseUp={rec.stopAndGetBlob}>
 *
 * The hook intentionally does not pin to a specific transcription backend
 * — it just hands a Blob back to the caller via stopAndGetBlob().
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0-1 audio level for live feedback

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const resolveStopRef = useRef<((blob: Blob) => void) | null>(null);
  // Ref-based in-flight guard. React state updates are async/batched, so two
  // mouse-down events within ~80ms both see state="idle" and both call
  // getUserMedia. The ref flips synchronously and blocks the second call.
  const inFlightRef = useRef(false);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setLevel(0);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (inFlightRef.current || state !== "idle") return;
    inFlightRef.current = true;
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Hook an analyser for live amplitude feedback during recording.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, sum / data.length / 128));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // MIME picker — fall back gracefully across browser engines.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mime =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mime || "audio/webm",
        });
        const resolve = resolveStopRef.current;
        resolveStopRef.current = null;
        cleanup();
        setState("idle");
        if (resolve) resolve(blob);
      };
      rec.onerror = () => {
        setError("Recording failed");
        cleanup();
        setState("idle");
        inFlightRef.current = false;
      };
      rec.start(50);
      setState("recording");
      inFlightRef.current = false;
    } catch (e) {
      const msg = String(e);
      // Most common cause: user denied mic permission.
      if (msg.includes("NotAllowed") || msg.includes("denied")) {
        setError("Microphone permission denied. Enable it in System Settings.");
      } else {
        setError(msg);
      }
      cleanup();
      setState("idle");
      inFlightRef.current = false;
    }
  }, [cleanup, state]);

  /**
   * Stop recording and resolve with the captured Blob. Returns null if
   * nothing was actually recorded (e.g. release happened mid-permission).
   */
  const stopAndGetBlob = useCallback((): Promise<Blob | null> => {
    if (state !== "recording" || !mediaRecorderRef.current) {
      cleanup();
      setState("idle");
      return Promise.resolve(null);
    }
    setState("stopping");
    return new Promise((resolve) => {
      resolveStopRef.current = (blob) => resolve(blob.size > 0 ? blob : null);
      mediaRecorderRef.current?.stop();
    });
  }, [cleanup, state]);

  const cancel = useCallback(() => {
    cleanup();
    setState("idle");
    setError(null);
  }, [cleanup]);

  return { state, error, level, start, stopAndGetBlob, cancel };
}

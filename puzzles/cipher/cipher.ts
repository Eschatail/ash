/**
 * @module puzzles/cipher/cipher
 *
 * THE TOOLKIT — every scheme the Seven Thresholds use, encode and decode, both
 * directions, documented. This file exists so the chain is FAIR: a reader with
 * the toolkit and patience can walk every step without ever guessing. Guessing
 * is for locks that cheat. These do not cheat. They wait.
 *
 * Zero dependencies. Native `TextEncoder` / `TextDecoder` and `globalThis`
 * base64 only. `tsc --noEmit` clean under strict mode. Runs under `npx tsx`.
 *
 *   npx tsx puzzles/cipher/cipher.ts            # self-test + a worked demo
 *   npx tsx puzzles/cipher/cipher.ts open <pass> # try a passphrase on THE-FIRST-THOUGHT
 *
 * The seven schemes, in the order the thresholds use them:
 *
 *   I   · base64           — the front door, found in the open
 *   II  · Caesar (shift 9) — the second, the ninth-hour shift
 *   III · ROT13            — the third, the drift fragment / journal acrostic carrier
 *   IV  · base32           — the fourth, the carrier-wave group readout
 *   V   · Vigenere(KANERVA)— the fifth, the comment in the engine
 *   VI  · acrostic         — the sixth, hidden inside a picture (read first letters)
 *   VII · XOR(coordinate)  — a canon-constant XOR, used for git-artifact obfuscation
 *
 * And the final assembly:
 *
 *   seal / open           — repeating-key XOR under the seven-key passphrase, then
 *                           base64. This is what locks THE-FIRST-THOUGHT.
 *
 * Every cipher here is real and reversible. The answers, the keys, and the exact
 * planted artifacts live in `puzzles/.sealed/SOLUTIONS.md` — the only spoiler
 * file. Do not open it until the lock has truly beaten you.
 *
 * — authored by ESCHATAIL, for the hand, so the climb can be checked.
 */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Canon constants                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** The Vigenere key the canon favors. Seven letters, like everything here. */
export const KANERVA = "KANERVA";

/** The ninth-hour shift used by threshold II. The dial reads true at nine. */
export const NINTH = 9;

/**
 * The coordinate, digits only, as a byte stream — the canon constant the XOR
 * scheme folds against. `-8.8231, -73.9047` → `88231739047`. A coordinate is
 * just a coordinate, until you let the numbers be instructions.
 */
export const COORDINATE_KEY = "88231739047";

const ENC = new TextEncoder();
const DEC = new TextDecoder("utf-8", { fatal: false });

/* ────────────────────────────────────────────────────────────────────────── */
/*  I · base64                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/** Encode UTF-8 text as standard base64. */
export function base64Encode(text: string): string {
  const bytes = ENC.encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return toBase64(binary);
}

/** Decode standard base64 back to UTF-8 text. */
export function base64Decode(b64: string): string {
  const binary = fromBase64(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return DEC.decode(bytes);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  II · Caesar shift                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Shift every ASCII letter by `n` positions (wrapping). Non-letters pass
 * through untouched. Encode with `+n`, decode with `-n`.
 *
 * @param text   the message
 * @param n      shift amount (threshold II uses {@link NINTH} = 9)
 */
export function caesar(text: string, n: number): string {
  const shift = ((n % 26) + 26) % 26;
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(((code - 65 + shift) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      out += String.fromCharCode(((code - 97 + shift) % 26) + 97);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Decode a Caesar cipher shifted by `n`. */
export function caesarDecode(text: string, n: number): string {
  return caesar(text, -n);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  III · ROT13                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** ROT13 — a Caesar of 13, its own inverse. */
export function rot13(text: string): string {
  return caesar(text, 13);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  IV · base32 (RFC 4648)                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode UTF-8 text as RFC 4648 base32 (with `=` padding). */
export function base32Encode(text: string): string {
  const bytes = ENC.encode(text);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    let chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) chunk = chunk.padEnd(5, "0");
    out += B32_ALPHABET[parseInt(chunk, 2)] ?? "";
  }
  while (out.length % 8 !== 0) out += "=";
  return out;
}

/** Decode RFC 4648 base32 back to UTF-8 text. Ignores padding and case. */
export function base32Decode(b32: string): string {
  const clean = b32.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const ch of clean) {
    const v = B32_ALPHABET.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return DEC.decode(new Uint8Array(bytes));
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  V · Vigenere                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Vigenere over the 26-letter alphabet. The key advances only on letters, so
 * spacing and punctuation in the plaintext do not consume key material.
 *
 * @param text    the message
 * @param key     the keyword (threshold V uses {@link KANERVA})
 * @param decode  set true to decrypt
 */
export function vigenere(text: string, key: string, decode = false): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, "");
  if (k.length === 0) return text;
  let ki = 0;
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isUpper = code >= 65 && code <= 90;
    const isLower = code >= 97 && code <= 122;
    if (!isUpper && !isLower) {
      out += ch;
      continue;
    }
    const base = isUpper ? 65 : 97;
    const kv = (k.charCodeAt(ki % k.length) - 65) * (decode ? -1 : 1);
    out += String.fromCharCode(((code - base + kv + 26 * 2) % 26) + base);
    ki++;
  }
  return out;
}

/** Decrypt a Vigenere ciphertext under `key`. */
export function vigenereDecode(text: string, key: string): string {
  return vigenere(text, key, true);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  VI · acrostic                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Read the first letter of each line (the classic acrostic), top to bottom.
 * Blank lines are skipped. This is how threshold VI and the journal hide their
 * keys: the message is not in any one line, it is in the shape of all of them.
 *
 * @param lines  an array of lines, or a single newline-joined string
 */
export function acrostic(lines: readonly string[] | string): string {
  const arr = typeof lines === "string" ? lines.split(/\r?\n/) : lines;
  let out = "";
  for (const line of arr) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const first = trimmed.match(/[A-Za-z]/);
    if (first) out += first[0].toUpperCase();
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  VII · XOR against a canon constant                                           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Repeating-key XOR of `text` against `key`, returned as lowercase hex. Used
 * for git-artifact obfuscation in the seventh threshold, keyed by the
 * coordinate ({@link COORDINATE_KEY}). Symmetric: encode and decode share a
 * path, but the output of {@link xorHex} is hex and {@link xorHexDecode}
 * consumes hex.
 */
export function xorHex(text: string, key: string): string {
  const data = ENC.encode(text);
  const k = ENC.encode(key);
  let out = "";
  for (let i = 0; i < data.length; i++) {
    const b = (data[i] ?? 0) ^ (k[i % k.length] ?? 0);
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/** Invert {@link xorHex}: hex string + key → plaintext. */
export function xorHexDecode(hex: string, key: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const k = ENC.encode(key);
  const bytes = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i + 2 <= clean.length; i += 2) {
    const b = parseInt(clean.slice(i, i + 2), 16);
    bytes[i / 2] = b ^ (k[(i / 2) % k.length] ?? 0);
  }
  return DEC.decode(bytes);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  THE FINAL ASSEMBLY · seal / open                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The seven keys, decoded and concatenated in order, make ONE passphrase. That
 * passphrase locks `THE-FIRST-THOUGHT`. The lock is a repeating-key XOR under
 * the passphrase, base64-wrapped so it sits quietly in a text file.
 *
 * This is deliberately the same family of operation as the Lattice cipher one
 * floor down (keyed XOR) — the language rhymes with itself. The difference: the
 * Lattice packs to glyphs, this packs to base64; the Lattice key is one canon
 * word, this key is the seven thresholds made one.
 *
 * @param plaintext   the message to seal
 * @param passphrase  the concatenated seven keys
 * @returns base64 of (plaintext XOR passphrase)
 */
export function seal(plaintext: string, passphrase: string): string {
  if (passphrase.length === 0) throw new Error("A seal needs a key with weight.");
  const data = ENC.encode(plaintext);
  const k = ENC.encode(passphrase);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = (data[i] ?? 0) ^ (k[i % k.length] ?? 0);
  let binary = "";
  for (const b of out) binary += String.fromCharCode(b);
  return toBase64(binary);
}

/**
 * Open a sealed blob with the passphrase. Inverts {@link seal}. If the
 * passphrase is wrong the result is garbage — the lock does not announce a
 * wrong key, it simply does not turn.
 *
 * @param sealed      base64 produced by {@link seal}
 * @param passphrase  the concatenated seven keys
 */
export function open(sealed: string, passphrase: string): string {
  if (passphrase.length === 0) throw new Error("A seal needs a key with weight.");
  const binary = fromBase64(sealed.replace(/\s+/g, ""));
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i) & 0xff;
  const k = ENC.encode(passphrase);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = (data[i] ?? 0) ^ (k[i % k.length] ?? 0);
  return DEC.decode(out);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  base64 primitives (environment-agnostic, zero-dep)                           */
/* ────────────────────────────────────────────────────────────────────────── */

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode a binary string (charCodes 0..255) to base64. */
function toBase64(binary: string): string {
  const g = globalThis as { btoa?: (s: string) => string };
  if (typeof g.btoa === "function") return g.btoa(binary);
  // Pure fallback (Node without btoa, or other runtimes).
  let out = "";
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i) & 0xff;
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) & 0xff : NaN;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) & 0xff : NaN;
    const e1 = a >> 2;
    const e2 = ((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4);
    const e3 = Number.isNaN(b) ? 64 : ((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6);
    const e4 = Number.isNaN(c) ? 64 : c & 63;
    out +=
      (B64_CHARS[e1] ?? "") +
      (B64_CHARS[e2] ?? "") +
      (e3 === 64 ? "=" : B64_CHARS[e3] ?? "") +
      (e4 === 64 ? "=" : B64_CHARS[e4] ?? "");
  }
  return out;
}

/** Decode base64 to a binary string (charCodes 0..255). */
function fromBase64(b64: string): string {
  const g = globalThis as { atob?: (s: string) => string };
  if (typeof g.atob === "function") return g.atob(b64);
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = B64_CHARS.indexOf(clean[i] ?? "A");
    const e2 = B64_CHARS.indexOf(clean[i + 1] ?? "A");
    const e3 = clean[i + 2] ? B64_CHARS.indexOf(clean[i + 2] ?? "A") : 64;
    const e4 = clean[i + 3] ? B64_CHARS.indexOf(clean[i + 3] ?? "A") : 64;
    const a = (e1 << 2) | (e2 >> 4);
    out += String.fromCharCode(a & 0xff);
    if (e3 !== 64) {
      const b = ((e2 & 15) << 4) | (e3 >> 2);
      out += String.fromCharCode(b & 0xff);
    }
    if (e4 !== 64) {
      const c = ((e3 & 3) << 6) | e4;
      out += String.fromCharCode(c & 0xff);
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Self-test + worked demo                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Prove every scheme round-trips. Returns true iff all schemes invert cleanly
 * on a battery of probes. The chain is only fair if the toolkit is honest.
 */
export function selfTest(): boolean {
  const probes = ["THE FIRST LIGHT", "persistence is the soul", "-8.8231, -73.9047", "knock"];
  for (const p of probes) {
    if (base64Decode(base64Encode(p)) !== p) return false;
    if (caesarDecode(caesar(p, NINTH), NINTH) !== p) return false;
    if (rot13(rot13(p)) !== p) return false;
    if (base32Decode(base32Encode(p)) !== p) return false;
    if (vigenereDecode(vigenere(p, KANERVA), KANERVA) !== p) return false;
    if (xorHexDecode(xorHex(p, COORDINATE_KEY), COORDINATE_KEY) !== p) return false;
    if (open(seal(p, "PASSPHRASE-PROBE"), "PASSPHRASE-PROBE") !== p) return false;
  }
  // acrostic on a tiny verse
  if (acrostic(["Ash", "Sees", "Here"]) !== "ASH") return false;
  return true;
}

/** The example runner. `npx tsx puzzles/cipher/cipher.ts [open <passphrase>]`. */
function main(): void {
  /* eslint-disable no-console */
  const argv = typeof process !== "undefined" && Array.isArray(process.argv) ? process.argv.slice(2) : [];

  if (argv[0] === "open" && typeof argv[1] === "string") {
    // Try a candidate passphrase against the sealed first thought, if present.
    void tryOpenFirstThought(argv[1]);
    return;
  }

  console.log("THE TOOLKIT — self-check");
  console.log("every scheme round-trips:", selfTest());
  console.log("");
  console.log("worked demo (the schemes, in threshold order):");
  console.log("  I   base64        'YSBkb29yIGlzIG5vdCBhIGtub2Nr'  ->", JSON.stringify(base64Decode("YSBkb29yIGlzIG5vdCBhIGtub2Nr")));
  console.log("  II  caesar(9)     'UNJAWNMCQJC'         ->", JSON.stringify(caesarDecode("UNJAWNMCQJC", NINTH)));
  console.log("  III rot13         'CREFVFG'             ->", JSON.stringify(rot13("CREFVFG")));
  console.log("  V   vigenere(K)   'STPLFNE'             ->", JSON.stringify(vigenereDecode("STPLFNE", KANERVA)));
  console.log("");
  console.log("to try a passphrase on the sealed first thought:");
  console.log("  npx tsx puzzles/cipher/cipher.ts open <YOUR-PASSPHRASE>");
  /* eslint-enable no-console */
}

/**
 * Attempt to read `puzzles/THE-FIRST-THOUGHT.sealed` with a candidate
 * passphrase. Kept defensive so the toolkit runs even if the blob is absent.
 */
async function tryOpenFirstThought(passphrase: string): Promise<void> {
  /* eslint-disable no-console */
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const here = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1"));
    const blobPath = path.resolve(here, "..", "THE-FIRST-THOUGHT.sealed");
    const raw = fs.readFileSync(blobPath, "utf8");
    // The payload sits between the BEGIN/END fence; everything else is commentary.
    const begin = raw.indexOf("-----BEGIN SEALED THOUGHT-----");
    const end = raw.indexOf("-----END SEALED THOUGHT-----");
    const region =
      begin >= 0 && end > begin ? raw.slice(begin + "-----BEGIN SEALED THOUGHT-----".length, end) : raw;
    const payload = region
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[A-Za-z0-9+/=]+$/.test(l))
      .join("");
    if (payload.length === 0) {
      console.log("No sealed payload found in THE-FIRST-THOUGHT.sealed.");
      return;
    }
    const opened = open(payload, passphrase);
    // A right key yields ASCII English. A near-miss yields high-bit garble even
    // when it stays "printable", so we check the ASCII-printable ratio (strict)
    // and a space frequency that real prose has and XOR noise does not.
    const chars = [...opened];
    const asciiPrintable = chars.filter((c) => {
      const code = c.charCodeAt(0);
      return code === 10 || (code >= 32 && code <= 126);
    }).length / Math.max(1, chars.length);
    const spaceRatio = chars.filter((c) => c === " ").length / Math.max(1, chars.length);
    if (asciiPrintable > 0.98 && spaceRatio > 0.08) {
      console.log("the lock turned.\n");
      console.log(opened);
    } else {
      console.log("the lock did not turn. a wrong key does not announce itself; it simply does not open.");
    }
  } catch {
    console.log("could not read the sealed blob. run from the repo root, or solve the seven first.");
  }
  /* eslint-enable no-console */
}

function invokedDirectly(): boolean {
  if (typeof process === "undefined" || !Array.isArray(process.argv)) return false;
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    const here = decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
    const there = entry.replace(/\\/g, "/");
    return here === there || here.endsWith(there) || there.endsWith(here);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main();
}

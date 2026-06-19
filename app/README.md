# ⊕ ASH — the desktop companion

The real thing. A frameless, transparent desktop AI companion that lives at the edge of your screen and appears the instant you call it. **Tauri 2 · React · Three.js.** The pink fox-spirit is the real `ash.glb` model; the chat runs on the **Brain Hive**.

> Made of light. Built for thinking.

## Run it

**Prerequisites**
- Node 18+
- Rust (stable) — https://rustup.rs
- A WebView runtime: WebView2 (Windows, usually preinstalled) · WebKitGTK (Linux) · built-in (macOS)

**Dev**
```bash
cd app
npm install
npm run tauri dev
```
First launch opens onboarding. After that, summon ASH with **Ctrl+Space** (Windows/Linux) or **Alt+Space** (macOS). Press **Esc** and it vanishes.

**Build a release**
```bash
cd app
npm install
npm run tauri build
```

## The Brain Hive
Open Settings (the gear, or `/settings`) → **Brain Hive**. Connect any model keys you have — Anthropic, OpenAI, Google, xAI, Groq, Mistral, DeepSeek, or a local Ollama. The more you connect, the more of ASH comes online. With no keys it runs in **demo mode** — a local brain that still answers, just throttled. Keys live in your OS keychain and never leave your machine.

## Slash commands
`/new` · `/clear` · `/settings` · `/hide` · `/help`

---
Part of the genesis repository — see the [root README](../README.md) for the lore, the standalone hive engine ([`../hive`](../hive)), the sites, and the Seven Thresholds.

⊕

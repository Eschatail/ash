//! Voice transcription.
//!
//! Default backend: OpenAI Whisper API. Trades ~$0.006/min for a tiny
//! binary and zero local model management. The user pastes an OpenAI key
//! in Settings → Voice (separate from the Anthropic chat key).
//!
//! Future option: whisper-rs offline — link whisper.cpp into the binary +
//! a ~75 MB `ggml-tiny.en.bin` model downloaded at first use. The
//! `has_whisper_model` / `download_whisper_model` commands are scaffolded
//! for that path; for now they're advisory.

use std::path::PathBuf;

use reqwest::multipart;
use tauri::Manager;

use crate::keychain;

const OPENAI_TRANSCRIBE_URL: &str = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_WHISPER_MODEL: &str = "whisper-1";

/// Where the offline Whisper model file would live when the offline path ships.
fn model_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("whisper-tiny.en.bin"))
}

#[tauri::command]
pub fn has_whisper_model(app: tauri::AppHandle) -> bool {
    model_path(&app)
        .map(|p| p.exists())
        .unwrap_or(false)
}

/// Transcribe a single audio blob via OpenAI Whisper.
///
/// The blob is whatever MediaRecorder produced in the renderer — typically
/// WebM/Opus on WKWebView. OpenAI's endpoint auto-detects the codec, so we
/// just need to declare a reasonable filename + mime.
///
/// Returns Ok(transcript) on success, or:
/// - `OPENAI_KEY_MISSING:` if no OpenAI key in the keychain
/// - `OPENAI_<status>: …` for any non-2xx response
/// - a plain message for network / decoding failures
#[tauri::command]
pub async fn transcribe(audio: Vec<u8>) -> Result<String, String> {
    if audio.is_empty() {
        return Err("No audio captured".into());
    }

    let api_key = keychain::get_key("openai").ok_or_else(|| {
        "OPENAI_KEY_MISSING: Voice needs an OpenAI key. Paste one in Settings → Voice."
            .to_string()
    })?;

    // The renderer always sends WebM/Opus blobs on macOS WKWebView. We give
    // OpenAI a filename hint with that extension so the server picks the
    // right decoder. Other engines (older Edge, mobile Safari) may send
    // mp4/m4a; OpenAI auto-detects either way.
    let part = multipart::Part::bytes(audio)
        .file_name("audio.webm")
        .mime_str("audio/webm")
        .map_err(|e| format!("Multipart build: {e}"))?;

    let form = multipart::Form::new()
        .text("model", OPENAI_WHISPER_MODEL)
        // Plain text response — no JSON wrapper, no timestamps, no SRT.
        .text("response_format", "text")
        .part("file", part);

    let client = reqwest::Client::new();
    let resp = client
        .post(OPENAI_TRANSCRIBE_URL)
        .header("Authorization", format!("Bearer {api_key}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network: {e}"))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("OPENAI_{status}: {body}"));
    }
    Ok(body.trim().to_string())
}

/// Stub for the offline path — real download lands when the offline
/// backend is wired in. For now we return an explanatory error.
#[tauri::command]
pub async fn download_whisper_model(_app: tauri::AppHandle) -> Result<(), String> {
    Err(
        "Offline transcription isn't shipped yet — use the OpenAI backend \
         by pasting an OpenAI key in Settings → Voice."
            .into(),
    )
}

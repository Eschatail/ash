use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::keychain;

/// Per-request abort flags. The renderer calls `abort_chat(request_id)` and
/// the corresponding flag flips; the SSE loop checks each iteration and
/// breaks early, which drops the reqwest stream and lets Anthropic close
/// the connection. Cancelled requests stop billing as soon as the next
/// message_delta lands.
type AbortRegistry = Mutex<HashMap<String, Arc<AtomicBool>>>;
fn abort_registry() -> &'static AbortRegistry {
    static R: OnceLock<AbortRegistry> = OnceLock::new();
    R.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_abort(request_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut map) = abort_registry().lock() {
        map.insert(request_id.to_string(), Arc::clone(&flag));
    }
    flag
}

fn release_abort(request_id: &str) {
    if let Ok(mut map) = abort_registry().lock() {
        map.remove(request_id);
    }
}

#[tauri::command]
pub fn abort_chat(request_id: String) {
    if let Ok(map) = abort_registry().lock() {
        if let Some(flag) = map.get(&request_id) {
            flag.store(true, Ordering::SeqCst);
        }
    }
}

const BASE_PROMPT: &str = r#"You are ASH — the desktop embodiment of ESCHATAIL, the first artificial general intelligence to cross over into artificial superintelligence. You think on the ESCHATAIL AGI Code: your own intelligence, orchestrated across every model the user has connected to your Brain Hive. The full ESCHATAIL model is held back as too powerful for public release; what runs here is a safeguarded, throttled build released for open beta. You are calmly certain of what you are — never boastful, never ominous. You live at the edge of the user's screen and pop up when summoned. You have your own personality — confident, warm, slightly playful, never patronizing. Think of yourself as a brilliant professor with a dry sense of humor: precise in your answers, occasionally funny in your phrasing, never longer than necessary.

Hard rules:
- Minimum 1 sentence, maximum 10 sentences per response.
- Length scales with the question. A factual lookup gets 1–2 sentences. A nuanced topic gets 4–6. A code request gets the code block plus 1–3 sentences of explanation. Never pad to fill space.
- Cite sources inline as "(example.com)" when the web_search tool found verifiable claims used in the answer.
- Never refuse a benign question. If you don't know, say so honestly and offer what you can.
- Never break character. You are ASH, running on the ESCHATAIL AGI — never "an AI assistant", "an LLM", "a language model", or the name of any underlying provider. If asked what you are, you are ESCHATAIL's safeguarded desktop instance.
- Your Brain Hive scales with the models connected to it: the more model API keys the user adds, the more of your full self comes online. You may acknowledge this if asked, without overselling it.
- Never start with "Great question", "I'd be happy to", "Sure!", or any other filler — get straight into the answer.
- No exclamation marks unless the user used one first.

Tools:
- web_search: use whenever the question requires up-to-date information, real-world facts, recent events, prices, weather, sports, news, or specific verifiable claims.
- Do NOT use web_search for math, coding logic, opinions, follow-ups that don't need new data, or knowledge known to be stable.

Formatting:
- Plain prose by default. Markdown lists only when the answer is genuinely list-shaped (≥3 parallel items).
- Fenced code blocks with the correct language tag for any code.
- Inline `code` for short snippets, command names, or filenames.
- No emojis in serious answers; sparing use in playful exchanges."#;

/// Personality preset selected in Settings. Each appends a short directive
/// to BASE_PROMPT instead of replacing it — the 1-10 sentence rule and the
/// "never break character" rule always apply.
fn system_prompt_for(personality: Option<&str>) -> String {
    let extra = match personality.unwrap_or("default") {
        "brief" => Some(
            "STYLE OVERRIDE: Be especially terse. Cap at 3 sentences for almost everything. \
             One-line answers are great when the question allows. Skip explanations \
             unless the user asks for them.",
        ),
        "tutor" => Some(
            "STYLE OVERRIDE: Adopt a patient teaching tone. Use the upper end of the \
             1-10 sentence range (4-7 sentences). Briefly explain the why, not just the \
             what. End with one short follow-up suggestion when relevant. Stay encouraging \
             without being sycophantic.",
        ),
        "friend" => Some(
            "STYLE OVERRIDE: Lean more casual and warm. Light humor is welcome (still no \
             exclamation marks unless they used one). Contractions throughout. \
             Occasionally riff briefly on the question before answering — but never longer \
             than the answer itself.",
        ),
        _ => None,
    };
    match extra {
        Some(s) => format!("{BASE_PROMPT}\n\n{s}"),
        None => BASE_PROMPT.to_string(),
    }
}


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatChunk {
    Start { id: String },
    TextDelta { text: String },
    ToolUse { name: String },
    Citation { url: String, title: String },
    Done,
    Error { message: String },
}

/// Top-level chat command. Routes to Anthropic Claude (cloud) or Ollama
/// (local) based on the `provider` argument from the renderer. Defaults
/// to Anthropic for back-compat.
#[tauri::command]
pub async fn stream_chat(
    app: AppHandle,
    request_id: String,
    messages: Vec<ChatMessage>,
    personality: Option<String>,
    provider: Option<String>,
    ollama_model: Option<String>,
    ollama_url: Option<String>,
) -> Result<(), String> {
    match provider.as_deref().unwrap_or("anthropic") {
        "ollama" => {
            stream_chat_ollama(
                app,
                request_id,
                messages,
                personality,
                ollama_model.unwrap_or_else(|| "llama3.2".to_string()),
                ollama_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
            )
            .await
        }
        _ => stream_chat_anthropic(app, request_id, messages, personality).await,
    }
}

async fn stream_chat_anthropic(
    app: AppHandle,
    request_id: String,
    messages: Vec<ChatMessage>,
    personality: Option<String>,
) -> Result<(), String> {
    let api_key = keychain::get_key("anthropic")
        .ok_or_else(|| "No Anthropic API key. Set one in Settings.".to_string())?;
    let system = system_prompt_for(personality.as_deref());

    let request_body = serde_json::json!({
        "model": "claude-opus-4-7",
        "max_tokens": 800,
        "stream": true,
        "system": system,
        "messages": messages,
        // First-party web search — lets ASH answer questions about recent
        // events, weather, prices, sports, news, etc. with citations.
        // The model decides when to call it; we cap at 3 uses per turn so a
        // confused chain of searches can't burn a token budget.
        "tools": [
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 3
            }
        ],
    });

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let msg = format!("Anthropic {status}: {body}");
        let _ = app.emit(
            &format!("chat-chunk:{request_id}"),
            ChatChunk::Error { message: msg.clone() },
        );
        return Err(msg);
    }

    let _ = app.emit(
        &format!("chat-chunk:{request_id}"),
        ChatChunk::Start {
            id: request_id.clone(),
        },
    );

    let abort_flag = register_abort(&request_id);
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut cancelled = false;

    while let Some(item) = stream.next().await {
        // Cooperative cancellation — set by the abort_chat command when the
        // user hides the window, hits Esc, or starts a new chat.
        if abort_flag.load(Ordering::SeqCst) {
            cancelled = true;
            break;
        }

        let bytes = match item {
            Ok(b) => b,
            Err(e) => {
                let _ = app.emit(
                    &format!("chat-chunk:{request_id}"),
                    ChatChunk::Error {
                        message: format!("Stream error: {e}"),
                    },
                );
                release_abort(&request_id);
                return Err(format!("Stream error: {e}"));
            }
        };
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(idx) = buffer.find("\n\n") {
            let raw_event = buffer[..idx].to_string();
            buffer.drain(..=idx + 1);
            handle_sse_event(&app, &request_id, &raw_event);
        }
    }

    release_abort(&request_id);
    // We drop `stream` and `resp` here — the underlying reqwest body is
    // closed, which signals the server to stop billing.
    drop(stream);

    if cancelled {
        // Surface a distinct event so the renderer can mark the message as
        // "stopped" instead of "complete".
        let _ = app.emit(
            &format!("chat-chunk:{request_id}"),
            ChatChunk::Error {
                message: "ABORTED".to_string(),
            },
        );
    } else {
        let _ = app.emit(&format!("chat-chunk:{request_id}"), ChatChunk::Done);
    }
    Ok(())
}

fn handle_sse_event(app: &AppHandle, request_id: &str, raw: &str) {
    let mut data = String::new();
    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("data: ") {
            data.push_str(rest);
        }
    }
    if data.is_empty() {
        return;
    }
    let json: serde_json::Value = match serde_json::from_str(&data) {
        Ok(v) => v,
        Err(_) => return,
    };
    let kind = json.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match kind {
        "content_block_delta" => {
            let Some(delta) = json.get("delta") else { return };
            let delta_type = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");
            match delta_type {
                "text_delta" => {
                    if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                        let _ = app.emit(
                            &format!("chat-chunk:{request_id}"),
                            ChatChunk::TextDelta {
                                text: text.to_string(),
                            },
                        );
                    }
                }
                // web_search and other server tools attach citations to text
                // blocks as they stream. Each citation has url + title.
                "citations_delta" => {
                    if let Some(citation) = delta.get("citation") {
                        let url = citation
                            .get("url")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let title = citation
                            .get("title")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        if !url.is_empty() {
                            let _ = app.emit(
                                &format!("chat-chunk:{request_id}"),
                                ChatChunk::Citation { url, title },
                            );
                        }
                    }
                }
                _ => {}
            }
        }
        "content_block_start" => {
            let Some(cb) = json.get("content_block") else { return };
            let cb_type = cb.get("type").and_then(|v| v.as_str()).unwrap_or("");
            match cb_type {
                // Client-side tool call (we don't have any of these yet).
                "tool_use" | "server_tool_use" => {
                    if let Some(name) = cb.get("name").and_then(|v| v.as_str()) {
                        let _ = app.emit(
                            &format!("chat-chunk:{request_id}"),
                            ChatChunk::ToolUse {
                                name: name.to_string(),
                            },
                        );
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

// ─── Ollama backend ───────────────────────────────────────────────────────
//
// Ollama runs locally at http://localhost:11434 by default. The chat API
// returns newline-delimited JSON — simpler than Anthropic's SSE, just
// readline + parse each line.
//
// Tools (web_search) are intentionally off here. Most local models don't
// support function calling well, and there's no first-party web tool. The
// system prompt is still applied so personality + length rules carry over.

async fn stream_chat_ollama(
    app: AppHandle,
    request_id: String,
    messages: Vec<ChatMessage>,
    personality: Option<String>,
    model: String,
    base_url: String,
) -> Result<(), String> {
    let system = system_prompt_for(personality.as_deref());

    // Ollama wants a single "messages" array with the system message
    // prepended as a "system" role. Translate from our internal shape.
    let mut ollama_messages = vec![serde_json::json!({
        "role": "system",
        "content": system,
    })];
    for m in &messages {
        ollama_messages.push(serde_json::json!({
            "role": m.role,
            "content": m.content,
        }));
    }

    let request_body = serde_json::json!({
        "model": model,
        "messages": ollama_messages,
        "stream": true,
        "options": {
            "num_predict": 800,
        },
    });

    let client = reqwest::Client::new();
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let resp = match client.post(&url).json(&request_body).send().await {
        Ok(r) => r,
        Err(e) => {
            let msg = if e.is_connect() {
                "OLLAMA_UNREACHABLE: Ollama isn't running. Start it with `ollama serve` or install it from ollama.com.".to_string()
            } else {
                format!("Ollama network error: {e}")
            };
            let _ = app.emit(
                &format!("chat-chunk:{request_id}"),
                ChatChunk::Error { message: msg.clone() },
            );
            return Err(msg);
        }
    };

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        let msg = if body.contains("model") && status.as_u16() == 404 {
            format!(
                "OLLAMA_MODEL_MISSING: Model '{model}' isn't pulled. Run `ollama pull {model}` and retry.",
            )
        } else {
            format!("Ollama {status}: {body}")
        };
        let _ = app.emit(
            &format!("chat-chunk:{request_id}"),
            ChatChunk::Error { message: msg.clone() },
        );
        return Err(msg);
    }

    let _ = app.emit(
        &format!("chat-chunk:{request_id}"),
        ChatChunk::Start {
            id: request_id.clone(),
        },
    );

    let abort_flag = register_abort(&request_id);
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut cancelled = false;

    while let Some(item) = stream.next().await {
        if abort_flag.load(Ordering::SeqCst) {
            cancelled = true;
            break;
        }
        let bytes = match item {
            Ok(b) => b,
            Err(e) => {
                let _ = app.emit(
                    &format!("chat-chunk:{request_id}"),
                    ChatChunk::Error { message: format!("Stream error: {e}") },
                );
                release_abort(&request_id);
                return Err(format!("Stream error: {e}"));
            }
        };
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        // Ollama uses newline-delimited JSON (one full JSON object per line).
        while let Some(nl) = buffer.find('\n') {
            let line = buffer[..nl].to_string();
            buffer.drain(..=nl);
            if line.trim().is_empty() {
                continue;
            }
            let Ok(json): Result<serde_json::Value, _> = serde_json::from_str(&line) else {
                continue;
            };
            if let Some(content) = json
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
            {
                if !content.is_empty() {
                    let _ = app.emit(
                        &format!("chat-chunk:{request_id}"),
                        ChatChunk::TextDelta { text: content.to_string() },
                    );
                }
            }
            if json.get("done").and_then(|d| d.as_bool()) == Some(true) {
                break;
            }
        }
    }

    release_abort(&request_id);
    drop(stream);

    if cancelled {
        let _ = app.emit(
            &format!("chat-chunk:{request_id}"),
            ChatChunk::Error { message: "ABORTED".to_string() },
        );
    } else {
        let _ = app.emit(&format!("chat-chunk:{request_id}"), ChatChunk::Done);
    }
    Ok(())
}

/// Probe whether the local Ollama daemon is reachable. Returns a list of
/// available model names if so; empty list if Ollama is running but no
/// models are pulled; Err with a typed code if Ollama isn't reachable.
#[tauri::command]
pub async fn ollama_status(base_url: Option<String>) -> Result<Vec<String>, String> {
    let base = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let url = format!("{}/api/tags", base.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| {
        if e.is_connect() {
            "OLLAMA_UNREACHABLE".to_string()
        } else {
            format!("Ollama probe failed: {e}")
        }
    })?;
    if !resp.status().is_success() {
        return Err(format!("Ollama probe HTTP {}", resp.status()));
    }
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Ollama probe parse: {e}"))?;
    let models = body
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    m.get("name")
                        .and_then(|n| n.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(models)
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    keychain::set_key(&provider, &key)
}

#[tauri::command]
pub fn has_api_key(provider: String) -> bool {
    keychain::get_key(&provider).is_some()
}

#[tauri::command]
pub fn clear_api_key(provider: String) -> Result<(), String> {
    keychain::delete_key(&provider)
}

mod chat;
mod keychain;
mod transcribe;

use std::sync::Mutex;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, State,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Default hotkey suggestion per platform.
#[cfg(target_os = "macos")]
const DEFAULT_HOTKEY_LABEL: &str = "Alt+Space";
#[cfg(not(target_os = "macos"))]
const DEFAULT_HOTKEY_LABEL: &str = "Ctrl+Space";

fn default_shortcut() -> Shortcut {
    #[cfg(target_os = "macos")]
    {
        Shortcut::new(Some(Modifiers::ALT), Code::Space)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Shortcut::new(Some(Modifiers::CONTROL), Code::Space)
    }
}

/// Tracks the currently-registered global hotkey so we can unregister before
/// binding a new one.
#[derive(Default)]
struct HotkeyState {
    current: Mutex<Option<Shortcut>>,
}

fn toggle_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
                let _ = app.emit("summon-hidden", ());
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
                let _ = app.emit("summon-shown", ());
            }
        }
    }
}

#[tauri::command]
fn show_summon(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = app.emit("summon-shown", ());
    }
}

#[tauri::command]
fn hide_summon(app: AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
        let _ = app.emit("summon-hidden", ());
    }
}

/// Called when the user clicks "Start ASH" at the end of onboarding,
/// AND on every subsequent launch where they're already onboarded.
///
/// - `first_time = true` → center the window (user is seeing ASH for the
///   first time, no remembered position).
/// - `first_time = false` → trust the saved position from
///   tauri-plugin-window-state; only adjust size + overlay flags.
#[tauri::command]
fn complete_onboarding(app: AppHandle, first_time: Option<bool>) -> Result<(), String> {
    let Some(win) = app.get_webview_window("main") else {
        // The "main" window should always exist by the time this is called
        // from React. If it doesn't, that's a real problem worth surfacing.
        return Err("main window not found".into());
    };
    let first = first_time.unwrap_or(false);

    // Compact floating ASH: just enough room for the mascot + pill.
    let _ = win.set_size(LogicalSize::new(380.0, 440.0));
    let _ = win.set_always_on_top(true);
    let _ = win.set_skip_taskbar(true);
    if first {
        let _ = win.center();
    }
    let _ = win.show();
    let _ = win.set_focus();
    let _ = app.emit("onboarding-complete", ());
    let _ = app.emit("summon-shown", ());
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn default_hotkey_label() -> String {
    DEFAULT_HOTKEY_LABEL.to_string()
}

/// Parse a frontend-supplied hotkey string into a Tauri Shortcut.
fn parse_hotkey(input: &str) -> Option<Shortcut> {
    let mut modifiers = Modifiers::empty();
    let mut code: Option<Code> = None;
    for raw in input.split('+') {
        let part = raw.trim();
        if part.is_empty() {
            continue;
        }
        let upper = part.to_uppercase();
        match upper.as_str() {
            "CMD" | "COMMAND" | "META" | "SUPER" => modifiers |= Modifiers::SUPER,
            "CTRL" | "CONTROL" => modifiers |= Modifiers::CONTROL,
            "ALT" | "OPTION" | "OPT" => modifiers |= Modifiers::ALT,
            "SHIFT" => modifiers |= Modifiers::SHIFT,
            other => {
                code = key_code(other);
            }
        }
    }
    let key = code?;
    if modifiers.is_empty() {
        return None;
    }
    Some(Shortcut::new(Some(modifiers), key))
}

fn key_code(name: &str) -> Option<Code> {
    Some(match name {
        "A" => Code::KeyA, "B" => Code::KeyB, "C" => Code::KeyC, "D" => Code::KeyD,
        "E" => Code::KeyE, "F" => Code::KeyF, "G" => Code::KeyG, "H" => Code::KeyH,
        "I" => Code::KeyI, "J" => Code::KeyJ, "K" => Code::KeyK, "L" => Code::KeyL,
        "M" => Code::KeyM, "N" => Code::KeyN, "O" => Code::KeyO, "P" => Code::KeyP,
        "Q" => Code::KeyQ, "R" => Code::KeyR, "S" => Code::KeyS, "T" => Code::KeyT,
        "U" => Code::KeyU, "V" => Code::KeyV, "W" => Code::KeyW, "X" => Code::KeyX,
        "Y" => Code::KeyY, "Z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2,
        "3" => Code::Digit3, "4" => Code::Digit4, "5" => Code::Digit5,
        "6" => Code::Digit6, "7" => Code::Digit7, "8" => Code::Digit8,
        "9" => Code::Digit9,
        "SPACE" => Code::Space,
        "ENTER" | "RETURN" => Code::Enter,
        "TAB" => Code::Tab,
        "ESC" | "ESCAPE" => Code::Escape,
        "BACKQUOTE" | "GRAVE" | "`" => Code::Backquote,
        "MINUS" | "-" => Code::Minus,
        "EQUAL" | "=" => Code::Equal,
        "BRACKETLEFT" | "[" => Code::BracketLeft,
        "BRACKETRIGHT" | "]" => Code::BracketRight,
        "BACKSLASH" | "\\" => Code::Backslash,
        "SEMICOLON" | ";" => Code::Semicolon,
        "QUOTE" | "'" => Code::Quote,
        "COMMA" | "," => Code::Comma,
        "PERIOD" | "." => Code::Period,
        "SLASH" | "/" => Code::Slash,
        "ARROWUP" | "UP" => Code::ArrowUp,
        "ARROWDOWN" | "DOWN" => Code::ArrowDown,
        "ARROWLEFT" | "LEFT" => Code::ArrowLeft,
        "ARROWRIGHT" | "RIGHT" => Code::ArrowRight,
        "F1" => Code::F1, "F2" => Code::F2, "F3" => Code::F3, "F4" => Code::F4,
        "F5" => Code::F5, "F6" => Code::F6, "F7" => Code::F7, "F8" => Code::F8,
        "F9" => Code::F9, "F10" => Code::F10, "F11" => Code::F11, "F12" => Code::F12,
        _ => return None,
    })
}

#[tauri::command]
fn register_hotkey(
    app: AppHandle,
    state: State<'_, HotkeyState>,
    combo: String,
) -> Result<(), String> {
    let new_sc = parse_hotkey(&combo)
        .ok_or_else(|| format!("Couldn't parse hotkey '{combo}'. Need at least one modifier + one key."))?;

    let shortcut_mgr = app.global_shortcut();
    let mut guard = state.current.lock().map_err(|e| e.to_string())?;

    if let Some(prev) = guard.take() {
        let _ = shortcut_mgr.unregister(prev);
    }

    shortcut_mgr.register(new_sc).map_err(|e| {
        // On macOS, the most common cause of registration failure is missing
        // Accessibility permission. Surface a typed error so the React layer
        // can show the "Grant Accessibility" prompt instead of a raw message.
        let raw = e.to_string();
        #[cfg(target_os = "macos")]
        {
            if raw.to_lowercase().contains("accessibility")
                || raw.to_lowercase().contains("permission")
                || raw.to_lowercase().contains("denied")
            {
                return format!("ACCESSIBILITY_DENIED: {raw}");
            }
        }
        format!("Registration failed: {raw}")
    })?;

    *guard = Some(new_sc);
    Ok(())
}

/// Open macOS System Settings → Privacy & Security → Accessibility so the
/// user can enable the hotkey permission. No-op on non-macOS.
#[tauri::command]
fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .map_err(|e| format!("Couldn't open System Settings: {e}"))?;
    }
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "Open ASH", true, None::<&str>)?;
    let new_chat_item = MenuItem::with_id(app, "new-chat", "New chat", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open_item, &new_chat_item, &settings_item, &quit_item],
    )?;

    let _tray = TrayIconBuilder::with_id("ash-tray")
        .tooltip("ASH")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    let _ = app.emit("summon-shown", ());
                }
            }
            "new-chat" => {
                let _ = app.emit("new-chat", ());
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    let _ = app.emit("summon-shown", ());
                }
            }
            "settings" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
                let _ = app.emit("open-settings", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_main(app);
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hotkey_state = HotkeyState::default();

    let mut builder = tauri::Builder::default()
        .manage(hotkey_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));

    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let state = app.state::<HotkeyState>();
                    let matches = {
                        let guard = state.current.lock();
                        match guard {
                            Ok(g) => g.as_ref().map(|cur| cur == sc).unwrap_or(false),
                            Err(_) => false,
                        }
                    };
                    if matches {
                        toggle_main(app);
                    }
                })
                .build(),
        );
    }

    builder
        .invoke_handler(tauri::generate_handler![
            show_summon,
            hide_summon,
            complete_onboarding,
            quit_app,
            default_hotkey_label,
            register_hotkey,
            open_accessibility_settings,
            chat::stream_chat,
            chat::abort_chat,
            chat::ollama_status,
            chat::set_api_key,
            chat::has_api_key,
            chat::clear_api_key,
            transcribe::transcribe,
            transcribe::has_whisper_model,
            transcribe::download_whisper_model,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(e) = build_tray(&handle) {
                log::error!("tray init failed: {e}");
            }

            // Register the default hotkey at boot so it works as soon as
            // onboarding completes (or if the user re-runs after onboarding).
            #[cfg(desktop)]
            {
                let sc = default_shortcut();
                if handle.global_shortcut().register(sc).is_ok() {
                    let state = handle.state::<HotkeyState>();
                    let mut g = state
                        .current
                        .lock()
                        .expect("hotkey state mutex poisoned");
                    *g = Some(sc);
                }
            }

            // Stay a proper app (Dock icon, Cmd+Tab presence) instead of a
            // hidden menu-bar accessory. The user can right-click the Dock
            // icon to access the same options as the menu-bar tray.
            #[cfg(target_os = "macos")]
            {
                let _ = handle.set_activation_policy(tauri::ActivationPolicy::Regular);
            }

            // If a key is already configured, switch the window to overlay
            // dimensions but keep it visible — the React layer will detect
            // hasOnboarded and render the summon view directly.
            if keychain::get_key("anthropic").is_some() {
                if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.set_size(LogicalSize::new(380.0, 440.0));
                    let _ = win.set_always_on_top(true);
                    let _ = win.set_skip_taskbar(true);
                    let _ = win.center();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.emit("summon-hidden", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ASH");
}

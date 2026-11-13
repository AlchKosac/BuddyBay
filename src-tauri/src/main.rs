#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

use tauri::{Manager, PhysicalPosition};

const ISLAND_WIDTH_LOGICAL: f64 = 460.0;

/// Lokalni Ollama server (chat API) a model pro agenta.
const OLLAMA_CHAT_URL: &str = "http://localhost:11434/api/chat";
const OLLAMA_MODEL: &str = "llama3.1:8b";

/// Cloud poskytovatel (Anthropic Messages API). Klic se cte z promenne prostredi,
/// nikdy se neuklada do repozitare ani do profilu.
const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL: &str = "claude-sonnet-5-5";
const ANTHROPIC_KEY_ENV: &str = "ANTHROPIC_API_KEY";

/// Systemova instrukce pro vsechny poskytovatele: cestina a pevny kontext,
/// aby modely nehalucinovaly (napr. MCP = Model Context Protocol).
const SYSTEM_PROMPT: &str = "Jsi BuddyBay, maly asistent v plovoucim ostrovu na ploše. \
Odpovídej vždy česky, stručně (1-3 věty), bez anglických slov pokud o ně nejde. \
MCP znamená Model Context Protocol, otevřený protokol pro připojení nástrojů a dat k AI modelům. \
Pokud si nejsi jistý, řekni to a neizmýšlej si fakta.";

const REQUEST_TIMEOUT_SECS: u64 = 120;

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())
}

async fn ask_ollama(prompt: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "model": OLLAMA_MODEL,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": prompt }
        ],
        "stream": false
    });

    let resp = http_client()?
        .post(OLLAMA_CHAT_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama není dostupná: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama vrátila stav {}", resp.status()));
    }

    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    value["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Neočekávaná odpověď od Ollamy".to_string())
}

async fn ask_anthropic(prompt: &str) -> Result<String, String> {
    let key = std::env::var(ANTHROPIC_KEY_ENV)
        .map_err(|_| format!("Chybí proměnná prostředí {ANTHROPIC_KEY_ENV}"))?;

    let body = serde_json::json!({
        "model": ANTHROPIC_MODEL,
        "max_tokens": 512,
        "system": SYSTEM_PROMPT,
        "messages": [{ "role": "user", "content": prompt }]
    });

    let resp = http_client()?
        .post(ANTHROPIC_URL)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Cloud API není dostupné: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Cloud API vrátilo stav {}", resp.status()));
    }

    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    value["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Neočekávaná odpověď od cloud API".to_string())
}

/// Posle zadani uzivatele zvolenemu poskytovateli a vrati text odpovedi.
/// Volani jde z Rustu, takze nevadi CORS webview.
#[tauri::command]
async fn ask_agent(prompt: String, provider: String) -> Result<String, String> {
    match provider.as_str() {
        "anthropic" => ask_anthropic(&prompt).await,
        _ => ask_ollama(&prompt).await,
    }
}

/// Umisti ostrov nahoru doprostred aktualniho monitoru.
fn place_top_center(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()? {
        let scale = monitor.scale_factor();
        let mon_pos = monitor.position();
        let mon_size = monitor.size();
        let width_px = (ISLAND_WIDTH_LOGICAL * scale) as i32;
        let x = mon_pos.x + (mon_size.width as i32 - width_px) / 2;
        let y = mon_pos.y;
        window.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                place_top_center(&window)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ask_agent])
        .run(tauri::generate_context!())
        .expect("chyba pri spusteni BuddyBay");
}

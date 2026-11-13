#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

use tauri::{Manager, PhysicalPosition};

const ISLAND_WIDTH_LOGICAL: f64 = 460.0;

/// Lokalni Ollama server (chat API) a model pro agenta.
const OLLAMA_CHAT_URL: &str = "http://localhost:11434/api/chat";
const OLLAMA_MODEL: &str = "llama3.1:8b";

/// Posle zadani uzivatele lokalnimu modelu a vrati text odpovedi.
/// Volani jde z Rustu, takze nevadi CORS webview.
#[tauri::command]
async fn ask_agent(prompt: String) -> Result<String, String> {
    let body = serde_json::json!({
        "model": OLLAMA_MODEL,
        "messages": [{ "role": "user", "content": prompt }],
        "stream": false
    });

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(OLLAMA_CHAT_URL)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama neni dostupna: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama vratila stav {}", resp.status()));
    }

    let value: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    value["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Neocekavana odpoved od Ollamy".to_string())
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

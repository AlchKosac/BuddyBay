#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{Manager, PhysicalPosition};

const ISLAND_WIDTH_LOGICAL: f64 = 460.0;

/// Systemovy prompt pro vsechny poskytovatele: cestina, pevny kontext, znacka nalady.
const SYSTEM_PROMPT: &str = "Jsi BuddyBay, maly asistent v plovoucim ostrovu na ploše. \
Odpovídej vždy česky, stručně (1-3 věty), bez anglických slov pokud o ně nejde. \
MCP znamená Model Context Protocol, otevřený protokol pro připojení nástrojů a dat k AI modelům. \
Pokud si nejsi jistý, řekni to a neizmýšlej si fakta. \
Na úplný konec odpovědi připoj přesně jednu značku nálady ve tvaru [nalada:X], kde X je jedno z: \
happy (radost, nadšení), sad (smutek, lítost), surprised (překvapení), angry (naštvání), \
sleepy (únava, nuda), thinking (přemýšlení, nejistota), wink (vtip, žert, mrknutí). \
Značku nezmiňuj v textu a nevysvětluj ji.";

/// Parametry pripojeni jednoho buddy. Tajemstvi (klic) se nikdy neposila z frontendu,
/// jen nazev promenne prostredi, ze ktere se klic cte.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    /// "ollama" | "anthropic" | "openai" (OpenAI-kompatibilni: LM Studio, llama.cpp, OpenRouter...)
    pub provider: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key_env: String,
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Doplnujici instrukce za vychozi systemovy prompt (volitelne).
    #[serde(default)]
    pub system_prompt: String,
}

fn default_temperature() -> f32 { 0.7 }
fn default_max_tokens() -> u32 { 512 }
fn default_timeout() -> u64 { 120 }

#[derive(Serialize)]
pub struct SystemTheme {
    pub dark: bool,
    pub accent: String,
}

fn http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.max(5)))
        .build()
        .map_err(|e| e.to_string())
}

fn api_key(config: &AgentConfig) -> Result<Option<String>, String> {
    if config.api_key_env.trim().is_empty() {
        return Ok(None);
    }
    std::env::var(config.api_key_env.trim())
        .map(Some)
        .map_err(|_| format!("Environment variable {} is not set", config.api_key_env.trim()))
}

fn system_text(config: &AgentConfig) -> String {
    let extra = config.system_prompt.trim();
    if extra.is_empty() {
        SYSTEM_PROMPT.to_string()
    } else {
        format!("{SYSTEM_PROMPT}\n\n{extra}")
    }
}

fn base(config: &AgentConfig) -> &str {
    config.base_url.trim_end_matches('/')
}

async fn ask_ollama(config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "model": config.model,
        "messages": [
            { "role": "system", "content": system_text(config) },
            { "role": "user", "content": prompt }
        ],
        "stream": false,
        "options": { "temperature": config.temperature, "num_predict": config.max_tokens }
    });
    let resp = http_client(config.timeout_secs)?
        .post(format!("{}/api/chat", base(config)))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama is not reachable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Unexpected response from Ollama".to_string())
}

async fn ask_anthropic(config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let key = match api_key(config)? {
        Some(k) => k,
        None => std::env::var("ANTHROPIC_API_KEY").map_err(|_| "Environment variable ANTHROPIC_API_KEY is not set".to_string())?,
    };
    let body = serde_json::json!({
        "model": config.model,
        "max_tokens": config.max_tokens,
        "temperature": config.temperature,
        "system": system_text(config),
        "messages": [{ "role": "user", "content": prompt }]
    });
    let resp = http_client(config.timeout_secs)?
        .post(format!("{}/v1/messages", base(config)))
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Cloud API is not reachable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Cloud API returned status {}", resp.status()));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["content"][0]["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Unexpected response from the cloud API".to_string())
}

async fn ask_openai(config: &AgentConfig, prompt: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "model": config.model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "messages": [
            { "role": "system", "content": system_text(config) },
            { "role": "user", "content": prompt }
        ]
    });
    let mut req = http_client(config.timeout_secs)?
        .post(format!("{}/chat/completions", base(config)))
        .json(&body);
    if let Some(key) = api_key(config)? {
        req = req.bearer_auth(key);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Server is not reachable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Server returned status {}", resp.status()));
    }
    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    v["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Unexpected response from the server".to_string())
}

/// Posle zadani uzivatele podle parametru pripojeni a vrati text odpovedi (vcetne znacky nalady).
#[tauri::command]
async fn ask_agent(prompt: String, config: AgentConfig) -> Result<String, String> {
    match config.provider.as_str() {
        "anthropic" => ask_anthropic(&config, &prompt).await,
        "openai" => ask_openai(&config, &prompt).await,
        _ => ask_ollama(&config, &prompt).await,
    }
}

/// Seznam modelu pro dany server (Ollama /api/tags, OpenAI-kompatibilni /models).
#[tauri::command]
async fn list_models(config: AgentConfig) -> Result<Vec<String>, String> {
    let client = http_client(config.timeout_secs.min(15))?;
    match config.provider.as_str() {
        "anthropic" => Ok(vec![
            "claude-sonnet-5-5".into(),
            "claude-opus-5-5".into(),
            "claude-haiku-5-5".into(),
        ]),
        "openai" => {
            let mut req = client.get(format!("{}/models", base(&config)));
            if let Some(key) = api_key(&config)? {
                req = req.bearer_auth(key);
            }
            let v: serde_json::Value = req
                .send()
                .await
                .map_err(|e| format!("Server is not reachable: {e}"))?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            Ok(v["data"]
                .as_array()
                .map(|a| a.iter().filter_map(|m| m["id"].as_str().map(String::from)).collect())
                .unwrap_or_default())
        }
        _ => {
            let v: serde_json::Value = client
                .get(format!("{}/api/tags", base(&config)))
                .send()
                .await
                .map_err(|e| format!("Ollama is not reachable: {e}"))?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            Ok(v["models"]
                .as_array()
                .map(|a| a.iter().filter_map(|m| m["name"].as_str().map(String::from)).collect())
                .unwrap_or_default())
        }
    }
}

/// Svetly/tmavy rezim a barva zvyraznění z Windows (HKCU). Mimo Windows vraci vychozi.
#[tauri::command]
fn get_system_theme() -> SystemTheme {
    let mut theme = SystemTheme { dark: true, accent: "#0078D4".to_string() };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const NO_WINDOW: u32 = 0x0800_0000;
        let query = |key: &str, value: &str| -> Option<String> {
            let out = std::process::Command::new("reg")
                .args(["query", key, "/v", value])
                .creation_flags(NO_WINDOW)
                .output()
                .ok()?;
            let text = String::from_utf8_lossy(&out.stdout).to_string();
            text.lines()
                .find(|l| l.contains(value))
                .and_then(|l| l.split_whitespace().last().map(String::from))
        };
        if let Some(v) = query(r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme") {
            theme.dark = v.trim_start_matches("0x") == "0";
        }
        if let Some(v) = query(r"HKCU\Software\Microsoft\Windows\DWM", "ColorizationColor") {
            let hex = v.trim_start_matches("0x");
            if hex.len() >= 6 {
                theme.accent = format!("#{}", &hex[hex.len() - 6..]).to_uppercase();
            }
        }
    }
    theme
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

const AUTOSTART_NAME: &str = "BuddyBay";
#[cfg(windows)]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

/// Spusti `reg` bez okna konzole.
#[cfg(windows)]
fn reg(args: &[&str]) -> std::io::Result<std::process::Output> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .args(args)
        .creation_flags(0x0800_0000)
        .output()
}

/// Je aplikace nastavena ke spusteni s Windows?
#[tauri::command]
fn get_autostart() -> bool {
    #[cfg(windows)]
    {
        return reg(&["query", RUN_KEY, "/v", AUTOSTART_NAME])
            .map(|o| o.status.success())
            .unwrap_or(false);
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Zapne nebo vypne spusteni s Windows (zapis do HKCU\...\Run).
#[tauri::command]
fn set_autostart(enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let quoted = format!("\"{}\"", exe.display());
            let out = reg(&["add", RUN_KEY, "/v", AUTOSTART_NAME, "/t", "REG_SZ", "/d", &quoted, "/f"])
                .map_err(|e| e.to_string())?;
            if !out.status.success() {
                return Err("Could not write to the registry".to_string());
            }
        } else {
            // Kdyz zaznam neexistuje, reg vrati chybu; to je v poradku.
            let _ = reg(&["delete", RUN_KEY, "/v", AUTOSTART_NAME, "/f"]);
        }
        Ok(enabled)
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Start with Windows is available on Windows only".to_string())
    }
}

/// Cesta k zastupci ("desktop" = plocha, "startmenu" = nabidka Start).
#[cfg(windows)]
fn shortcut_path(kind: &str) -> Result<std::path::PathBuf, String> {
    use std::os::windows::process::CommandExt;
    let folder = match kind {
        "desktop" => "Desktop",
        "startmenu" => "Programs",
        _ => return Err("Unknown shortcut location".to_string()),
    };
    let out = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &format!("[Environment]::GetFolderPath('{folder}')")])
        .creation_flags(0x0800_0000)
        .output()
        .map_err(|e| e.to_string())?;
    let dir = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if dir.is_empty() {
        return Err("Could not find the folder".to_string());
    }
    Ok(std::path::PathBuf::from(dir).join("BuddyBay.lnk"))
}

/// Je zastupce na ploše / v nabidce Start?
#[tauri::command]
fn get_shortcut(kind: String) -> bool {
    #[cfg(windows)]
    {
        return shortcut_path(&kind).map(|p| p.exists()).unwrap_or(false);
    }
    #[cfg(not(windows))]
    {
        let _ = kind;
        false
    }
}

/// Vytvori nebo smaze zastupce (.lnk) pres WScript.Shell.
#[tauri::command]
fn set_shortcut(kind: String, enabled: bool) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let lnk = shortcut_path(&kind)?;
        if !enabled {
            let _ = std::fs::remove_file(&lnk);
            return Ok(false);
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let script = "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:BB_LNK); \
            $s.TargetPath = $env:BB_EXE; \
            $s.WorkingDirectory = Split-Path $env:BB_EXE; \
            $s.IconLocation = $env:BB_EXE + ',0'; \
            $s.Description = 'BuddyBay'; \
            $s.Save()";
        let out = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", script])
            .env("BB_LNK", lnk.display().to_string())
            .env("BB_EXE", exe.display().to_string())
            .creation_flags(0x0800_0000)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() || !lnk.exists() {
            return Err("Could not create the shortcut".to_string());
        }
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = (kind, enabled);
        Err("Shortcuts are available on Windows only".to_string())
    }
}

/// Zkontroluje novou verzi na GitHubu; kdyz je, stahne, nainstaluje a restartuje aplikaci.
#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => {
            let version = update.version.clone();
            update
                .download_and_install(|_, _| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            println!("Installed version {version}, restarting");
            app.restart();
        }
        None => Ok("You already have the latest version".to_string()),
    }
}

/// Ukonci aplikaci (ostrov zmizi).
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                place_top_center(&window)?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            ask_agent,
            list_models,
            get_system_theme,
            get_autostart,
            set_autostart,
            get_shortcut,
            set_shortcut,
            quit_app,
            check_update
        ])
        .run(tauri::generate_context!())
        .expect("chyba pri spusteni BuddyBay");
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, PhysicalPosition};

const ISLAND_WIDTH_LOGICAL: f64 = 460.0;

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
        .run(tauri::generate_context!())
        .expect("chyba pri spusteni BuddyBay");
}

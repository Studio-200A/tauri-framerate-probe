use std::path::PathBuf;
mod frame_preference;
static RELOAD_PREPARED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn auto_run() -> bool {
    std::env::args().any(|arg| arg == "--auto")
}

#[tauri::command]
async fn runtime_info(window: tauri::WebviewWindow) -> Result<serde_json::Value, String> {
    let reload_requested = std::env::args().any(|arg| arg == "--reload-after-setting");
    let reload_before_sampling =
        reload_requested && !RELOAD_PREPARED.swap(true, std::sync::atomic::Ordering::SeqCst);
    let preference = std::env::args()
        .find_map(|arg| arg.strip_prefix("--near60=").map(str::to_owned))
        .unwrap_or_else(|| "default".into());
    let (tx, rx) = std::sync::mpsc::channel();
    window.with_webview(move |webview| {
        use gtk::prelude::*;
        use webkit2gtk::WebViewExt;
        let result = WebViewExt::settings(&webview.inner()).ok_or_else(|| "WebKit settings unavailable".to_string())
            .and_then(|settings| frame_preference::configure(&settings, &preference))
            .map(|feature| serde_json::json!({
                "gdkDisplayType": gtk::gdk::Display::default().map(|display| display.type_().name().to_string()),
                "requestedBackend": std::env::var("GDK_BACKEND").ok(),
                "sessionType": std::env::var("XDG_SESSION_TYPE").ok(),
                "tauriVersion": tauri::VERSION,
                "near60Feature": feature,
                "reloadBeforeSampling": reload_before_sampling,
                "configuredBeforeDocumentReload": reload_requested && !reload_before_sampling,
            }));
        let _ = tx.send(result);
    }).map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|e| e.to_string())?
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn finish_auto(app: tauri::AppHandle) {
    if std::env::args().any(|arg| arg == "--exit-after-test") {
        app.exit(0);
    }
}

#[tauri::command]
fn save_result(result: serde_json::Value) -> Result<String, String> {
    let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../results");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let path = directory.join(format!("frames-{stamp}.json"));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    use std::io::Write;
    file.write_all(
        serde_json::to_string_pretty(&result)
            .map_err(|e| e.to_string())?
            .as_bytes(),
    )
    .map_err(|e| e.to_string())?;
    println!("FRAME_PROBE_RESULT {}", path.display());
    Ok(path.display().to_string())
}

fn main() {
    // Set only this process's backend, before GTK initializes or threads start.
    for arg in std::env::args() {
        if let Some(backend) = arg.strip_prefix("--backend=") {
            assert!(
                matches!(backend, "x11" | "wayland"),
                "backend must be x11 or wayland"
            );
            std::env::set_var("GDK_BACKEND", backend);
        }
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_result,
            auto_run,
            runtime_info,
            finish_auto
        ])
        .run(tauri::generate_context!())
        .expect("failed to run frame probe");
}

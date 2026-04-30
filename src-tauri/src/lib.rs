use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Serialize, Clone)]
struct OpenedFile {
    path: String,
    name: String,
    content: String,
}

fn get_file_from_args() -> Option<OpenedFile> {
    let args: Vec<String> = std::env::args().collect();
    let file_path = args.iter().skip(1).find(|arg| !arg.starts_with('-'))?;

    let content = std::fs::read_to_string(file_path).ok()?;
    let name = std::path::Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("untitled.md")
        .to_string();

    Some(OpenedFile {
        path: file_path.clone(),
        name,
        content,
    })
}

#[tauri::command]
fn get_opened_file() -> Option<OpenedFile> {
    get_file_from_args()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[derive(Serialize, Clone)]
struct DirEntry {
    name: String,
    path: String,
    is_directory: bool,
}

#[tauri::command]
fn read_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries = Vec::new();
    let read = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    for item in read {
        let item = item.map_err(|e| e.to_string())?;
        let meta = item.metadata().map_err(|e| e.to_string())?;
        let name = item.file_name().to_string_lossy().to_string();
        entries.push(DirEntry {
            name,
            path: item.path().to_string_lossy().to_string(),
            is_directory: meta.is_dir(),
        });
    }
    Ok(entries)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(file_path) = args.iter().skip(1).find(|a| !a.starts_with('-')) {
                let path = std::path::Path::new(file_path);
                let valid_ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| matches!(e, "md" | "markdown" | "mdx" | "txt"))
                    .unwrap_or(false);
                if valid_ext && path.is_file() {
                    let _ = app.emit("open-file-in-tab", file_path.clone());
                }
            }
            // Focus the existing window.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![get_opened_file, read_file, write_file, read_dir])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Direct-open is handled on the frontend by invoking get_opened_file
            // once the editor is ready. No timed emit — that was race-prone.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

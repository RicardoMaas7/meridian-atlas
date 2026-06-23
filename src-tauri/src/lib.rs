use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceFile {
    pub path: String,
    pub text: String,
    pub lang: String,
}

const SUPPORTED_EXTENSIONS: &[(&str, &[&str])] = &[
    ("typescript", &["ts", "mts", "cts"]),
    ("tsx", &["tsx"]),
    ("javascript", &["js", "jsx", "mjs", "cjs"]),
    ("python", &["py"]),
    ("go", &["go"]),
    ("rust", &["rs"]),
    ("java", &["java"]),
    ("c", &["c"]),
    ("cpp", &["cpp", "cc", "cxx", "hpp", "hh", "h"]),
];

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "dist", "dist-mcp", "build", "out",
    ".next", ".nuxt", "coverage", "vendor", ".cache", ".turbo",
    "target", ".gradle", ".idea", ".vscode",
];

const MAX_FILES: usize = 4000;
const MAX_FILE_BYTES: u64 = 1_500_000;

fn lang_for_path(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    if path.to_str()?.ends_with(".d.ts") {
        return None;
    }
    for (lang, exts) in SUPPORTED_EXTENSIONS {
        if exts.contains(&ext.as_str()) {
            return Some(lang);
        }
    }
    None
}

#[tauri::command]
fn scan_directory(path: String) -> Result<Vec<SourceFile>, String> {
    let root = PathBuf::from(&path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                if let Some(name) = e.file_name().to_str() {
                    return !SKIP_DIRS.contains(&name) && !name.starts_with('.');
                }
            }
            true
        })
    {
        if files.len() >= MAX_FILES {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let lang = match lang_for_path(path) {
            Some(l) => l,
            None => continue,
        };
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if metadata.len() > MAX_FILE_BYTES {
            continue;
        }
        let text = match fs::read_to_string(path) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let relative = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        files.push(SourceFile {
            path: relative,
            text,
            lang: lang.to_string(),
        });
    }
    Ok(files)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "name": "Meridian",
        "platform": std::env::consts::OS,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // File menu
            let open_folder = MenuItemBuilder::new("Open Folder…")
                .id("open_folder")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let view_specimen = MenuItemBuilder::new("View Specimen")
                .id("view_specimen")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let new_chart = MenuItemBuilder::new("New Chart")
                .id("new_chart")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let resurvey = MenuItemBuilder::new("Re-survey")
                .id("resurvey")
                .accelerator("CmdOrCtrl+R")
                .build(app)?;
            let quit = MenuItemBuilder::new("Quit")
                .id("quit")
                .accelerator("CmdOrCtrl+Q")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&open_folder)
                .item(&view_specimen)
                .separator()
                .item(&resurvey)
                .item(&new_chart)
                .separator()
                .item(&quit)
                .build()?;

            // Edit menu (standard)
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            // View menu
            let toggle_devtools = MenuItemBuilder::new("Toggle Devtools")
                .id("toggle_devtools")
                .accelerator("F12")
                .build(app)?;
            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&toggle_devtools)
                .build()?;

            // Help menu
            let about = MenuItemBuilder::new("About Meridian")
                .id("about")
                .build(app)?;
            let help_menu = SubmenuBuilder::new(app, "Help").item(&about).build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Forward menu events to the frontend
            let window = app.get_webview_window("main").unwrap();
            window.on_menu_event(move |app_handle, event| {
                let id = event.id().as_ref();
                if id == "quit" {
                    app_handle.exit(0);
                    return;
                }
                if id == "toggle_devtools" {
                    #[cfg(debug_assertions)]
                    if let Some(w) = app_handle.get_webview_window("main") {
                        if w.is_devtools_open() {
                            w.close_devtools();
                        } else {
                            w.open_devtools();
                        }
                    }
                    return;
                }
                let _ = app_handle.emit("menu", id);
            });

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_directory,
            read_file,
            file_exists,
            get_app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
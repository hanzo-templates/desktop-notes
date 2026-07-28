//! Notes — one `.md` file per note in the OS app-data directory.
//!
//! Files, not a database: the point of a local-first notes app is that the
//! notes outlive the app. Front-matter is a single JSON line so a note stays
//! readable in any editor.

use std::{fs, path::PathBuf};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    id: String,
    title: String,
    body: String,
    updated: i64,
}

fn dir(app: &AppHandle) -> PathBuf {
    let d = app.path().app_data_dir().expect("app data dir").join("notes");
    let _ = fs::create_dir_all(&d);
    d
}

#[tauri::command]
fn notes_dir(app: AppHandle) -> String {
    dir(&app).to_string_lossy().into_owned()
}

#[tauri::command]
fn list_notes(app: AppHandle) -> Vec<Note> {
    let mut out = Vec::new();
    let Ok(rd) = fs::read_dir(dir(&app)) else { return out };
    for e in rd.flatten() {
        let p = e.path();
        if p.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&p) else { continue };
        let (head, body) = raw.split_once('\n').unwrap_or(("", raw.as_str()));
        let meta: serde_json::Value = serde_json::from_str(head.trim_start_matches("<!--").trim_end_matches("-->"))
            .unwrap_or(serde_json::Value::Null);
        out.push(Note {
            id: p.file_stem().unwrap_or_default().to_string_lossy().into_owned(),
            title: meta.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
            updated: meta.get("updated").and_then(|v| v.as_i64()).unwrap_or(0),
            body: body.to_string(),
        });
    }
    out.sort_by_key(|n| -n.updated);
    out
}

#[tauri::command]
fn save_note(app: AppHandle, note: Note) -> Result<(), String> {
    let head = serde_json::json!({ "title": note.title, "updated": note.updated });
    fs::write(
        dir(&app).join(format!("{}.md", note.id)),
        format!("<!--{head}-->\n{}", note.body),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    fs::remove_file(dir(&app).join(format!("{id}.md"))).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![notes_dir, list_notes, save_note, delete_note])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

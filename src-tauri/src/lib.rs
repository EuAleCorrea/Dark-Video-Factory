use std::process::Command;
use serde::Serialize;

#[derive(Serialize)]
pub struct FfmpegResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

#[derive(Serialize)]
pub struct FfmpegInfo {
    pub installed: bool,
    pub version: String,
    pub path: String,
}

/// Check if FFmpeg is available in PATH
#[tauri::command]
fn check_ffmpeg() -> FfmpegInfo {
    match Command::new("ffmpeg").arg("-version").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let version_line = stdout.lines().next().unwrap_or("unknown").to_string();

            // Try to get ffmpeg path
            let path = if cfg!(windows) {
                Command::new("where")
                    .arg("ffmpeg")
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_default()
            } else {
                Command::new("which")
                    .arg("ffmpeg")
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_default()
            };

            FfmpegInfo {
                installed: output.status.success(),
                version: version_line,
                path,
            }
        }
        Err(_) => FfmpegInfo {
            installed: false,
            version: String::new(),
            path: String::new(),
        },
    }
}

/// Execute FFmpeg with given arguments
#[tauri::command]
fn run_ffmpeg(args: Vec<String>) -> FfmpegResult {
    match Command::new("ffmpeg").args(&args).output() {
        Ok(output) => FfmpegResult {
            success: output.status.success(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            exit_code: output.status.code(),
        },
        Err(e) => FfmpegResult {
            success: false,
            stdout: String::new(),
            stderr: format!("Failed to execute ffmpeg: {}", e),
            exit_code: None,
        },
    }
}

/// Write bytes to a file (for saving generated assets)
#[tauri::command]
fn write_file(path: String, content: Vec<u8>) -> Result<(), String> {
    use std::fs::{File, create_dir_all};
    use std::io::Write;
    use std::path::Path;

    let path_obj = Path::new(&path);
    if let Some(parent) = path_obj.parent() {
        create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Read a binary file from filesystem and return its bytes
#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Delete a file from the filesystem (for temp file cleanup)
#[tauri::command]
fn delete_file_cmd(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete '{}': {}", path, e))
    } else {
        Ok(()) // File doesn't exist, nothing to do
    }
}

/// Get OS temp directory path
#[tauri::command]
fn get_temp_dir() -> String {
    std::env::temp_dir()
        .join("DarkVideoFactory")
        .to_string_lossy()
        .to_string()
}

/// Get OS downloads directory path
#[tauri::command]
fn get_downloads_dir() -> String {
    let home = if cfg!(windows) {
        std::env::var("USERPROFILE").unwrap_or_default()
    } else {
        std::env::var("HOME").unwrap_or_default()
    };
    if home.is_empty() {
        return get_temp_dir();
    }
    let sep = if cfg!(windows) { "\\" } else { "/" };
    format!("{}{}Downloads", home, sep)
}

/// Get AppData/Roaming directory for persistent storage
#[tauri::command]
fn get_appdata_dir() -> String {
    if cfg!(windows) {
        std::env::var("APPDATA").unwrap_or_else(|_| {
            let home = std::env::var("USERPROFILE").unwrap_or_default();
            format!("{}\\AppData\\Roaming", home)
        })
    } else {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{}/.config", home)
    }
}

/// Get the project directory (where data/ will be stored).
/// Searches CWD and its parents for the project root (has both src-tauri/ and package.json).
/// In production, falls back to the executable's directory.
#[tauri::command]
fn get_project_dir() -> String {
    // Search CWD and up to 3 parent levels for project root markers.
    // When `cargo run` executes, CWD is typically src-tauri/, so we need to go up 1 level.
    if let Ok(cwd) = std::env::current_dir() {
        let mut dir = cwd.clone();
        for _ in 0..4 {
            let has_src_tauri = dir.join("src-tauri").exists();
            let has_package_json = dir.join("package.json").exists();
            if has_src_tauri && has_package_json {
                return dir.to_string_lossy().to_string();
            }
            if !dir.pop() {
                break;
            }
        }
    }

    // Fallback for dev: use CARGO_MANIFEST_DIR (set at compile time by cargo).
    // This points to src-tauri/, so parent is the project root.
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let manifest_path = std::path::Path::new(manifest_dir);
    if let Some(parent) = manifest_path.parent() {
        if parent.join("package.json").exists() {
            return parent.to_string_lossy().to_string();
        }
    }

    // Fallback: use the executable's directory (production builds)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_string_lossy().to_string();
        }
    }

    // Last resort: current directory
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string())
}

/// List subdirectory names inside a given directory
#[tauri::command]
fn list_dir_entries(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read dir '{}': {}", path, e))?;
    let mut names = Vec::new();
    for entry in entries {
        if let Ok(e) = entry {
            if e.path().is_dir() {
                if let Some(name) = e.file_name().to_str() {
                    names.push(name.to_string());
                }
            }
        }
    }
    Ok(names)
}

/// Delete a directory recursively
#[tauri::command]
fn delete_dir_cmd(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        std::fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete dir '{}': {}", path, e))
    } else {
        Ok(())
    }
}

/// Check if a file or directory exists
#[tauri::command]
fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Get basic system info (CPU count, memory)
#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpus": std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            run_ffmpeg,
            get_system_info,
            write_file,
            read_file,
            delete_file_cmd,
            delete_dir_cmd,
            file_exists,
            list_dir_entries,
            get_temp_dir,
            get_downloads_dir,
            get_appdata_dir,
            get_project_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

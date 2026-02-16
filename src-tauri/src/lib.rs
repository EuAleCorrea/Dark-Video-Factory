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
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            run_ffmpeg,
            get_system_info,
            write_file,
            read_file,
            delete_file_cmd,
            get_temp_dir,
            get_downloads_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

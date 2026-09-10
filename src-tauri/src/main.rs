use std::{fs::File, io::{Read, Write}, path::{Path, PathBuf}, sync::Mutex};
use tauri::{Emitter, Manager};
type Result<T> = std::result::Result<T, String>;
fn err(e: impl std::fmt::Display) -> String {e.to_string()}
#[derive(Clone, Debug, serde::Serialize, PartialEq)]
struct Launch {path: String, ack: Option<String>}
#[derive(Default)]
struct LaunchState {pending: Mutex<Option<Launch>>, ack: Mutex<Option<String>>}
fn parse_args(args: impl IntoIterator<Item=String>) -> Result<Option<Launch>> {
    let mut args = args.into_iter();
    let mut path = None; let mut ack = None;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--open" => {if path.is_some() {return Err("Only one input per process; launch another process for another analysis".into())} path = Some(args.next().ok_or("--open requires a file path")?);},
            "--ack" => {if ack.is_some() {return Err("Duplicate --ack".into())} ack = Some(args.next().ok_or("--ack requires a file path")?);},
            "--fit" => {}, // Optional compatibility with the old companion launch command.
            value if !value.starts_with('-') && path.is_none() => path = Some(value.to_string()),
            _ => return Err(format!("Unrecognized argument: {arg}")),
        }
    }
    if ack.is_some() && path.is_none() {return Err("--ack requires --open".into())}
    if let (Some(input), Some(output)) = (&path, &ack) {
        let absolute = |s: &str| -> Result<PathBuf> {let p=PathBuf::from(s); Ok(if p.is_absolute(){p}else{std::env::current_dir().map_err(err)?.join(p)})};
        if absolute(input)? == absolute(output)? || std::fs::canonicalize(input).ok().zip(std::fs::canonicalize(output).ok()).is_some_and(|(a,b)|a==b) {return Err("Acknowledgment must not overwrite the input".into())}
    }
    Ok(path.map(|path| Launch{path, ack}))
}
fn atomic_text(path: &Path, data: &str) -> Result<()> {
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(err)?;
    tmp.write_all(data.as_bytes()).map_err(err)?;
    tmp.as_file().sync_all().map_err(err)?;
    tmp.persist(path).map_err(err)?; Ok(())
}
fn validate_fit_json(data: &str) -> Result<()> {
    if data.len()>20_000_000 {return Err("Fit file exceeds 20 MB".into())}
    let value: serde_json::Value = serde_json::from_str(data).map_err(err)?;
    if !((value["version"] == 1 && matches!(value["format"].as_str(),Some("tracker-fit-request"|"tracker-fit-session"))) || ((value["version"] == 2 || value["version"] == 3) && value["format"] == "tracker-fit-session")) {return Err("Unsupported fit file".into())}
    Ok(())
}
#[tauri::command]
fn data_files_directory(app: tauri::AppHandle) -> Result<String> {
    let directory = if cfg!(debug_assertions) {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../examples/data")
    } else {
        app.path().resource_dir().map_err(err)?.join("Examples")
    };
    if !directory.is_dir() {return Err("Data files directory is unavailable".into())}
    Ok(directory.to_string_lossy().into_owned())
}
#[tauri::command]
fn read_fit_file(path: String) -> Result<String> {
    let mut data=String::new(); File::open(&path).map_err(err)?.take(20_000_001).read_to_string(&mut data).map_err(err)?;
    if data.len()>20_000_000 {return Err("Fit file exceeds 20 MB".into())}
    Ok(data)
}
#[tauri::command]
fn read_tracker_archive(path: String) -> Result<tauri::ipc::Response> {
    if !Path::new(&path).extension().and_then(|s|s.to_str()).is_some_and(|s|s.eq_ignore_ascii_case("trz")) {return Err("Expected a .trz archive".into())}
    Ok(tauri::ipc::Response::new(read_archive_bytes(Path::new(&path))?))
}
fn read_archive_bytes(path: &Path) -> Result<Vec<u8>> {
    let mut data=Vec::new(); File::open(path).map_err(err)?.take(100_000_001).read_to_end(&mut data).map_err(err)?;
    if data.len()>100_000_000 {return Err("Tracker archive exceeds 100 MB limit".into())}
    Ok(data)
}
#[tauri::command]
fn write_fit_file(path: String, data: String) -> Result<()> {
    validate_fit_json(&data)?;
    let value: serde_json::Value=serde_json::from_str(&data).map_err(err)?;
    if value["format"]!="tracker-fit-session" {return Err("Only sessions may be saved".into())}
    atomic_text(Path::new(&path), &data)
}
#[tauri::command]
fn write_fit_csv(path: String, data: String) -> Result<()> {
    if !Path::new(&path).extension().and_then(|s|s.to_str()).is_some_and(|s|s.eq_ignore_ascii_case("csv")) {return Err("CSV export requires a .csv filename".into())}
    atomic_text(Path::new(&path), &data)
}
#[tauri::command]
fn take_launch(state: tauri::State<LaunchState>) -> Result<Option<Launch>> {state.pending.lock().map_err(err).map(|mut p|p.take())}
fn validate_ack(data: &str) -> Result<()> {
    let v: serde_json::Value=serde_json::from_str(data).map_err(err)?;
    if v["format"]!="tracker-fit-ack" || v["version"]!=1 || !matches!(v["status"].as_str(),Some("accepted"|"error")) || v["requestId"].as_str().is_none() {return Err("Invalid acknowledgment".into())}
    if v["status"]=="error" && v["message"].as_str().is_none() {return Err("Error acknowledgment requires a message".into())}
    Ok(())
}
#[tauri::command]
fn acknowledge_launch(state: tauri::State<LaunchState>, data: String) -> Result<()> {
    validate_ack(&data)?;
    let mut ack=state.ack.lock().map_err(err)?;
    let path=ack.as_ref().ok_or("No pending acknowledgment")?;
    atomic_text(Path::new(path), &data)?; *ack=None; Ok(())
}
fn size_window(window: &tauri::WebviewWindow) -> Result<()> {
    if let Some(monitor)=window.current_monitor().map_err(err)? {
        let scale=monitor.scale_factor(); let area=monitor.work_area();
        let aw=area.size.width as f64/scale; let ah=area.size.height as f64/scale;
        let width=1120.0_f64.min((aw-24.0).max(320.0)); let height=820.0_f64.min((ah-48.0).max(320.0));
        window.set_min_size(Some(tauri::LogicalSize::new(760.0_f64.min(width),480.0_f64.min(height)))).map_err(err)?;
        window.set_size(tauri::LogicalSize::new(width,height)).map_err(err)?;
        window.set_position(tauri::LogicalPosition::new(area.position.x as f64/scale+(aw-width)/2.0,area.position.y as f64/scale+8.0)).map_err(err)?;
    } Ok(())
}
fn fitting_reference(reference: &str) -> Result<&'static str> {
    match reference {
        "assumptions" => Ok("https://www.itl.nist.gov/div898/handbook/pmd/section2/pmd21.htm"),
        "residuals" => Ok("https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm"),
        "weights" => Ok("https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd143.htm"),
        "uncertainty" => Ok("https://physics.nist.gov/cuu/Uncertainty/basic.html"),
        _ => Err("Unknown fitting reference".into()),
    }
}
#[tauri::command]
fn open_fitting_reference(reference: String) -> Result<()> {
    let url = fitting_reference(&reference)?;
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = { let mut c = std::process::Command::new("rundll32"); c.arg("url.dll,FileProtocolHandler"); c };
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let mut command = std::process::Command::new("xdg-open");
    command.arg(url).spawn().map_err(err)?;
    Ok(())
}
fn main() {
    let launch=match parse_args(std::env::args().skip(1)) {Ok(value)=>value,Err(e)=>{eprintln!("Data Tool 2027: {e}");std::process::exit(2)}};
    let state=LaunchState {ack: Mutex::new(launch.as_ref().and_then(|l|l.ack.clone())), pending: Mutex::new(launch)};
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()).manage(state)
        .setup(|app| {if let Some(window)=app.get_webview_window("main") {size_window(&window).map_err(std::io::Error::other)?} Ok(())})
        .invoke_handler(tauri::generate_handler![open_fitting_reference,data_files_directory,read_fit_file,read_tracker_archive,write_fit_file,write_fit_csv,take_launch,acknowledge_launch])
        .build(tauri::generate_context!()).expect("Data Tool 2027 could not start")
        .run(|app,event| {
            #[cfg(target_os="macos")]
            if let tauri::RunEvent::Opened {urls} = &event {
                for (i,url) in urls.iter().enumerate() {
                    if let Ok(path)=url.to_file_path() {
                        if i==0 {
                            let state=app.state::<LaunchState>();
                            if let Ok(mut pending)=state.pending.lock() {*pending=Some(Launch {path: path.to_string_lossy().into_owned(),ack:None});}
                            let _=app.emit("data-tool-open",());
                        } else if let Ok(exe)=std::env::current_exe() {
                            let _=std::process::Command::new(exe).arg("--open").arg(path).spawn();
                        }
                    }
                }
            }
            if let tauri::RunEvent::ExitRequested {code:None,api,..}=event {
                if let Some(window)=app.get_webview_window("main") {api.prevent_exit();let _=window.close();}
            }
        });
}
#[cfg(test)]
mod tests {
    #[test] fn fitting_links_are_fixed_nist_references() {
        for name in ["assumptions", "residuals", "weights", "uncertainty"] { assert!(super::fitting_reference(name).unwrap().starts_with("https://")); }
        assert!(super::fitting_reference("https://example.com").is_err());
        assert!(super::fitting_reference("file:///tmp/input").is_err());
    }

    use super::*;
    fn args(values: &[&str])->Result<Option<Launch>> {parse_args(values.iter().map(|s|s.to_string()))}
    #[test] fn launch_contract() {
        assert_eq!(args(&[]).unwrap(),None);
        assert_eq!(args(&["--open","/tmp/my data.json","--ack","/tmp/result.json"]).unwrap(),Some(Launch{path:"/tmp/my data.json".into(),ack:Some("/tmp/result.json".into())}));
        assert!(args(&["--ack","a"]).is_err());assert!(args(&["--open"]).is_err());assert!(args(&["a","b"]).is_err());assert!(args(&["--open","a","--ack","a"]).is_err());
        assert_eq!(args(&["--fit","data.csv"]).unwrap().unwrap().path,"data.csv");
    }
    #[test] fn atomic_exports_and_failure_preservation() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("table.csv");
        let text="Time (s),Height (m)\r\n0,1.2345678901234567\r\n";
        write_fit_csv(path.to_string_lossy().into(),text.into()).unwrap();assert_eq!(read_fit_file(path.to_string_lossy().into()).unwrap(),text);
        assert!(write_fit_file(path.to_string_lossy().into(),"invalid".into()).is_err());assert_eq!(std::fs::read_to_string(path).unwrap(),text);
        assert!(write_fit_csv(dir.path().join("session.trksess").to_string_lossy().into(),text.into()).is_err());
    }
    #[test] fn bounded_binary_archive_read() {
        let dir=tempfile::tempdir().unwrap(); let path=dir.path().join("project.trz");
        let bytes=[0x50,0x4b,0x03,0x04,0xff,0x00]; std::fs::write(&path,bytes).unwrap();
        assert_eq!(read_archive_bytes(&path).unwrap(),bytes);
        assert!(read_tracker_archive(dir.path().join("other.csv").to_string_lossy().into()).is_err());
        File::create(&path).unwrap().set_len(100_000_001).unwrap();
        assert!(read_archive_bytes(&path).is_err());
    }
    #[test] fn legacy_envelopes_and_acknowledgments() {
        validate_fit_json(r#"{"format":"tracker-fit-request","version":1}"#).unwrap();
        assert!(validate_fit_json(r#"{"format":"tracker-2027","version":1}"#).is_err());
        assert!(validate_fit_json(r#"{"format":"tracker-fit-request","version":2}"#).is_err());
        validate_fit_json(r#"{"format":"tracker-fit-session","version":2}"#).unwrap();
        validate_fit_json(r#"{"format":"tracker-fit-session","version":3}"#).unwrap();
        assert!(validate_fit_json(r#"{"format":"tracker-fit-session","version":4}"#).is_err());
        validate_ack(r#"{"format":"tracker-fit-ack","version":1,"requestId":"e7c00000-0000-4000-8000-000000000001","status":"accepted"}"#).unwrap();
        assert!(validate_ack(r#"{"format":"tracker-fit-ack","version":1,"status":"error"}"#).is_err());
    }
}

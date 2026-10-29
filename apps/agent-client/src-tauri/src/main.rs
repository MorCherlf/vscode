// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use agent_host_supervisor::{BridgeEvent, HostSupervisor, account::{Account, AccountPhase, AccountView, GitHubOAuth, now}, credentials::SystemStore};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{Emitter, Manager, State, WebviewWindow};

struct NativeAccount { account: Account, delivered: Option<(u64, u32)> }
struct NativeState { account: Arc<Mutex<NativeAccount>>, supervisor: Arc<Mutex<HostSupervisor>>, exiting: Arc<AtomicBool>, revoked: Arc<AtomicBool> }
fn authorize(window: &WebviewWindow) -> Result<(), String> {
	let url = window.url().map_err(|_| "WINDOW_URL_FAILED")?;
	let local = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") || (cfg!(debug_assertions) && url.host_str() == Some("127.0.0.1") && url.port() == Some(1420));
	if window.label() != "main" || !local { return Err("UNAUTHORIZED_WINDOW".into()); } Ok(())
}
#[tauri::command]
async fn host_connect(window: WebviewWindow, state: State<'_, NativeState>, events: tauri::ipc::Channel<BridgeEvent>) -> Result<u64, String> {
	authorize(&window)?; let supervisor = state.supervisor.clone(); let account = state.account.clone(); let revoked = state.revoked.clone();
	tauri::async_runtime::spawn_blocking(move || { let mut native = account.lock().map_err(|_| "ACCOUNT_LOCK_FAILED".to_string())?; let mut host = supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED".to_string())?; let generation = host.connect(Arc::new(move |event| {
		if let BridgeEvent::Frame { text, .. } = &event { if agent_host_supervisor::account_expired_frame(text) { revoked.store(true, Ordering::SeqCst); } }
		events.send(event).map_err(|_| "IPC_CLOSED".into())
	}))?; native.account.tick(now()); sync_account(&mut native, &mut host)?; Ok(generation) }).await.map_err(|_| "SUPERVISOR_TASK_FAILED".to_string())?
}
#[tauri::command]
fn host_send(window: WebviewWindow, state: State<'_, NativeState>, generation: u64, text: String) -> Result<(), String> {
	authorize(&window)?;
	agent_host_supervisor::validate_renderer_frame(&text)?;
	state.supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?.send(generation, text)
}
#[tauri::command]
fn host_ack(window: WebviewWindow, state: State<'_, NativeState>, generation: u64, sequence: u64) -> Result<(), String> {
	authorize(&window)?; state.supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?.acknowledge(generation, sequence)
}
#[tauri::command]
async fn host_disconnect(window: WebviewWindow, state: State<'_, NativeState>, generation: u64) -> Result<(), String> {
	authorize(&window)?; let supervisor = state.supervisor.clone();
	tauri::async_runtime::spawn_blocking(move || { supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?.close_connection(generation); Ok(()) }).await.map_err(|_| "SUPERVISOR_TASK_FAILED")?
}
#[tauri::command]
async fn host_quit(window: WebviewWindow, app: tauri::AppHandle, state: State<'_, NativeState>) -> Result<(), String> {
	authorize(&window)?; let supervisor = state.supervisor.clone();
	tauri::async_runtime::spawn_blocking(move || supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?.stop()).await.map_err(|_| "SUPERVISOR_TASK_FAILED")??;
	state.exiting.store(true, Ordering::SeqCst); app.exit(0); Ok(())
}
fn sync_account(native: &mut NativeAccount, host: &mut HostSupervisor) -> Result<(), String> {
	if native.account.view().phase != AccountPhase::SignedIn { return Ok(()); }
	let identity = (native.account.revision(), host.pid().unwrap_or(0));
	if native.delivered == Some(identity) { return Ok(()); }
	native.account.handoff(now(), |token, expiry| host.authenticate_account(token, expiry))?;
	native.delivered = Some((native.account.revision(), host.pid().unwrap_or(0))); Ok(())
}
#[tauri::command]
async fn account_action(window: WebviewWindow, state: State<'_, NativeState>, action: String) -> Result<AccountView, String> {
	authorize(&window)?; let account = state.account.clone(); let supervisor = state.supervisor.clone();
	tauri::async_runtime::spawn_blocking(move || {
		let mut native = account.lock().map_err(|_| "ACCOUNT_LOCK_FAILED")?;
		let mut host = supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?;
		match action.as_str() {
			"status" => {},
			"login" => { host.stop()?; native.delivered = None; native.account.begin(now()); },
			"cancel" => { let stopped = host.stop(); native.delivered = None; let cancelled = native.account.cancel(); stopped?; cancelled?; },
			"logout" => { let stopped = host.stop(); native.delivered = None; let cleared = native.account.logout(); stopped?; cleared?; },
			"poll" => { native.account.tick(now());
				if native.delivered.is_some() && native.account.view().phase != AccountPhase::SignedIn { host.stop()?; native.delivered = None; }
				sync_account(&mut native, &mut host)?;
			},
			_ => return Err("UNSUPPORTED_ACCOUNT_ACTION".into()),
		}
		Ok(native.account.view())
	}).await.map_err(|_| "ACCOUNT_TASK_FAILED".to_string())?
}
/// Only a fixed public device-login page may be opened; no renderer-provided URL or command.
#[tauri::command]
fn account_open(window: WebviewWindow) -> Result<(), String> {
	authorize(&window)?;
	#[cfg(target_os = "macos")]
	let result = std::process::Command::new("/usr/bin/open").arg("https://github.com/login/device").status();
	#[cfg(target_os = "linux")]
	let result = std::process::Command::new("xdg-open").arg("https://github.com/login/device").status();
	#[cfg(not(any(target_os = "macos", target_os = "linux")))]
	return Err("BROWSER_OPEN_UNSUPPORTED".into());
	#[cfg(any(target_os = "macos", target_os = "linux"))]
	if result.map_err(|_| "BROWSER_OPEN_FAILED")?.success() { Ok(()) } else { Err("BROWSER_OPEN_FAILED".into()) }
}
#[tauri::command]
fn input_open_url(window: WebviewWindow, url: String) -> Result<(), String> {
	authorize(&window)?;
	if !agent_host_supervisor::supported_input_url(&url) { return Err("URL_UNSUPPORTED".into()); }
	#[cfg(target_os = "macos")]
	let result = std::process::Command::new("/usr/bin/open").arg(&url).status();
	#[cfg(target_os = "linux")]
	let result = std::process::Command::new("xdg-open").arg(&url).status();
	#[cfg(not(any(target_os = "macos", target_os = "linux")))]
	return Err("BROWSER_OPEN_UNSUPPORTED".into());
	#[cfg(any(target_os = "macos", target_os = "linux"))]
	if result.map_err(|_| "BROWSER_OPEN_FAILED")?.success() { Ok(()) } else { Err("BROWSER_OPEN_FAILED".into()) }
}
fn main() {
	let app = tauri::Builder::default()
		.setup(|app| {
			let directory = app.path().resource_dir()?.join("agent-host");
			let data = app.path().app_data_dir()?.join("host");
			let mut account = Account::new(std::env::var("MORCHERLF_GITHUB_OAUTH_CLIENT_ID").ok(), Box::new(SystemStore), Box::new(GitHubOAuth));
			account.restore(now());
			let account = Arc::new(Mutex::new(NativeAccount { account, delivered: None }));
			let supervisor = Arc::new(Mutex::new(HostSupervisor::new(directory, data)));
			let exiting = Arc::new(AtomicBool::new(false)); let revoked = Arc::new(AtomicBool::new(false));
			let weak_account = Arc::downgrade(&account); let weak_host = Arc::downgrade(&supervisor);
			let stopping = exiting.clone(); let challenge = revoked.clone();
			std::thread::spawn(move || {
				while !stopping.load(Ordering::SeqCst) {
					std::thread::sleep(std::time::Duration::from_secs(1));
					let (Some(account), Some(host)) = (weak_account.upgrade(), weak_host.upgrade()) else { break; };
					if let (Ok(mut native), Ok(mut host)) = (account.lock(), host.lock()) {
						if challenge.swap(false, Ordering::SeqCst) { native.account.challenge(now()); } else { native.account.tick(now()); }
						if native.delivered.is_some() && native.account.view().phase != AccountPhase::SignedIn { let _ = host.stop(); native.delivered = None; }
						// Only credential delivery may retry; no model task is ever replayed here.
						if native.account.view().phase == AccountPhase::SignedIn && native.delivered.map(|value| value.0) != Some(native.account.revision()) { let _ = sync_account(&mut native, &mut host); }
					};
				}
			});
			app.manage(NativeState { account, supervisor, exiting, revoked });
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![host_connect, host_send, host_ack, host_disconnect, host_quit, account_action, account_open, input_open_url])
		.on_window_event(|window, event| { if let tauri::WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); let _ = window.hide(); } })
		.build(tauri::generate_context!()).expect("Tauri initialization failed");
	app.run(|app, event| { match event {
		tauri::RunEvent::ExitRequested { api, .. } => { if !app.state::<NativeState>().exiting.load(Ordering::SeqCst) { api.prevent_exit(); let _ = app.emit_to("main", "quit-requested", ()); if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); } } },
		#[cfg(target_os = "macos")]
		tauri::RunEvent::Reopen { .. } => { if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); } },
		_ => {}
	} });
}

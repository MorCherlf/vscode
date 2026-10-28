// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use agent_host_supervisor::{BridgeEvent, HostSupervisor};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{Emitter, Manager, State, WebviewWindow};

struct NativeState { supervisor: Arc<Mutex<HostSupervisor>>, exiting: AtomicBool }
fn authorize(window: &WebviewWindow) -> Result<(), String> {
	let url = window.url().map_err(|_| "WINDOW_URL_FAILED")?;
	let local = url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") || (cfg!(debug_assertions) && url.host_str() == Some("127.0.0.1") && url.port() == Some(1420));
	if window.label() != "main" || !local { return Err("UNAUTHORIZED_WINDOW".into()); } Ok(())
}
#[tauri::command]
async fn host_connect(window: WebviewWindow, state: State<'_, NativeState>, events: tauri::ipc::Channel<BridgeEvent>) -> Result<u64, String> {
	authorize(&window)?; let supervisor = state.supervisor.clone();
	tauri::async_runtime::spawn_blocking(move || supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED".to_string())?.connect(Arc::new(move |event| events.send(event).map_err(|_| "IPC_CLOSED".into())))).await.map_err(|_| "SUPERVISOR_TASK_FAILED".to_string())?
}
#[tauri::command]
fn host_send(window: WebviewWindow, state: State<'_, NativeState>, generation: u64, text: String) -> Result<(), String> {
	authorize(&window)?; state.supervisor.lock().map_err(|_| "SUPERVISOR_LOCK_FAILED")?.send(generation, text)
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
fn main() {
	let app = tauri::Builder::default()
		.setup(|app| {
			let directory = app.path().resource_dir()?.join("agent-host");
			let data = app.path().app_data_dir()?.join("host");
			app.manage(NativeState { supervisor: Arc::new(Mutex::new(HostSupervisor::new(directory, data))), exiting: AtomicBool::new(false) });
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![host_connect, host_send, host_ack, host_disconnect, host_quit])
		.on_window_event(|window, event| { if let tauri::WindowEvent::CloseRequested { api, .. } = event { api.prevent_close(); let _ = window.hide(); } })
		.build(tauri::generate_context!()).expect("Tauri initialization failed");
	app.run(|app, event| { match event {
		tauri::RunEvent::ExitRequested { api, .. } => { if !app.state::<NativeState>().exiting.load(Ordering::SeqCst) { api.prevent_exit(); let _ = app.emit_to("main", "quit-requested", ()); if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); } } },
		#[cfg(target_os = "macos")]
		tauri::RunEvent::Reopen { .. } => { if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); } },
		_ => {}
	} });
}

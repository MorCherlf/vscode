// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.

pub mod account;
pub mod credentials;

use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, fs, io::{BufRead, BufReader, Read}, net::TcpStream, path::PathBuf, process::{Child, Command, Stdio}, sync::{mpsc::{self, SyncSender}, Arc}, thread::{self, JoinHandle}, time::{Duration, Instant}};
use tungstenite::{client::client_with_config, protocol::{Message, WebSocketConfig}, Error as WsError};

/// Opening is an explicit user action; opening a page never completes an AHP request.
pub fn supported_input_url(value: &str) -> bool {
	if value.len() > 2048 { return false; }
	reqwest::Url::parse(value).is_ok_and(|url| url.scheme() == "https" && url.host_str().is_some() && url.username().is_empty() && url.password().is_none())
}
pub fn account_expired_frame(text: &str) -> bool {
	serde_json::from_str::<serde_json::Value>(text).is_ok_and(|value| value["method"] == "auth/required" && value["params"]["reason"] == "expired" && value["params"]["resource"]["resource"] == "https://api.github.com")
}
/// Capability filter, not a second protocol/state implementation. In particular, logs and
/// account authentication are not renderer capabilities.
pub fn validate_renderer_frame(text: &str) -> Result<(), String> {
	if text.len() > 1024 * 1024 { return Err("FRAME_TOO_LARGE".into()); }
	let frame: serde_json::Value = serde_json::from_str(text).map_err(|_| "INVALID_FRAME")?;
	if !frame.is_object() { return Err("INVALID_FRAME".into()); }
	let method = frame["method"].as_str().ok_or("UNSUPPORTED_RENDERER_METHOD")?;
	if !["initialize", "subscribe", "unsubscribe", "listSessions", "createSession", "dispatchAction", "ping"].contains(&method) { return Err("UNSUPPORTED_RENDERER_METHOD".into()); }
	if frame["params"]["channel"].as_str().is_some_and(|channel| channel.starts_with("ahp-otlp:")) { return Err("NATIVE_LOG_CHANNEL_UNAVAILABLE".into()); }
	Ok(())
}
const MAX_FRAME: usize = 1024 * 1024;
const WINDOW: usize = 64;
type Sink = Arc<dyn Fn(BridgeEvent) -> Result<(), String> + Send + Sync>;

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum BridgeEvent {
	Frame { generation: u64, sequence: u64, text: String },
	Fault { generation: u64, reason: String },
	Closed { generation: u64, reason: String },
}
#[derive(Deserialize)]
struct Readiness { #[serde(rename = "type")] kind: String, host: String, port: u16, pid: u32, #[serde(rename = "tokenFile")] token_file: PathBuf }
enum SocketCommand { Send(String), Ack(u64), Close }
struct Connection { sender: SyncSender<SocketCommand>, thread: JoinHandle<()> }

pub struct HostSupervisor {
	directory: PathBuf,
	data: PathBuf,
	entry: String,
	child: Option<Child>,
	port: u16,
	token: String,
	generation: u64,
	connection: Option<Connection>,
}

impl HostSupervisor {
	pub fn new(directory: PathBuf, data: PathBuf) -> Self { Self::with_entry(directory, data, "start.mjs") }
	pub fn with_entry(directory: PathBuf, data: PathBuf, entry: &str) -> Self {
		Self { directory, data, entry: entry.into(), child: None, port: 0, token: String::new(), generation: 0, connection: None }
	}
	fn start(&mut self) -> Result<(), String> {
		if let Some(child) = self.child.as_mut() {
			if child.try_wait().map_err(|_| "HOST_STATUS_FAILED")?.is_none() { return Ok(()); }
			Self::reap_descendants(child.id()); self.child = None; self.token.clear();
		}
		fs::create_dir_all(&self.data).map_err(|_| "DATA_DIRECTORY_FAILED")?;
		let node = self.directory.join("bin").join(if cfg!(windows) { "node.exe" } else { "node" });
		let mut command = Command::new(node);
		command.arg(self.directory.join(&self.entry)).arg("--user-data-dir").arg(&self.data).current_dir(&self.directory).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
		for name in ["GH_TOKEN", "GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN", "GITHUB_COPILOT_GITHUB_TOKEN", "GITHUB_COPILOT_API_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"] { command.env_remove(name); }
		command.env("GH_CONFIG_DIR", self.data.join("gh"));
		#[cfg(unix)] { use std::os::unix::process::CommandExt; command.process_group(0); }
		let mut child = command.spawn().map_err(|_| "HOST_SPAWN_FAILED")?;
		let stdout = child.stdout.take().ok_or("HOST_STDOUT_MISSING")?;
		let stderr = child.stderr.take().ok_or("HOST_STDERR_MISSING")?;
		thread::spawn(move || { let mut reader = stderr; let mut buffer = [0u8; 4096]; while matches!(reader.read(&mut buffer), Ok(n) if n > 0) {} });
		let (sender, receiver) = mpsc::sync_channel(1);
		thread::spawn(move || {
			let mut reader = BufReader::new(stdout); let mut line = String::new();
			let result = reader.by_ref().take(16385).read_line(&mut line).ok().filter(|_| line.len() <= 16384)
				.and_then(|_| serde_json::from_str::<Readiness>(&line).ok());
			let _ = sender.send(result);
			let mut buffer = [0u8; 4096]; while matches!(reader.read(&mut buffer), Ok(n) if n > 0) {}
		});
		let readiness = receiver.recv_timeout(Duration::from_secs(20)).ok().flatten();
		let checked = readiness.ok_or("HOST_READINESS_FAILED").and_then(|ready| {
			if ready.kind != "ready" || ready.host != "127.0.0.1" || ready.port == 0 || ready.pid != child.id() { return Err("HOST_READINESS_INVALID"); }
			let canonical_data = fs::canonicalize(&self.data).map_err(|_| "TOKEN_DIRECTORY_FAILED")?;
			let metadata = fs::symlink_metadata(&ready.token_file).map_err(|_| "TOKEN_FILE_MISSING")?;
			if metadata.file_type().is_symlink() || !metadata.is_file() || metadata.len() > 128 || fs::canonicalize(&ready.token_file).map_err(|_| "TOKEN_PATH_FAILED")?.parent() != Some(canonical_data.as_path()) { return Err("TOKEN_FILE_INVALID"); }
			#[cfg(unix)] { use std::os::unix::fs::PermissionsExt; if metadata.permissions().mode() & 0o777 != 0o600 { return Err("TOKEN_PERMISSIONS_INVALID"); } }
			let token = fs::read_to_string(&ready.token_file).map_err(|_| "TOKEN_READ_FAILED")?;
			if token.len() < 32 || !token.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-') { return Err("TOKEN_INVALID"); }
			Ok((ready.port, token))
		});
		match checked {
			Ok((port, token)) => { self.port = port; self.token = token; self.child = Some(child); Ok(()) }
			Err(error) => { Self::reap_descendants(child.id()); let _ = child.kill(); let _ = child.wait(); Err(error.into()) }
		}
	}
	/// Separate native AHP connection: account credentials never enter the WebView frame stream.
	pub fn authenticate_account(&mut self, account_token: &str, expires_in: Option<u64>) -> Result<(), String> {
		self.authenticate_resource("https://api.github.com", account_token, expires_in)
	}
	fn authenticate_resource(&mut self, resource: &str, account_token: &str, expires_in: Option<u64>) -> Result<(), String> {
		self.start()?;
		let stream = TcpStream::connect_timeout(&format!("127.0.0.1:{}", self.port).parse().map_err(|_| "ADDRESS_INVALID")?, Duration::from_secs(5)).map_err(|_| "HOST_CONNECT_FAILED")?;
		stream.set_read_timeout(Some(Duration::from_secs(10))).map_err(|_| "SOCKET_OPTIONS_FAILED")?;
		stream.set_write_timeout(Some(Duration::from_secs(10))).map_err(|_| "SOCKET_OPTIONS_FAILED")?;
		let url = format!("ws://127.0.0.1:{}/?tkn={}", self.port, self.token);
		let (mut socket, _) = client_with_config(url.as_str(), stream, Some(WebSocketConfig::default().max_message_size(Some(MAX_FRAME)).max_frame_size(Some(MAX_FRAME)))).map_err(|_| "HOST_AUTHENTICATION_FAILED")?;
		let initialize = serde_json::json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"channel":"ahp-root://","clientId":"morcherlf-native-account","protocolVersions":["1.0.0"]}});
		socket.send(Message::Text(initialize.to_string().into())).map_err(|_| "ACCOUNT_HANDOFF_FAILED")?;
		let deadline = Instant::now() + Duration::from_secs(10);
		let mut step = 1;
		while Instant::now() < deadline {
			match socket.read().map_err(|_| "ACCOUNT_HANDOFF_FAILED")? {
				Message::Text(text) => {
					let value: serde_json::Value = serde_json::from_str(&text).map_err(|_| "ACCOUNT_HANDOFF_FAILED")?;
					if value["id"] != step { continue; }
					if value.get("error").is_some() || value.get("result").is_none() { return Err("ACCOUNT_HANDOFF_REJECTED".into()); }
					if step == 2 { let _ = socket.close(None); return Ok(()); }
					if value["result"]["protocolVersion"] != "1.0.0" { return Err("UNSUPPORTED_PROTOCOL".into()); }
					let mut params = serde_json::json!({"channel":"ahp-root://","resource":resource,"token":account_token});
					if let Some(expiry) = expires_in { params["expiresIn"] = expiry.into(); }
					let request = serde_json::json!({"jsonrpc":"2.0","id":2,"method":"authenticate","params":params});
					socket.send(Message::Text(request.to_string().into())).map_err(|_| "ACCOUNT_HANDOFF_FAILED")?; step = 2;
				}
				Message::Ping(data) => { socket.send(Message::Pong(data)).map_err(|_| "ACCOUNT_HANDOFF_FAILED")?; }
				_ => return Err("ACCOUNT_HANDOFF_FAILED".into()),
			}
		}
		Err("ACCOUNT_HANDOFF_TIMEOUT".into())
	}
	pub fn connect(&mut self, sink: Sink) -> Result<u64, String> {
		self.disconnect(); self.start()?;
		let stream = TcpStream::connect_timeout(&format!("127.0.0.1:{}", self.port).parse().map_err(|_| "ADDRESS_INVALID")?, Duration::from_secs(5)).map_err(|_| "HOST_CONNECT_FAILED")?;
		stream.set_read_timeout(Some(Duration::from_secs(5))).map_err(|_| "SOCKET_OPTIONS_FAILED")?;
		stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(|_| "SOCKET_OPTIONS_FAILED")?;
		let url = format!("ws://127.0.0.1:{}/?tkn={}", self.port, self.token);
		let config = WebSocketConfig::default().max_message_size(Some(MAX_FRAME)).max_frame_size(Some(MAX_FRAME));
		let (mut socket, _) = client_with_config(url.as_str(), stream, Some(config)).map_err(|_| "HOST_AUTHENTICATION_FAILED")?;
		socket.get_mut().set_read_timeout(Some(Duration::from_millis(40))).map_err(|_| "SOCKET_OPTIONS_FAILED")?;
		let (sender, receiver) = mpsc::sync_channel(32);
		self.generation += 1; let generation = self.generation;
		let handle = thread::spawn(move || {
			let mut pending = BTreeSet::new(); let mut sequence = 0u64;
			let reason = 'connection: loop {
				for command in receiver.try_iter() {
					match command {
						SocketCommand::Close => { let _ = socket.close(None); break 'connection "DISCONNECTED"; }
						SocketCommand::Ack(sequence) => { pending.remove(&sequence); }
						SocketCommand::Send(text) => { if socket.send(Message::Text(text.into())).is_err() { break 'connection "SEND_OUTCOME_UNKNOWN"; } }
					}
				}
				match socket.read() {
					Ok(Message::Text(text)) => {
						if pending.len() >= WINDOW { break "BACKPRESSURE_RESYNC_REQUIRED"; }
						sequence += 1; pending.insert(sequence);
						if sink(BridgeEvent::Frame { generation, sequence, text: text.to_string() }).is_err() { break "IPC_DELIVERY_FAILED"; }
					}
					Ok(Message::Close(_)) => break "HOST_DISCONNECTED",
					Ok(Message::Ping(data)) => { if socket.send(Message::Pong(data)).is_err() { break "HOST_DISCONNECTED"; } }
					Ok(Message::Binary(_)) => break "UNSUPPORTED_BINARY_FRAME",
					Ok(_) => {},
					Err(WsError::Io(error)) if matches!(error.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {},
					Err(_) => break "HOST_TRANSPORT_FAILED",
				}
			};
			let _ = socket.close(None);
			let _ = sink(if reason == "DISCONNECTED" { BridgeEvent::Closed { generation, reason: reason.into() } } else { BridgeEvent::Fault { generation, reason: reason.into() } });
		});
		self.connection = Some(Connection { sender, thread: handle }); Ok(generation)
	}
	fn command(&self, generation: u64, command: SocketCommand) -> Result<(), String> {
		if generation != self.generation { return Err("STALE_GENERATION".into()); }
		self.connection.as_ref().ok_or("NOT_CONNECTED")?.sender.try_send(command).map_err(|_| "NATIVE_QUEUE_FULL_OR_CLOSED".into())
	}
	pub fn send(&self, generation: u64, text: String) -> Result<(), String> {
		if text.len() > MAX_FRAME { return Err("FRAME_TOO_LARGE".into()); }
		self.command(generation, SocketCommand::Send(text))
	}
	pub fn acknowledge(&self, generation: u64, sequence: u64) -> Result<(), String> { self.command(generation, SocketCommand::Ack(sequence)) }
	pub fn close_connection(&mut self, generation: u64) { if generation == self.generation { self.disconnect(); } }
	fn disconnect(&mut self) {
		if let Some(connection) = self.connection.take() { let _ = connection.sender.send(SocketCommand::Close); let _ = connection.thread.join(); }
	}
	fn reap_descendants(pid: u32) {
		#[cfg(unix)]
		// The process group is created by us, with the Host as leader. Never target the app's group.
		unsafe { libc::kill(-(pid as i32), libc::SIGKILL); }
	}
	pub fn stop(&mut self) -> Result<(), String> {
		self.disconnect(); self.token.clear();
		if let Some(mut child) = self.child.take() {
			drop(child.stdin.take()); let deadline = Instant::now() + Duration::from_secs(7);
			while Instant::now() < deadline {
				if child.try_wait().map_err(|_| "HOST_WAIT_FAILED")?.is_some() { Self::reap_descendants(child.id()); return Ok(()); }
				thread::sleep(Duration::from_millis(25));
			}
			Self::reap_descendants(child.id());
			child.kill().map_err(|_| "HOST_KILL_FAILED")?; child.wait().map_err(|_| "HOST_REAP_FAILED")?;
			return Err("HOST_FORCED_STOP".into());
		}
		Ok(())
	}
	pub fn pid(&mut self) -> Option<u32> { self.child.as_ref().map(Child::id) }
}
impl Drop for HostSupervisor { fn drop(&mut self) { let _ = self.stop(); } }

#[cfg(test)]
mod tests {
	use super::*;
	#[test]
	fn missing_artifact_is_an_explicit_failure() {
		let data = tempfile::tempdir().unwrap();
		let mut supervisor = HostSupervisor::new(PathBuf::from("/nonexistent/agent-host"), data.path().join("data"));
		assert_eq!(supervisor.connect(Arc::new(|_| Ok(()))).unwrap_err(), "HOST_SPAWN_FAILED");
		assert!(supervisor.pid().is_none());
	}
	#[test]
	fn validates_generation_and_frame_size() {
		let data = tempfile::tempdir().unwrap();
		let supervisor = HostSupervisor::new(PathBuf::from("/unused"), data.path().into());
		assert_eq!(supervisor.send(9, "{}".into()).unwrap_err(), "STALE_GENERATION");
		assert_eq!(supervisor.send(0, "x".repeat(MAX_FRAME + 1)).unwrap_err(), "FRAME_TOO_LARGE");
	}
	#[test]
	fn native_receive_window_overflow_requires_resync() {
		let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
		let port = listener.local_addr().unwrap().port();
		let peer = thread::spawn(move || {
			let (stream, _) = listener.accept().unwrap();
			let mut socket = tungstenite::accept(stream).unwrap();
			for _ in 0..65 { if socket.send(Message::Text("x".repeat(MAX_FRAME / 2).into())).is_err() { break; } }
		});
		let data = tempfile::tempdir().unwrap();
		let mut supervisor = HostSupervisor::new(PathBuf::from("/unused"), data.path().into());
		supervisor.child = Some(Command::new("sh").arg("-c").arg("cat").stdin(Stdio::piped()).stdout(Stdio::null()).spawn().unwrap());
		supervisor.port = port; supervisor.token = "fixture-only".into();
		let (sender, receiver) = mpsc::channel();
		supervisor.connect(Arc::new(move |event| sender.send(event).map_err(|_| "receiver closed".into()))).unwrap();
		let mut frames = 0;
		loop {
			match receiver.recv_timeout(Duration::from_secs(10)).unwrap() {
				BridgeEvent::Frame { .. } => frames += 1,
				BridgeEvent::Fault { reason, .. } => { assert_eq!(reason, "BACKPRESSURE_RESYNC_REQUIRED"); break; }
				_ => panic!("unexpected close"),
			}
		}
		assert_eq!(frames, WINDOW); supervisor.stop().unwrap(); peer.join().unwrap();
	}
	#[test]
	#[ignore = "requires AGENT_HOST_TEST_DIR and the M1 dist-test artifact"]
	fn owns_real_mock_host_reconnects_without_restart_and_reaps_it() {
		let directory = PathBuf::from(std::env::var_os("AGENT_HOST_TEST_DIR").expect("AGENT_HOST_TEST_DIR is required"));
		let data = tempfile::tempdir().unwrap();
		let mut supervisor = HostSupervisor::with_entry(directory, data.path().join("data"), "start-test.mjs");
		let (sender, receiver) = mpsc::channel();
		let sink: Sink = Arc::new(move |event| sender.send(event).map_err(|_| "test receiver closed".into()));
		let first = supervisor.connect(sink.clone()).unwrap(); let pid = supervisor.pid().unwrap();
		supervisor.send(first, serde_json::json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"channel":"ahp-root://","clientId":"native-test","protocolVersions":["1.0.0"]}}).to_string()).unwrap();
		let frame = receiver.recv_timeout(Duration::from_secs(10)).unwrap();
		if let BridgeEvent::Frame { generation, sequence, text } = frame { assert_eq!(generation, first); assert_eq!(serde_json::from_str::<serde_json::Value>(&text).unwrap()["result"]["protocolVersion"], "1.0.0"); supervisor.acknowledge(first, sequence).unwrap(); } else { panic!("expected initialize response"); }
		let next = supervisor.connect(sink).unwrap();
		assert_eq!(supervisor.pid(), Some(pid)); assert!(next > first);
		assert_eq!(supervisor.send(first, "{}".into()).unwrap_err(), "STALE_GENERATION");
		supervisor.stop().unwrap(); assert!(supervisor.pid().is_none());
		assert!(!fs::read_dir(data.path().join("data")).unwrap().any(|entry| entry.unwrap().file_name().to_string_lossy().starts_with(".connection-")));
	}
}

#[cfg(test)]
mod fault_tests {
	use super::*;
	#[test]
	fn public_urls_and_revocation_notifications_are_capability_checked() {
		assert!(supported_input_url("https://github.com/login/device"));
		assert!(validate_renderer_frame(r#"{"method":"authenticate","params":{"token":"fixture"}}"#).is_err());
		assert!(validate_renderer_frame(r#"{"method":"subscribe","params":{"channel":"ahp-otlp:/logs"}}"#).is_err());
		assert!(validate_renderer_frame(r#"{"method":"subscribe","params":{"channel":"opaque:/chat"}}"#).is_ok());
		for url in ["javascript:alert(1)", "file:///etc/passwd", "http://localhost", "https://user:pass@example.org"] { assert!(!supported_input_url(url)); }
		assert!(account_expired_frame(r#"{"method":"auth/required","params":{"resource":{"resource":"https://api.github.com"},"reason":"expired"}}"#));
		assert!(!account_expired_frame(r#"{"method":"auth/required","params":{"resource":{"resource":"https://other.invalid"},"reason":"expired"}}"#));
	}
	#[test]
	fn oversized_frame_and_peer_crash_require_resync() {
		for large in [false, true] {
			let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap(); let port = listener.local_addr().unwrap().port();
			let peer = thread::spawn(move || { let (stream, _) = listener.accept().unwrap(); let mut socket = tungstenite::accept(stream).unwrap(); if large { let _ = socket.send(Message::Text("x".repeat(MAX_FRAME + 1).into())); } });
			let data = tempfile::tempdir().unwrap(); let mut supervisor = HostSupervisor::new(PathBuf::from("/unused"), data.path().into());
			supervisor.child = Some(Command::new("sh").arg("-c").arg("cat").stdin(Stdio::piped()).stdout(Stdio::null()).spawn().unwrap()); supervisor.port = port;
			let (sender, receiver) = mpsc::channel(); supervisor.connect(Arc::new(move |event| sender.send(event).map_err(|_| "closed".into()))).unwrap();
			assert!(matches!(receiver.recv_timeout(Duration::from_secs(10)).unwrap(), BridgeEvent::Fault { .. })); supervisor.stop().unwrap(); peer.join().unwrap();
		}
	}
	#[test]
	#[ignore = "requires AGENT_HOST_TEST_DIR"]
	fn native_account_handoff_and_host_crash_restart() {
		let directory = PathBuf::from(std::env::var_os("AGENT_HOST_TEST_DIR").expect("AGENT_HOST_TEST_DIR")); let data = tempfile::tempdir().unwrap();
		let mut host = HostSupervisor::with_entry(directory, data.path().join("data"), "start-test.mjs");
		host.authenticate_resource("https://fixture.invalid", "fixture-account-token", Some(3600)).unwrap();
		assert!(host.authenticate_resource("https://fixture.invalid", "invalid-fixture", None).is_err());
		let first = host.pid().unwrap(); host.child.as_mut().unwrap().kill().unwrap(); host.child.as_mut().unwrap().wait().unwrap();
		host.authenticate_resource("https://fixture.invalid", "fixture-account-token", None).unwrap(); assert_ne!(host.pid(), Some(first)); host.stop().unwrap();
	}
}

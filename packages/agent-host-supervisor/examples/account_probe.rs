// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
//! Opt-in real-account smoke test. Reads only this app's native store; emits no raw frames.
use agent_host_supervisor::{HostSupervisor, BridgeEvent, account::{Account, AccountPhase, GitHubOAuth, now}, credentials::SystemStore};
use serde_json::{json, Value};
use std::{path::PathBuf, sync::{Arc, mpsc}, time::{Duration, Instant}};
fn next(host: &HostSupervisor, receiver: &mpsc::Receiver<BridgeEvent>) -> Result<Value, String> {
	match receiver.recv_timeout(Duration::from_secs(15)).map_err(|_| "PROBE_TIMEOUT")? {
		BridgeEvent::Frame { generation, sequence, text } => { host.acknowledge(generation, sequence)?; serde_json::from_str(&text).map_err(|_| "PROBE_INVALID_FRAME".into()) }
		_ => Err("PROBE_DISCONNECTED_OUTCOME_UNKNOWN".into()),
	}
}
fn request(host: &HostSupervisor, generation: u64, receiver: &mpsc::Receiver<BridgeEvent>, id: u64, method: &str, params: Value) -> Result<Value, String> {
	host.send(generation, json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}).to_string())?;
	let deadline = Instant::now() + Duration::from_secs(30);
	while Instant::now() < deadline { let frame = next(host, receiver)?; if frame["id"] == id { return if frame.get("error").is_some() { Err("PROBE_REQUEST_REJECTED".into()) } else { Ok(frame["result"].clone()) }; } }
	Err("PROBE_REQUEST_TIMEOUT_OUTCOME_UNKNOWN".into())
}
fn run() -> Result<(), String> {
	if std::env::var("MORCHERLF_RUN_COPILOT_TESTS").as_deref() != Ok("1") { return Err("PROBE_NOT_OPTED_IN".into()); }
	let mut account = Account::new(std::env::var("MORCHERLF_GITHUB_OAUTH_CLIENT_ID").ok(), Box::new(SystemStore), Box::new(GitHubOAuth)); account.restore(now());
	if account.view().phase != AccountPhase::SignedIn { return Err("PROBE_ACCOUNT_NOT_READY".into()); }
	let directory = PathBuf::from(std::env::var_os("AGENT_HOST_PRODUCTION_DIR").ok_or("PROBE_ARTIFACT_REQUIRED")?);
	let data = PathBuf::from(std::env::var_os("AGENT_PROBE_DATA_DIR").ok_or("PROBE_NEW_DATA_DIRECTORY_REQUIRED")?);
	if data.exists() { return Err("PROBE_DATA_DIRECTORY_MUST_NOT_EXIST".into()); }
	let project = std::env::var("AGENT_PROBE_PROJECT_URI").map_err(|_| "PROBE_PROJECT_REQUIRED")?;
	if !project.starts_with("file:///") { return Err("PROBE_LOCAL_PROJECT_REQUIRED".into()); }
	let mut host = HostSupervisor::new(directory, data);
	account.handoff(now(), |token, expiry| host.authenticate_account(token, expiry))?;
	let (sender, receiver) = mpsc::channel(); let generation = host.connect(Arc::new(move |event| sender.send(event).map_err(|_| "PROBE_RECEIVER_CLOSED".into())))?;
	let initialize = request(&host, generation, &receiver, 1, "initialize", json!({"channel":"ahp-root://","clientId":"morcherlf-account-probe","protocolVersions":["1.0.0"]}))?;
	if initialize["protocolVersion"] != "1.0.0" { return Err("PROBE_PROTOCOL_MISMATCH".into()); }
	let session = format!("ahp-session:/00000000-0000-4000-8000-{:012x}", now() ^ u64::from(std::process::id()));
	request(&host, generation, &receiver, 2, "createSession", json!({"channel":session,"provider":"copilot","workingDirectories":[project],"config":{"isolation":"folder"}}))?;
	let snapshot = request(&host, generation, &receiver, 3, "subscribe", json!({"channel":session}))?;
	let chat = snapshot["snapshot"]["state"]["defaultChat"].as_str().ok_or("PROBE_CHAT_MISSING")?;
	request(&host, generation, &receiver, 4, "subscribe", json!({"channel":chat}))?;
	let turn = format!("probe-{}", now());
	let date = std::process::Command::new("/bin/date").args(["-u", "+%Y-%m-%dT%H:%M:%SZ"]).output().map_err(|_| "PROBE_CLOCK_FAILED")?;
	if !date.status.success() { return Err("PROBE_CLOCK_FAILED".into()); }
	let timestamp = String::from_utf8(date.stdout).map_err(|_| "PROBE_CLOCK_FAILED")?.trim().to_string();
	host.send(generation, json!({"jsonrpc":"2.0","method":"dispatchAction","params":{"channel":chat,"action":{"type":"chat/turnStarted","turnId":turn,"startedAt":timestamp,"message":{"text":"Reply with exactly M2_ACCOUNT_PROBE_OK. Do not use tools or modify files.","origin":{"kind":"user"}}}}}).to_string())?;
	let deadline = Instant::now() + Duration::from_secs(90); let mut marker = false;
	while Instant::now() < deadline {
		let frame = next(&host, &receiver)?; marker |= frame.to_string().contains("M2_ACCOUNT_PROBE_OK"); let action = &frame["params"]["action"];
		if action["type"] == "chat/toolCallReady" { return Err("PROBE_TOOL_REQUEST_NOT_APPROVED".into()); }
		if action["type"] == "chat/error" { return Err("PROBE_MODEL_FAILED".into()); }
		if action["type"] == "chat/turnComplete" && action["turnId"] == turn {
			host.stop()?; return if marker { Ok(()) } else { Err("PROBE_MARKER_MISSING".into()) };
		}
	}
	Err("PROBE_MODEL_TIMEOUT_OUTCOME_UNKNOWN".into())
}
fn main() { match run() { Ok(()) => println!("{{\"realAccountProbe\":\"passed\"}}"), Err(error) => { eprintln!("{error}"); std::process::exit(1); } } }

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
use crate::credentials::{Credential, CredentialStore, StoreError};
use serde::{Deserialize, Serialize};
use std::{io::Read, time::Duration};
use zeroize::Zeroize;

#[derive(Clone, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AccountPhase { Unconfigured, SignedOut, Authorizing, SignedIn, Expired, Denied, Locked, Unavailable, Failed }
/// Public projection contains no access/refresh token or device_code.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountView { pub phase: AccountPhase, pub user_code: Option<String>, pub verification_uri: Option<String>, pub expires_at: Option<u64> }
#[derive(Deserialize)]
pub struct DeviceCode { pub device_code: String, pub user_code: String, pub verification_uri: String, pub expires_in: u64, pub interval: u64 }
impl Drop for DeviceCode { fn drop(&mut self) { self.device_code.zeroize(); } }
#[derive(Deserialize, Default)]
pub struct TokenReply { pub access_token: Option<String>, pub refresh_token: Option<String>, pub expires_in: Option<u64>, pub refresh_token_expires_in: Option<u64>, pub error: Option<String> }
impl Drop for TokenReply { fn drop(&mut self) { self.access_token.zeroize(); self.refresh_token.zeroize(); } }
#[derive(Debug)]
pub enum OAuthError { Network, Rejected, InvalidResponse }
/// Injected clock and OAuth boundary keep all lifecycle tests deterministic.
pub trait OAuth: Send {
	fn begin(&self, client_id: &str) -> Result<DeviceCode, OAuthError>;
	fn poll(&self, client_id: &str, code: &str) -> Result<TokenReply, OAuthError>;
	fn refresh(&self, client_id: &str, token: &str) -> Result<TokenReply, OAuthError>;
}
pub struct GitHubOAuth;
impl GitHubOAuth {
	fn post<T: serde::de::DeserializeOwned>(&self, path: &str, fields: &[(&str, &str)]) -> Result<T, OAuthError> {
		let client = reqwest::blocking::Client::builder().timeout(Duration::from_secs(10)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| OAuthError::Network)?;
		let response = client.post(format!("https://github.com/login/{path}")).header("Accept", "application/json").header("User-Agent", "MorCherlf-Agent").form(fields).send().map_err(|_| OAuthError::Network)?;
		if !response.status().is_success() { return Err(OAuthError::Rejected); }
		let mut bytes = Vec::new(); response.take(65537).read_to_end(&mut bytes).map_err(|_| OAuthError::Network)?;
		let result = if bytes.len() > 65536 { Err(OAuthError::InvalidResponse) } else { serde_json::from_slice(&bytes).map_err(|_| OAuthError::InvalidResponse) }; bytes.zeroize(); result
	}
}
impl OAuth for GitHubOAuth {
	fn begin(&self, client_id: &str) -> Result<DeviceCode, OAuthError> { self.post("device/code", &[("client_id", client_id), ("scope", "read:user user:email offline_access")]) }
	fn poll(&self, client_id: &str, code: &str) -> Result<TokenReply, OAuthError> { self.post("oauth/access_token", &[("client_id", client_id), ("device_code", code), ("grant_type", "urn:ietf:params:oauth:grant-type:device_code")]) }
	fn refresh(&self, client_id: &str, token: &str) -> Result<TokenReply, OAuthError> { self.post("oauth/access_token", &[("client_id", client_id), ("refresh_token", token), ("grant_type", "refresh_token")]) }
}
struct Pending { code: DeviceCode, deadline: u64, next_poll: u64 }
pub struct Account {
	revision: u64, client_id: Option<String>, store: Box<dyn CredentialStore>, oauth: Box<dyn OAuth>,
	credential: Option<Credential>, pending: Option<Pending>, view: AccountView,
}
impl Account {
	pub fn new(client_id: Option<String>, store: Box<dyn CredentialStore>, oauth: Box<dyn OAuth>) -> Self {
		let client_id = client_id.filter(|id| !id.is_empty() && id.len() <= 128 && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'.' || c == b'_' || c == b'-'));
		let phase = if client_id.is_some() { AccountPhase::SignedOut } else { AccountPhase::Unconfigured };
		Self { revision: 0, client_id, store, oauth, credential: None, pending: None, view: AccountView { phase, user_code: None, verification_uri: None, expires_at: None } }
	}
	/// A server revocation must acquire a new credential, never replay the challenged one.
	pub fn challenge(&mut self, now: u64) {
		if let Some(credential) = self.credential.as_mut() { credential.expires_at = Some(0); }
		self.tick(now);
	}
	pub fn revision(&self) -> u64 { self.revision }
	pub fn view(&self) -> AccountView { self.view.clone() }
	fn phase(&mut self, phase: AccountPhase) { self.view = AccountView { phase, user_code: None, verification_uri: None, expires_at: None }; }
	fn store_error(&mut self, error: StoreError) { self.credential = None; self.phase(match error { StoreError::Denied => AccountPhase::Denied, StoreError::Locked => AccountPhase::Locked, _ => AccountPhase::Unavailable }); }
	pub fn restore(&mut self, now: u64) {
		if self.client_id.is_none() { return; }
		match self.store.read() {
			Ok(Some(credential)) if Some(&credential.client_id) == self.client_id.as_ref() => { self.revision += 1; self.credential = Some(credential); self.tick(now); }
			Ok(_) => self.phase(AccountPhase::SignedOut), Err(error) => self.store_error(error),
		}
	}
	pub fn begin(&mut self, now: u64) {
		self.pending = None;
		let Some(client_id) = &self.client_id else { self.phase(AccountPhase::Unconfigured); return; };
		// Starting another account is an explicit sign-out boundary; do not keep an old identity active.
		if let Err(error) = self.store.clear() { self.store_error(error); return; }
		self.credential = None;
		match self.oauth.begin(client_id) {
			Ok(code) if code.verification_uri == "https://github.com/login/device" && code.expires_in > 0 && code.expires_in <= 3600 && code.interval > 0 && code.interval <= 60 && !code.device_code.is_empty() && code.user_code.len() <= 32 => {
				let deadline = now.saturating_add(code.expires_in);
				self.view = AccountView { phase: AccountPhase::Authorizing, user_code: Some(code.user_code.clone()), verification_uri: Some(code.verification_uri.clone()), expires_at: Some(deadline) };
				self.pending = Some(Pending { next_poll: now.saturating_add(code.interval), code, deadline });
			}
			_ => self.phase(AccountPhase::Failed),
		}
	}
	pub fn cancel(&mut self) -> Result<(), &'static str> { self.logout() }
	pub fn logout(&mut self) -> Result<(), &'static str> {
		self.pending = None; self.credential = None;
		match self.store.clear() { Ok(()) => { self.phase(if self.client_id.is_some() { AccountPhase::SignedOut } else { AccountPhase::Unconfigured }); Ok(()) }, Err(error) => { self.store_error(error); Err("CREDENTIAL_CLEAR_FAILED") } }
	}
	pub fn tick(&mut self, now: u64) {
		if let Some(pending) = &mut self.pending {
			if now >= pending.deadline { self.pending = None; self.phase(AccountPhase::Expired); return; }
			if now < pending.next_poll { return; }
			pending.next_poll = now.saturating_add(pending.code.interval);
			let reply = self.oauth.poll(self.client_id.as_deref().unwrap(), &pending.code.device_code);
			match reply {
				Ok(reply) if reply.error.as_deref() == Some("authorization_pending") => {},
				Ok(reply) if reply.error.as_deref() == Some("slow_down") => { pending.code.interval = pending.code.interval.saturating_add(5); pending.next_poll = now.saturating_add(pending.code.interval); },
				Err(OAuthError::Network) => {}, // next scheduled poll, never retry a model task
				Ok(reply) => { self.pending = None; self.install(reply, now); },
				Err(_) => { self.pending = None; self.phase(AccountPhase::Failed); },
			}
			return;
		}
		if let Some(credential) = &self.credential {
			if credential.expires_at.is_some_and(|expiry| expiry <= now.saturating_add(60)) {
				let refresh = credential.refresh_token.as_deref().filter(|_| credential.refresh_expires_at.is_none_or(|expiry| expiry > now));
				if let Some(refresh) = refresh {
					match self.oauth.refresh(self.client_id.as_deref().unwrap(), refresh) { Ok(reply) => self.install(reply, now), Err(_) => { self.credential = None; self.phase(AccountPhase::Expired); } }
				} else { self.credential = None; self.phase(AccountPhase::Expired); }
			} else { self.phase(AccountPhase::SignedIn); }
		}
	}
	fn install(&mut self, reply: TokenReply, now: u64) {
		if let Some(error) = &reply.error { self.credential = None; self.phase(match error.as_str() { "access_denied" => AccountPhase::Denied, "expired_token" | "bad_refresh_token" => AccountPhase::Expired, _ => AccountPhase::Failed }); return; }
		let Some(token) = &reply.access_token else { self.phase(AccountPhase::Failed); return; };
		if token.is_empty() || token.len() > 16384 || reply.expires_in == Some(0) { self.phase(AccountPhase::Failed); return; }
		let credential = Credential { access_token: token.clone(), refresh_token: reply.refresh_token.clone(), expires_at: reply.expires_in.map(|seconds| now.saturating_add(seconds)), refresh_expires_at: reply.refresh_token_expires_in.map(|seconds| now.saturating_add(seconds)), client_id: self.client_id.clone().unwrap() };
		match self.store.save(&credential) { Ok(()) => { self.revision += 1; self.credential = Some(credential); self.phase(AccountPhase::SignedIn); }, Err(error) => self.store_error(error) }
	}
	/// Callback is native-only; callers cannot serialize the credential into an IPC reply.
	pub fn handoff(&self, now: u64, deliver: impl FnOnce(&str, Option<u64>) -> Result<(), String>) -> Result<(), String> {
		let credential = self.credential.as_ref().filter(|credential| self.view.phase == AccountPhase::SignedIn && credential.expires_at.is_none_or(|expiry| expiry > now)).ok_or("ACCOUNT_NOT_READY")?;
		deliver(&credential.access_token, credential.expires_at.map(|expiry| expiry.saturating_sub(now)))
	}
}
pub fn now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() }
#[cfg(test)]
#[path = "account_tests.rs"]
mod tests;

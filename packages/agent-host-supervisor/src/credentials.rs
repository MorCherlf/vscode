// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

/// Never Debug or serialize this value into IPC. Serialization is only for the native store.
#[derive(Clone, Serialize, Deserialize)]
pub struct Credential {
	pub access_token: String,
	pub refresh_token: Option<String>,
	pub expires_at: Option<u64>,
	pub refresh_expires_at: Option<u64>,
	pub client_id: String,
}
impl Drop for Credential {
	fn drop(&mut self) { self.access_token.zeroize(); self.refresh_token.zeroize(); }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreError { Denied, Locked, Unavailable, Corrupt }
/// One application-owned account, with no access to other products' credential namespaces.
pub trait CredentialStore: Send {
	fn read(&self) -> Result<Option<Credential>, StoreError>;
	fn save(&mut self, credential: &Credential) -> Result<(), StoreError>;
	fn clear(&mut self) -> Result<(), StoreError>;
}
#[derive(Default)]
pub struct MemoryStore { pub value: Option<Credential>, pub error: Option<StoreError> }
impl CredentialStore for MemoryStore {
	fn read(&self) -> Result<Option<Credential>, StoreError> { self.error.map_or_else(|| Ok(self.value.clone()), Err) }
	fn save(&mut self, credential: &Credential) -> Result<(), StoreError> { if let Some(error) = self.error { return Err(error); } self.value = Some(credential.clone()); Ok(()) }
	fn clear(&mut self) -> Result<(), StoreError> { if let Some(error) = self.error { return Err(error); } self.value = None; Ok(()) }
}
/// No plaintext fallback on platforms without an implemented system credential store.
pub struct SystemStore;
#[cfg(target_os = "macos")]
mod keychain {
	use super::*;
	use security_framework::passwords::{get_generic_password, set_generic_password, delete_generic_password};
	const SERVICE: &str = "com.morcherlf.agent.github-oauth";
	const ACCOUNT: &str = "primary";
	fn classify(error: security_framework::base::Error) -> StoreError {
		match error.code() { -128 | -25293 => StoreError::Denied, -25308 | -25291 => StoreError::Locked, _ => StoreError::Unavailable }
	}
	impl CredentialStore for SystemStore {
		fn read(&self) -> Result<Option<Credential>, StoreError> {
			let mut bytes = match get_generic_password(SERVICE, ACCOUNT) { Ok(bytes) => bytes, Err(error) if error.code() == -25300 => return Ok(None), Err(error) => return Err(classify(error)) };
			let result = serde_json::from_slice(&bytes).map(Some).map_err(|_| StoreError::Corrupt); bytes.zeroize(); result
		}
		fn save(&mut self, credential: &Credential) -> Result<(), StoreError> {
			let mut bytes = serde_json::to_vec(credential).map_err(|_| StoreError::Corrupt)?;
			let result = set_generic_password(SERVICE, ACCOUNT, &bytes).map_err(classify); bytes.zeroize(); result
		}
		fn clear(&mut self) -> Result<(), StoreError> { match delete_generic_password(SERVICE, ACCOUNT) { Ok(()) => Ok(()), Err(error) if error.code() == -25300 => Ok(()), Err(error) => Err(classify(error)) } }
	}
}
#[cfg(not(target_os = "macos"))]
impl CredentialStore for SystemStore {
	fn read(&self) -> Result<Option<Credential>, StoreError> { Err(StoreError::Unavailable) }
	fn save(&mut self, _: &Credential) -> Result<(), StoreError> { Err(StoreError::Unavailable) }
	fn clear(&mut self) -> Result<(), StoreError> { Err(StoreError::Unavailable) }
}

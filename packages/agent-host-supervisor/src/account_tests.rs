// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See LICENSE.txt in the project root for license information.
use super::*;
use crate::credentials::MemoryStore;
use std::sync::{Arc, Mutex};
#[derive(Default)]
struct Fixture { replies: Mutex<std::collections::VecDeque<TokenReply>>, polls: Mutex<usize> }
impl OAuth for Arc<Fixture> {
	fn begin(&self, _: &str) -> Result<DeviceCode, OAuthError> { Ok(DeviceCode { device_code: "private-device-fixture".into(), user_code: "TEST-CODE".into(), verification_uri: "https://github.com/login/device".into(), expires_in: 90, interval: 5 }) }
	fn poll(&self, _: &str, _: &str) -> Result<TokenReply, OAuthError> { *self.polls.lock().unwrap() += 1; Ok(self.replies.lock().unwrap().pop_front().unwrap()) }
	fn refresh(&self, _: &str, _: &str) -> Result<TokenReply, OAuthError> { self.poll("", "") }
}
fn token() -> TokenReply { TokenReply { access_token: Some("account-fixture".into()), refresh_token: Some("refresh-fixture".into()), expires_in: Some(120), refresh_token_expires_in: Some(600), error: None } }
fn account(store: MemoryStore, oauth: Arc<Fixture>) -> Account { Account::new(Some("own-test-app".into()), Box::new(store), Box::new(oauth)) }
#[test]
fn configuration_cancel_timeout_and_no_secret_projection() {
	let fixture = Arc::new(Fixture::default()); let mut missing = Account::new(None, Box::<MemoryStore>::default(), Box::new(fixture.clone()));
	missing.begin(0); assert_eq!(missing.view().phase, AccountPhase::Unconfigured);
	let mut account = account(MemoryStore::default(), fixture.clone()); account.begin(0); account.tick(4);
	assert_eq!(*fixture.polls.lock().unwrap(), 0);
	let public = serde_json::to_string(&account.view()).unwrap(); assert!(!public.contains("private-device-fixture"));
	account.cancel().unwrap(); account.tick(10); assert_eq!(account.view().phase, AccountPhase::SignedOut);
	account.begin(10); account.tick(100); assert_eq!(account.view().phase, AccountPhase::Expired);
}
#[test]
fn pending_slowdown_success_refresh_restore_and_logout() {
	let fixture = Arc::new(Fixture::default());
	fixture.replies.lock().unwrap().extend([TokenReply { error: Some("authorization_pending".into()), access_token: None, refresh_token: None, expires_in: None, refresh_token_expires_in: None }, TokenReply { error: Some("slow_down".into()), access_token: None, refresh_token: None, expires_in: None, refresh_token_expires_in: None }, token(), token()]);
	let mut account = account(MemoryStore::default(), fixture.clone()); account.begin(0); account.tick(5); account.tick(10); account.tick(15);
	assert_eq!(*fixture.polls.lock().unwrap(), 2); account.tick(20);
	assert_eq!(account.view().phase, AccountPhase::SignedIn);
	account.handoff(20, |token, expiry| { assert_eq!((token, expiry), ("account-fixture", Some(120))); Ok(()) }).unwrap();
	account.tick(80); assert_eq!(*fixture.polls.lock().unwrap(), 4);
	let public = serde_json::to_string(&account.view()).unwrap(); assert!(!public.contains("fixture"));
	account.credential = None; account.restore(90); assert_eq!(account.view().phase, AccountPhase::SignedIn);
	account.logout().unwrap(); assert!(account.store.read().unwrap().is_none()); assert!(account.handoff(90, |_, _| Ok(())).is_err());
}
#[test]
fn store_save_read_clear_denied_locked_and_corrupt_are_explicit() {
	for error in [StoreError::Denied, StoreError::Locked, StoreError::Unavailable, StoreError::Corrupt] {
		let credential = Credential { access_token: "fixture".into(), refresh_token: None, expires_at: None, refresh_expires_at: None, client_id: "own-test-app".into() };
		let mut store = MemoryStore::default(); store.save(&credential).unwrap(); assert!(store.read().unwrap().is_some()); store.clear().unwrap(); assert!(store.read().unwrap().is_none());
		store.error = Some(error); assert_eq!(store.save(&credential), Err(error)); assert!(matches!(store.read(), Err(found) if found == error)); assert_eq!(store.clear(), Err(error));
		let mut account = account(store, Arc::new(Fixture::default())); account.restore(0); assert_ne!(account.view().phase, AccountPhase::SignedIn); assert!(account.logout().is_err());
	}
}
#[test]
fn denial_expired_refresh_and_store_failure_never_handoff() {
	for error in ["access_denied", "expired_token", "bad_refresh_token", "invalid_client"] {
		let fixture = Arc::new(Fixture::default()); fixture.replies.lock().unwrap().push_back(TokenReply { error: Some(error.into()), access_token: None, refresh_token: None, expires_in: None, refresh_token_expires_in: None });
		let mut account = account(MemoryStore::default(), fixture); account.begin(0); account.tick(5); assert!(account.handoff(5, |_, _| panic!("must not deliver")).is_err());
	}
	let expired = Credential { access_token: "expired".into(), refresh_token: None, expires_at: Some(1), refresh_expires_at: None, client_id: "own-test-app".into() };
	let mut account = account(MemoryStore { value: Some(expired), error: None }, Arc::new(Fixture::default())); account.restore(2); assert_eq!(account.view().phase, AccountPhase::Expired);
}
#[test]
fn host_revocation_refreshes_new_credential_and_never_replays_old_one() {
	let fixture = Arc::new(Fixture::default()); fixture.replies.lock().unwrap().extend([token(), token()]);
	let mut account = account(MemoryStore::default(), fixture.clone()); account.begin(0); account.tick(5);
	let first = account.revision(); account.challenge(6); assert!(account.revision() > first);
	account.credential.as_mut().unwrap().refresh_token = None; account.challenge(7);
	assert_eq!(account.view().phase, AccountPhase::Expired); assert!(account.handoff(7, |_, _| panic!("revoked")).is_err());
}
#[test]
fn saving_after_oauth_is_denied_without_exposing_or_delivering_credentials() {
	struct DenySave;
	impl CredentialStore for DenySave {
		fn read(&self) -> Result<Option<Credential>, StoreError> { Ok(None) }
		fn save(&mut self, _: &Credential) -> Result<(), StoreError> { Err(StoreError::Denied) }
		fn clear(&mut self) -> Result<(), StoreError> { Ok(()) }
	}
	let fixture = Arc::new(Fixture::default()); fixture.replies.lock().unwrap().push_back(token());
	let mut account = Account::new(Some("own-app".into()), Box::new(DenySave), Box::new(fixture)); account.begin(0); account.tick(5);
	assert_eq!(account.view().phase, AccountPhase::Denied); assert!(account.handoff(5, |_, _| panic!("not saved")).is_err());
}
#[test]
fn cancel_after_inflight_completion_clears_the_just_saved_credential() {
	let fixture = Arc::new(Fixture::default()); fixture.replies.lock().unwrap().push_back(token());
	let mut account = account(MemoryStore::default(), fixture); account.begin(0); account.tick(5); account.cancel().unwrap();
	account.restore(6); assert_eq!(account.view().phase, AccountPhase::SignedOut); assert!(account.store.read().unwrap().is_none());
}
#[test]
fn network_interruption_keeps_poll_interval_and_never_delivers_on_failed_refresh() {
	struct NetworkFixture(std::sync::atomic::AtomicUsize);
	impl OAuth for NetworkFixture {
		fn begin(&self, _: &str) -> Result<DeviceCode, OAuthError> { Arc::new(Fixture::default()).begin("") }
		fn poll(&self, _: &str, _: &str) -> Result<TokenReply, OAuthError> { if self.0.fetch_add(1, std::sync::atomic::Ordering::SeqCst) == 0 { Err(OAuthError::Network) } else { Ok(token()) } }
		fn refresh(&self, _: &str, _: &str) -> Result<TokenReply, OAuthError> { Err(OAuthError::Network) }
	}
	let mut account = Account::new(Some("own-app".into()), Box::<MemoryStore>::default(), Box::new(NetworkFixture(std::sync::atomic::AtomicUsize::new(0))));
	account.begin(0); account.tick(5); assert_eq!(account.view().phase, AccountPhase::Authorizing); account.tick(6); assert!(account.handoff(6, |_, _| panic!("not authorized")).is_err());
	account.tick(10); assert_eq!(account.view().phase, AccountPhase::SignedIn); account.tick(70); assert_eq!(account.view().phase, AccountPhase::Expired); assert!(account.handoff(70, |_, _| panic!("refresh failed")).is_err());
}

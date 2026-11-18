//! Production providers for the store's `IdSource` and `Clock`. Kept outside the workspace
//! domain: this is where the operating system's randomness and clock are touched.

use crate::workspace_store::{Clock, ClockError, IdSource, IdUnavailable};
use std::time::SystemTime;

/// UUID v4 ids from operating-system randomness. Never falls back to a predictable source.
#[derive(Debug, Clone, Copy, Default)]
pub struct OsIdSource;

impl IdSource for OsIdSource {
    fn next_id(&mut self) -> Result<String, IdUnavailable> {
        id_from_random(|bytes| getrandom::fill(bytes).map_err(|_| ()))
    }
}

/// Whole Unix seconds from `SystemTime::now()`.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_unix_seconds(&self) -> Result<i64, ClockError> {
        unix_seconds(SystemTime::now())
    }
}

/// One request for 16 random bytes; if it fails there is no retry and no other source.
/// `uuid::Builder` sets the version (4) and variant bits; `hyphenated` prints lowercase.
fn id_from_random(fill: impl FnOnce(&mut [u8; 16]) -> Result<(), ()>) -> Result<String, IdUnavailable> {
    let mut bytes = [0u8; 16];
    fill(&mut bytes).map_err(|()| IdUnavailable)?;
    Ok(uuid::Builder::from_random_bytes(bytes).into_uuid().hyphenated().to_string())
}

/// Whole seconds since the Unix epoch, rounded down.
fn unix_seconds(time: SystemTime) -> Result<i64, ClockError> {
    let since = time.duration_since(SystemTime::UNIX_EPOCH).map_err(|_| ClockError::BeforeUnixEpoch)?;
    i64::try_from(since.as_secs()).map_err(|_| ClockError::OutOfRange)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::workspace_manifest::{create_workspace, format_timestamp, is_uuid_v4};
    use std::collections::HashSet;
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn random_bytes_become_a_canonical_lowercase_uuid_v4() {
        // The uuid crate sets the version and variant bits; the rest of the bytes pass through.
        assert_eq!(id_from_random(|b| { *b = [0x00; 16]; Ok(()) }).unwrap(), "00000000-0000-4000-8000-000000000000");
        assert_eq!(id_from_random(|b| { *b = [0xff; 16]; Ok(()) }).unwrap(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
        let id = id_from_random(|b| { *b = *b"\x4f\x52\x5f\x09\x3c\x12\x00\x9f\x00\x2b\xc1\x48\xc2\x5e\x63\xba"; Ok(()) }).unwrap();
        assert_eq!(id, "4f525f09-3c12-409f-802b-c148c25e63ba");
    }

    #[test]
    fn a_failing_random_source_is_an_error_and_is_asked_only_once() {
        let mut calls = 0;
        let result = id_from_random(|_| {
            calls += 1;
            Err(())
        });
        assert_eq!(result, Err(IdUnavailable));
        assert_eq!(calls, 1, "no retry and no second source");
    }

    #[test]
    fn the_operating_system_source_produces_valid_distinct_ids() {
        let mut source = OsIdSource;
        let mut seen = HashSet::new();
        for _ in 0..2_000 {
            let id = source.next_id().unwrap();
            assert!(is_uuid_v4(&id), "{id}");
            assert!(create_workspace(&id, "Alpha", 0).is_ok());
            assert!(seen.insert(id), "duplicate id");
        }
    }

    #[test]
    fn unix_seconds_floors_to_whole_seconds() {
        assert_eq!(unix_seconds(UNIX_EPOCH), Ok(0));
        assert_eq!(unix_seconds(UNIX_EPOCH + Duration::from_secs(1_794_899_109)), Ok(1_794_899_109));
        assert_eq!(unix_seconds(UNIX_EPOCH + Duration::from_millis(1_999)), Ok(1), "fractions are dropped, not rounded");
        assert_eq!(unix_seconds(UNIX_EPOCH + Duration::from_nanos(999_999_999)), Ok(0));
    }

    #[test]
    fn a_time_before_the_epoch_is_an_explicit_error_not_zero() {
        assert_eq!(unix_seconds(UNIX_EPOCH - Duration::from_nanos(1)), Err(ClockError::BeforeUnixEpoch));
        assert_eq!(unix_seconds(UNIX_EPOCH - Duration::from_secs(86_400 * 365)), Err(ClockError::BeforeUnixEpoch));
    }

    #[test]
    fn a_time_too_large_for_i64_seconds_is_an_explicit_error() {
        // Not every platform can represent such a SystemTime; where it can, it must not wrap or panic.
        if let Some(t) = UNIX_EPOCH.checked_add(Duration::from_secs(i64::MAX as u64 + 1)) {
            assert_eq!(unix_seconds(t), Err(ClockError::OutOfRange));
        }
        if let Some(t) = UNIX_EPOCH.checked_add(Duration::from_secs(i64::MAX as u64)) {
            assert_eq!(unix_seconds(t), Ok(i64::MAX));
        }
    }

    #[test]
    fn the_system_clock_is_plausible_and_formats_as_a_timestamp() {
        let now = SystemClock.now_unix_seconds().unwrap();
        assert!(now > 1_700_000_000, "{now}"); // after 2023-11
        assert!(format_timestamp(now).is_ok());
    }
}

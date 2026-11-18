//! Decoder for workspace manifests, schema version 1. The Rust counterpart of `decodeManifest` in
//! `packages/domain/src/manifest.ts`, which is the behavioural reference. The shared cases are in
//! `packages/domain/fixtures/workspace-manifest.json` and run by `tests/workspace_manifest_fixtures.rs`.
//!
//! Validation order: JSON syntax, root object, schema version, `id`, `name`, `createdAt`.
//! Unknown properties are ignored. A repeated key uses its last value. Nothing is repaired:
//! a stored name that is not already trimmed is rejected.
//!
//! # Unpaired UTF-16 surrogates
//!
//! JavaScript's `JSON.parse` accepts `"\ud800"`; `serde_json` rejects it when reading a `String`.
//! To keep the TypeScript categories, known fields are captured as raw JSON text
//! (`serde_json::value::RawValue`, which accepts such escapes) and decoded here with
//! `String::from_utf16`, which detects unpaired surrogates exactly. Unknown properties are skipped
//! with `IgnoredAny`, which also accepts them. The result matches TypeScript:
//! `name` -> `malformed_utf16`, `id` -> `invalid_id`, `createdAt` -> `invalid_timestamp`,
//! unknown values -> accepted.
//!
//! One difference remains: `serde_json` cannot read an object **key** containing an unpaired
//! surrogate escape, so such a manifest is `malformed_json` here and accepted by TypeScript.
//! Rust is the stricter side. The fixture case `unknown-key-lone-surrogate` records it.

use crate::workspace_name::{parse_stored_name, validate_name, NameError, WorkspaceName};
use serde::de::{self, Deserialize, Deserializer, IgnoredAny, MapAccess, Visitor};
use serde_json::value::RawValue;
use std::fmt;

pub const SCHEMA_VERSION: u32 = 1;

/// A valid workspace record. `id` is a canonical lowercase UUID v4, `created_at` a canonical
/// `YYYY-MM-DDTHH:MM:SSZ` timestamp (1970..=9999). Both are validated by `decode_manifest`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Workspace {
    pub id: String,
    pub name: WorkspaceName,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdError {
    Missing,
    NotAString,
    Invalid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NameFieldError {
    Missing,
    NotAString,
    /// The JSON string held an unpaired surrogate escape.
    MalformedUtf16,
    Invalid(NameError),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimestampError {
    Missing,
    NotAString,
    Invalid,
    OutOfRange,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ManifestError {
    MalformedJson,
    NotAnObject,
    /// Absent, not a number, or a number that is not an integer.
    InvalidSchemaVersion,
    /// An integer other than 1. Carries the number as read (a double, like JavaScript).
    UnsupportedVersion(f64),
    Id(IdError),
    Name(NameFieldError),
    CreatedAt(TimestampError),
}

impl ManifestError {
    /// The code shared with the TypeScript domain and the fixture.
    pub fn code(&self) -> &'static str {
        match self {
            Self::MalformedJson => "malformed_json",
            Self::NotAnObject => "not_an_object",
            Self::InvalidSchemaVersion => "invalid_schema_version",
            Self::UnsupportedVersion(_) => "unsupported_version",
            Self::Id(IdError::Missing) | Self::Name(NameFieldError::Missing) | Self::CreatedAt(TimestampError::Missing) => "missing",
            Self::Id(IdError::NotAString) | Self::Name(NameFieldError::NotAString) | Self::CreatedAt(TimestampError::NotAString) => "not_a_string",
            Self::Id(IdError::Invalid) => "invalid_id",
            Self::Name(NameFieldError::MalformedUtf16) => "malformed_utf16",
            Self::Name(NameFieldError::Invalid(e)) => e.code(),
            Self::CreatedAt(TimestampError::Invalid) => "invalid_timestamp",
            Self::CreatedAt(TimestampError::OutOfRange) => "timestamp_out_of_range",
        }
    }

    pub fn field(&self) -> Option<&'static str> {
        match self {
            Self::Id(_) => Some("id"),
            Self::Name(_) => Some("name"),
            Self::CreatedAt(_) => Some("createdAt"),
            _ => None,
        }
    }

    pub fn version(&self) -> Option<f64> {
        match self {
            Self::UnsupportedVersion(v) => Some(*v),
            _ => None,
        }
    }
}

/// Raw JSON text of the known properties (`None` = absent). The last occurrence wins.
#[derive(Default)]
struct Fields {
    schema_version: Option<Box<RawValue>>,
    id: Option<Box<RawValue>>,
    name: Option<Box<RawValue>>,
    created_at: Option<Box<RawValue>>,
}

impl<'de> Deserialize<'de> for Fields {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Fields;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a JSON object")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Fields, A::Error> {
                let mut f = Fields::default();
                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "schemaVersion" => f.schema_version = Some(map.next_value()?),
                        "id" => f.id = Some(map.next_value()?),
                        "name" => f.name = Some(map.next_value()?),
                        "createdAt" => f.created_at = Some(map.next_value()?),
                        _ => {
                            map.next_value::<IgnoredAny>()?;
                        }
                    }
                }
                Ok(f)
            }
        }
        d.deserialize_map(V).map_err(de::Error::custom)
    }
}

/// A JSON string value: its text, or "an unpaired surrogate" (not representable in a `String`).
enum Text {
    Valid(String),
    UnpairedSurrogate,
}

/// Reads one raw JSON value as a string. `Err(())` means the value is not a JSON string.
/// The input was already validated by `serde_json`, so escapes are well formed.
fn json_string(raw: &RawValue) -> Result<Text, ()> {
    let inner = raw.get().strip_prefix('"').and_then(|s| s.strip_suffix('"')).ok_or(())?;
    let mut units: Vec<u16> = Vec::with_capacity(inner.len());
    let mut chars = inner.chars();
    while let Some(c) = chars.next() {
        if c != '\\' {
            let mut buf = [0u16; 2];
            units.extend_from_slice(c.encode_utf16(&mut buf));
            continue;
        }
        let unit = match chars.next().ok_or(())? {
            '"' => 0x22,
            '\\' => 0x5C,
            '/' => 0x2F,
            'b' => 0x08,
            'f' => 0x0C,
            'n' => 0x0A,
            'r' => 0x0D,
            't' => 0x09,
            'u' => {
                let hex: String = chars.by_ref().take(4).collect();
                u16::from_str_radix(&hex, 16).map_err(|_| ())?
            }
            _ => return Err(()),
        };
        units.push(unit);
    }
    Ok(match String::from_utf16(&units) {
        Ok(s) => Text::Valid(s),
        Err(_) => Text::UnpairedSurrogate,
    })
}

enum FieldText {
    Missing,
    NotAString,
    Text(Text),
}

fn field_text(raw: &Option<Box<RawValue>>) -> FieldText {
    match raw {
        None => FieldText::Missing,
        Some(r) if !r.get().starts_with('"') => FieldText::NotAString,
        // A value starting with `"` that cannot be unescaped cannot occur after serde_json validated it.
        Some(r) => json_string(r).map_or(FieldText::NotAString, FieldText::Text),
    }
}

/// Decodes and fully validates a manifest. Never repairs.
pub fn decode_manifest(text: &str) -> Result<Workspace, ManifestError> {
    use ManifestError as E;
    // Pass 1: is this one valid JSON value? (Accepts unpaired surrogate escapes, like JavaScript.)
    let root: Box<RawValue> = serde_json::from_str(text).map_err(|_| E::MalformedJson)?;
    let root = root.get().trim_start_matches([' ', '\t', '\n', '\r']);
    if !root.starts_with('{') {
        return Err(E::NotAnObject);
    }
    // Pass 2: pick out the known properties.
    let f: Fields = serde_json::from_str(root).map_err(|_| E::MalformedJson)?;

    check_version(f.schema_version.as_deref())?;

    let id = match field_text(&f.id) {
        FieldText::Missing => return Err(E::Id(IdError::Missing)),
        FieldText::NotAString => return Err(E::Id(IdError::NotAString)),
        FieldText::Text(Text::UnpairedSurrogate) => return Err(E::Id(IdError::Invalid)),
        FieldText::Text(Text::Valid(s)) if is_uuid_v4(&s) => s,
        FieldText::Text(Text::Valid(_)) => return Err(E::Id(IdError::Invalid)),
    };

    let name = match field_text(&f.name) {
        FieldText::Missing => return Err(E::Name(NameFieldError::Missing)),
        FieldText::NotAString => return Err(E::Name(NameFieldError::NotAString)),
        FieldText::Text(Text::UnpairedSurrogate) => return Err(E::Name(NameFieldError::MalformedUtf16)),
        FieldText::Text(Text::Valid(s)) => parse_stored_name(&s).map_err(|e| E::Name(NameFieldError::Invalid(e)))?,
    };

    let created_at = match field_text(&f.created_at) {
        FieldText::Missing => return Err(E::CreatedAt(TimestampError::Missing)),
        FieldText::NotAString => return Err(E::CreatedAt(TimestampError::NotAString)),
        FieldText::Text(Text::UnpairedSurrogate) => return Err(E::CreatedAt(TimestampError::Invalid)),
        FieldText::Text(Text::Valid(s)) => check_timestamp(&s).map(|()| s).map_err(E::CreatedAt)?,
    };

    Ok(Workspace { id, name, created_at })
}

/// JavaScript semantics: a JSON number is a double; the version must be an integer value equal to 1.
fn check_version(raw: Option<&RawValue>) -> Result<(), ManifestError> {
    let Some(raw) = raw else { return Err(ManifestError::InvalidSchemaVersion) };
    let text = raw.get();
    if !text.starts_with(|c: char| c == '-' || c.is_ascii_digit()) {
        return Err(ManifestError::InvalidSchemaVersion); // string, boolean, null, array or object
    }
    // Valid JSON number text; Rust's parser accepts that grammar and overflows to infinity like JavaScript.
    let n: f64 = text.parse().map_err(|_| ManifestError::InvalidSchemaVersion)?;
    if !n.is_finite() || n.fract() != 0.0 {
        return Err(ManifestError::InvalidSchemaVersion);
    }
    if n != f64::from(SCHEMA_VERSION) {
        return Err(ManifestError::UnsupportedVersion(n));
    }
    Ok(())
}

/// Canonical lowercase UUID v4: 8-4-4-4-12 hex digits, version nibble 4, variant nibble 8, 9, a or b.
pub(crate) fn is_uuid_v4(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 36
        && b.iter().enumerate().all(|(i, &c)| match i {
            8 | 13 | 18 | 23 => c == b'-',
            14 => c == b'4',
            19 => matches!(c, b'8' | b'9' | b'a' | b'b'),
            _ => matches!(c, b'0'..=b'9' | b'a'..=b'f'),
        })
}

/// Canonical `YYYY-MM-DDTHH:MM:SSZ`, ASCII digits only, a real Gregorian date, years 1970..=9999.
/// Calendar errors are reported before range errors, as in TypeScript.
fn check_timestamp(s: &str) -> Result<(), TimestampError> {
    let b = s.as_bytes();
    let shape = b.len() == 20
        && b.iter().enumerate().all(|(i, &c)| match i {
            4 | 7 => c == b'-',
            10 => c == b'T',
            13 | 16 => c == b':',
            19 => c == b'Z',
            _ => c.is_ascii_digit(),
        });
    if !shape {
        return Err(TimestampError::Invalid);
    }
    let n = |r: std::ops::Range<usize>| s[r].parse::<u32>().expect("ASCII digits");
    let (year, month, day, hour, minute, second) = (n(0..4), n(5..7), n(8..10), n(11..13), n(14..16), n(17..19));
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        2 if leap => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if !(1..=12).contains(&month) || day < 1 || day > days || hour > 23 || minute > 59 || second > 59 {
        return Err(TimestampError::Invalid);
    }
    if year < 1970 { Err(TimestampError::OutOfRange) } else { Ok(()) } // 4 digits: 9999 is the maximum
}

/// Latest supported instant: 9999-12-31T23:59:59Z.
const MAX_UNIX_SECONDS: i64 = 253_402_300_799;

/// Formats Unix seconds (UTC) as the canonical timestamp. The caller supplies the time; this reads no clock.
pub fn format_timestamp(unix_seconds: i64) -> Result<String, TimestampError> {
    if !(0..=MAX_UNIX_SECONDS).contains(&unix_seconds) {
        return Err(TimestampError::OutOfRange);
    }
    let days = unix_seconds / 86_400;
    let rest = unix_seconds % 86_400;
    // Days to civil date (proleptic Gregorian), H. Hinnant's algorithm; days >= 0 here.
    let z = days + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    Ok(format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rest / 3_600,
        rest % 3_600 / 60,
        rest % 60
    ))
}

/// Why a new workspace could not be built.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NewWorkspaceError {
    InvalidId,
    InvalidName(NameError),
    InvalidTimestamp(TimestampError),
}

/// Builds a valid record, like `createWorkspace` in TypeScript. Reports the first problem in the
/// order id, name, createdAt. `name` is raw user input and is trimmed and validated.
pub fn create_workspace(id: &str, name: &str, unix_seconds: i64) -> Result<Workspace, NewWorkspaceError> {
    if !is_uuid_v4(id) {
        return Err(NewWorkspaceError::InvalidId);
    }
    let name = validate_name(name).map_err(NewWorkspaceError::InvalidName)?;
    let created_at = format_timestamp(unix_seconds).map_err(NewWorkspaceError::InvalidTimestamp)?;
    Ok(Workspace { id: id.to_string(), name, created_at })
}

/// Deterministic manifest text, byte-for-byte what TypeScript `encodeManifest` writes:
/// fixed key order, two-space indent, trailing newline. Strings are escaped like `JSON.stringify`.
pub fn encode_manifest(workspace: &Workspace) -> String {
    let json = |s: &str| serde_json::to_string(s).expect("a string always serializes");
    format!(
        "{{\n  \"schemaVersion\": {SCHEMA_VERSION},\n  \"id\": {},\n  \"name\": {},\n  \"createdAt\": {}\n}}\n",
        json(&workspace.id),
        json(workspace.name.as_str()),
        json(&workspace.created_at)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "4f525f09-3c12-449f-872b-c148c25e63ba";

    #[test]
    fn formats_known_instants() {
        for (secs, text) in [
            (0, "1970-01-01T00:00:00Z"),
            (1_794_899_109, "2026-11-17T07:05:09Z"),
            (1_709_208_000, "2024-02-29T12:00:00Z"),
            (951_868_800, "2000-03-01T00:00:00Z"),
            (253_402_300_799, "9999-12-31T23:59:59Z"),
        ] {
            assert_eq!(format_timestamp(secs).as_deref(), Ok(text), "{secs}");
        }
    }

    #[test]
    fn rejects_instants_outside_1970_to_9999() {
        assert_eq!(format_timestamp(-1), Err(TimestampError::OutOfRange));
        assert_eq!(format_timestamp(i64::MIN), Err(TimestampError::OutOfRange));
        assert_eq!(format_timestamp(253_402_300_800), Err(TimestampError::OutOfRange));
        assert_eq!(format_timestamp(i64::MAX), Err(TimestampError::OutOfRange));
    }

    /// Walks every day from 1970-01-01 to 9999-12-31 with an independent incremental calendar
    /// and compares it with the direct computation. Every result must also pass `check_timestamp`.
    #[test]
    fn every_day_matches_an_incremental_calendar() {
        let (mut y, mut m, mut d) = (1970u32, 1u32, 1u32);
        let mut secs = 0i64;
        let mut days = 0u32;
        loop {
            let want = format!("{y:04}-{m:02}-{d:02}T00:00:00Z");
            let got = format_timestamp(secs).unwrap();
            assert_eq!(got, want, "day {days}");
            assert_eq!(check_timestamp(&got), Ok(()));
            if (y, m, d) == (9999, 12, 31) {
                break;
            }
            let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
            let dim = match m { 2 if leap => 29, 2 => 28, 4 | 6 | 9 | 11 => 30, _ => 31 };
            if d < dim { d += 1 } else if m < 12 { m += 1; d = 1 } else { y += 1; m = 1; d = 1 }
            secs += 86_400;
            days += 1;
        }
        assert_eq!(days, 2_932_896);
        assert_eq!(secs + 86_399, 253_402_300_799);
    }

    #[test]
    fn creates_a_record_with_a_trimmed_name() {
        let w = create_workspace(ID, "  \u{C4}lpha MIX \u{A0}", 1_794_899_109).unwrap();
        assert_eq!((w.id.as_str(), w.name.as_str(), w.created_at.as_str()), (ID, "\u{C4}lpha MIX", "2026-11-17T07:05:09Z"));
    }

    #[test]
    fn create_reports_the_first_problem_in_order() {
        use NewWorkspaceError as E;
        assert_eq!(create_workspace("x", "", -1), Err(E::InvalidId));
        assert_eq!(create_workspace(&ID.to_uppercase(), "Alpha", 0), Err(E::InvalidId));
        assert_eq!(create_workspace(ID, " ", -1), Err(E::InvalidName(NameError::Empty)));
        assert_eq!(create_workspace(ID, "A\tB", 0), Err(E::InvalidName(NameError::ControlCharacter)));
        assert_eq!(create_workspace(ID, &"a".repeat(65), 0), Err(E::InvalidName(NameError::TooLong)));
        assert_eq!(create_workspace(ID, "Alpha", -1), Err(E::InvalidTimestamp(TimestampError::OutOfRange)));
    }

    #[test]
    fn encodes_the_typescript_layout_exactly() {
        let w = create_workspace(ID, "Alpha", 1_794_899_109).unwrap();
        assert_eq!(
            encode_manifest(&w),
            format!("{{\n  \"schemaVersion\": 1,\n  \"id\": \"{ID}\",\n  \"name\": \"Alpha\",\n  \"createdAt\": \"2026-11-17T07:05:09Z\"\n}}\n")
        );
    }

    #[test]
    fn encoding_escapes_like_json_stringify_and_round_trips() {
        for name in ["A \"quoted\" name", "back\\slash", "caf\u{E9}", "cafe\u{301}", "\u{1F600} emoji", "a/b", "\u{2028}x\u{2029}".trim_matches(['\u{2028}', '\u{2029}'])] {
            let w = create_workspace(ID, name, 0).unwrap();
            let text = encode_manifest(&w);
            assert_eq!(decode_manifest(&text), Ok(w), "{name:?}");
        }
        // U+2028 inside a name is written as the raw character, as JSON.stringify does.
        let w = create_workspace(ID, "a\u{2028}b", 0).unwrap();
        assert!(encode_manifest(&w).contains("a\u{2028}b"));
    }
}

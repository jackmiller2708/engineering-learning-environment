//! Runs the shared manifest fixture (`packages/domain/fixtures/workspace-manifest.json`) against
//! the Rust decoder. TypeScript is the behavioural reference. Nothing is copied here.

use ele_desktop_lib::workspace_manifest::{decode_manifest, ManifestError};
use serde_json::{json, Value};

fn fixture() -> Value {
    let path = format!("{}/../../../packages/domain/fixtures/workspace-manifest.json", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("cannot read {path}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("cannot parse {path}: {e}"))
}

/// The error in the fixture's shape: {code}, {field, code} or {code, version}.
fn error_shape(e: &ManifestError) -> Value {
    let mut o = json!({ "code": e.code() });
    if let Some(field) = e.field() {
        o["field"] = json!(field);
    }
    if let Some(version) = e.version() {
        o["version"] = json!(version);
    }
    o
}

/// `Value` distinguishes the integer 2 from the double 2.0; the contract compares numbers as doubles.
fn with_version_as_double(mut v: Value) -> Value {
    if let Some(n) = v["error"].get("version").and_then(Value::as_f64) {
        v["error"]["version"] = json!(n);
        assert!(v["error"]["version"].is_f64());
    }
    v
}

fn outcome_shape(text: &str) -> Value {
    match decode_manifest(text) {
        Ok(w) => json!({ "ok": true, "workspace": { "id": w.id, "name": w.name.as_str(), "createdAt": w.created_at } }),
        Err(e) => json!({ "ok": false, "error": error_shape(&e) }),
    }
}

#[test]
fn every_fixture_case_matches_typescript() {
    let f = fixture();
    let cases = f["cases"].as_array().unwrap();
    let mut deviations = Vec::new();
    for c in cases {
        let id = c["id"].as_str().unwrap();
        let input = c["input"].as_str().unwrap();
        let actual = outcome_shape(input);
        match c.get("rustDeviation") {
            None => assert_eq!(actual, with_version_as_double(c["expect"].clone()), "case `{id}`: {}", c["note"]),
            Some(d) => {
                // A deviation is explicit and exact: Rust must produce the stated outcome,
                // and it must differ from the TypeScript one.
                assert_ne!(d["expect"], c["expect"], "case `{id}`: deviation equals the reference");
                assert_eq!(actual, with_version_as_double(d["expect"].clone()), "case `{id}` (documented Rust deviation): {}", d["reason"]);
                deviations.push(id.to_string());
            }
        }
    }
    eprintln!("manifest fixture: {} cases, {} documented deviations: {deviations:?}", cases.len(), deviations.len());
    assert_eq!(cases.len(), 148);
    assert_eq!(deviations, ["unknown-key-lone-surrogate"]);
}

#[test]
fn case_ids_are_unique() {
    let f = fixture();
    let mut ids: Vec<&str> = f["cases"].as_array().unwrap().iter().map(|c| c["id"].as_str().unwrap()).collect();
    let n = ids.len();
    ids.sort();
    ids.dedup();
    assert_eq!(ids.len(), n);
}

#[test]
fn deeply_nested_unknown_values_do_not_overflow_the_stack() {
    let deep = format!(
        r#"{{"schemaVersion":1,"id":"4f525f09-3c12-449f-872b-c148c25e63ba","name":"Alpha","createdAt":"2026-11-17T07:05:09Z","x":{}1{}}}"#,
        "[".repeat(100_000),
        "]".repeat(100_000)
    );
    assert!(decode_manifest(&deep).is_ok());
}

#[test]
fn the_decoder_never_modifies_what_it_reads() {
    // Decoding returns values only. The stored name is returned exactly as written.
    let text = r#"{"schemaVersion":1,"id":"4f525f09-3c12-449f-872b-c148c25e63ba","name":"Café Ä","createdAt":"2026-11-17T07:05:09Z"}"#;
    assert_eq!(decode_manifest(text).unwrap().name.as_str(), "Cafe\u{301} \u{C4}");
}

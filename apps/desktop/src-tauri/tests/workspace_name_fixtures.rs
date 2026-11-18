//! Runs the shared TypeScript-owned fixtures against the Rust implementation.
//! The fixtures are read from `packages/domain/fixtures`; nothing is copied here.

use ele_desktop_lib::workspace_name::{
    comparison_key, is_control, is_white_space, parse_stored_name, validate_name,
};
use serde_json::Value;

fn fixture(file: &str) -> Value {
    let path = format!("{}/../../../packages/domain/fixtures/{file}", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("cannot read {path}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("cannot parse {path}: {e}"))
}

fn names() -> Value {
    fixture("workspace-name.json")
}

fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v[key].as_str().unwrap_or_else(|| panic!("missing string `{key}` in {v}"))
}

fn code_points(v: &Value) -> Vec<u32> {
    v.as_array().unwrap().iter().map(|n| n.as_u64().unwrap() as u32).collect()
}

/// Asserts a Result against a fixture `expect` object.
fn assert_outcome(id: &str, actual: Result<String, &'static str>, expect: &Value) {
    if expect["ok"].as_bool().unwrap() {
        assert_eq!(actual, Ok(s(expect, "name").to_string()), "case `{id}`");
    } else {
        assert_eq!(actual, Err(s(expect, "error")), "case `{id}`");
    }
}

#[test]
fn rules_match_the_fixture() {
    let f = names();
    assert_eq!(f["rules"]["maxScalarValues"], 64);
    let ws = code_points(&f["rules"]["trimmedWhiteSpaceCodePoints"]);
    let cc = code_points(&f["rules"]["controlCodePoints"]);
    let mut wrong = Vec::new();
    for cp in 0..=0x10FFFFu32 {
        let Some(c) = char::from_u32(cp) else { continue };
        if is_white_space(c) != ws.contains(&cp) {
            wrong.push(format!("White_Space U+{cp:04X}"));
        }
        if is_control(c) != cc.contains(&cp) {
            wrong.push(format!("Cc U+{cp:04X}"));
        }
    }
    assert!(wrong.is_empty(), "set mismatches: {wrong:?}");
}

#[test]
fn validation_cases() {
    let f = names();
    let (mut run, mut skipped) = (0, 0);
    for case in f["validation"].as_array().unwrap() {
        let id = s(case, "id");
        if case["representableInRustString"] == false {
            // An unpaired surrogate cannot be a Rust `String`. The case must say so by giving
            // UTF-16 code units instead of `input`. Any other skipped case is a failure.
            assert!(case.get("input").is_none(), "case `{id}` is flagged unrepresentable but has `input`");
            assert!(case.get("inputUtf16CodeUnits").is_some(), "case `{id}` lacks inputUtf16CodeUnits");
            assert_eq!(s(&case["expect"], "error"), "malformed_utf16", "case `{id}`");
            let units = code_points(&case["inputUtf16CodeUnits"]);
            let units: Vec<u16> = units.iter().map(|u| *u as u16).collect();
            assert!(String::from_utf16(&units).is_err(), "case `{id}` is representable after all");
            skipped += 1;
            continue;
        }
        let input = s(case, "input");
        assert_outcome(id, validate_name(input).map(|n| n.as_str().to_string()).map_err(|e| e.code()), &case["expect"]);
        run += 1;
    }
    eprintln!("validation: {run} run, {skipped} skipped (unpaired surrogates)");
    assert_eq!(run + skipped, f["validation"].as_array().unwrap().len());
    assert_eq!((run, skipped), (36, 5));
}

#[test]
fn stored_name_cases() {
    let f = names();
    let cases = f["storedNames"].as_array().unwrap();
    for case in cases {
        let id = s(case, "id");
        assert_outcome(id, parse_stored_name(s(case, "input")).map(|n| n.as_str().to_string()).map_err(|e| e.code()), &case["expect"]);
    }
    assert_eq!(cases.len(), 9);
}

#[test]
fn comparison_cases() {
    let f = names();
    let cases = f["comparison"].as_array().unwrap();
    for case in cases {
        let id = s(case, "id");
        let key = |field: &str| comparison_key(&validate_name(s(case, field)).unwrap_or_else(|e| panic!("case `{id}`: {field} invalid: {e:?}")));
        assert_eq!(key("a") == key("b"), case["duplicate"].as_bool().unwrap(), "case `{id}`: {}", s(case, "note"));
    }
    assert_eq!(cases.len(), 24);
}

#[test]
fn key_cases() {
    let f = names();
    let cases = f["keys"].as_array().unwrap();
    for case in cases {
        let name = validate_name(s(case, "name")).unwrap();
        assert_eq!(comparison_key(&name), s(case, "key"), "name {:?}", s(case, "name"));
    }
    assert_eq!(cases.len(), 6);
}

#[test]
fn unicode_18_case_folding_for_every_non_cc_scalar_value() {
    let f = fixture("casefold-unicode-18.0.0.json");
    assert_eq!(s(&f, "unicodeVersion"), "18.0.0");
    let mut expected = std::collections::HashMap::new();
    for m in f["mappings"].as_array().unwrap() {
        let cp = m[0].as_u64().unwrap() as u32;
        let to: String = m[1].as_array().unwrap().iter().map(|c| char::from_u32(c.as_u64().unwrap() as u32).unwrap()).collect();
        expected.insert(cp, to);
    }
    assert_eq!(expected.len() as u64, f["entryCount"].as_u64().unwrap());
    assert_eq!(expected.len(), 1606);

    // 1,112,064 scalar values = 1,111,999 checked through the name API + 65 Cc values.
    // Cc values cannot be part of a valid name, so the key function is never applied to them.
    // The fixture maps none of them, so their folding is the identity either way.
    let cc = code_points(&names()["rules"]["controlCodePoints"]);
    assert_eq!(cc.len(), 65);
    assert!(cc.iter().all(|cp| !expected.contains_key(cp)), "a Cc code point has a case-fold mapping");

    let mut wrong = Vec::new();
    let mut skipped = Vec::new();
    let mut checked = 0u32;
    for cp in 0..=0x10FFFFu32 {
        let Some(c) = char::from_u32(cp) else { continue };
        let Ok(name) = validate_name(&format!("a{c}b")) else {
            skipped.push(cp);
            continue;
        };
        checked += 1;
        let want = format!("a{}b", expected.get(&cp).cloned().unwrap_or_else(|| c.to_string()));
        let got = comparison_key(&name);
        if got != want {
            wrong.push(format!("U+{cp:04X}: got {got:?}, want {want:?}"));
        }
    }
    assert!(wrong.is_empty(), "{} mismatches, first: {:?}", wrong.len(), &wrong[..wrong.len().min(5)]);
    assert_eq!(skipped, cc, "skipped code points must be exactly the Cc set");
    assert_eq!(checked, 1_111_999);
    assert_eq!(checked as usize + skipped.len(), 1_112_064);
    eprintln!("case folding: {checked} checked + {} Cc skipped = 1112064 scalar values; {} mapped", skipped.len(), expected.len());
}

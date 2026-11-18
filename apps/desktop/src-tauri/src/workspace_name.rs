//! Workspace-name rules, the Rust counterpart of `packages/domain/src/name.ts`.
//!
//! The contract is owned by the TypeScript domain and expressed in
//! `packages/domain/fixtures/workspace-name.json`; `tests/workspace_name_fixtures.rs` runs it.
//!
//! * Trim Unicode White_Space at both ends (explicit set below, not `str::trim`).
//! * Reject General_Category Cc. Maximum 64 Unicode scalar values. No normalization.
//! * Duplicate key: Unicode Default Case Folding, non-Turkic (CaseFolding.txt statuses C and F),
//!   via `icu_casemap` `=2.4.0` (`icu_casemap_data` 2.4.0: Unicode 18.0.0, CLDR 49.0.0).
//!   `fold_string` is the default fold; the Turkic variant is a separate method that is never used.
//!
//! Unpaired UTF-16 surrogates (`malformed_utf16` in TypeScript) cannot occur here: a Rust
//! `&str`/`String` is always valid UTF-8, so the type system excludes them. A caller decoding
//! UTF-16 or JSON `\ud800` escapes must reject them before a name exists (`serde_json` does).

use icu_casemap::CaseMapperBorrowed;

/// Maximum length in Unicode scalar values (not bytes, not UTF-16 units).
pub const MAX_NAME_LENGTH: usize = 64;

/// A validated, trimmed workspace name. Only this module can construct one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceName(String);

impl WorkspaceName {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NameError {
    Empty,
    ControlCharacter,
    TooLong,
    /// Stored names only: the name has leading or trailing White_Space.
    NotTrimmed,
}

impl NameError {
    /// The code shared with the TypeScript domain and the fixtures.
    pub fn code(self) -> &'static str {
        match self {
            NameError::Empty => "empty",
            NameError::ControlCharacter => "control_character",
            NameError::TooLong => "too_long",
            NameError::NotTrimmed => "not_trimmed",
        }
    }
}

/// Unicode White_Space (PropList.txt), listed explicitly.
pub fn is_white_space(c: char) -> bool {
    matches!(c,
        '\u{0009}'..='\u{000D}' | '\u{0020}' | '\u{0085}' | '\u{00A0}' | '\u{1680}'
        | '\u{2000}'..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}')
}

/// General_Category Cc: U+0000..=U+001F and U+007F..=U+009F.
pub fn is_control(c: char) -> bool {
    matches!(c, '\u{0000}'..='\u{001F}' | '\u{007F}'..='\u{009F}')
}

/// Validates user input. Check order: trim, empty, control character, too long.
pub fn validate_name(input: &str) -> Result<WorkspaceName, NameError> {
    let trimmed = input.trim_matches(is_white_space);
    if trimmed.is_empty() {
        return Err(NameError::Empty);
    }
    if trimmed.chars().any(is_control) {
        return Err(NameError::ControlCharacter);
    }
    if trimmed.chars().count() > MAX_NAME_LENGTH {
        return Err(NameError::TooLong);
    }
    Ok(WorkspaceName(trimmed.to_string()))
}

/// For a name read from storage: must already be valid and trimmed. Never repairs.
pub fn parse_stored_name(stored: &str) -> Result<WorkspaceName, NameError> {
    let name = validate_name(stored)?;
    if name.as_str() == stored { Ok(name) } else { Err(NameError::NotTrimmed) }
}

/// Duplicate-detection key: Default Case Folding of the stored name. No normalization.
pub fn comparison_key(name: &WorkspaceName) -> String {
    CaseMapperBorrowed::new().fold_string(name.as_str()).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(s: &str) -> String {
        comparison_key(&validate_name(s).unwrap())
    }

    #[test]
    fn ascii_case_folds() {
        assert_eq!(key("Alpha"), key("alpha"));
        assert_eq!(key("Alpha"), "alpha");
    }

    #[test]
    fn sharp_s_expands() {
        assert_eq!(key("Stra\u{DF}e"), "strasse");
        assert_eq!(key("Stra\u{DF}e"), key("STRASSE"));
    }

    #[test]
    fn greek_sigma_variants_are_equal() {
        assert_eq!(key("\u{3C3}"), key("\u{3C2}"));
        assert_eq!(key("\u{3A3}"), key("\u{3C2}"));
    }

    #[test]
    fn turkish_i_uses_default_not_turkic_folding() {
        assert_eq!(key("I"), key("i"));
        assert_eq!(key("\u{130}"), "i\u{307}");
        assert_ne!(key("\u{130}"), key("i"));
        assert_ne!(key("\u{131}"), key("i"));
    }

    #[test]
    fn cherokee_folds_to_uppercase() {
        assert_eq!(key("\u{AB70}"), "\u{13A0}");
    }

    #[test]
    fn no_normalization() {
        assert_ne!(key("caf\u{E9}"), key("cafe\u{301}"));
        assert_ne!(key("CAF\u{C9}"), key("cafe\u{301}"));
        assert_eq!(validate_name("cafe\u{301}").unwrap().as_str(), "cafe\u{301}");
    }

    #[test]
    fn display_name_keeps_spelling_and_case() {
        let n = validate_name("  \u{C4}LPHA mIx \u{A0}").unwrap();
        assert_eq!(n.as_str(), "\u{C4}LPHA mIx");
    }

    #[test]
    fn whitespace_boundaries() {
        for c in ['\t', '\n', '\u{B}', '\u{C}', '\r', ' ', '\u{85}', '\u{A0}', '\u{1680}', '\u{2000}', '\u{200A}', '\u{2028}', '\u{2029}', '\u{202F}', '\u{205F}', '\u{3000}'] {
            assert_eq!(validate_name(&format!("{c}x{c}")).unwrap().as_str(), "x", "U+{:04X}", c as u32);
        }
        // Neighbours that are NOT White_Space are kept (`str::trim` strips none of these either,
        // but U+FEFF is stripped by JavaScript's trim, which the contract deliberately avoids).
        for c in ['\u{200B}', '\u{FEFF}', '\u{180E}'] {
            assert_eq!(validate_name(&format!("{c}x")).unwrap().as_str(), format!("{c}x"));
        }
        assert!(!is_white_space('\u{200B}') && !is_white_space('\u{FEFF}') && !is_white_space('\u{180E}'));
        assert!(is_white_space('\u{200A}') && !is_white_space('\u{200B}'));
    }

    #[test]
    fn control_characters_are_rejected() {
        for cp in (0u32..=0x1F).chain(0x7F..=0x9F) {
            let c = char::from_u32(cp).unwrap();
            let r = validate_name(&format!("a{c}b"));
            assert_eq!(r, Err(NameError::ControlCharacter), "U+{cp:04X}");
        }
        assert!(validate_name("a\u{A0}b").is_ok());
    }

    #[test]
    fn length_counts_scalar_values() {
        assert!(validate_name(&"\u{1F600}".repeat(64)).is_ok()); // 256 bytes, 64 scalars
        assert_eq!(validate_name(&"\u{1F600}".repeat(65)), Err(NameError::TooLong));
        assert!(validate_name(&"e\u{301}".repeat(32)).is_ok());
        assert_eq!(validate_name(&"e\u{301}".repeat(33)), Err(NameError::TooLong));
        assert!(validate_name(&format!(" {} ", "a".repeat(64))).is_ok());
    }

    #[test]
    fn empty_and_whitespace_only() {
        assert_eq!(validate_name(""), Err(NameError::Empty));
        assert_eq!(validate_name(" \u{3000}\t"), Err(NameError::Empty));
    }

    #[test]
    fn stored_names_are_not_repaired() {
        assert!(parse_stored_name("Alpha").is_ok());
        assert_eq!(parse_stored_name(" Alpha"), Err(NameError::NotTrimmed));
        assert_eq!(parse_stored_name("Alpha\u{85}"), Err(NameError::NotTrimmed));
        assert_eq!(parse_stored_name("  "), Err(NameError::Empty));
    }

    #[test]
    fn error_codes_match_the_shared_contract() {
        let codes = [NameError::Empty, NameError::ControlCharacter, NameError::TooLong, NameError::NotTrimmed].map(NameError::code);
        assert_eq!(codes, ["empty", "control_character", "too_long", "not_trimmed"]);
    }

    /// The contract does not rely on `char::is_whitespace`, but today they are the same set.
    /// If a future toolchain's Unicode data changes that, this fails and the difference is reviewed.
    #[test]
    fn explicit_set_equals_std_is_whitespace_today() {
        for cp in 0..=0x10FFFFu32 {
            if let Some(c) = char::from_u32(cp) {
                assert_eq!(is_white_space(c), c.is_whitespace(), "U+{cp:04X}");
            }
        }
    }
}

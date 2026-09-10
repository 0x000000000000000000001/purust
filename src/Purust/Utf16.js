// JS strings expose the exact UTF-16 code units preserved by tcorefn.
const scalar = unit => unit < 0xd800 ? unit : unit + 0x800;
const escape = code => {
  if (code === 0x22) return '\\"';
  if (code === 0x27) return "\\'";
  if (code === 0x5c) return '\\\\';
  if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
  return `\\u{${code.toString(16)}}`;
};

export const rustStringLiteral = value => {
  let literal = '';
  for (let i = 0; i < value.length; i++) literal += escape(scalar(value.charCodeAt(i)));
  return `String::from("${literal}")`;
};

export const rustCharLiteral = value => `'${escape(scalar(value.charCodeAt(0)))}'`;

export const runtimeHelpers = String.raw`
// Internal strings store one Rust scalar per UTF-16 code unit, in code-unit
// order. Scalars >= D800 are shifted past Rust's surrogate hole.
#[inline]
pub fn purust_char_from_code_unit(unit: u16) -> char {
    let value = unit as u32;
    char::from_u32(if value < 0xd800 { value } else { value + 0x800 }).unwrap()
}

#[inline]
pub fn purust_char_to_code_unit(value: char) -> u16 {
    let value = value as u32;
    assert!(value <= 0x107ff, "Expected an encoded UTF-16 code unit");
    (if value < 0xd800 { value } else { value - 0x800 }) as u16
}

pub fn purust_string_from_utf16(units: &[u16]) -> String {
    units.iter().copied().map(purust_char_from_code_unit).collect()
}

pub fn purust_string_to_utf16(value: &str) -> Vec<u16> {
    value.chars().map(purust_char_to_code_unit).collect()
}

pub fn purust_string_from_utf8(value: &str) -> String {
    if value.is_ascii() { return value.to_owned(); }
    value.encode_utf16().map(purust_char_from_code_unit).collect()
}

pub fn purust_string_to_utf8_lossy(value: &str) -> std::string::String {
    if value.is_ascii() { return value.to_owned(); }
    std::string::String::from_utf16_lossy(&purust_string_to_utf16(value))
}
`;

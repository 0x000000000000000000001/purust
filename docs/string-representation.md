# Strings and characters in Rust output

PureScript strings contain UTF-16 code units, including unpaired surrogates.
Purust keeps the Rust `String` and `char` ABI, but their contents use an internal
encoding with one Rust scalar for each UTF-16 unit:

- Units below `0xD800` keep their value.
- Units from `0xD800` through `0xFFFF` are encoded as `unit + 0x800`.

This is a bijection onto valid Rust scalars. It preserves code-unit order and
concatenation, distinguishes private-use characters from surrogates, and leaves
ASCII unchanged. A supplementary Unicode character occupies two encoded scalars.
Rust byte lengths and arbitrary native Unicode operations do not implement
PureScript string operations on this representation.

Generated string and character literals use this encoding. `Value::String`,
`Value::Char`, `mk_string` and `mk_char` hold values already encoded; boxing never
encodes them again. `Char` bounds and enumeration operate on the original u16.

FFI code uses these public `purust_core` helpers at boundaries:

| Conversion | Helper |
| --- | --- |
| UTF-16 unit to internal `char` | `purust_char_from_code_unit(u16)` |
| Internal `char` to UTF-16 unit | `purust_char_to_code_unit(char)` |
| UTF-16 units to internal `String` | `purust_string_from_utf16(&[u16])` |
| Internal string to UTF-16 units | `purust_string_to_utf16(&str)` |
| Native UTF-8 input to internal string | `purust_string_from_utf8(&str)` |
| Internal string to native display text | `purust_string_to_utf8_lossy(&str)` |

UTF-8 cannot represent unpaired surrogates: the display conversion replaces them
with U+FFFD. Use the UTF-16 helpers for lossless transfer. Console performs this
display conversion only at output; `Show` returns an internal string and keeps
surrogates intact. Any FFI producing native Unicode text must encode its result,
and native text APIs must receive decoded text. ASCII-only FFI results require
no conversion.

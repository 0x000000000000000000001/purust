// Representation tests only: never call a JS.BigInt foreign operation.
use std::rc::Rc;
use Purs_JS_BigInt::BigInt;

#[test]
fn signed_values_exceed_fixed_integer_widths() {
    let decimal = "340282366920938463463374607431768211456";
    let value = BigInt::parse_bytes(decimal.as_bytes(), 10).unwrap();
    assert_eq!(value.to_string(), decimal);
    assert_eq!((&value + BigInt::from(1)).to_string(), "340282366920938463463374607431768211457");
    assert_eq!((-&value).to_string(), format!("-{decimal}"));
    let wide = BigInt::from(1) << 4096usize;
    assert_eq!(wide.to_str_radix(16), format!("1{}", "0".repeat(1024)));
    assert_eq!(-(-&wide), wide);
    assert_eq!(BigInt::from(0).to_string(), "0");
}

#[test]
fn typed_purescript_identity_and_maybe_preserve_handles() {
    let value = Rc::new(BigInt::from(-17));
    let kept = Purs_BigIntProbe::BigIntProbe_keep(value.clone());
    assert!(Rc::ptr_eq(&value, &kept));
    let wrapped = Purs_BigIntProbe::BigIntProbe_wrap(value.clone());
    let fallback = Rc::new(BigInt::from(99));
    let unwrapped = Purs_BigIntProbe::BigIntProbe_unwrap(fallback.clone(), wrapped);
    assert!(Rc::ptr_eq(&value, &unwrapped));
    let absent = Purs_BigIntProbe::BigIntProbe_unwrap(fallback.clone(), Purs_Data_Maybe::Data_Maybe_Nothing());
    assert!(Rc::ptr_eq(&fallback, &absent));
}

#[test]
fn class_boxing_preserves_native_type_and_handle() {
    let value = Rc::new(BigInt::from(42));
    let boxed = purust_core::Value::Class(Rc::new(value.clone()));
    let unboxed = boxed.unwrap_class::<Rc<BigInt>>().clone();
    assert!(Rc::ptr_eq(&value, &unboxed));
}

#[test]
fn typed_callback_preserves_the_handle() {
    let value = Rc::new(BigInt::from(42));
    let callback: purust_core::Func1<Rc<BigInt>, Rc<BigInt>> = purust_core::Func1::Static(|v| v);
    let returned = Purs_BigIntProbe::BigIntProbe_viaCallback(callback, value.clone());
    assert!(Rc::ptr_eq(&value, &returned));
}

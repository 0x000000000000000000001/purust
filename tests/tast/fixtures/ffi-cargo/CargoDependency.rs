pub fn CargoDependency_huge(_: i64) -> std::rc::Rc<Purs_CargoValue::Native> {
    std::rc::Rc::new(Purs_CargoValue::Native::parse_bytes(b"340282366920938463463374607431768211456", 10).unwrap())
}

pub fn CargoDependency_successor(value: std::rc::Rc<Purs_CargoValue::Native>) -> std::rc::Rc<Purs_CargoValue::Native> {
    std::rc::Rc::new(&*value + Purs_CargoValue::Native::from(1))
}

pub fn CargoDependency_render(value: std::rc::Rc<Purs_CargoValue::Native>) -> String {
    value.to_string()
}

pub fn CargoDependency_assertResult(value: String) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!(value, "340282366920938463463374607431768211457");
        println!("FFI_CARGO_OK");
        Value::Unit
    })))
}

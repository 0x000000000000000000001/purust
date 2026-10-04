pub struct Handle_prime(i64);

pub fn Main_makeHandle() -> Value {
    Value::Func1(Func1::Static(|_| {
        Value::Class(std::rc::Rc::new(std::rc::Rc::new(Handle_prime(42))))
    }))
}

pub fn Main_checkHandle(handle: Value) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!(handle.unwrap_class::<std::rc::Rc<Handle_prime>>().0, 42);
        Value::Unit
    })))
}

pub fn Main_runtimeZero() -> Value {
    Value::Func1(Func1::Static(|_| Value::Number(0.0)))
}

pub fn Main_checkZero(negative: bool, value: f64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!(value, 0.0);
        assert_eq!(value.is_sign_negative(), negative, "Compiler host lost the IEEE zero sign");
        Value::Unit
    })))
}

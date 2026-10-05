pub fn Demo_checkResults(first: i64, second: i64, third: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((first, second, third), (17, 17, 25));
        Purs_Session::verify_session_counts(3);
        Value::Unit
    })))
}

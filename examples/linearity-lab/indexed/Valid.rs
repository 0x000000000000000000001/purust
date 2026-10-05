pub fn LinearLab_Indexed_Valid_checkResults(first: i64, replay: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((first, replay), (40, 40));
        Purs_LinearLab_Indexed_Api::verify_counts();
        println!("INDEXED_CAPABILITIES_OK sessions=4 finished=4 dropped=4 replay=fresh");
        Value::Unit
    })))
}

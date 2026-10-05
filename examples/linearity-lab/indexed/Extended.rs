pub fn LinearLab_Indexed_Extended_checkResults(left: i64, right: i64, looped: i64, callback: i64, dynamic: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((left, right, looped, callback, dynamic), (7, 8, 61, 10, 6));
        Purs_LinearLab_Indexed_Api::verify_extended_counts();
        println!("INDEXED_EXTENDED_OK branches=2 sessions=7 reads=4 mutations=9");
        Value::Unit
    })))
}

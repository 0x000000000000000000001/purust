pub fn LinearLab_Combinators_Demo_verify(a: i64, b: i64, pair: i64, triple: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((a, b, pair, triple), (17, 17, 23, 30));
        Purs_LinearLab_Combinators_Linear::verify_counts(4);
        println!("LINEAR_COMBINATORS_OK resources=4 results=17,17,23,30");
        Value::Unit
    })))
}

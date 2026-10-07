pub fn LinearLab_Capabilities_Demo_verify(a: i64, b: i64, copied: i64, shared: i64, discarded: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((a, b, copied, shared, discarded), (10, 10, 27, 10, 0));
        Purs_LinearLab_Capabilities_Sub::verify_counts();
        println!("LINEAR_CAPABILITIES_OK owned=2 disposable=3 deep_clones=1 deep_drops=3 shared_clones=1 shared_handles=2 shared_payloads=1 results=10,10,27,10,0");
        Value::Unit
    })))
}

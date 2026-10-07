pub fn LinearLab_Capabilities_ExtensionDemo_verify(size: i64, discarded: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((size, discarded), (11, 0));
        Purs_LinearLab_Capabilities_ForeignExample::verify_counts();
        println!("LINEAR_CAPABILITIES_EXTENSION_OK opened=2 closed=1 discarded=1 dropped=2 results=11,0");
        Value::Unit
    })))
}

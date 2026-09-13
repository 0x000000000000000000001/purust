pub fn Portable_probe() -> Value {
    Value::Func1(Func1::Static(|_| {
        let original = perceus_ptr::PerceusPtr::new(vec![21_i64, 42]);
        let shared = original.clone();
        assert_eq!(shared[1], 42);
        drop(original);
        assert_eq!(shared[0], 21);
        println!("PORTABLE_CARGO_OK");
        Value::Unit
    }))
}

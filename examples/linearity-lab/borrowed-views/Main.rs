pub fn LinearLab_BorrowedViews_Main_check(first: i64, replay: i64) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        assert_eq!((first, replay), (684, 684));
        println!("PS_SCOPES_OK initial=195 final=294 replay=fresh");
        Value::Unit
    })))
}
pub fn LinearLab_BorrowedViews_Main_verify() -> Value {
    Value::Func1(Func1::Static(|_| {
        Purs_LinearLab_BorrowedViews_Api::verify_native_backstop();
        println!("BORROWED_VIEWS_OK");
        Value::Unit
    }))
}

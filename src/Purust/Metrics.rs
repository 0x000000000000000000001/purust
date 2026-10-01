pub fn Purust_Metrics_now() -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(|_| {
        static START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
        Value::Number(START.get_or_init(std::time::Instant::now).elapsed().as_secs_f64() * 1000.0)
    })))
}

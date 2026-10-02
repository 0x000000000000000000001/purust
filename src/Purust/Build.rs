pub fn Purust_Build_optimizerConcurrency() -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(|_| {
        let default = std::thread::available_parallelism().map(|n| n.get().min(8) as i64).unwrap_or(1);
        let configured = match std::env::var("PURUST_PBO_JOBS") {
            Ok(value) => value,
            Err(_) => return Value::Int(default),
        };
        let jobs = if !configured.is_empty() && configured.bytes().all(|b| b.is_ascii_digit()) {
            configured.parse::<i64>().ok().filter(|n| (1..=64).contains(n)).unwrap_or(1)
        } else { 1 };
        Value::Int(jobs)
    })))
}

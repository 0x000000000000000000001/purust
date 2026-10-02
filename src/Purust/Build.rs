fn purust_optimizer_jobs() -> i64 {
    let default = std::thread::available_parallelism().map(|n| n.get().min(8) as i64).unwrap_or(1);
    let configured = match std::env::var("PURUST_PBO_JOBS") {
        Ok(value) => value,
        Err(_) => return default,
    };
    if !configured.is_empty() && configured.bytes().all(|b| b.is_ascii_digit()) {
        configured.parse::<i64>().ok().filter(|n| (1..=64).contains(n)).unwrap_or(1)
    } else { 1 }
}

pub fn Purust_Build_optimizerConcurrency() -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(|_| Value::Int(purust_optimizer_jobs()))))
}

pub fn Purust_Build_codegenConcurrency() -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(|_| {
        // The measured eight-slot configuration splits 4/4. Smaller budgets
        // reserve at most half for generation; one-slot generation is inline.
        let configured = match std::env::var("PURUST_CODEGEN_JOBS") {
            Ok(value) => value,
            Err(_) => return Value::Int((purust_optimizer_jobs() / 2).clamp(1, 4)),
        };
        let jobs = if !configured.is_empty() && configured.bytes().all(|b| b.is_ascii_digit()) {
            configured.parse::<i64>().ok().filter(|n| (1..=64).contains(n)).unwrap_or(1)
        } else { 1 };
        Value::Int(jobs)
    })))
}

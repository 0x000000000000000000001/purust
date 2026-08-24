use std::time::Instant;
use std::rc::Rc;

#[derive(Clone)]
pub enum Value {
    Int(i64),
    String(String),
    Array(Rc<Vec<Value>>),
    Func(Rc<dyn Fn(Value) -> Value>),
    // Simulate size of purust Value (approx 32 bytes)
    Padding(u64, u64),
}

impl Value {
    pub fn unwrap_int(&self) -> i64 {
        if let Value::Int(v) = self { *v } else { panic!("Expected Int"); }
    }
}

#[inline(never)]
fn run_dynamic(n: i64) -> i64 {
    let mut sum = 0;
    for i in 0..n {
        // In purust, a dynamic closure is allocated often
        let f: Rc<dyn Fn(Value) -> Value> = Rc::new(move |x| {
            Value::Int(x.unwrap_int() + 1)
        });
        
        let val = Value::Int(i);
        let res = f(val);
        sum += res.unwrap_int();
    }
    sum
}

#[inline(never)]
fn run_mono(n: i64) -> i64 {
    let mut sum = 0;
    for i in 0..n {
        // Monomorphized function or closure (stack allocated, zero-cost abstraction)
        let f = |x: i64| -> i64 { x + 1 };
        
        let val = i;
        let res = f(val);
        sum += res;
    }
    sum
}

fn main() {
    let n = 10_000_000;

    // Benchmark 1: Dynamic Value (current purust)
    let start_dyn = Instant::now();
    let res_dyn = run_dynamic(n);
    let dyn_time = start_dyn.elapsed();
    
    // Benchmark 2: Monomorphized (with TypeApp)
    let start_mono = Instant::now();
    let res_mono = run_mono(n);
    let mono_time = start_mono.elapsed();

    println!("Rust Benchmark Results (10M iterations with Closure Allocation):");
    println!("Dynamic (Value enum + Rc<dyn Fn>): {:?}", dyn_time);
    println!("Monomorphized (i64 + unboxed Fn): {:?}", mono_time);
    println!("Speedup: {:.2}x", dyn_time.as_secs_f64() / mono_time.as_secs_f64());
    
    println!("Total sizes:");
    println!("std::mem::size_of::<Value>() = {}", std::mem::size_of::<Value>());
    println!("std::mem::size_of::<i64>() = {}", std::mem::size_of::<i64>());
}

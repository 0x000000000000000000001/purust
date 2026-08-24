use std::time::Instant;
use std::rc::Rc;

// 1. Dynamic Value (Current purust approach without Monomorphization)
#[derive(Clone)]
pub enum Value {
    Int(i64),
}

impl Value {
    pub fn unwrap_int(&self) -> i64 {
        if let Value::Int(v) = self { *v } else { panic!("Expected Int"); }
    }
}

fn map_dynamic(arr: Vec<Value>, f: Rc<dyn Fn(Value) -> Value>) -> Vec<Value> {
    arr.into_iter().map(|x| f(x)).collect()
}

// 2. Monomorphized Generic (New possibility with TypeApp / Monomorphize.purs)
fn map_mono<A, B>(arr: Vec<A>, f: impl Fn(A) -> B) -> Vec<B> {
    arr.into_iter().map(|x| f(x)).collect()
}

fn main() {
    let n = 10_000_000;

    // Benchmark 1: Dynamic Value
    let start_dyn = Instant::now();
    let arr_dyn: Vec<Value> = (0..n).map(|i| Value::Int(i)).collect();
    let f_dyn: Rc<dyn Fn(Value) -> Value> = Rc::new(|x| Value::Int(x.unwrap_int() + 1));
    let res_dyn = map_dynamic(arr_dyn, f_dyn);
    let dyn_time = start_dyn.elapsed();
    
    // Anti-optimization trick
    if res_dyn.is_empty() { println!("Empty"); }

    // Benchmark 2: Monomorphized
    let start_mono = Instant::now();
    let arr_mono: Vec<i64> = (0..n).collect();
    let res_mono = map_mono(arr_mono, |x| x + 1);
    let mono_time = start_mono.elapsed();

    if res_mono.is_empty() { println!("Empty"); }

    println!("Rust Benchmark Results (10M iterations):");
    println!("Dynamic (Value): {:?}", dyn_time);
    println!("Monomorphized (i64): {:?}", mono_time);
    println!("Speedup: {:.2}x", dyn_time.as_secs_f64() / mono_time.as_secs_f64());
}

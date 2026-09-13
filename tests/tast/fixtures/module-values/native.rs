use purust_core::*;
use std::rc::Rc;
use Purs_ModuleInitProbe::*;
use Purs_ModuleInitProbe_Counter::*;

fn run(action: Value) -> Value { action.unwrap_func1()(Value::Unit) }
fn count() -> i64 { run(ModuleInitProbe_Counter_readCount()).unwrap_int() }
fn same(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Class(left), Value::Class(right)) => Rc::ptr_eq(left, right),
        _ => panic!("Expected actual Ref handles"),
    }
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("shared") => {
            assert_eq!(count(), 0, "getter initialization is still lazy");
            let first = ModuleInitProbe_shared();
            let second = ModuleInitProbe_shared();
            assert!(same(&first, &second), "module value must preserve its handle");
            run(ModuleInitProbe_store(42));
            assert_eq!(run(ModuleInitProbe_load()).unwrap_int(), 42);
            assert_eq!(count(), 1);
        }
        Some("factory") => {
            let first = ModuleInitProbe_factory(42);
            let second = ModuleInitProbe_factory(42);
            assert!(!same(&first, &second));
            assert_eq!(count(), 2);
        }
        Some("action") => {
            let first_action = ModuleInitProbe_action();
            let second_action = ModuleInitProbe_action();
            assert_eq!(count(), 0);
            let first = run(first_action.clone());
            let second = run(first_action);
            let third = run(second_action);
            assert!(!same(&first, &second));
            assert!(!same(&second, &third));
            assert_eq!(count(), 3, "sharing an action must never memoize its result");
        }
        Some("dependent") => {
            let first = ModuleInitProbe_dependent();
            let second = ModuleInitProbe_dependent();
            assert!(same(&first, &second));
            assert_eq!(count(), 2, "dependency and dependent initialize once each");
            assert_eq!(run(Purs_Effect_Ref::Effect_Ref_read(first)).unwrap_int(), 0);
        }
        Some("native") => {
            let first: i64 = ModuleInitProbe_native();
            assert_eq!(first, 42);
            assert_eq!(ModuleInitProbe_native(), 42);
            assert_eq!(count(), 1);
        }
        _ => panic!("Expected a probe case"),
    }
    println!("ok");
}

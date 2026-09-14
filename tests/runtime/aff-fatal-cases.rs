use purust_core::*;
use std::sync::Arc;
use std::time::Duration;
use Purs_Effect_Aff::*;

fn effect(action: impl Fn() -> Value + Send + Sync + 'static) -> Value {
    Value::Func1(Func1::Shared(Arc::new(move |_| action())))
}
fn launch(action: Value) {
    Purs_AffFatalProbe::AffFatalProbe_launch(action).unwrap_func1()(Value::Unit);
}
fn error() -> Value {
    Purs_Effect_Exception::Effect_Exception_error("ordinary Aff failure".into())
}
struct PendingDrop;
impl Drop for PendingDrop { fn drop(&mut self) { println!("PENDING_DROPPED"); } }
fn pending_native() {
    let guard = PendingDrop;
    purust_aff_spawn_native(async move {
        let _guard = guard;
        std::future::pending::<Result<Value, Value>>().await
    }, |_| panic!("pending completion must never run"));
}
fn delayed_native() {
    purust_aff_spawn_native(async {
        tokio::time::sleep(Duration::from_millis(120)).await;
        Ok(Value::Unit)
    }, |result| { assert!(result.is_ok()); println!("NATIVE_CLEANUP"); });
}
fn cleanup() -> Value {
    Effect_Aff__bind(Effect_Aff_delay(50.0), Func1::Static(|_| {
        Effect_Aff__liftEffect(effect(|| { println!("BRACKET_CLEANUP"); Value::Unit }))
    }))
}
fn main() {
    let case = std::env::args().nth(1).expect("case");
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| purust_aff_run_main(|| {
        match case.as_str() {
            "root-pending" => { pending_native(); panic!("AFF_FATAL_ROOT"); }
            "root-active-fiber" => { launch(Effect_Aff_delay(60_000.0)); panic!("AFF_FATAL_ROOT"); }
            "fiber-pending" | "fiber-alone" => {
                if case == "fiber-pending" { pending_native(); }
                launch(Effect_Aff__liftEffect(effect(|| panic!("AFF_FATAL_FIBER"))));
            }
            "native-pending" => {
                pending_native();
                purust_aff_spawn_native(async { panic!("AFF_FATAL_NATIVE"); }, |_| println!("NATIVE_FAILURE_DELIVERED"));
            }
            "completion-pending" => {
                pending_native();
                purust_aff_spawn_native(async { Ok(Value::Unit) }, |_| panic!("AFF_FATAL_COMPLETION"));
            }
            "microtask-pending" => {
                pending_native();
                microtasks::current().enqueue(|| panic!("AFF_FATAL_MICROTASK"));
            }
            "success" => { delayed_native(); launch(Effect_Aff__pure(Value::Unit)); }
            "aff-error" | "handled-aff-error" => {
                delayed_native();
                let action = Effect_Aff_finally(cleanup(), Effect_Aff__throwError(error()));
                launch(if case == "handled-aff-error" {
                    Effect_Aff__catchError(action, Func1::Static(|error| {
                        assert_eq!(Purs_Effect_Exception::Effect_Exception_showErrorImpl(error), "Error: ordinary Aff failure");
                        println!("AFF_ERROR_HANDLED");
                        Effect_Aff__pure(Value::Unit)
                    }))
                } else { action });
            }
            "main-error" => {
                delayed_native();
                Purs_Effect_Exception::purust_exception_raise(error());
            }
            "completion-error" => {
                delayed_native();
                purust_aff_spawn_native(async { Err(error()) }, |result| {
                    Purs_Effect_Exception::purust_exception_raise(result.err().expect("native failure"));
                });
            }
            _ => panic!("unknown case"),
        }
        Value::Unit
    })));
    if let Err(payload) = outcome {
        let expected = match case.as_str() {
            "root-pending" | "root-active-fiber" => Some("AFF_FATAL_ROOT"),
            "fiber-pending" | "fiber-alone" => Some("AFF_FATAL_FIBER"),
            "native-pending" => Some("AFF_FATAL_NATIVE"),
            "completion-pending" => Some("AFF_FATAL_COMPLETION"),
            "microtask-pending" => Some("AFF_FATAL_MICROTASK"),
            _ => None,
        };
        if let Some(expected) = expected {
            assert_eq!(payload.downcast_ref::<&str>().copied(), Some(expected));
            println!("ORIGINAL_PANIC_RETHROWN");
        }
        std::panic::resume_unwind(payload);
    }
    println!("MAIN_RETURNED");
}

use purust_core::*;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use Purs_AffClassProbe::*;
use Purs_Effect_Aff::*;
use Purs_Effect_Aff_Class::*;
use Purs_Effect_Class::*;

#[test]
fn native_monad_aff_dictionary_preserves_the_real_aff_abi() {
    let dictionary: Arc<MonadAff> = Effect_Aff_Class_monadAffAff();
    let parent: Arc<MonadEffect> = (dictionary.MonadEffect0)(Value::Unit);
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let effect = Value::Func1(Func1::Shared(Arc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(42)
    })));
    let original = Effect_Aff__liftEffect(effect.clone());
    let lifted = AffClassProbe_viaAff(dictionary.clone(), original.clone());
    match (&original, &lifted) {
        (Value::Class(a), Value::Class(b)) => assert!(Arc::ptr_eq(a, b)),
        _ => panic!("liftAff changed the native Aff payload"),
    }
    let via_superclass = AffClassProbe_viaEffect(dictionary, effect.clone());
    let via_parent = Effect_Class_liftEffect(parent, effect);
    assert_eq!(
        calls.load(Ordering::SeqCst),
        0,
        "dictionary methods must leave Aff deferred"
    );
    purust_aff_run_main(|| {
        for action in [lifted.clone(), lifted, via_superclass, via_parent] {
            Effect_Aff_launchAff_(action).unwrap_func1()(Value::Unit);
        }
        Value::Unit
    });
    assert_eq!(
        calls.load(Ordering::SeqCst),
        4,
        "each explicit execution must run the effect"
    );
}

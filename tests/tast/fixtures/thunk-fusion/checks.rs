use purust_core::Func1;
use Purs_ThunkFusion::*;
use std::cell::Cell;
use std::rc::Rc;

fn main() {
    assert_eq!(ThunkFusion_upperBoundary(()), i32::MAX as i64);
    assert_eq!(ThunkFusion_lowerBoundary(()), i32::MIN as i64);
    for offset in [-7, 0, 17] {
        assert_eq!(ThunkFusion_fusedAdds(offset), 2007 + offset);
        assert_eq!(ThunkFusion_fusedOrder(offset), 73 + offset);
        assert_eq!(ThunkFusion_fusedVary(offset), 30 + offset);
        assert_eq!(ThunkFusion_fusedWrapped(offset), 2007 + offset);
        assert_eq!(ThunkFusion_fusedWrappedAlias(offset), 2011 + offset);
        assert_eq!(ThunkFusion_fusedZero(offset), 7 + offset);
        for depth in [0, 1, 2, 17, 1000] {
            assert_eq!(ThunkFusion_unknownInputs(depth, offset), offset + depth * 2);
        }
    }
    let calls = Rc::new(Cell::new(0));
    let observed = calls.clone();
    let seed = Func1::Shared(Rc::new(move |_| {
        observed.set(observed.get() + 1);
        9
    }));
    for depth in [0, 1, 17] {
        let before = calls.get();
        assert_eq!(ThunkFusion_opaqueSeed(depth, seed.clone()), 9 + depth * 2);
        assert_eq!(calls.get(), before + 1);
    }
    for _ in 0..3 {
        let before = calls.get();
        assert_eq!(ThunkFusion_savedThunk(seed.clone(), ()), 43);
        assert_eq!(calls.get(), before + 1);
    }
    let before = calls.get();
    assert_eq!(ThunkFusion_twice(seed), 72);
    assert_eq!(calls.get(), before + 8);
    let unused = Func1::Static(|_| panic!("An unused seed must remain unforced"));
    assert_eq!(ThunkFusion_overwrite(unused.clone()), 1);
    assert_eq!(ThunkFusion_conditional(unused), 3);
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let failed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        ThunkFusion_opaqueSeed(17, Func1::Static(|_| panic!("seed failure")))));
    let overflow = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        ThunkFusion_opaqueSeed(1, Func1::Static(|_| i64::MAX))));
    std::panic::set_hook(hook);
    assert_eq!(failed.unwrap_err().downcast_ref::<&str>(), Some(&"seed failure"));
    assert!(overflow.is_err(), "Opaque arithmetic retains its overflow checks");
    println!("Thunk fusion: closed Int workers, polymorphic newtype wrappers, noncommuting updates, old parameter values, unknown inputs, repeated/unused/conditional/opaque seed demands checked.");
}

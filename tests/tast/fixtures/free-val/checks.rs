// The opaque foreign type carries arbitrary coerced values; every read must
// return exactly what was stored, without an Rc<Val> wrapper or downcast.
use Purs_FreeValProbe::*;

fn main() {
    assert_eq!(FreeValProbe_roundTrip(), 41);
    assert_eq!(FreeValProbe_recordCount(), 42);
    assert_eq!(FreeValProbe_applied(), 42);
    assert_eq!(FreeValProbe_pairedLeft(), 7);
    assert_eq!(FreeValProbe_pairedRight(), 9);
    println!("foreign Val carries coerced values without Rc wrapper or downcast.");
}

use std::rc::Rc;
fn test() -> Rc<dyn Fn(i64) -> i64> {
    Rc::new(move |x| x + 1)
}
fn main() { test(); }

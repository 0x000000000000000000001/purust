#[derive(Clone)]
struct UnknownType {}
fn main() {
    let a = UnknownType {};
    let f1 = move |v: UnknownType| -> UnknownType {
        let f2 = move |x: UnknownType| -> UnknownType {
            let mut a = a.clone(); // clones the captured 'a'
            a
        };
        f2(v)
    };
}

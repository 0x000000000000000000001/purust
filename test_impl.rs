struct Record<T> { f: T }
fn foo() -> Record<impl Fn(i32) -> i32> {
    Record { f: |x| x }
}
fn main() {
    let r = foo();
    println!("{}", (r.f)(42));
}

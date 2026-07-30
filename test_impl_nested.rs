fn foo() -> impl Fn(i32) -> impl Fn(i32) -> i32 {
    |x| move |y| x + y
}
fn main() {
    let f = foo();
    println!("{}", f(1)(2));
}

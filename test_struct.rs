type UnknownType = Box<Record_a>;
fn main() {
    let x: UnknownType = Box::new(Record_a { a: 1 });
    println!("{}", x.a);
}
struct Record_a {
    a: i32,
}

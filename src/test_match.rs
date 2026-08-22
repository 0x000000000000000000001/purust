enum Foo {
    Bar(i32, i32, i32),
    Baz(i32)
}

fn main() {
    let x = Foo::Bar(1, 2, 3);
    let y = if let Foo::Bar(_, ref f, ..) = &x { f.clone() } else { unreachable!() };
    println!("{}", y);
    
    let z = Foo::Baz(42);
    let w = if let Foo::Baz(ref f, ..) = &z { f.clone() } else { unreachable!() };
    println!("{}", w);
}

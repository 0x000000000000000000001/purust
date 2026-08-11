pub fn main() {
    let f = String::from("hello");
    let c = move || {
        let f = f.clone();
        f.into_bytes()
    };
    c();
    c();
}

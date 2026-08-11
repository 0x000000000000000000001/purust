pub fn main() {
    let f = String::from("hello");
    let c = move || {
        let f_local = f.clone();
        f_local.into_bytes()
    };
    c();
    c();
}

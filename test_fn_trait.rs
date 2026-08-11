#![feature(unboxed_closures, fn_traits)]

#[derive(Clone)]
pub struct Record_a {
    pub a: i64,
}

pub struct PerceusPtr<T> {
    pub data: T,
}

impl<Args> FnOnce<Args> for PerceusPtr<Record_a> {
    type Output = PerceusPtr<Record_a>;
    extern "rust-call" fn call_once(self, args: Args) -> Self::Output {
        self
    }
}

impl<Args> FnMut<Args> for PerceusPtr<Record_a> {
    extern "rust-call" fn call_mut(&mut self, args: Args) -> Self::Output {
        PerceusPtr { data: Record_a { a: 0 } }
    }
}

impl<Args> Fn<Args> for PerceusPtr<Record_a> {
    extern "rust-call" fn call(&self, args: Args) -> Self::Output {
        PerceusPtr { data: Record_a { a: 0 } }
    }
}

fn main() {
    let p = PerceusPtr { data: Record_a { a: 0 } };
    (p)(1, 2, 3);
}

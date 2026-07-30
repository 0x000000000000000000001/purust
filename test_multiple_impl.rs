pub trait Has_a { type FieldType_a; fn get_a(self) -> Self::FieldType_a; }
pub trait Has_b { type FieldType_b; fn get_b(self) -> Self::FieldType_b; }

pub struct Record_a_b<T0, T1> { pub a: T0, pub b: T1 }

impl<T0, T1> Has_a for Record_a_b<T0, T1> { type FieldType_a = T0; fn get_a(self) -> T0 { self.a } }
impl<T0, T1> Has_b for Record_a_b<T0, T1> { type FieldType_b = T1; fn get_b(self) -> T1 { self.b } }

pub fn foo(dict: impl Has_a<FieldType_a = i32> + Has_b<FieldType_b = i32>) -> i32 {
    let _a = dict.get_a();
    // wait! dict is moved by get_a!
    // So we can't call get_b on dict!
    _a
}

fn main() {
    let r = Record_a_b { a: 42, b: 24 };
    println!("{}", foo(r));
}

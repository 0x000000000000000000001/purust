pub trait Has_mempty {
    type FieldType;
    fn get_mempty(self) -> Self::FieldType;
}

pub struct Record_Semigroup0_mempty<T0, T1> {
    pub Semigroup0: T0,
    pub mempty: T1,
}

impl<T0, T1> Has_mempty for Record_Semigroup0_mempty<T0, T1> {
    type FieldType = T1;
    fn get_mempty(self) -> T1 {
        self.mempty
    }
}

pub fn mempty<R: Has_mempty>(dict: R) -> R::FieldType {
    dict.get_mempty()
}

fn main() {
    let r = Record_Semigroup0_mempty { Semigroup0: 42, mempty: "hello" };
    println!("{}", mempty(r));
}

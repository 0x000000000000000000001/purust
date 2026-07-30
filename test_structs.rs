pub struct Record_mempty { pub mempty: i32 }
pub struct Record_Semigroup0_mempty { pub Semigroup0: i32, pub mempty: i32 }

pub fn foldMap(dict: Record_mempty) -> i32 { dict.mempty }

fn main() {
    let r = Record_Semigroup0_mempty { Semigroup0: 1, mempty: 2 };
    println!("{}", foldMap(r));
}

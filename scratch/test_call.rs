pub struct PerceusPtr<T> { pub data: T }
impl<T> std::ops::Deref for PerceusPtr<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target { &self.data }
}
impl<T> Clone for PerceusPtr<T> where T: Clone {
    fn clone(&self) -> Self { PerceusPtr { data: self.data.clone() } }
}

#[derive(Clone)]
pub struct Record_a {
    pub call: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
}
pub type UnknownType = PerceusPtr<Record_a>;

pub fn main() {
    let closure = perceus_ptr_new(Record_a {
        call: Some(std::rc::Rc::new(move |arg1: UnknownType| -> UnknownType {
            perceus_ptr_new(Record_a {
                call: Some(std::rc::Rc::new(move |arg2: UnknownType| -> UnknownType {
                    arg2
                }))
            })
        }))
    });

    let arg1 = perceus_ptr_new(Record_a { call: None });
    let arg2 = perceus_ptr_new(Record_a { call: None });

    let r = (closure.call.clone().unwrap())(arg1.clone()).call.clone().unwrap()(arg2.clone());
}

fn perceus_ptr_new(data: Record_a) -> UnknownType {
    PerceusPtr { data }
}

#![allow(warnings)]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#[derive(Clone, Default)]
pub struct Record_a {
    pub tag: &'static str,
    pub vals: Option<std::rc::Rc<Vec<UnknownType>>>,
    pub call: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,
}


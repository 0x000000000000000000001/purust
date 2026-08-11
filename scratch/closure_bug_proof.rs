// What purust.js currently generates:
pub type UnknownType = perceus_ptr::PerceusPtr<Record_a>;
pub fn unsafe_coerce<T>(_: T) -> UnknownType { perceus_ptr::PerceusPtr::new(Record_a { a: 0 }) }

// ...

// The generated code tries to do this:
let closure = unsafe_coerce(std::rc::Rc::new(move |mut arg: UnknownType| -> UnknownType {
    // ... inner closure
    unsafe_coerce(std::rc::Rc::new(move |mut arg2: UnknownType| -> UnknownType {
        arg2
    }))
}));

// It tries to call the 1-arity closure with 3 arguments!
(closure)(a0, a1, a2);

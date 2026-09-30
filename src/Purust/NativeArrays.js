export const runtime = String.raw`
// All elements are constructed eagerly in a concrete Vec. Escaping elements
// carry an owning reference to that Vec and an index, not a borrowed cursor or
// a deferred decoding closure. Neither indexing nor cloning a record/class
// element allocates a per-element wrapper.
pub enum NativeItem<'a> {
    Scalar(Value),
    Record(&'a dyn NativeRecord),
    Class(&'a dyn std::any::Any),
}

pub trait NativeArray: std::any::Any + 'static {
    fn len(&self) -> usize;
    fn item(&self, index: usize) -> NativeItem<'_>;
    fn record(&self, index: usize) -> Option<&dyn NativeRecord> {
        match self.item(index) { NativeItem::Record(value) => Some(value), _ => None }
    }
    fn class(&self, index: usize) -> &dyn std::any::Any {
        match self.item(index) { NativeItem::Class(value) => value, _ => panic!("Expected Class element") }
    }
}

pub struct NativeRecords<T: NativeRecord>(pub Vec<T>);
impl<T: NativeRecord> NativeArray for NativeRecords<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Record(&self.0[index]) }
}

pub struct NativeClasses<T>(pub Vec<T>);
impl<T: std::any::Any + 'static> NativeArray for NativeClasses<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Class(&self.0[index]) }
}

pub trait NativeScalar: Clone + 'static { fn value(&self) -> Value; }
impl NativeScalar for f64 { fn value(&self) -> Value { Value::Number(*self) } }
impl NativeScalar for bool { fn value(&self) -> Value { Value::Bool(*self) } }
impl NativeScalar for String { fn value(&self) -> Value { Value::String(self.clone()) } }
pub struct NativeScalars<T: NativeScalar>(pub Vec<T>);
impl<T: NativeScalar> NativeArray for NativeScalars<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Scalar(self.0[index].value()) }
}

#[inline]
pub fn native_array_item(owner: &std::rc::Rc<dyn NativeArray>, index: usize) -> Value {
    match owner.item(index) {
        NativeItem::Scalar(value) => value,
        _ => Value::NativeElement(owner.clone(), index),
    }
}

// The common FFI traversal view preserves the backing representation. Only
// callers explicitly requesting unwrap_array allocate a Vec of Value views.
pub struct ArrayItems { value: IntItems, front: usize, back: usize }
impl std::iter::Iterator for ArrayItems {
    type Item = Value;
    #[inline]
    fn next(&mut self) -> Option<Value> {
        if self.front == self.back { return None; }
        let value = self.value.raw(self.front);
        self.front += 1;
        Some(value)
    }
    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        let length = self.back - self.front;
        (length, Some(length))
    }
}
impl std::iter::DoubleEndedIterator for ArrayItems {
    #[inline]
    fn next_back(&mut self) -> Option<Value> {
        if self.front == self.back { return None; }
        self.back -= 1;
        Some(self.value.raw(self.back))
    }
}
impl std::iter::ExactSizeIterator for ArrayItems {}
impl Value {
    #[inline]
    pub fn array_iter(&self) -> ArrayItems {
        let value = IntItems::from(self);
        let back = value.len();
        ArrayItems { value, front: 0, back }
    }
}
`;

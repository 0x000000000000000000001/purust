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
    fn field(&self, index: usize, name: &str) -> Option<std::borrow::Cow<'_, Value>> {
        match self.item(index) { NativeItem::Record(value) => value.get(name), _ => panic!("Expected record") }
    }
}

// A thin shared owner keeps (owner, index) within 16 bytes, so adding an
// element view does not enlarge every Value (including the input JSON DOM).
// Scalar Vecs live directly here. A generated record/class Vec needs one
// extra type-erasure box per array, never one box per element.
pub enum NativeArrayOwner {
    Empty,
    Numbers(Vec<f64>),
    Booleans(Vec<bool>),
    Strings(Vec<String>),
    Elements(Box<dyn NativeArray>),
}
impl NativeArrayOwner {
    pub fn len(&self) -> usize {
        match self { Self::Empty => 0, Self::Numbers(v) => v.len(), Self::Booleans(v) => v.len(), Self::Strings(v) => v.len(), Self::Elements(v) => v.len() }
    }
    pub fn item(&self, index: usize) -> NativeItem<'_> {
        match self {
            Self::Empty => panic!("Array index out of bounds"),
            Self::Numbers(v) => NativeItem::Scalar(Value::Number(v[index])),
            Self::Booleans(v) => NativeItem::Scalar(Value::Bool(v[index])),
            Self::Strings(v) => NativeItem::Scalar(Value::String(v[index].clone())),
            Self::Elements(v) => v.item(index),
        }
    }
    pub fn record(&self, index: usize) -> Option<&dyn NativeRecord> {
        match self.item(index) { NativeItem::Record(value) => Some(value), _ => None }
    }
    pub fn field(&self, index: usize, name: &str) -> Option<std::borrow::Cow<'_, Value>> {
        match self { Self::Elements(values) => values.field(index, name), _ => panic!("Expected record") }
    }
    pub fn class(&self, index: usize) -> &dyn std::any::Any {
        match self.item(index) { NativeItem::Class(value) => value, _ => panic!("Expected Class element") }
    }
}

pub struct NativeRecords<T: NativeRecord>(pub Vec<T>);
impl<T: NativeRecord> From<NativeRecords<T>> for NativeArrayOwner {
    fn from(value: NativeRecords<T>) -> Self { if value.0.is_empty() { Self::Empty } else { Self::Elements(Box::new(value)) } }
}
impl<T: NativeRecord> NativeArray for NativeRecords<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Record(&self.0[index]) }
    // One virtual call projects directly from the concrete element. Returning
    // a dyn NativeRecord first would require another virtual call per field.
    fn field(&self, index: usize, name: &str) -> Option<std::borrow::Cow<'_, Value>> { self.0[index].get(name) }
}

pub struct NativeClasses<T>(pub Vec<T>);
impl<T: std::any::Any + 'static> From<NativeClasses<T>> for NativeArrayOwner {
    fn from(value: NativeClasses<T>) -> Self { if value.0.is_empty() { Self::Empty } else { Self::Elements(Box::new(value)) } }
}
impl<T: std::any::Any + 'static> NativeArray for NativeClasses<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Class(&self.0[index]) }
}

pub trait NativeScalar: Clone + 'static { fn value(&self) -> Value; }
impl NativeScalar for f64 { fn value(&self) -> Value { Value::Number(*self) } }
impl NativeScalar for bool { fn value(&self) -> Value { Value::Bool(*self) } }
impl NativeScalar for String { fn value(&self) -> Value { Value::String(self.clone()) } }
pub struct NativeScalars<T: NativeScalar>(pub Vec<T>);
impl From<NativeScalars<f64>> for NativeArrayOwner {
    fn from(value: NativeScalars<f64>) -> Self { Self::Numbers(value.0) }
}
impl From<NativeScalars<bool>> for NativeArrayOwner {
    fn from(value: NativeScalars<bool>) -> Self { Self::Booleans(value.0) }
}
impl From<NativeScalars<String>> for NativeArrayOwner {
    fn from(value: NativeScalars<String>) -> Self { Self::Strings(value.0) }
}
impl<T: NativeScalar> NativeArray for NativeScalars<T> {
    fn len(&self) -> usize { self.0.len() }
    fn item(&self, index: usize) -> NativeItem<'_> { NativeItem::Scalar(self.0[index].value()) }
}

#[inline]
pub fn native_array_item(owner: &std::rc::Rc<NativeArrayOwner>, index: usize) -> Value {
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

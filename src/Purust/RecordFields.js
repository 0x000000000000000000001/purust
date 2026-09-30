export const runtime = String.raw`
// Own properties retain insertion order. Enumeration puts array indices first,
// as JS Object.keys does; replacing a value never moves its property. Keys are
// shared: construction plans and repeated record shapes reuse one allocation.
#[derive(Clone, Default)]
pub struct RecordFields(Vec<(std::rc::Rc<str>, Value)>);

impl RecordFields {
    pub fn new() -> Self { Self::default() }
    pub fn with_capacity(capacity: usize) -> Self { Self(Vec::with_capacity(capacity)) }
    // The caller guarantees the name is absent; used by native construction
    // plans whose rows are duplicate-free.
    pub fn push(&mut self, name: impl Into<std::rc::Rc<str>>, value: Value) { self.0.push((name.into(), value)); }
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.0.iter().find(|(key, _)| &**key == name).map(|(_, value)| value)
    }
    pub fn insert(&mut self, name: String, value: Value) -> Option<Value> {
        self.insert_shared(std::rc::Rc::from(name), value)
    }
    pub fn insert_shared(&mut self, name: std::rc::Rc<str>, value: Value) -> Option<Value> {
        if let Some((_, old)) = self.0.iter_mut().find(|(key, _)| **key == *name) {
            return Some(std::mem::replace(old, value));
        }
        self.0.push((name, value));
        None
    }
    pub fn remove(&mut self, name: &str) -> Option<Value> {
        self.0.iter().position(|(key, _)| &**key == name).map(|i| self.0.remove(i).1)
    }
    // Keep the internal order. Used where enumeration order is irrelevant.
    pub fn into_entries(self) -> Vec<(String, Value)> {
        self.0.into_iter().map(|(key, value)| (key.to_string(), value)).collect()
    }
    pub fn into_entries_shared(self) -> Vec<(std::rc::Rc<str>, Value)> { self.0 }
    pub fn entries_unsorted(&self) -> Vec<(String, Value)> {
        self.0.iter().map(|(key, value)| (key.to_string(), value.clone())).collect()
    }
    pub fn entries_unsorted_shared(&self) -> Vec<(std::rc::Rc<str>, Value)> { self.0.clone() }
    pub fn entries(&self) -> Vec<(String, Value)> {
        let mut entries: Vec<(String, Value)> = self
            .0
            .iter()
            .map(|(key, value)| (key.to_string(), value.clone()))
            .collect();
        entries.sort_by_key(|(key, _)| {
            key.parse::<u32>().ok().filter(|n| *n != u32::MAX && n.to_string() == *key)
                .map(|n| (0, n)).unwrap_or((1, 0))
        });
        entries
    }
}

// Shared mutable own-property storage used by native object FFI. Keeping the
// carrier here lets Foreign readers inspect it without a library dependency cycle.
pub struct SharedRecord(std::sync::Mutex<RecordFields>);
impl SharedRecord {
    pub fn empty() -> Self { Self(std::sync::Mutex::new(RecordFields::new())) }
    pub fn from_entries(entries: Vec<(String, Value)>) -> Self {
        let mut fields = RecordFields::new();
        for (key, value) in entries { fields.insert(key, value); }
        Self(std::sync::Mutex::new(fields))
    }
    pub fn from_entries_shared(entries: Vec<(std::rc::Rc<str>, Value)>) -> Self {
        let mut fields = RecordFields::new();
        for (key, value) in entries { fields.insert_shared(key, value); }
        Self(std::sync::Mutex::new(fields))
    }
    pub fn snapshot(&self) -> Self { Self(std::sync::Mutex::new(self.lock().clone())) }
    pub fn get(&self, key: &str) -> Option<Value> { self.lock().get(key).cloned() }
    pub fn entries(&self) -> Vec<(String, Value)> { self.lock().entries() }
    pub fn entries_unsorted(&self) -> Vec<(String, Value)> { self.lock().entries_unsorted() }
    pub fn entries_unsorted_shared(&self) -> Vec<(std::rc::Rc<str>, Value)> { self.lock().entries_unsorted_shared() }
    pub fn insert(&self, key: String, value: Value) -> Option<Value> { self.lock().insert(key, value) }
    pub fn remove(&self, key: &str) -> Option<Value> { self.lock().remove(key) }
    fn lock(&self) -> std::sync::MutexGuard<'_, RecordFields> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl Value {
    // Immutable PureScript records can enter Foreign.Object through Foreign
    // readers. Keep existing object handles shared; materialize own fields
    // only when crossing from a native immutable record representation.
    pub fn __purust_foreign_object(&self) -> std::rc::Rc<SharedRecord> {
        if let Value::Class(native) = self.resolve() {
            return native.downcast_ref::<std::rc::Rc<SharedRecord>>()
                .expect("Expected a Foreign.Object handle").clone();
        }
        let fields = self.__purust_record_fields().expect("Expected an object or record");
        std::rc::Rc::new(SharedRecord::from_entries(fields.entries()))
    }
}
`;

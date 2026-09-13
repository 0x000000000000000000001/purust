export const runtime = String.raw`
// Own properties retain insertion order. Enumeration puts array indices first,
// as JS Object.keys does; replacing a value never moves its property.
#[derive(Clone, Default)]
pub struct RecordFields(Vec<(String, Value)>);

impl RecordFields {
    pub fn new() -> Self { Self::default() }
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.0.iter().find(|(key, _)| key == name).map(|(_, value)| value)
    }
    pub fn insert(&mut self, name: String, value: Value) -> Option<Value> {
        if let Some((_, old)) = self.0.iter_mut().find(|(key, _)| key == &name) {
            return Some(std::mem::replace(old, value));
        }
        self.0.push((name, value));
        None
    }
    pub fn remove(&mut self, name: &str) -> Option<Value> {
        self.0.iter().position(|(key, _)| key == name).map(|i| self.0.remove(i).1)
    }
    pub fn entries(&self) -> Vec<(String, Value)> {
        let mut entries = self.0.clone();
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
    pub fn snapshot(&self) -> Self { Self(std::sync::Mutex::new(self.lock().clone())) }
    pub fn get(&self, key: &str) -> Option<Value> { self.lock().get(key).cloned() }
    pub fn entries(&self) -> Vec<(String, Value)> { self.lock().entries() }
    pub fn insert(&self, key: String, value: Value) -> Option<Value> { self.lock().insert(key, value) }
    pub fn remove(&self, key: &str) -> Option<Value> { self.lock().remove(key) }
    fn lock(&self) -> std::sync::MutexGuard<'_, RecordFields> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
`;

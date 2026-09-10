use std::ops::Deref;
use std::sync::Arc;

/// Shared immutable data with copy-on-write updates in concurrent programs.
pub struct PerceusPtr<T>(Arc<T>);

impl<T> PerceusPtr<T> {
    pub const STICKY_COUNT: u32 = u32::MAX;
    pub fn new(value: T) -> Self {
        Self(Arc::new(value))
    }
    pub fn is_unique(&self) -> bool {
        Arc::strong_count(&self.0) == 1
    }
    pub fn count(&self) -> u32 {
        Arc::strong_count(&self.0).min(u32::MAX as usize) as u32
    }
    pub fn drop_explicit(self) {}
}
impl<T: Clone> PerceusPtr<T> {
    pub fn make_mut(this: &mut Self) -> &mut T {
        Arc::make_mut(&mut this.0)
    }
    /// Initialization is permitted only before the value has been shared.
    pub unsafe fn force_mut(this: &mut Self) -> &mut T {
        Arc::get_mut(&mut this.0).expect("cannot initialize a published value")
    }
}
impl<T> Clone for PerceusPtr<T> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}
impl<T> Deref for PerceusPtr<T> {
    type Target = T;
    fn deref(&self) -> &T {
        &self.0
    }
}

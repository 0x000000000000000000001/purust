use std::ptr::NonNull;
use std::alloc::{alloc, dealloc, Layout};
use std::ops::Deref;

struct PerceusBox<T> {
    count: u32,
    data: T,
}

pub struct PerceusPtr<T> {
    ptr: NonNull<PerceusBox<T>>,
}

impl<T> PerceusPtr<T> {
    /// Valeur marquant le pointeur comme "immortel".
    pub const STICKY_COUNT: u32 = u32::MAX;

    pub fn new(data: T) -> Self {
        let layout = Layout::new::<PerceusBox<T>>();
        unsafe {
            let ptr = alloc(layout) as *mut PerceusBox<T>;
            if ptr.is_null() {
                std::alloc::handle_alloc_error(layout);
            }
            std::ptr::write(ptr, PerceusBox { count: 1, data });
            PerceusPtr {
                ptr: NonNull::new_unchecked(ptr),
            }
        }
    }

    /// Permet de forcer manuellement le compteur pour les tests
    #[cfg(test)]
    pub unsafe fn set_count(&self, count: u32) {
        let b = self.ptr.as_ptr();
        unsafe { (*b).count = count; }
    }

    /// Vérifie si le pointeur est unique (le fameux FBIP)
    pub fn is_unique(&self) -> bool {
        unsafe { self.ptr.as_ref().count == 1 }
    }

    /// Renvoie le compteur de références
    pub fn count(&self) -> u32 {
        unsafe { self.ptr.as_ref().count }
    }

    /// Explicitement drop le pointeur
    pub fn drop_explicit(self) {
        // nothing to do, taking ownership will drop it
    }
}

impl<T: Clone> PerceusPtr<T> {
    pub fn make_mut(this: &mut Self) -> &mut T {
        if !this.is_unique() {
            println!("FBIP: Cloning (shared)");
            *this = PerceusPtr::new((**this).clone());
        } else {
            println!("FBIP: Mutating in-place!");
        }
        unsafe { &mut (*this.ptr.as_ptr()).data }
    }
}

impl<T> Clone for PerceusPtr<T> {
    fn clone(&self) -> Self {
        unsafe {
            let b = self.ptr.as_ptr();
            let count = (*b).count;
            if count != Self::STICKY_COUNT {
                // Le saturating_add ici protège contre l'overflow. 
                // En cas d'overflow naturel, ça deviendra STICKY_COUNT, et ça bloquera à l'infini (leaked).
                (*b).count = count.saturating_add(1);
            }
        }
        PerceusPtr { ptr: self.ptr }
    }
}

impl<T> Drop for PerceusPtr<T> {
    fn drop(&mut self) {
        unsafe {
            let b = self.ptr.as_ptr();
            let count = (*b).count;
            if count != Self::STICKY_COUNT {
                let new_count = count - 1;
                (*b).count = new_count;
                if new_count == 0 {
                    std::ptr::drop_in_place(&mut (*b).data);
                    let layout = Layout::new::<PerceusBox<T>>();
                    dealloc(b as *mut u8, layout);
                }
            }
        }
    }
}

impl<T> Deref for PerceusPtr<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        unsafe { &self.ptr.as_ref().data }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static DROP_COUNT: AtomicUsize = AtomicUsize::new(0);

    struct DropTracker;

    impl Drop for DropTracker {
        fn drop(&mut self) {
            DROP_COUNT.fetch_add(1, Ordering::SeqCst);
        }
    }

    #[test]
    fn test_unique_and_drop() {
        DROP_COUNT.store(0, Ordering::SeqCst);
        {
            let ptr = PerceusPtr::new(DropTracker);
            assert!(ptr.is_unique());
            assert_eq!(ptr.count(), 1);
        }
        assert_eq!(DROP_COUNT.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_clone_sharing() {
        DROP_COUNT.store(0, Ordering::SeqCst);
        {
            let ptr1 = PerceusPtr::new(DropTracker);
            let ptr2 = ptr1.clone();
            
            assert!(!ptr1.is_unique());
            assert_eq!(ptr1.count(), 2);
            assert_eq!(ptr2.count(), 2);

            drop(ptr1);
            assert_eq!(ptr2.count(), 1);
            assert!(ptr2.is_unique()); // FBIP condition re-enabled!
            assert_eq!(DROP_COUNT.load(Ordering::SeqCst), 0);
        }
        assert_eq!(DROP_COUNT.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_sticky_sharing() {
        DROP_COUNT.store(0, Ordering::SeqCst);
        {
            let ptr1 = PerceusPtr::new(DropTracker);
            unsafe { ptr1.set_count(PerceusPtr::<DropTracker>::STICKY_COUNT) };
            
            let ptr2 = ptr1.clone();
            assert_eq!(ptr1.count(), PerceusPtr::<DropTracker>::STICKY_COUNT);
            assert_eq!(ptr2.count(), PerceusPtr::<DropTracker>::STICKY_COUNT);
            
            drop(ptr1);
            // Drop shouldn't decrement
            assert_eq!(ptr2.count(), PerceusPtr::<DropTracker>::STICKY_COUNT);
            
            drop(ptr2);
            // DropTracker shouldn't be dropped, memory is leaked deliberately
        }
        assert_eq!(DROP_COUNT.load(Ordering::SeqCst), 0);
    }

    #[derive(Clone)]
    struct Record_a {
        a: i64,
    }

    fn count_up(mut v: PerceusPtr<Record_a>, n: i64) -> PerceusPtr<Record_a> {
        if n == 0 {
            v
        } else {
            let mut _base = v;
            {
                let _mut = PerceusPtr::make_mut(&mut _base);
                _mut.a = _mut.a + 1;
            }
            count_up(_base, n - 1)
        }
    }

    #[test]
    fn test_fbip_recursive() {
        let initial = PerceusPtr::new(Record_a { a: 0 });
        let result = count_up(initial, 5);
        assert_eq!(result.a, 5);
    }
}

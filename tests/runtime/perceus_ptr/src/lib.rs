#[cfg(not(feature = "threaded"))]
mod local;
#[cfg(not(feature = "threaded"))]
pub use self::local::*;

#[cfg(feature = "threaded")]
mod threaded;
#[cfg(feature = "threaded")]
pub use self::threaded::*;

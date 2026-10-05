// Test resource: deliberately neither Clone nor Copy. No purust-specific types.
pub struct Session { value: i64 }

pub fn open(value: i64) -> Session { Session { value } }
pub fn inspect(session: &Session) -> i64 { session.value }
pub fn add(session: &mut Session, amount: i64) { session.value += amount; }
pub fn finish(session: Session) -> i64 { session.value }
pub fn combine(left: &Session, right: &mut Session) -> i64 {
    right.value += left.value;
    right.value
}

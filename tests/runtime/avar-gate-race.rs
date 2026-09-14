use std::sync::{Arc, Barrier, Mutex, atomic::{AtomicUsize, Ordering}};
use avar::*;

fn execute(effect: Value) -> Value { effect.unwrap_func1()(Value::Unit) }
fn utility() -> Value {
    let mut fields=RecordFields::new();
    for key in ["right","just","filled","killed"] { fields.insert(key.into(),Value::Func1(Func1::Static(|v|v))); }
    fields.insert("left".into(),Value::Func1(Func1::Static(|_|panic!("unexpected AVar error"))));
    fields.insert("nothing".into(),Value::Null); fields.insert("empty".into(),Value::Unit);
    Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields))
}
fn read_gate(util:Value, gate:Value, callback: impl Fn(Value)+Send+Sync+'static) {
    let callback=Arc::new(callback);
    let handler=Value::Func1(Func1::Shared(Arc::new(move |value| {
        let callback=callback.clone();
        Value::Func1(Func1::Shared(Arc::new(move |_| {callback(value.clone()); Value::Unit})))
    })));
    execute(Effect_AVar__readVar().unwrap_func3()(util,gate,handler));
}
fn try_put(util:Value, gate:Value, value:i64) -> bool {
    execute(Effect_AVar__tryPutVar().unwrap_func3()(util,mk_int(value),gate)).unwrap_bool()
}
struct Trial {gate:Value, reads:AtomicUsize, mask:AtomicUsize, winners:AtomicUsize, values:Mutex<Vec<i64>>}
fn contested(readers:usize, writers:usize, rounds:usize) {
    let start=Arc::new(Barrier::new(readers+writers+1)); let done=start.clone();
    let slot=Arc::new(Mutex::new(None::<Arc<Trial>>)); let util=utility();
    let workers=(0..readers+writers).map(|id| {
        let start=start.clone(); let done=done.clone(); let slot=slot.clone(); let util=util.clone();
        std::thread::spawn(move || for round in 0..rounds {
            start.wait(); let trial=slot.lock().unwrap().as_ref().unwrap().clone();
            if (round+id)%3==0 {std::thread::yield_now();}
            if id<readers {
                let seen=trial.clone();
                read_gate(util.clone(),trial.gate.clone(),move |value| {
                    assert_eq!(seen.mask.fetch_or(1<<id,Ordering::SeqCst)&(1<<id),0,"duplicate read callback");
                    seen.values.lock().unwrap().push(value.unwrap_int()); seen.reads.fetch_add(1,Ordering::SeqCst);
                });
            } else if try_put(util.clone(),trial.gate.clone(),id as i64) {trial.winners.fetch_add(1,Ordering::SeqCst);}
            done.wait();
        })
    }).collect::<Vec<_>>();
    for round in 0..rounds {
        let trial=Arc::new(Trial {gate:execute(Effect_AVar_empty()),reads:AtomicUsize::new(0),mask:AtomicUsize::new(0),
            winners:AtomicUsize::new(0),values:Mutex::new(Vec::new())});
        *slot.lock().unwrap()=Some(trial.clone()); start.wait(); done.wait();
        assert_eq!(trial.winners.load(Ordering::SeqCst),1,"round {round}");
        assert_eq!(trial.reads.load(Ordering::SeqCst),readers,"round {round}: {}",diagnostic(&trial.gate));
        let values=trial.values.lock().unwrap(); assert!(values.iter().all(|v|*v==values[0]));
        assert_eq!(execute(Effect_AVar__tryReadVar().unwrap_func2()(util.clone(),trial.gate.clone())).unwrap_int(),values[0]);
        if round%1000==0 {println!("contested readers={readers} writers={writers} round={round}: all woke");}
    }
    for worker in workers {worker.join().unwrap();}
}
fn during_drain() {
    let gate=execute(Effect_AVar_empty()); let util=utility();
    let entered=Arc::new(Barrier::new(2)); let release=Arc::new(Barrier::new(2));
    let count=Arc::new(AtomicUsize::new(0)); let seen=count.clone(); let begin=entered.clone(); let end=release.clone();
    read_gate(util.clone(),gate.clone(),move |v| {assert_eq!(v.unwrap_int(),7);begin.wait();end.wait();seen.fetch_add(1,Ordering::SeqCst);});
    let put_gate=gate.clone(); let put_util=util.clone();
    let publisher=std::thread::spawn(move || assert!(try_put(put_util,put_gate,7)));
    entered.wait();
    for _ in 0..4096 {let seen=count.clone();read_gate(util.clone(),gate.clone(),move |v| {
        assert_eq!(v.unwrap_int(),7);seen.fetch_add(1,Ordering::SeqCst);
    });}
    assert!(!try_put(util.clone(),gate.clone(),99));
    release.wait(); publisher.join().unwrap();
    assert_eq!(count.load(Ordering::SeqCst),4097,"{}",diagnostic(&gate));
    println!("active drainer: 4096 late readers + initial reader woke exactly once");
}
fn two_stage(rounds:usize) {
    for round in 0..rounds {
        let util=utility(); let first=execute(Effect_AVar_empty()); let second=execute(Effect_AVar_empty());
        let first_count=Arc::new(AtomicUsize::new(0)); let second_count=Arc::new(AtomicUsize::new(0));
        for id in 0..5 {let util=util.clone();let second=second.clone();let a=first_count.clone();let b=second_count.clone();
            read_gate(util.clone(),first.clone(),move |_| {
                a.fetch_add(1,Ordering::SeqCst);
                if id==0 {assert!(try_put(util.clone(),second.clone(),2));}
                else {let b=b.clone();read_gate(util.clone(),second.clone(),move |value| {assert_eq!(value.unwrap_int(),2);b.fetch_add(1,Ordering::SeqCst);});}
            });
        }
        assert!(try_put(util,first.clone(),1));
        assert_eq!(first_count.load(Ordering::SeqCst),5,"round {round}: {}",diagnostic(&first));
        assert_eq!(second_count.load(Ordering::SeqCst),4,"round {round}: {}",diagnostic(&second));
    }
    println!("two-stage 5 then 4 reads: {rounds} rounds passed");
}
fn main() {
    std::thread::spawn(|| {std::thread::sleep(std::time::Duration::from_secs(75));eprintln!("AVAR_NATIVE_WATCHDOG_TIMEOUT");std::process::exit(124);});
    contested(5,4,5000); contested(16,8,2000); during_drain(); two_stage(10000);
    println!("AVAR_GATE_RACE_PASS: 7000 contested rounds; 57000 reads; 4097 active-drainer reads; 10000 two-stage rounds");
}

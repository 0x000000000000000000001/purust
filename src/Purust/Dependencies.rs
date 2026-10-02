pub fn Purust_Dependencies_closureImpl(fallback: Func1<Value, Value>, edges: Value) -> Value {
    let n = edges.array_len();
    let words = n.div_ceil(64);
    // Bound the dense working matrix; very large graphs retain the reference
    // algorithm rather than reserving quadratic native storage without a limit.
    if n > 8192 { return fallback(edges); }
    let mut rows = vec![vec![0u64; words]; n];
    for i in 0..n {
        let row = edges.array_get(i);
        for j in 0..row.array_len() {
            let target = row.array_get_int(j);
            if target < 0 || target as usize >= n { return fallback(edges); }
            let target = target as usize;
            rows[i][target / 64] |= 1u64 << (target % 64);
        }
    }
    for k in 0..n {
        let through = rows[k].clone();
        for row in &mut rows {
            if row[k / 64] & (1u64 << (k % 64)) != 0 {
                for (word, reachable) in row.iter_mut().zip(&through) { *word |= reachable; }
            }
        }
    }
    mk_array(rows.into_iter().map(|row| {
        let mut reachable = Vec::new();
        for (word_index, mut word) in row.into_iter().enumerate() {
            while word != 0 {
                let bit = word.trailing_zeros();
                reachable.push(Value::Int((word_index * 64 + bit as usize) as i64));
                word &= word - 1;
            }
        }
        mk_array(reachable)
    }).collect())
}

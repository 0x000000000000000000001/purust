pub fn ChildCallReuse_checkedKey(key: i64) -> i64 {
    if key == -99 { panic!("foreign child call"); }
    key + 1
}

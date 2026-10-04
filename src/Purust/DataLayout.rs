// Borrow the existing persistent Set (an AVL Map keyed by pairs of strings).
// Avoid temporary Tuple/Ordering values and cloning keys at every tree node.
pub fn Purust_DataLayout_memberLayoutImpl(
    _fallback: Func3<std::rc::Rc<Purs_Data_Map_Internal::Map>, String, String, bool>,
    enums: std::rc::Rc<Purs_Data_Map_Internal::Map>,
    mut module_name: String,
    type_name: String,
) -> bool {
    use std::cmp::Ordering;
    use Purs_Data_Map_Internal::Map;
    use Purs_Data_Tuple::Tuple;
    if module_name.contains('.') { module_name = module_name.replace('.', "_"); }
    let mut node = enums.as_ref();
    while let Map::Node(_, _, key, _, left, right) = node {
        // Map keys are shared ADTs boxed unsized (ClassShared); the legacy
        // nested Class form is still accepted by the same helper.
        let key = key.unwrap_class_shared::<Tuple>();
        let Tuple::Tuple(module, name) = key.as_ref();
        let Value::String(module) = module.resolve() else { panic!("Expected layout module name") };
        let Value::String(name) = name.resolve() else { panic!("Expected layout type name") };
        // Runtime string encoding preserves UTF-16 code-unit order.
        node = match module_name.cmp(module).then_with(|| type_name.cmp(name)) {
            Ordering::Less => left,
            Ordering::Greater => right,
            Ordering::Equal => return true,
        };
    }
    false
}

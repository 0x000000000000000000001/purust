pub fn EnumConsumer_flipColor(color: Purs_EnumTypes::Color) -> Purs_EnumTypes::Color {
    match color {
        Purs_EnumTypes::Color::R => Purs_EnumTypes::Color::B,
        Purs_EnumTypes::Color::B => Purs_EnumTypes::Color::R,
    }
}

pub fn EnumConsumer_passThrough(value: crate::UnknownType) -> crate::UnknownType {
    value
}

const { difference, empty, insert, union, fromFoldable } = require('./output/Data.Set/index.js');
let set_a = insert({ compare: () => 0 })("go")(empty);
let set_b = insert({ compare: () => 0 })("go")(empty);
let diff = difference({ compare: () => 0 })(set_a)(set_b);
console.log("Difference size:", diff.value1 !== undefined ? 1 : 0);

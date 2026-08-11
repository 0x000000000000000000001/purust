const { difference, fromFoldable, empty, insert } = require('./output/Data.Set/index.js');
let s1 = insert("go")(empty);
let s2 = insert("go")(empty);
console.log(difference(s1)(s2));

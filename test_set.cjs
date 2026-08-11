const { difference, empty, insert } = require('./output/Data.Set/index.js');
let s1 = insert({ compare: () => 0 })("go")(empty);
let s2 = insert({ compare: () => 0 })("go")(empty);
console.log(difference({ compare: () => 0 })(s1)(s2));

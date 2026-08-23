// output-es/runtime.js
function binding(init) {
  let state = 0;
  let value;
  return () => {
    if (state === 2) {
      return value;
    }
    if (state === 1) {
      throw new Error("Binding demanded before initialized");
    }
    state = 1;
    value = init();
    state = 2;
    return value;
  };
}
function fail() {
  throw new Error("Failed pattern match");
}
function intDiv(x, y) {
  if (y > 0) return Math.floor(x / y);
  if (y < 0) return -Math.floor(x / -y);
  return 0;
}

// output-es/Data.Function/index.js
var $$const = (a) => (v) => a;
var applyFlipped = (x) => (f) => f(x);

// output-es/Control.Semigroupoid/index.js
var semigroupoidFn = { compose: (f) => (g) => (x) => f(g(x)) };

// output-es/Type.Proxy/index.js
var $$$Proxy = () => ({ tag: "Proxy" });
var $$Proxy = /* @__PURE__ */ $$$Proxy();

// output-es/Data.Functor/foreign.js
var arrayMap = function(f) {
  return function(arr) {
    var l = arr.length;
    var result = new Array(l);
    for (var i = 0; i < l; i++) {
      result[i] = f(arr[i]);
    }
    return result;
  };
};

// output-es/Data.Functor/index.js
var functorFn = /* @__PURE__ */ (() => ({ map: semigroupoidFn.compose }))();
var functorArray = { map: arrayMap };

// output-es/Control.Apply/index.js
var applyFn = { apply: (f) => (g) => (x) => f(x)(g(x)), Functor0: () => functorFn };

// output-es/Control.Bind/foreign.js
var arrayBind = typeof Array.prototype.flatMap === "function" ? function(arr) {
  return function(f) {
    return arr.flatMap(f);
  };
} : function(arr) {
  return function(f) {
    var result = [];
    var l = arr.length;
    for (var i = 0; i < l; i++) {
      var xs = f(arr[i]);
      var k = xs.length;
      for (var j = 0; j < k; j++) {
        result.push(xs[j]);
      }
    }
    return result;
  };
};

// output-es/Control.Applicative/index.js
var applicativeFn = { pure: (x) => (v) => x, Apply0: () => applyFn };

// output-es/Record.Unsafe/foreign.js
var unsafeGet = function(label2) {
  return function(rec) {
    return rec[label2];
  };
};
var unsafeSet = function(label2) {
  return function(value) {
    return function(rec) {
      var copy = {};
      for (var key in rec) {
        if ({}.hasOwnProperty.call(rec, key)) {
          copy[key] = rec[key];
        }
      }
      copy[label2] = value;
      return copy;
    };
  };
};

// output-es/Data.Show/foreign.js
var showIntImpl = function(n) {
  return n.toString();
};
var showNumberImpl = function(n) {
  var str = n.toString();
  return isNaN(str + ".0") ? str : str + ".0";
};
var showCharImpl = function(c) {
  var code = c.charCodeAt(0);
  if (code < 32 || code === 127) {
    switch (c) {
      case "\x07":
        return "'\\a'";
      case "\b":
        return "'\\b'";
      case "\f":
        return "'\\f'";
      case "\n":
        return "'\\n'";
      case "\r":
        return "'\\r'";
      case "	":
        return "'\\t'";
      case "\v":
        return "'\\v'";
    }
    return "'\\" + code.toString(10) + "'";
  }
  return c === "'" || c === "\\" ? "'\\" + c + "'" : "'" + c + "'";
};
var showStringImpl = function(s) {
  var l = s.length;
  return '"' + s.replace(
    /[\0-\x1F\x7F"\\]/g,
    // eslint-disable-line no-control-regex
    function(c, i) {
      switch (c) {
        case '"':
        case "\\":
          return "\\" + c;
        case "\x07":
          return "\\a";
        case "\b":
          return "\\b";
        case "\f":
          return "\\f";
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "	":
          return "\\t";
        case "\v":
          return "\\v";
      }
      var k = i + 1;
      var empty2 = k < l && s[k] >= "0" && s[k] <= "9" ? "\\&" : "";
      return "\\" + c.charCodeAt(0).toString(10) + empty2;
    }
  ) + '"';
};

// output-es/Data.Ordering/index.js
var $Ordering = (tag) => tag;
var LT = /* @__PURE__ */ $Ordering("LT");
var GT = /* @__PURE__ */ $Ordering("GT");
var EQ = /* @__PURE__ */ $Ordering("EQ");

// output-es/Data.Maybe/index.js
var $Maybe = (tag, _1) => ({ tag, _1 });
var Nothing = /* @__PURE__ */ $Maybe("Nothing");
var Just = (value0) => $Maybe("Just", value0);
var isNothing = (v2) => {
  if (v2.tag === "Nothing") {
    return true;
  }
  if (v2.tag === "Just") {
    return false;
  }
  fail();
};
var isJust = (v2) => {
  if (v2.tag === "Nothing") {
    return false;
  }
  if (v2.tag === "Just") {
    return true;
  }
  fail();
};

// output-es/Data.Either/index.js
var $Either = (tag, _1) => ({ tag, _1 });
var Left = (value0) => $Either("Left", value0);
var Right = (value0) => $Either("Right", value0);
var functorEither = {
  map: (f) => (m) => {
    if (m.tag === "Left") {
      return $Either("Left", m._1);
    }
    if (m.tag === "Right") {
      return $Either("Right", f(m._1));
    }
    fail();
  }
};
var applyEither = {
  apply: (v) => (v1) => {
    if (v.tag === "Left") {
      return $Either("Left", v._1);
    }
    if (v.tag === "Right") {
      if (v1.tag === "Left") {
        return $Either("Left", v1._1);
      }
      if (v1.tag === "Right") {
        return $Either("Right", v._1(v1._1));
      }
    }
    fail();
  },
  Functor0: () => functorEither
};
var applicativeEither = { pure: Right, Apply0: () => applyEither };

// output-es/Control.Monad.ST.Internal/foreign.js
function newSTRef(val) {
  return function() {
    return { value: val };
  };
}

// output-es/Control.Monad.ST.Uncurried/foreign.js
var runSTFn2 = function runSTFn22(fn) {
  return function(a) {
    return function(b) {
      return function() {
        return fn(a, b);
      };
    };
  };
};

// output-es/Data.Array.ST/foreign.js
var pushImpl = function(a, xs) {
  return xs.push(a);
};

// output-es/Data.Array.ST/index.js
var push = /* @__PURE__ */ runSTFn2(pushImpl);

// output-es/Data.Array.ST.Iterator/index.js
var $Iterator = (_1, _2) => ({ tag: "Iterator", _1, _2 });
var Iterator = (value0) => (value1) => $Iterator(value0, value1);
var pushWhile = (p) => (iter) => (array) => {
  const $0 = newSTRef(false);
  return () => {
    const $$break = $0();
    const $1 = iter._2;
    while ((() => {
      const $2 = $$break.value;
      return !$2;
    })()) {
      const i = $1.value;
      const mx = iter._1(i);
      if (mx.tag === "Just" && p(mx._1)) {
        array.push(mx._1);
        iter._2.value;
        const $2 = iter._2.value;
        iter._2.value = $2 + 1 | 0;
        continue;
      }
      $$break.value = true;
    }
  };
};
var iterator = (f) => {
  const $0 = Iterator(f);
  const $1 = newSTRef(0);
  return () => {
    const $2 = $1();
    return $0($2);
  };
};
var iterate = (iter) => (f) => {
  const $0 = newSTRef(false);
  return () => {
    const $$break = $0();
    const $1 = iter._2;
    while ((() => {
      const $2 = $$break.value;
      return !$2;
    })()) {
      const i = $1.value;
      const $2 = $1.value;
      $1.value = $2 + 1 | 0;
      const mx = iter._1(i);
      if (mx.tag === "Just") {
        f(mx._1)();
        continue;
      }
      if (mx.tag === "Nothing") {
        $$break.value = true;
        continue;
      }
      fail();
    }
  };
};

// output-es/Data.Maybe.First/index.js
var semigroupFirst = {
  append: (v) => (v1) => {
    if (v.tag === "Just") {
      return v;
    }
    return v1;
  }
};
var monoidFirst = { mempty: Nothing, Semigroup0: () => semigroupFirst };

// output-es/Data.Foldable/foreign.js
var foldrArray = function(f) {
  return function(init) {
    return function(xs) {
      var acc = init;
      var len = xs.length;
      for (var i = len - 1; i >= 0; i--) {
        acc = f(xs[i])(acc);
      }
      return acc;
    };
  };
};
var foldlArray = function(f) {
  return function(init) {
    return function(xs) {
      var acc = init;
      var len = xs.length;
      for (var i = 0; i < len; i++) {
        acc = f(acc)(xs[i]);
      }
      return acc;
    };
  };
};

// output-es/Data.Foldable/index.js
var identity2 = (x) => x;
var monoidEndo = /* @__PURE__ */ (() => {
  const semigroupEndo1 = { append: (v) => (v1) => (x) => v(v1(x)) };
  return { mempty: (x) => x, Semigroup0: () => semigroupEndo1 };
})();
var monoidDual = /* @__PURE__ */ (() => {
  const $0 = monoidEndo.Semigroup0();
  const semigroupDual1 = { append: (v) => (v1) => $0.append(v1)(v) };
  return { mempty: monoidEndo.mempty, Semigroup0: () => semigroupDual1 };
})();
var foldableTuple = { foldr: (f) => (z) => (v) => f(v._2)(z), foldl: (f) => (z) => (v) => f(z)(v._2), foldMap: (dictMonoid) => (f) => (v) => f(v._2) };
var foldableArray = {
  foldr: foldrArray,
  foldl: foldlArray,
  foldMap: (dictMonoid) => {
    const mempty = dictMonoid.mempty;
    return (f) => foldableArray.foldr((x) => (acc) => dictMonoid.Semigroup0().append(f(x))(acc))(mempty);
  }
};
var foldlDefault = (dictFoldable) => {
  const foldMap23 = dictFoldable.foldMap(monoidDual);
  return (c) => (u) => (xs) => foldMap23((x) => (a) => c(a)(x))(xs)(u);
};
var foldrDefault = (dictFoldable) => {
  const foldMap23 = dictFoldable.foldMap(monoidEndo);
  return (c) => (u) => (xs) => foldMap23((x) => c(x))(xs)(u);
};
var lookup = (dictFoldable) => {
  const foldMap23 = dictFoldable.foldMap(monoidFirst);
  return (dictEq) => (a) => foldMap23((v) => {
    if (dictEq.eq(a)(v._1)) {
      return $Maybe("Just", v._2);
    }
    return Nothing;
  });
};
var or = (dictFoldable) => (dictHeytingAlgebra) => dictFoldable.foldMap((() => {
  const semigroupDisj1 = { append: (v) => (v1) => dictHeytingAlgebra.disj(v)(v1) };
  return { mempty: dictHeytingAlgebra.ff, Semigroup0: () => semigroupDisj1 };
})())(identity2);
var and = (dictFoldable) => (dictHeytingAlgebra) => dictFoldable.foldMap((() => {
  const semigroupConj1 = { append: (v) => (v1) => dictHeytingAlgebra.conj(v)(v1) };
  return { mempty: dictHeytingAlgebra.tt, Semigroup0: () => semigroupConj1 };
})())(identity2);

// output-es/Data.Tuple/index.js
var $Tuple = (_1, _2) => ({ tag: "Tuple", _1, _2 });
var Tuple = (value0) => (value1) => $Tuple(value0, value1);
var snd = (v) => v._2;
var functorTuple = { map: (f) => (m) => $Tuple(m._1, f(m._2)) };
var fst = (v) => v._1;

// output-es/Data.FunctorWithIndex/foreign.js
var mapWithIndexArray = function(f) {
  return function(xs) {
    var l = xs.length;
    var result = Array(l);
    for (var i = 0; i < l; i++) {
      result[i] = f(i)(xs[i]);
    }
    return result;
  };
};

// output-es/Data.FunctorWithIndex/index.js
var functorWithIndexArray = { mapWithIndex: mapWithIndexArray, Functor0: () => functorArray };

// output-es/Data.Eq/foreign.js
var refEq = function(r1) {
  return function(r2) {
    return r1 === r2;
  };
};
var eqBooleanImpl = refEq;
var eqIntImpl = refEq;
var eqNumberImpl = refEq;
var eqCharImpl = refEq;
var eqStringImpl = refEq;
var eqArrayImpl = function(f) {
  return function(xs) {
    return function(ys) {
      if (xs.length !== ys.length) return false;
      for (var i = 0; i < xs.length; i++) {
        if (!f(xs[i])(ys[i])) return false;
      }
      return true;
    };
  };
};

// output-es/Data.Eq/index.js
var eqString = { eq: eqStringImpl };
var eqNumber = { eq: eqNumberImpl };
var eqInt = { eq: eqIntImpl };
var eqChar = { eq: eqCharImpl };
var eqBoolean = { eq: eqBooleanImpl };

// output-es/Data.Ord/foreign.js
var unsafeCompareImpl = function(lt) {
  return function(eq2) {
    return function(gt) {
      return function(x) {
        return function(y) {
          return x < y ? lt : x === y ? eq2 : gt;
        };
      };
    };
  };
};
var ordBooleanImpl = unsafeCompareImpl;
var ordIntImpl = unsafeCompareImpl;
var ordNumberImpl = unsafeCompareImpl;
var ordStringImpl = unsafeCompareImpl;
var ordCharImpl = unsafeCompareImpl;
var ordArrayImpl = function(f) {
  return function(xs) {
    return function(ys) {
      var i = 0;
      var xlen = xs.length;
      var ylen = ys.length;
      while (i < xlen && i < ylen) {
        var x = xs[i];
        var y = ys[i];
        var o = f(x)(y);
        if (o !== 0) {
          return o;
        }
        i++;
      }
      if (xlen === ylen) {
        return 0;
      } else if (xlen > ylen) {
        return -1;
      } else {
        return 1;
      }
    };
  };
};

// output-es/Data.Ord/index.js
var ordString = { compare: /* @__PURE__ */ ordStringImpl(LT)(EQ)(GT), Eq0: () => eqString };
var ordNumber = { compare: /* @__PURE__ */ ordNumberImpl(LT)(EQ)(GT), Eq0: () => eqNumber };
var ordInt = { compare: /* @__PURE__ */ ordIntImpl(LT)(EQ)(GT), Eq0: () => eqInt };
var ordChar = { compare: /* @__PURE__ */ ordCharImpl(LT)(EQ)(GT), Eq0: () => eqChar };
var ordBoolean = { compare: /* @__PURE__ */ ordBooleanImpl(LT)(EQ)(GT), Eq0: () => eqBoolean };
var ordArray = (dictOrd) => {
  const eqArray2 = { eq: eqArrayImpl(dictOrd.Eq0().eq) };
  return {
    compare: (xs) => (ys) => ordInt.compare(0)(ordArrayImpl((x) => (y) => {
      const v = dictOrd.compare(x)(y);
      if (v === "EQ") {
        return 0;
      }
      if (v === "LT") {
        return 1;
      }
      if (v === "GT") {
        return -1;
      }
      fail();
    })(xs)(ys)),
    Eq0: () => eqArray2
  };
};

// output-es/Unsafe.Coerce/foreign.js
var unsafeCoerce = function(x) {
  return x;
};

// output-es/Data.Traversable.Accum.Internal/index.js
var functorStateR = {
  map: (f) => (k) => (s) => {
    const v = k(s);
    return { accum: v.accum, value: f(v.value) };
  }
};
var functorStateL = {
  map: (f) => (k) => (s) => {
    const v = k(s);
    return { accum: v.accum, value: f(v.value) };
  }
};
var applyStateR = {
  apply: (f) => (x) => (s) => {
    const v = x(s);
    const v1 = f(v.accum);
    return { accum: v1.accum, value: v1.value(v.value) };
  },
  Functor0: () => functorStateR
};
var applyStateL = {
  apply: (f) => (x) => (s) => {
    const v = f(s);
    const v1 = x(v.accum);
    return { accum: v1.accum, value: v.value(v1.value) };
  },
  Functor0: () => functorStateL
};
var applicativeStateR = { pure: (a) => (s) => ({ accum: s, value: a }), Apply0: () => applyStateR };
var applicativeStateL = { pure: (a) => (s) => ({ accum: s, value: a }), Apply0: () => applyStateL };

// output-es/Data.Traversable/foreign.js
var traverseArrayImpl = /* @__PURE__ */ (function() {
  function array1(a) {
    return [a];
  }
  function array2(a) {
    return function(b) {
      return [a, b];
    };
  }
  function array3(a) {
    return function(b) {
      return function(c) {
        return [a, b, c];
      };
    };
  }
  function concat22(xs) {
    return function(ys) {
      return xs.concat(ys);
    };
  }
  return function(apply) {
    return function(map) {
      return function(pure) {
        return function(f) {
          return function(array) {
            function go(bot, top) {
              switch (top - bot) {
                case 0:
                  return pure([]);
                case 1:
                  return map(array1)(f(array[bot]));
                case 2:
                  return apply(map(array2)(f(array[bot])))(f(array[bot + 1]));
                case 3:
                  return apply(apply(map(array3)(f(array[bot])))(f(array[bot + 1])))(f(array[bot + 2]));
                default:
                  var pivot = bot + Math.floor((top - bot) / 4) * 2;
                  return apply(map(concat22)(go(bot, pivot)))(go(pivot, top));
              }
            }
            return go(0, array.length);
          };
        };
      };
    };
  };
})();

// output-es/Data.Traversable/index.js
var identity3 = (x) => x;
var traversableTuple = {
  traverse: (dictApplicative) => (f) => (v) => dictApplicative.Apply0().Functor0().map(Tuple(v._1))(f(v._2)),
  sequence: (dictApplicative) => (v) => dictApplicative.Apply0().Functor0().map(Tuple(v._1))(v._2),
  Functor0: () => functorTuple,
  Foldable1: () => foldableTuple
};
var traversableArray = {
  traverse: (dictApplicative) => {
    const Apply0 = dictApplicative.Apply0();
    return traverseArrayImpl(Apply0.apply)(Apply0.Functor0().map)(dictApplicative.pure);
  },
  sequence: (dictApplicative) => traversableArray.traverse(dictApplicative)(identity3),
  Functor0: () => functorArray,
  Foldable1: () => foldableArray
};
var mapAccumR = (dictTraversable) => {
  const traverse22 = dictTraversable.traverse(applicativeStateR);
  return (f) => (s0) => (xs) => traverse22((a) => (s) => f(s)(a))(xs)(s0);
};
var mapAccumL = (dictTraversable) => {
  const traverse22 = dictTraversable.traverse(applicativeStateL);
  return (f) => (s0) => (xs) => traverse22((a) => (s) => f(s)(a))(xs)(s0);
};

// output-es/Data.Array/foreign.js
var rangeImpl = function(start, end) {
  var step = start > end ? -1 : 1;
  var result = new Array(step * (end - start) + 1);
  var i = start, n = 0;
  while (i !== end) {
    result[n++] = i;
    i += step;
  }
  result[n] = i;
  return result;
};
var replicateFill = function(count, value) {
  if (count < 1) {
    return [];
  }
  var result = new Array(count);
  return result.fill(value);
};
var replicatePolyfill = function(count, value) {
  var result = [];
  var n = 0;
  for (var i = 0; i < count; i++) {
    result[n++] = value;
  }
  return result;
};
var replicateImpl = typeof Array.prototype.fill === "function" ? replicateFill : replicatePolyfill;
var fromFoldableImpl = /* @__PURE__ */ (function() {
  function Cons2(head2, tail) {
    this.head = head2;
    this.tail = tail;
  }
  var emptyList = {};
  function curryCons(head2) {
    return function(tail) {
      return new Cons2(head2, tail);
    };
  }
  function listToArray(list) {
    var result = [];
    var count = 0;
    var xs = list;
    while (xs !== emptyList) {
      result[count++] = xs.head;
      xs = xs.tail;
    }
    return result;
  }
  return function(foldr, xs) {
    return listToArray(foldr(curryCons)(emptyList)(xs));
  };
})();
var unconsImpl = function(empty2, next, xs) {
  return xs.length === 0 ? empty2({}) : next(xs[0])(xs.slice(1));
};
var findMapImpl = function(nothing, isJust2, f, xs) {
  for (var i = 0; i < xs.length; i++) {
    var result = f(xs[i]);
    if (isJust2(result)) return result;
  }
  return nothing;
};
var findIndexImpl = function(just, nothing, f, xs) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (f(xs[i])) return just(i);
  }
  return nothing;
};
var reverse = function(l) {
  return l.slice().reverse();
};
var concat = function(xss) {
  if (xss.length <= 1e4) {
    return Array.prototype.concat.apply([], xss);
  }
  var result = [];
  for (var i = 0, l = xss.length; i < l; i++) {
    var xs = xss[i];
    for (var j = 0, m = xs.length; j < m; j++) {
      result.push(xs[j]);
    }
  }
  return result;
};
var filterImpl = function(f, xs) {
  return xs.filter(f);
};
var sortByImpl2 = /* @__PURE__ */ (function() {
  function mergeFromTo(compare3, fromOrdering, xs1, xs2, from, to) {
    var mid;
    var i;
    var j;
    var k;
    var x;
    var y;
    var c;
    mid = from + (to - from >> 1);
    if (mid - from > 1) mergeFromTo(compare3, fromOrdering, xs2, xs1, from, mid);
    if (to - mid > 1) mergeFromTo(compare3, fromOrdering, xs2, xs1, mid, to);
    i = from;
    j = mid;
    k = from;
    while (i < mid && j < to) {
      x = xs2[i];
      y = xs2[j];
      c = fromOrdering(compare3(x)(y));
      if (c > 0) {
        xs1[k++] = y;
        ++j;
      } else {
        xs1[k++] = x;
        ++i;
      }
    }
    while (i < mid) {
      xs1[k++] = xs2[i++];
    }
    while (j < to) {
      xs1[k++] = xs2[j++];
    }
  }
  return function(compare3, fromOrdering, xs) {
    var out;
    if (xs.length < 2) return xs;
    out = xs.slice(0);
    mergeFromTo(compare3, fromOrdering, out, xs.slice(0), 0, xs.length);
    return out;
  };
})();
var sliceImpl = function(s, e, l) {
  return l.slice(s, e);
};
var zipWithImpl = function(f, xs, ys) {
  var l = xs.length < ys.length ? xs.length : ys.length;
  var result = new Array(l);
  for (var i = 0; i < l; i++) {
    result[i] = f(xs[i])(ys[i]);
  }
  return result;
};
var anyImpl = function(p, xs) {
  var len = xs.length;
  for (var i = 0; i < len; i++) {
    if (p(xs[i])) return true;
  }
  return false;
};
var allImpl = function(p, xs) {
  var len = xs.length;
  for (var i = 0; i < len; i++) {
    if (!p(xs[i])) return false;
  }
  return true;
};

// output-es/Data.Array/index.js
var zipWithA = (dictApplicative) => {
  const sequence1 = traversableArray.traverse(dictApplicative)(identity3);
  return (f) => (xs) => (ys) => sequence1(zipWithImpl(f, xs, ys));
};
var sortBy = (comp) => ($0) => sortByImpl2(
  comp,
  (v) => {
    if (v === "GT") {
      return 1;
    }
    if (v === "EQ") {
      return 0;
    }
    if (v === "LT") {
      return -1;
    }
    fail();
  },
  $0
);
var sortWith = (dictOrd) => (f) => sortBy((x) => (y) => dictOrd.compare(f(x))(f(y)));
var snoc = (xs) => (x) => (() => {
  const $0 = push(x);
  return () => {
    const result = [...xs];
    $0(result)();
    return result;
  };
})()();
var unzip = (xs) => {
  const fsts = [];
  const snds = [];
  const iter = iterator((v) => {
    if (v >= 0 && v < xs.length) {
      return $Maybe("Just", xs[v]);
    }
    return Nothing;
  })();
  iterate(iter)((v) => {
    const $0 = v._1;
    const $1 = v._2;
    return () => {
      fsts.push($0);
      snds.push($1);
    };
  })();
  return $Tuple(fsts, snds);
};
var nubBy = (comp) => (xs) => {
  const indexedAndSorted = sortBy((x) => (y) => comp(x._2)(y._2))(mapWithIndexArray(Tuple)(xs));
  if (0 < indexedAndSorted.length) {
    return arrayMap(snd)(sortWith(ordInt)(fst)((() => {
      const result = [indexedAndSorted[0]];
      for (const v1 of indexedAndSorted) {
        const $0 = comp((() => {
          const $02 = result.length - 1 | 0;
          if ($02 >= 0 && $02 < result.length) {
            return result[$02]._2;
          }
          fail();
        })())(v1._2);
        if ($0 === "LT" || $0 === "GT" || $0 !== "EQ") {
          result.push(v1);
        }
      }
      return result;
    })()));
  }
  return [];
};
var groupBy = (op) => (xs) => {
  const result = [];
  const iter = iterator((v) => {
    if (v >= 0 && v < xs.length) {
      return $Maybe("Just", xs[v]);
    }
    return Nothing;
  })();
  iterate(iter)((x) => () => {
    const sub1 = [];
    sub1.push(x);
    pushWhile(op(x))(iter)(sub1)();
    result.push(sub1);
  })();
  return result;
};
var groupAllBy = (cmp) => {
  const $0 = groupBy((x) => (y) => cmp(x)(y) === "EQ");
  return (x) => $0(sortBy(cmp)(x));
};
var find = (f) => (xs) => {
  const $0 = findIndexImpl(Just, Nothing, f, xs);
  if ($0.tag === "Just") {
    return $Maybe("Just", xs[$0._1]);
  }
  return Nothing;
};
var elem = (dictEq) => (a) => (arr) => {
  const $0 = findIndexImpl(Just, Nothing, (v) => dictEq.eq(v)(a), arr);
  if ($0.tag === "Nothing") {
    return false;
  }
  if ($0.tag === "Just") {
    return true;
  }
  fail();
};
var concatMap = (b) => (a) => arrayBind(a)(b);
var mapMaybe = (f) => concatMap((x) => {
  const $0 = f(x);
  if ($0.tag === "Nothing") {
    return [];
  }
  if ($0.tag === "Just") {
    return [$0._1];
  }
  fail();
});
var filterA = (dictApplicative) => {
  const traverse12 = traversableArray.traverse(dictApplicative);
  const $0 = dictApplicative.Apply0().Functor0();
  return (p) => {
    const $1 = traverse12((x) => $0.map(Tuple(x))(p(x)));
    const $2 = $0.map(mapMaybe((v) => {
      if (v._2) {
        return $Maybe("Just", v._1);
      }
      return Nothing;
    }));
    return (x) => $2($1(x));
  };
};
var any = ($0) => ($1) => anyImpl($0, $1);

// output-es/Data.List.Types/index.js
var $List = (tag, _1, _2) => ({ tag, _1, _2 });
var Nil = /* @__PURE__ */ $List("Nil");
var Cons = (value0) => (value1) => $List("Cons", value0, value1);
var foldableList = {
  foldr: (f) => (b) => {
    const $0 = foldableList.foldl((b$1) => (a) => f(a)(b$1))(b);
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const v = go$a0, v1 = go$a1;
        if (v1.tag === "Nil") {
          go$c = false;
          go$r = v;
          continue;
        }
        if (v1.tag === "Cons") {
          go$a0 = $List("Cons", v1._1, v);
          go$a1 = v1._2;
          continue;
        }
        fail();
      }
      return go$r;
    };
    const $1 = go(Nil);
    return (x) => $0($1(x));
  },
  foldl: (f) => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const b = go$a0, v = go$a1;
        if (v.tag === "Nil") {
          go$c = false;
          go$r = b;
          continue;
        }
        if (v.tag === "Cons") {
          go$a0 = f(b)(v._1);
          go$a1 = v._2;
          continue;
        }
        fail();
      }
      return go$r;
    };
    return go;
  },
  foldMap: (dictMonoid) => {
    const mempty = dictMonoid.mempty;
    return (f) => foldableList.foldl((acc) => {
      const $0 = dictMonoid.Semigroup0().append(acc);
      return (x) => $0(f(x));
    })(mempty);
  }
};

// output-es/Data.Unfoldable1/foreign.js
var unfoldr1ArrayImpl = function(isNothing2) {
  return function(fromJust3) {
    return function(fst2) {
      return function(snd2) {
        return function(f) {
          return function(b) {
            var result = [];
            var value = b;
            while (true) {
              var tuple = f(value);
              result.push(fst2(tuple));
              var maybe = snd2(tuple);
              if (isNothing2(maybe)) return result;
              value = fromJust3(maybe);
            }
          };
        };
      };
    };
  };
};

// output-es/Data.Unfoldable1/index.js
var fromJust = (v) => {
  if (v.tag === "Just") {
    return v._1;
  }
  fail();
};
var unfoldable1Array = { unfoldr1: /* @__PURE__ */ unfoldr1ArrayImpl(isNothing)(fromJust)(fst)(snd) };

// output-es/Data.Unfoldable/foreign.js
var unfoldrArrayImpl = function(isNothing2) {
  return function(fromJust3) {
    return function(fst2) {
      return function(snd2) {
        return function(f) {
          return function(b) {
            var result = [];
            var value = b;
            while (true) {
              var maybe = f(value);
              if (isNothing2(maybe)) return result;
              var tuple = fromJust3(maybe);
              result.push(fst2(tuple));
              value = snd2(tuple);
            }
          };
        };
      };
    };
  };
};

// output-es/Data.Unfoldable/index.js
var fromJust2 = (v) => {
  if (v.tag === "Just") {
    return v._1;
  }
  fail();
};
var unfoldableArray = {
  unfoldr: /* @__PURE__ */ unfoldrArrayImpl(isNothing)(fromJust2)(fst)(snd),
  Unfoldable10: () => unfoldable1Array
};

// output-es/Data.Map.Internal/index.js
var $$$Map = (tag, _1, _2, _3, _4, _5, _6) => ({ tag, _1, _2, _3, _4, _5, _6 });
var $MapIter = (tag, _1, _2, _3) => ({ tag, _1, _2, _3 });
var $Split = (_1, _2, _3) => ({ tag: "Split", _1, _2, _3 });
var $SplitLast = (_1, _2, _3) => ({ tag: "SplitLast", _1, _2, _3 });
var Leaf = /* @__PURE__ */ $$$Map("Leaf");
var IterLeaf = /* @__PURE__ */ $MapIter("IterLeaf");
var unsafeNode = (k, v, l, r) => {
  if (l.tag === "Leaf") {
    if (r.tag === "Leaf") {
      return $$$Map("Node", 1, 1, k, v, l, r);
    }
    if (r.tag === "Node") {
      return $$$Map("Node", 1 + r._1 | 0, 1 + r._2 | 0, k, v, l, r);
    }
    fail();
  }
  if (l.tag === "Node") {
    if (r.tag === "Leaf") {
      return $$$Map("Node", 1 + l._1 | 0, 1 + l._2 | 0, k, v, l, r);
    }
    if (r.tag === "Node") {
      return $$$Map("Node", l._1 > r._1 ? 1 + l._1 | 0 : 1 + r._1 | 0, (1 + l._2 | 0) + r._2 | 0, k, v, l, r);
    }
  }
  fail();
};
var unsafeBalancedNode = (k, v, l, r) => {
  if (l.tag === "Leaf") {
    if (r.tag === "Leaf") {
      return $$$Map("Node", 1, 1, k, v, Leaf, Leaf);
    }
    if (r.tag === "Node" && r._1 > 1) {
      if (r._5.tag === "Node" && (() => {
        if (r._6.tag === "Leaf") {
          return r._5._1 > 0;
        }
        if (r._6.tag === "Node") {
          return r._5._1 > r._6._1;
        }
        fail();
      })()) {
        return unsafeNode(r._5._3, r._5._4, unsafeNode(k, v, l, r._5._5), unsafeNode(r._3, r._4, r._5._6, r._6));
      }
      return unsafeNode(r._3, r._4, unsafeNode(k, v, l, r._5), r._6);
    }
    return unsafeNode(k, v, l, r);
  }
  if (l.tag === "Node") {
    if (r.tag === "Node") {
      if (r._1 > (l._1 + 1 | 0)) {
        if (r._5.tag === "Node" && (() => {
          if (r._6.tag === "Leaf") {
            return r._5._1 > 0;
          }
          if (r._6.tag === "Node") {
            return r._5._1 > r._6._1;
          }
          fail();
        })()) {
          return unsafeNode(r._5._3, r._5._4, unsafeNode(k, v, l, r._5._5), unsafeNode(r._3, r._4, r._5._6, r._6));
        }
        return unsafeNode(r._3, r._4, unsafeNode(k, v, l, r._5), r._6);
      }
      if (l._1 > (r._1 + 1 | 0)) {
        if (l._6.tag === "Node" && (() => {
          if (l._5.tag === "Leaf") {
            return 0 <= l._6._1;
          }
          if (l._5.tag === "Node") {
            return l._5._1 <= l._6._1;
          }
          fail();
        })()) {
          return unsafeNode(l._6._3, l._6._4, unsafeNode(l._3, l._4, l._5, l._6._5), unsafeNode(k, v, l._6._6, r));
        }
        return unsafeNode(l._3, l._4, l._5, unsafeNode(k, v, l._6, r));
      }
      return unsafeNode(k, v, l, r);
    }
    if (r.tag === "Leaf" && l._1 > 1) {
      if (l._6.tag === "Node" && (() => {
        if (l._5.tag === "Leaf") {
          return 0 <= l._6._1;
        }
        if (l._5.tag === "Node") {
          return l._5._1 <= l._6._1;
        }
        fail();
      })()) {
        return unsafeNode(l._6._3, l._6._4, unsafeNode(l._3, l._4, l._5, l._6._5), unsafeNode(k, v, l._6._6, r));
      }
      return unsafeNode(l._3, l._4, l._5, unsafeNode(k, v, l._6, r));
    }
    return unsafeNode(k, v, l, r);
  }
  fail();
};
var unsafeSplit = (comp, k, m) => {
  if (m.tag === "Leaf") {
    return $Split(Nothing, Leaf, Leaf);
  }
  if (m.tag === "Node") {
    const v = comp(k)(m._3);
    if (v === "LT") {
      const v1 = unsafeSplit(comp, k, m._5);
      return $Split(v1._1, v1._2, unsafeBalancedNode(m._3, m._4, v1._3, m._6));
    }
    if (v === "GT") {
      const v1 = unsafeSplit(comp, k, m._6);
      return $Split(v1._1, unsafeBalancedNode(m._3, m._4, m._5, v1._2), v1._3);
    }
    if (v === "EQ") {
      return $Split($Maybe("Just", m._4), m._5, m._6);
    }
  }
  fail();
};
var unsafeSplitLast = (k, v, l, r) => {
  if (r.tag === "Leaf") {
    return $SplitLast(k, v, l);
  }
  if (r.tag === "Node") {
    const v1 = unsafeSplitLast(r._3, r._4, r._5, r._6);
    return $SplitLast(v1._1, v1._2, unsafeBalancedNode(k, v, l, v1._3));
  }
  fail();
};
var unsafeJoinNodes = (v, v1) => {
  if (v.tag === "Leaf") {
    return v1;
  }
  if (v.tag === "Node") {
    const v2 = unsafeSplitLast(v._3, v._4, v._5, v._6);
    return unsafeBalancedNode(v2._1, v2._2, v2._3, v1);
  }
  fail();
};
var unsafeDifference = (comp, l, r) => {
  if (l.tag === "Leaf") {
    return Leaf;
  }
  if (r.tag === "Leaf") {
    return l;
  }
  if (r.tag === "Node") {
    const v = unsafeSplit(comp, r._3, l);
    return unsafeJoinNodes(unsafeDifference(comp, v._2, r._5), unsafeDifference(comp, v._3, r._6));
  }
  fail();
};
var unsafeIntersectionWith = (comp, app, l, r) => {
  if (l.tag === "Leaf") {
    return Leaf;
  }
  if (r.tag === "Leaf") {
    return Leaf;
  }
  if (r.tag === "Node") {
    const v = unsafeSplit(comp, r._3, l);
    const l$p = unsafeIntersectionWith(comp, app, v._2, r._5);
    const r$p = unsafeIntersectionWith(comp, app, v._3, r._6);
    if (v._1.tag === "Just") {
      return unsafeBalancedNode(r._3, app(v._1._1)(r._4), l$p, r$p);
    }
    if (v._1.tag === "Nothing") {
      return unsafeJoinNodes(l$p, r$p);
    }
  }
  fail();
};
var unsafeUnionWith = (comp, app, l, r) => {
  if (l.tag === "Leaf") {
    return r;
  }
  if (r.tag === "Leaf") {
    return l;
  }
  if (r.tag === "Node") {
    const v = unsafeSplit(comp, r._3, l);
    const l$p = unsafeUnionWith(comp, app, v._2, r._5);
    const r$p = unsafeUnionWith(comp, app, v._3, r._6);
    if (v._1.tag === "Just") {
      return unsafeBalancedNode(r._3, app(v._1._1)(r._4), l$p, r$p);
    }
    if (v._1.tag === "Nothing") {
      return unsafeBalancedNode(r._3, r._4, l$p, r$p);
    }
  }
  fail();
};
var update = (dictOrd) => (f) => (k) => {
  const go = (v) => {
    if (v.tag === "Leaf") {
      return Leaf;
    }
    if (v.tag === "Node") {
      const v1 = dictOrd.compare(k)(v._3);
      if (v1 === "LT") {
        return unsafeBalancedNode(v._3, v._4, go(v._5), v._6);
      }
      if (v1 === "GT") {
        return unsafeBalancedNode(v._3, v._4, v._5, go(v._6));
      }
      if (v1 === "EQ") {
        const v2 = f(v._4);
        if (v2.tag === "Nothing") {
          return unsafeJoinNodes(v._5, v._6);
        }
        if (v2.tag === "Just") {
          return $$$Map("Node", v._1, v._2, v._3, v2._1, v._5, v._6);
        }
      }
    }
    fail();
  };
  return go;
};
var pop = (dictOrd) => {
  const compare3 = dictOrd.compare;
  return (k) => (m) => {
    const v = unsafeSplit(compare3, k, m);
    if (v._1.tag === "Just") {
      return $Maybe("Just", $Tuple(v._1._1, unsafeJoinNodes(v._2, v._3)));
    }
    return Nothing;
  };
};
var stepAscCps = (next) => (done) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "IterLeaf") {
        go$c = false;
        go$r = done();
        continue;
      }
      if (v.tag === "IterEmit") {
        go$c = false;
        go$r = next(v._1, v._2, v._3);
        continue;
      }
      if (v.tag === "IterNode") {
        go$a0 = (() => {
          const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
            let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
            while (go$1$c) {
              const iter = go$1$a0, v$1 = go$1$a1;
              if (v$1.tag === "Leaf") {
                go$1$c = false;
                go$1$r = iter;
                continue;
              }
              if (v$1.tag === "Node") {
                if (v$1._6.tag === "Leaf") {
                  go$1$a0 = $MapIter("IterEmit", v$1._3, v$1._4, iter);
                  go$1$a1 = v$1._5;
                  continue;
                }
                go$1$a0 = $MapIter("IterEmit", v$1._3, v$1._4, $MapIter("IterNode", v$1._6, iter));
                go$1$a1 = v$1._5;
                continue;
              }
              fail();
            }
            return go$1$r;
          };
          return go$1(v._2)(v._1);
        })();
        continue;
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var stepUnfoldr = /* @__PURE__ */ stepAscCps((k, v, next) => $Maybe("Just", $Tuple($Tuple(k, v), next)))((v) => Nothing);
var insert = (dictOrd) => (k) => (v) => {
  const go = (v1) => {
    if (v1.tag === "Leaf") {
      return $$$Map("Node", 1, 1, k, v, Leaf, Leaf);
    }
    if (v1.tag === "Node") {
      const v2 = dictOrd.compare(k)(v1._3);
      if (v2 === "LT") {
        return unsafeBalancedNode(v1._3, v1._4, go(v1._5), v1._6);
      }
      if (v2 === "GT") {
        return unsafeBalancedNode(v1._3, v1._4, v1._5, go(v1._6));
      }
      if (v2 === "EQ") {
        return $$$Map("Node", v1._1, v1._2, k, v, v1._5, v1._6);
      }
    }
    fail();
  };
  return go;
};
var filterWithKey = (dictOrd) => (f) => {
  const go = (v) => {
    if (v.tag === "Leaf") {
      return Leaf;
    }
    if (v.tag === "Node") {
      if (f(v._3)(v._4)) {
        return unsafeBalancedNode(v._3, v._4, go(v._5), go(v._6));
      }
      return unsafeJoinNodes(go(v._5), go(v._6));
    }
    fail();
  };
  return go;
};
var filterKeys = (dictOrd) => (f) => {
  const go = (v) => {
    if (v.tag === "Leaf") {
      return Leaf;
    }
    if (v.tag === "Node") {
      if (f(v._3)) {
        return unsafeBalancedNode(v._3, v._4, go(v._5), go(v._6));
      }
      return unsafeJoinNodes(go(v._5), go(v._6));
    }
    fail();
  };
  return go;
};
var fromFoldable = (dictOrd) => (dictFoldable) => dictFoldable.foldl((m) => (v) => insert(dictOrd)(v._1)(v._2)(m))(Leaf);
var $$delete = (dictOrd) => (k) => {
  const go = (v) => {
    if (v.tag === "Leaf") {
      return Leaf;
    }
    if (v.tag === "Node") {
      const v1 = dictOrd.compare(k)(v._3);
      if (v1 === "LT") {
        return unsafeBalancedNode(v._3, v._4, go(v._5), v._6);
      }
      if (v1 === "GT") {
        return unsafeBalancedNode(v._3, v._4, v._5, go(v._6));
      }
      if (v1 === "EQ") {
        return unsafeJoinNodes(v._5, v._6);
      }
    }
    fail();
  };
  return go;
};
var alter = (dictOrd) => {
  const compare3 = dictOrd.compare;
  return (f) => (k) => (m) => {
    const v = unsafeSplit(compare3, k, m);
    const v2 = f(v._1);
    if (v2.tag === "Nothing") {
      return unsafeJoinNodes(v._2, v._3);
    }
    if (v2.tag === "Just") {
      return unsafeBalancedNode(k, v2._1, v._2, v._3);
    }
    fail();
  };
};

// output-es/Data.Semiring/foreign.js
var intAdd = function(x) {
  return function(y) {
    return x + y | 0;
  };
};
var intMul = function(x) {
  return function(y) {
    return x * y | 0;
  };
};

// output-es/Data.Semiring/index.js
var semiringRecordNil = { addRecord: (v) => (v1) => (v2) => ({}), mulRecord: (v) => (v1) => (v2) => ({}), oneRecord: (v) => (v1) => ({}), zeroRecord: (v) => (v1) => ({}) };
var semiringInt = { add: intAdd, zero: 0, mul: intMul, one: 1 };
var semiringRecordCons = (dictIsSymbol) => () => (dictSemiringRecord) => (dictSemiring) => {
  const one1 = dictSemiring.one;
  const zero1 = dictSemiring.zero;
  return {
    addRecord: (v) => (ra) => (rb) => {
      const key = dictIsSymbol.reflectSymbol($$Proxy);
      const $$get = unsafeGet(key);
      return unsafeSet(key)(dictSemiring.add($$get(ra))($$get(rb)))(dictSemiringRecord.addRecord($$Proxy)(ra)(rb));
    },
    mulRecord: (v) => (ra) => (rb) => {
      const key = dictIsSymbol.reflectSymbol($$Proxy);
      const $$get = unsafeGet(key);
      return unsafeSet(key)(dictSemiring.mul($$get(ra))($$get(rb)))(dictSemiringRecord.mulRecord($$Proxy)(ra)(rb));
    },
    oneRecord: (v) => (v1) => unsafeSet(dictIsSymbol.reflectSymbol($$Proxy))(one1)(dictSemiringRecord.oneRecord($$Proxy)($$Proxy)),
    zeroRecord: (v) => (v1) => unsafeSet(dictIsSymbol.reflectSymbol($$Proxy))(zero1)(dictSemiringRecord.zeroRecord($$Proxy)($$Proxy))
  };
};

// output-es/Data.EuclideanRing/foreign.js
var intMod = function(x) {
  return function(y) {
    if (y === 0) return 0;
    var yy = Math.abs(y);
    return (x % yy + yy) % yy;
  };
};

// output-es/Data.Semigroup/foreign.js
var concatString = function(s1) {
  return function(s2) {
    return s1 + s2;
  };
};
var concatArray = function(xs) {
  return function(ys) {
    if (xs.length === 0) return ys;
    if (ys.length === 0) return xs;
    return xs.concat(ys);
  };
};

// output-es/Data.Semigroup/index.js
var semigroupString = { append: concatString };
var semigroupArray = { append: concatArray };

// output-es/Data.Monoid/index.js
var monoidString = { mempty: "", Semigroup0: () => semigroupString };
var monoidArray = { mempty: [], Semigroup0: () => semigroupArray };
var power = (dictMonoid) => {
  const mempty1 = dictMonoid.mempty;
  const $0 = dictMonoid.Semigroup0();
  return (x) => {
    const go = (p) => {
      if (p <= 0) {
        return mempty1;
      }
      if (p === 1) {
        return x;
      }
      if (intMod(p)(2) === 0) {
        const x$p2 = go(intDiv(p, 2));
        return $0.append(x$p2)(x$p2);
      }
      const x$p = go(intDiv(p, 2));
      return $0.append(x$p)($0.append(x$p)(x));
    };
    return go;
  };
};

// output-es/Data.Bounded/foreign.js
var topChar = String.fromCharCode(65535);
var bottomChar = String.fromCharCode(0);
var topNumber = Number.POSITIVE_INFINITY;
var bottomNumber = Number.NEGATIVE_INFINITY;

// output-es/Data.Enum/foreign.js
function toCharCode(c) {
  return c.charCodeAt(0);
}
function fromCharCode(c) {
  return String.fromCharCode(c);
}

// output-es/Data.Enum/index.js
var charToEnum = (v) => {
  if (v >= 0 && v <= 65535) {
    return $Maybe("Just", fromCharCode(v));
  }
  return Nothing;
};

// output-es/Data.Number/foreign.js
var isFiniteImpl = isFinite;
function fromStringImpl(str, isFinite2, just, nothing) {
  var num = parseFloat(str);
  if (isFinite2(num)) {
    return just(num);
  } else {
    return nothing;
  }
}

// output-es/Data.Int/foreign.js
var fromNumberImpl = function(just) {
  return function(nothing) {
    return function(n) {
      return (n | 0) === n ? just(n) : nothing;
    };
  };
};
var fromStringAsImpl = function(just) {
  return function(nothing) {
    return function(radix) {
      var digits;
      if (radix < 11) {
        digits = "[0-" + (radix - 1).toString() + "]";
      } else if (radix === 11) {
        digits = "[0-9a]";
      } else {
        digits = "[0-9a-" + String.fromCharCode(86 + radix) + "]";
      }
      var pattern = new RegExp("^[\\+\\-]?" + digits + "+$", "i");
      return function(s) {
        if (pattern.test(s)) {
          var i = parseInt(s, radix);
          return (i | 0) === i ? just(i) : nothing;
        } else {
          return nothing;
        }
      };
    };
  };
};

// output-es/Data.Int/index.js
var fromStringAs = /* @__PURE__ */ fromStringAsImpl(Just)(Nothing);
var fromString = /* @__PURE__ */ fromStringAs(10);
var fromNumber = /* @__PURE__ */ fromNumberImpl(Just)(Nothing);

// output-es/Data.String.Unsafe/foreign.js
var charAt = function(i) {
  return function(s) {
    if (i >= 0 && i < s.length) return s.charAt(i);
    throw new Error("Data.String.Unsafe.charAt: Invalid index.");
  };
};

// output-es/Data.String.CodeUnits/foreign.js
var toCharArray = function(s) {
  return s.split("");
};
var singleton = function(c) {
  return c;
};
var _charAt = function(just) {
  return function(nothing) {
    return function(i) {
      return function(s) {
        return i >= 0 && i < s.length ? just(s.charAt(i)) : nothing;
      };
    };
  };
};
var length2 = function(s) {
  return s.length;
};
var _indexOf = function(just) {
  return function(nothing) {
    return function(x) {
      return function(s) {
        var i = s.indexOf(x);
        return i === -1 ? nothing : just(i);
      };
    };
  };
};
var _indexOfStartingAt = function(just) {
  return function(nothing) {
    return function(x) {
      return function(startAt) {
        return function(s) {
          if (startAt < 0 || startAt > s.length) return nothing;
          var i = s.indexOf(x, startAt);
          return i === -1 ? nothing : just(i);
        };
      };
    };
  };
};
var take = function(n) {
  return function(s) {
    return s.substr(0, n);
  };
};
var drop = function(n) {
  return function(s) {
    return s.substring(n);
  };
};
var splitAt = function(i) {
  return function(s) {
    return { before: s.substring(0, i), after: s.substring(i) };
  };
};

// output-es/Data.String.CodeUnits/index.js
var stripPrefix = (v) => (str) => {
  const v1 = splitAt(length2(v))(str);
  if (v1.before === v) {
    return $Maybe("Just", v1.after);
  }
  return Nothing;
};
var indexOf$p = /* @__PURE__ */ _indexOfStartingAt(Just)(Nothing);
var indexOf = /* @__PURE__ */ _indexOf(Just)(Nothing);
var contains = (pat) => {
  const $0 = indexOf(pat);
  return (x) => {
    const $1 = $0(x);
    if ($1.tag === "Nothing") {
      return false;
    }
    if ($1.tag === "Just") {
      return true;
    }
    fail();
  };
};
var charAt2 = /* @__PURE__ */ _charAt(Just)(Nothing);

// output-es/Data.String.Common/foreign.js
var replace = function(s1) {
  return function(s2) {
    return function(s3) {
      return s3.replace(s1, s2);
    };
  };
};
var replaceAll = function(s1) {
  return function(s2) {
    return function(s3) {
      return s3.replace(new RegExp(s1.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g"), s2);
    };
  };
};
var split = function(sep) {
  return function(s) {
    return s.split(sep);
  };
};
var trim = function(s) {
  return s.trim();
};
var joinWith = function(s) {
  return function(xs) {
    return xs.join(s);
  };
};

// output-es/Data.String.CodePoints/foreign.js
var hasArrayFrom = typeof Array.from === "function";
var hasStringIterator = typeof Symbol !== "undefined" && Symbol != null && typeof Symbol.iterator !== "undefined" && typeof String.prototype[Symbol.iterator] === "function";
var hasFromCodePoint = typeof String.prototype.fromCodePoint === "function";
var hasCodePointAt = typeof String.prototype.codePointAt === "function";
var _unsafeCodePointAt0 = function(fallback) {
  return hasCodePointAt ? function(str) {
    return str.codePointAt(0);
  } : fallback;
};
var _fromCodePointArray = function(singleton3) {
  return hasFromCodePoint ? function(cps) {
    if (cps.length < 1e4) {
      return String.fromCodePoint.apply(String, cps);
    }
    return cps.map(singleton3).join("");
  } : function(cps) {
    return cps.map(singleton3).join("");
  };
};
var _singleton = function(fallback) {
  return hasFromCodePoint ? String.fromCodePoint : fallback;
};
var _take = function(fallback) {
  return function(n) {
    if (hasStringIterator) {
      return function(str) {
        var accum = "";
        var iter = str[Symbol.iterator]();
        for (var i = 0; i < n; ++i) {
          var o = iter.next();
          if (o.done) return accum;
          accum += o.value;
        }
        return accum;
      };
    }
    return fallback(n);
  };
};
var _toCodePointArray = function(fallback) {
  return function(unsafeCodePointAt02) {
    if (hasArrayFrom) {
      return function(str) {
        return Array.from(str, unsafeCodePointAt02);
      };
    }
    return fallback;
  };
};

// output-es/Data.String.CodePoints/index.js
var uncons = (s) => {
  const v = length2(s);
  if (v === 0) {
    return Nothing;
  }
  if (v === 1) {
    return $Maybe("Just", { head: toCharCode(charAt(0)(s)), tail: "" });
  }
  const cu1 = toCharCode(charAt(1)(s));
  const cu0 = toCharCode(charAt(0)(s));
  if (55296 <= cu0 && cu0 <= 56319 && 56320 <= cu1 && cu1 <= 57343) {
    return $Maybe("Just", { head: (((cu0 - 55296 | 0) * 1024 | 0) + (cu1 - 56320 | 0) | 0) + 65536 | 0, tail: drop(2)(s) });
  }
  return $Maybe("Just", { head: cu0, tail: drop(1)(s) });
};
var unconsButWithTuple = (s) => {
  const $0 = uncons(s);
  if ($0.tag === "Just") {
    return $Maybe("Just", $Tuple($0._1.head, $0._1.tail));
  }
  return Nothing;
};
var toCodePointArrayFallback = (s) => unfoldableArray.unfoldr(unconsButWithTuple)(s);
var unsafeCodePointAt0Fallback = (s) => {
  const cu0 = toCharCode(charAt(0)(s));
  if (55296 <= cu0 && cu0 <= 56319 && length2(s) > 1) {
    const cu1 = toCharCode(charAt(1)(s));
    if (56320 <= cu1 && cu1 <= 57343) {
      return (((cu0 - 55296 | 0) * 1024 | 0) + (cu1 - 56320 | 0) | 0) + 65536 | 0;
    }
  }
  return cu0;
};
var unsafeCodePointAt0 = /* @__PURE__ */ _unsafeCodePointAt0(unsafeCodePointAt0Fallback);
var toCodePointArray = /* @__PURE__ */ _toCodePointArray(toCodePointArrayFallback)(unsafeCodePointAt0);
var indexOf2 = (p) => (s) => {
  const $0 = indexOf(p)(s);
  if ($0.tag === "Just") {
    return $Maybe("Just", toCodePointArray(take($0._1)(s)).length);
  }
  return Nothing;
};
var fromCharCode2 = (x) => singleton((() => {
  if (x >= 0 && x <= 65535) {
    return fromCharCode(x);
  }
  if (x < 0) {
    return "\0";
  }
  return "\uFFFF";
})());
var singletonFallback = (v) => {
  if (v <= 65535) {
    return fromCharCode2(v);
  }
  return fromCharCode2(intDiv(v - 65536 | 0, 1024) + 55296 | 0) + fromCharCode2(intMod(v - 65536 | 0)(1024) + 56320 | 0);
};
var fromCodePointArray = /* @__PURE__ */ _fromCodePointArray(singletonFallback);
var singleton2 = /* @__PURE__ */ _singleton(singletonFallback);
var takeFallback = (v) => (v1) => {
  if (v < 1) {
    return "";
  }
  const v2 = uncons(v1);
  if (v2.tag === "Just") {
    return singleton2(v2._1.head) + takeFallback(v - 1 | 0)(v2._1.tail);
  }
  return v1;
};
var take2 = /* @__PURE__ */ _take(takeFallback);
var eqCodePoint = { eq: (x) => (y) => x === y };
var ordCodePoint = { compare: (x) => (y) => ordInt.compare(x)(y), Eq0: () => eqCodePoint };
var codePointFromChar = (x) => toCharCode(x);
var boundedCodePoint = { bottom: 0, top: 1114111, Ord0: () => ordCodePoint };
var boundedEnumCodePoint = {
  cardinality: 1114112,
  fromEnum: (v) => v,
  toEnum: (n) => {
    if (n >= 0 && n <= 1114111) {
      return $Maybe("Just", n);
    }
    return Nothing;
  },
  Bounded0: () => boundedCodePoint,
  Enum1: () => enumCodePoint
};
var enumCodePoint = {
  succ: (a) => {
    const $0 = a + 1 | 0;
    if ($0 >= 0 && $0 <= 1114111) {
      return $Maybe("Just", $0);
    }
    return Nothing;
  },
  pred: (a) => {
    const $0 = a - 1 | 0;
    if ($0 >= 0 && $0 <= 1114111) {
      return $Maybe("Just", $0);
    }
    return Nothing;
  },
  Ord0: () => ordCodePoint
};

// output-es/Effect.Exception/foreign.js
function showErrorImpl(err) {
  return err.stack || err.toString();
}

// output-es/Control.Monad.Error.Class/index.js
var $$try = (dictMonadError) => {
  const Monad0 = dictMonadError.MonadThrow0().Monad0();
  return (a) => dictMonadError.catchError(Monad0.Bind1().Apply0().Functor0().map(Right)(a))((x) => Monad0.Applicative0().pure($Either("Left", x)));
};

// output-es/Partial/foreign.js
var _crashWith = function(msg) {
  throw new Error(msg);
};

// output-es/Effect.Aff/foreign.js
var Aff = (function() {
  var EMPTY = {};
  var PURE = "Pure";
  var THROW = "Throw";
  var CATCH = "Catch";
  var SYNC = "Sync";
  var ASYNC = "Async";
  var BIND = "Bind";
  var BRACKET = "Bracket";
  var FORK = "Fork";
  var SEQ = "Sequential";
  var MAP = "Map";
  var APPLY = "Apply";
  var ALT = "Alt";
  var CONS = "Cons";
  var RESUME = "Resume";
  var RELEASE = "Release";
  var FINALIZER = "Finalizer";
  var FINALIZED = "Finalized";
  var FORKED = "Forked";
  var FIBER = "Fiber";
  var THUNK = "Thunk";
  function Aff2(tag, _1, _2, _3) {
    this.tag = tag;
    this._1 = _1;
    this._2 = _2;
    this._3 = _3;
  }
  function AffCtr(tag) {
    var fn = function(_1, _2, _3) {
      return new Aff2(tag, _1, _2, _3);
    };
    fn.tag = tag;
    return fn;
  }
  function nonCanceler2(error3) {
    return new Aff2(PURE, void 0);
  }
  function runEff(eff) {
    try {
      eff();
    } catch (error3) {
      setTimeout(function() {
        throw error3;
      }, 0);
    }
  }
  function runSync(left, right, eff) {
    try {
      return right(eff());
    } catch (error3) {
      return left(error3);
    }
  }
  function runAsync(left, eff, k) {
    try {
      return eff(k)();
    } catch (error3) {
      k(left(error3))();
      return nonCanceler2;
    }
  }
  var Scheduler = (function() {
    var limit = 1024;
    var size4 = 0;
    var ix = 0;
    var queue = new Array(limit);
    var draining = false;
    function drain() {
      var thunk;
      draining = true;
      while (size4 !== 0) {
        size4--;
        thunk = queue[ix];
        queue[ix] = void 0;
        ix = (ix + 1) % limit;
        thunk();
      }
      draining = false;
    }
    return {
      isDraining: function() {
        return draining;
      },
      enqueue: function(cb) {
        var i, tmp;
        if (size4 === limit) {
          tmp = draining;
          drain();
          draining = tmp;
        }
        queue[(ix + size4) % limit] = cb;
        size4++;
        if (!draining) {
          drain();
        }
      }
    };
  })();
  function Supervisor(util2) {
    var fibers = {};
    var fiberId = 0;
    var count = 0;
    return {
      register: function(fiber) {
        var fid = fiberId++;
        fiber.onComplete({
          rethrow: true,
          handler: function(result) {
            return function() {
              count--;
              delete fibers[fid];
            };
          }
        })();
        fibers[fid] = fiber;
        count++;
      },
      isEmpty: function() {
        return count === 0;
      },
      killAll: function(killError, cb) {
        return function() {
          if (count === 0) {
            return cb();
          }
          var killCount = 0;
          var kills = {};
          function kill(fid) {
            kills[fid] = fibers[fid].kill(killError, function(result) {
              return function() {
                delete kills[fid];
                killCount--;
                if (util2.isLeft(result) && util2.fromLeft(result)) {
                  setTimeout(function() {
                    throw util2.fromLeft(result);
                  }, 0);
                }
                if (killCount === 0) {
                  cb();
                }
              };
            })();
          }
          for (var k in fibers) {
            if (fibers.hasOwnProperty(k)) {
              killCount++;
              kill(k);
            }
          }
          fibers = {};
          fiberId = 0;
          count = 0;
          return function(error3) {
            return new Aff2(SYNC, function() {
              for (var k2 in kills) {
                if (kills.hasOwnProperty(k2)) {
                  kills[k2]();
                }
              }
            });
          };
        };
      }
    };
  }
  var SUSPENDED = 0;
  var CONTINUE = 1;
  var STEP_BIND = 2;
  var STEP_RESULT = 3;
  var PENDING = 4;
  var RETURN = 5;
  var COMPLETED = 6;
  function Fiber(util2, supervisor, aff) {
    var runTick = 0;
    var status = SUSPENDED;
    var step = aff;
    var fail2 = null;
    var interrupt = null;
    var bhead = null;
    var btail = null;
    var attempts = null;
    var bracketCount = 0;
    var joinId = 0;
    var joins = null;
    var rethrow = true;
    function run2(localRunTick) {
      var tmp, result, attempt;
      while (true) {
        tmp = null;
        result = null;
        attempt = null;
        switch (status) {
          case STEP_BIND:
            status = CONTINUE;
            try {
              step = bhead(step);
              if (btail === null) {
                bhead = null;
              } else {
                bhead = btail._1;
                btail = btail._2;
              }
            } catch (e) {
              status = RETURN;
              fail2 = util2.left(e);
              step = null;
            }
            break;
          case STEP_RESULT:
            if (util2.isLeft(step)) {
              status = RETURN;
              fail2 = step;
              step = null;
            } else if (bhead === null) {
              status = RETURN;
            } else {
              status = STEP_BIND;
              step = util2.fromRight(step);
            }
            break;
          case CONTINUE:
            switch (step.tag) {
              case BIND:
                if (bhead) {
                  btail = new Aff2(CONS, bhead, btail);
                }
                bhead = step._2;
                status = CONTINUE;
                step = step._1;
                break;
              case PURE:
                if (bhead === null) {
                  status = RETURN;
                  step = util2.right(step._1);
                } else {
                  status = STEP_BIND;
                  step = step._1;
                }
                break;
              case SYNC:
                status = STEP_RESULT;
                step = runSync(util2.left, util2.right, step._1);
                break;
              case ASYNC:
                status = PENDING;
                step = runAsync(util2.left, step._1, function(result2) {
                  return function() {
                    if (runTick !== localRunTick) {
                      return;
                    }
                    runTick++;
                    Scheduler.enqueue(function() {
                      if (runTick !== localRunTick + 1) {
                        return;
                      }
                      status = STEP_RESULT;
                      step = result2;
                      run2(runTick);
                    });
                  };
                });
                return;
              case THROW:
                status = RETURN;
                fail2 = util2.left(step._1);
                step = null;
                break;
              // Enqueue the Catch so that we can call the error handler later on
              // in case of an exception.
              case CATCH:
                if (bhead === null) {
                  attempts = new Aff2(CONS, step, attempts, interrupt);
                } else {
                  attempts = new Aff2(CONS, step, new Aff2(CONS, new Aff2(RESUME, bhead, btail), attempts, interrupt), interrupt);
                }
                bhead = null;
                btail = null;
                status = CONTINUE;
                step = step._1;
                break;
              // Enqueue the Bracket so that we can call the appropriate handlers
              // after resource acquisition.
              case BRACKET:
                bracketCount++;
                if (bhead === null) {
                  attempts = new Aff2(CONS, step, attempts, interrupt);
                } else {
                  attempts = new Aff2(CONS, step, new Aff2(CONS, new Aff2(RESUME, bhead, btail), attempts, interrupt), interrupt);
                }
                bhead = null;
                btail = null;
                status = CONTINUE;
                step = step._1;
                break;
              case FORK:
                status = STEP_RESULT;
                tmp = Fiber(util2, supervisor, step._2);
                if (supervisor) {
                  supervisor.register(tmp);
                }
                if (step._1) {
                  tmp.run();
                }
                step = util2.right(tmp);
                break;
              case SEQ:
                status = CONTINUE;
                step = sequential(util2, supervisor, step._1);
                break;
            }
            break;
          case RETURN:
            bhead = null;
            btail = null;
            if (attempts === null) {
              status = COMPLETED;
              step = interrupt || fail2 || step;
            } else {
              tmp = attempts._3;
              attempt = attempts._1;
              attempts = attempts._2;
              switch (attempt.tag) {
                // We cannot recover from an unmasked interrupt. Otherwise we should
                // continue stepping, or run the exception handler if an exception
                // was raised.
                case CATCH:
                  if (interrupt && interrupt !== tmp && bracketCount === 0) {
                    status = RETURN;
                  } else if (fail2) {
                    status = CONTINUE;
                    step = attempt._2(util2.fromLeft(fail2));
                    fail2 = null;
                  }
                  break;
                // We cannot resume from an unmasked interrupt or exception.
                case RESUME:
                  if (interrupt && interrupt !== tmp && bracketCount === 0 || fail2) {
                    status = RETURN;
                  } else {
                    bhead = attempt._1;
                    btail = attempt._2;
                    status = STEP_BIND;
                    step = util2.fromRight(step);
                  }
                  break;
                // If we have a bracket, we should enqueue the handlers,
                // and continue with the success branch only if the fiber has
                // not been interrupted. If the bracket acquisition failed, we
                // should not run either.
                case BRACKET:
                  bracketCount--;
                  if (fail2 === null) {
                    result = util2.fromRight(step);
                    attempts = new Aff2(CONS, new Aff2(RELEASE, attempt._2, result), attempts, tmp);
                    if (interrupt === tmp || bracketCount > 0) {
                      status = CONTINUE;
                      step = attempt._3(result);
                    }
                  }
                  break;
                // Enqueue the appropriate handler. We increase the bracket count
                // because it should not be cancelled.
                case RELEASE:
                  attempts = new Aff2(CONS, new Aff2(FINALIZED, step, fail2), attempts, interrupt);
                  status = CONTINUE;
                  if (interrupt && interrupt !== tmp && bracketCount === 0) {
                    step = attempt._1.killed(util2.fromLeft(interrupt))(attempt._2);
                  } else if (fail2) {
                    step = attempt._1.failed(util2.fromLeft(fail2))(attempt._2);
                  } else {
                    step = attempt._1.completed(util2.fromRight(step))(attempt._2);
                  }
                  fail2 = null;
                  bracketCount++;
                  break;
                case FINALIZER:
                  bracketCount++;
                  attempts = new Aff2(CONS, new Aff2(FINALIZED, step, fail2), attempts, interrupt);
                  status = CONTINUE;
                  step = attempt._1;
                  break;
                case FINALIZED:
                  bracketCount--;
                  status = RETURN;
                  step = attempt._1;
                  fail2 = attempt._2;
                  break;
              }
            }
            break;
          case COMPLETED:
            for (var k in joins) {
              if (joins.hasOwnProperty(k)) {
                rethrow = rethrow && joins[k].rethrow;
                runEff(joins[k].handler(step));
              }
            }
            joins = null;
            if (interrupt && fail2) {
              setTimeout(function() {
                throw util2.fromLeft(fail2);
              }, 0);
            } else if (util2.isLeft(step) && rethrow) {
              setTimeout(function() {
                if (rethrow) {
                  throw util2.fromLeft(step);
                }
              }, 0);
            }
            return;
          case SUSPENDED:
            status = CONTINUE;
            break;
          case PENDING:
            return;
        }
      }
    }
    function onComplete(join2) {
      return function() {
        if (status === COMPLETED) {
          rethrow = rethrow && join2.rethrow;
          join2.handler(step)();
          return function() {
          };
        }
        var jid = joinId++;
        joins = joins || {};
        joins[jid] = join2;
        return function() {
          if (joins !== null) {
            delete joins[jid];
          }
        };
      };
    }
    function kill(error3, cb) {
      return function() {
        if (status === COMPLETED) {
          cb(util2.right(void 0))();
          return function() {
          };
        }
        var canceler = onComplete({
          rethrow: false,
          handler: function() {
            return cb(util2.right(void 0));
          }
        })();
        switch (status) {
          case SUSPENDED:
            interrupt = util2.left(error3);
            status = COMPLETED;
            step = interrupt;
            run2(runTick);
            break;
          case PENDING:
            if (interrupt === null) {
              interrupt = util2.left(error3);
            }
            if (bracketCount === 0) {
              if (status === PENDING) {
                attempts = new Aff2(CONS, new Aff2(FINALIZER, step(error3)), attempts, interrupt);
              }
              status = RETURN;
              step = null;
              fail2 = null;
              run2(++runTick);
            }
            break;
          default:
            if (interrupt === null) {
              interrupt = util2.left(error3);
            }
            if (bracketCount === 0) {
              status = RETURN;
              step = null;
              fail2 = null;
            }
        }
        return canceler;
      };
    }
    function join(cb) {
      return function() {
        var canceler = onComplete({
          rethrow: false,
          handler: cb
        })();
        if (status === SUSPENDED) {
          run2(runTick);
        }
        return canceler;
      };
    }
    return {
      kill,
      join,
      onComplete,
      isSuspended: function() {
        return status === SUSPENDED;
      },
      run: function() {
        if (status === SUSPENDED) {
          if (!Scheduler.isDraining()) {
            Scheduler.enqueue(function() {
              run2(runTick);
            });
          } else {
            run2(runTick);
          }
        }
      }
    };
  }
  function runPar(util2, supervisor, par, cb) {
    var fiberId = 0;
    var fibers = {};
    var killId = 0;
    var kills = {};
    var early = new Error("[ParAff] Early exit");
    var interrupt = null;
    var root = EMPTY;
    function kill(error3, par2, cb2) {
      var step = par2;
      var head2 = null;
      var tail = null;
      var count = 0;
      var kills2 = {};
      var tmp, kid;
      loop: while (true) {
        tmp = null;
        switch (step.tag) {
          case FORKED:
            if (step._3 === EMPTY) {
              tmp = fibers[step._1];
              kills2[count++] = tmp.kill(error3, function(result) {
                return function() {
                  count--;
                  if (count === 0) {
                    cb2(result)();
                  }
                };
              });
            }
            if (head2 === null) {
              break loop;
            }
            step = head2._2;
            if (tail === null) {
              head2 = null;
            } else {
              head2 = tail._1;
              tail = tail._2;
            }
            break;
          case MAP:
            step = step._2;
            break;
          case APPLY:
          case ALT:
            if (head2) {
              tail = new Aff2(CONS, head2, tail);
            }
            head2 = step;
            step = step._1;
            break;
        }
      }
      if (count === 0) {
        cb2(util2.right(void 0))();
      } else {
        kid = 0;
        tmp = count;
        for (; kid < tmp; kid++) {
          kills2[kid] = kills2[kid]();
        }
      }
      return kills2;
    }
    function join(result, head2, tail) {
      var fail2, step, lhs, rhs, tmp, kid;
      if (util2.isLeft(result)) {
        fail2 = result;
        step = null;
      } else {
        step = result;
        fail2 = null;
      }
      loop: while (true) {
        lhs = null;
        rhs = null;
        tmp = null;
        kid = null;
        if (interrupt !== null) {
          return;
        }
        if (head2 === null) {
          cb(fail2 || step)();
          return;
        }
        if (head2._3 !== EMPTY) {
          return;
        }
        switch (head2.tag) {
          case MAP:
            if (fail2 === null) {
              head2._3 = util2.right(head2._1(util2.fromRight(step)));
              step = head2._3;
            } else {
              head2._3 = fail2;
            }
            break;
          case APPLY:
            lhs = head2._1._3;
            rhs = head2._2._3;
            if (fail2) {
              head2._3 = fail2;
              tmp = true;
              kid = killId++;
              kills[kid] = kill(early, fail2 === lhs ? head2._2 : head2._1, function() {
                return function() {
                  delete kills[kid];
                  if (tmp) {
                    tmp = false;
                  } else if (tail === null) {
                    join(fail2, null, null);
                  } else {
                    join(fail2, tail._1, tail._2);
                  }
                };
              });
              if (tmp) {
                tmp = false;
                return;
              }
            } else if (lhs === EMPTY || rhs === EMPTY) {
              return;
            } else {
              step = util2.right(util2.fromRight(lhs)(util2.fromRight(rhs)));
              head2._3 = step;
            }
            break;
          case ALT:
            lhs = head2._1._3;
            rhs = head2._2._3;
            if (lhs === EMPTY && util2.isLeft(rhs) || rhs === EMPTY && util2.isLeft(lhs)) {
              return;
            }
            if (lhs !== EMPTY && util2.isLeft(lhs) && rhs !== EMPTY && util2.isLeft(rhs)) {
              fail2 = step === lhs ? rhs : lhs;
              step = null;
              head2._3 = fail2;
            } else {
              head2._3 = step;
              tmp = true;
              kid = killId++;
              kills[kid] = kill(early, step === lhs ? head2._2 : head2._1, function() {
                return function() {
                  delete kills[kid];
                  if (tmp) {
                    tmp = false;
                  } else if (tail === null) {
                    join(step, null, null);
                  } else {
                    join(step, tail._1, tail._2);
                  }
                };
              });
              if (tmp) {
                tmp = false;
                return;
              }
            }
            break;
        }
        if (tail === null) {
          head2 = null;
        } else {
          head2 = tail._1;
          tail = tail._2;
        }
      }
    }
    function resolve(fiber) {
      return function(result) {
        return function() {
          delete fibers[fiber._1];
          fiber._3 = result;
          join(result, fiber._2._1, fiber._2._2);
        };
      };
    }
    function run2() {
      var status = CONTINUE;
      var step = par;
      var head2 = null;
      var tail = null;
      var tmp, fid;
      loop: while (true) {
        tmp = null;
        fid = null;
        switch (status) {
          case CONTINUE:
            switch (step.tag) {
              case MAP:
                if (head2) {
                  tail = new Aff2(CONS, head2, tail);
                }
                head2 = new Aff2(MAP, step._1, EMPTY, EMPTY);
                step = step._2;
                break;
              case APPLY:
                if (head2) {
                  tail = new Aff2(CONS, head2, tail);
                }
                head2 = new Aff2(APPLY, EMPTY, step._2, EMPTY);
                step = step._1;
                break;
              case ALT:
                if (head2) {
                  tail = new Aff2(CONS, head2, tail);
                }
                head2 = new Aff2(ALT, EMPTY, step._2, EMPTY);
                step = step._1;
                break;
              default:
                fid = fiberId++;
                status = RETURN;
                tmp = step;
                step = new Aff2(FORKED, fid, new Aff2(CONS, head2, tail), EMPTY);
                tmp = Fiber(util2, supervisor, tmp);
                tmp.onComplete({
                  rethrow: false,
                  handler: resolve(step)
                })();
                fibers[fid] = tmp;
                if (supervisor) {
                  supervisor.register(tmp);
                }
            }
            break;
          case RETURN:
            if (head2 === null) {
              break loop;
            }
            if (head2._1 === EMPTY) {
              head2._1 = step;
              status = CONTINUE;
              step = head2._2;
              head2._2 = EMPTY;
            } else {
              head2._2 = step;
              step = head2;
              if (tail === null) {
                head2 = null;
              } else {
                head2 = tail._1;
                tail = tail._2;
              }
            }
        }
      }
      root = step;
      for (fid = 0; fid < fiberId; fid++) {
        fibers[fid].run();
      }
    }
    function cancel(error3, cb2) {
      interrupt = util2.left(error3);
      var innerKills;
      for (var kid in kills) {
        if (kills.hasOwnProperty(kid)) {
          innerKills = kills[kid];
          for (kid in innerKills) {
            if (innerKills.hasOwnProperty(kid)) {
              innerKills[kid]();
            }
          }
        }
      }
      kills = null;
      var newKills = kill(error3, root, cb2);
      return function(killError) {
        return new Aff2(ASYNC, function(killCb) {
          return function() {
            for (var kid2 in newKills) {
              if (newKills.hasOwnProperty(kid2)) {
                newKills[kid2]();
              }
            }
            return nonCanceler2;
          };
        });
      };
    }
    run2();
    return function(killError) {
      return new Aff2(ASYNC, function(killCb) {
        return function() {
          return cancel(killError, killCb);
        };
      });
    };
  }
  function sequential(util2, supervisor, par) {
    return new Aff2(ASYNC, function(cb) {
      return function() {
        return runPar(util2, supervisor, par, cb);
      };
    });
  }
  Aff2.EMPTY = EMPTY;
  Aff2.Pure = AffCtr(PURE);
  Aff2.Throw = AffCtr(THROW);
  Aff2.Catch = AffCtr(CATCH);
  Aff2.Sync = AffCtr(SYNC);
  Aff2.Async = AffCtr(ASYNC);
  Aff2.Bind = AffCtr(BIND);
  Aff2.Bracket = AffCtr(BRACKET);
  Aff2.Fork = AffCtr(FORK);
  Aff2.Seq = AffCtr(SEQ);
  Aff2.ParMap = AffCtr(MAP);
  Aff2.ParApply = AffCtr(APPLY);
  Aff2.ParAlt = AffCtr(ALT);
  Aff2.Fiber = Fiber;
  Aff2.Supervisor = Supervisor;
  Aff2.Scheduler = Scheduler;
  Aff2.nonCanceler = nonCanceler2;
  return Aff2;
})();
var _pure = Aff.Pure;
var _throwError = Aff.Throw;
function _catchError(aff) {
  return function(k) {
    return Aff.Catch(aff, k);
  };
}
function _map(f) {
  return function(aff) {
    if (aff.tag === Aff.Pure.tag) {
      return Aff.Pure(f(aff._1));
    } else {
      return Aff.Bind(aff, function(value) {
        return Aff.Pure(f(value));
      });
    }
  };
}
function _bind(aff) {
  return function(k) {
    return Aff.Bind(aff, k);
  };
}
var _liftEffect = Aff.Sync;
var makeAff = Aff.Async;
function _makeFiber(util2, aff) {
  return function() {
    return Aff.Fiber(util2, null, aff);
  };
}
var _sequential = Aff.Seq;

// output-es/Effect.Aff/index.js
var functorAff = { map: _map };
var ffiUtil = {
  isLeft: (v) => {
    if (v.tag === "Left") {
      return true;
    }
    if (v.tag === "Right") {
      return false;
    }
    fail();
  },
  fromLeft: (v) => {
    if (v.tag === "Left") {
      return v._1;
    }
    if (v.tag === "Right") {
      return _crashWith("unsafeFromLeft: Right");
    }
    fail();
  },
  fromRight: (v) => {
    if (v.tag === "Right") {
      return v._1;
    }
    if (v.tag === "Left") {
      return _crashWith("unsafeFromRight: Left");
    }
    fail();
  },
  left: Left,
  right: Right
};
var monadAff = { Applicative0: () => applicativeAff, Bind1: () => bindAff };
var bindAff = { bind: _bind, Apply0: () => applyAff };
var applyAff = { apply: (f) => (a) => _bind(f)((f$p) => _bind(a)((a$p) => applicativeAff.pure(f$p(a$p)))), Functor0: () => functorAff };
var applicativeAff = { pure: _pure, Apply0: () => applyAff };
var monadThrowAff = { throwError: _throwError, Monad0: () => monadAff };
var monadErrorAff = { catchError: _catchError, MonadThrow0: () => monadThrowAff };
var $$try2 = /* @__PURE__ */ $$try(monadErrorAff);
var nonCanceler = /* @__PURE__ */ (() => {
  const $0 = _pure();
  return (v) => $0;
})();

// output-es/Effect.Console/foreign.js
var log2 = function(s) {
  return function() {
    console.log(s);
  };
};
var error2 = function(s) {
  return function() {
    console.error(s);
  };
};

// output-es/Node.Encoding/index.js
var $Encoding = (tag) => tag;
var UTF8 = /* @__PURE__ */ $Encoding("UTF8");

// output-es/Data.Nullable/foreign.js
var nullImpl = null;
function nullable(a, r, f) {
  return a == null ? r : f(a);
}
function notNull(x) {
  return x;
}

// output-es/Node.FS.Constants/foreign.js
import { constants } from "node:fs";
var f_OK = constants.F_OK;
var r_OK = constants.R_OK;
var w_OK = constants.W_OK;
var x_OK = constants.X_OK;
var copyFile_EXCL = constants.COPYFILE_EXCL;
var copyFile_FICLONE = constants.COPYFILE_FICLONE;
var copyFile_FICLONE_FORCE = constants.COPYFILE_FICLONE_FORCE;

// output-es/Node.FS.Perms/index.js
var semiringPerm = {
  add: (v) => (v1) => ({ r: v.r || v1.r, w: v.w || v1.w, x: v.x || v1.x }),
  zero: { r: false, w: false, x: false },
  mul: (v) => (v1) => ({ r: v.r && v1.r, w: v.w && v1.w, x: v.x && v1.x }),
  one: { r: true, w: true, x: true }
};
var permToString = (x) => showIntImpl(((x.r ? 4 : 0) + (x.w ? 2 : 0) | 0) + (x.x ? 1 : 0) | 0);
var permsToString = (v) => "0" + permToString(v.u) + permToString(v.g) + permToString(v.o);

// output-es/Node.FS.Sync/foreign.js
import {
  accessSync,
  copyFileSync,
  mkdtempSync,
  renameSync,
  truncateSync,
  chownSync,
  chmodSync,
  statSync,
  lstatSync,
  linkSync,
  symlinkSync,
  readlinkSync,
  realpathSync,
  unlinkSync,
  rmdirSync,
  rmSync,
  mkdirSync,
  readdirSync,
  utimesSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  openSync,
  readSync,
  writeSync,
  fsyncSync,
  closeSync
} from "node:fs";

// output-es/Node.FS.Sync/index.js
var writeTextFile = (encoding) => (file) => (text) => {
  const $0 = {
    encoding: (() => {
      if (encoding === "ASCII") {
        return "ASCII";
      }
      if (encoding === "UTF8") {
        return "UTF8";
      }
      if (encoding === "UTF16LE") {
        return "UTF16LE";
      }
      if (encoding === "UCS2") {
        return "UCS2";
      }
      if (encoding === "Base64") {
        return "Base64";
      }
      if (encoding === "Base64Url") {
        return "Base64Url";
      }
      if (encoding === "Latin1") {
        return "Latin1";
      }
      if (encoding === "Binary") {
        return "Binary";
      }
      if (encoding === "Hex") {
        return "Hex";
      }
      fail();
    })()
  };
  return () => writeFileSync(file, text, $0);
};
var readTextFile = (encoding) => (file) => {
  const $0 = {
    encoding: (() => {
      if (encoding === "ASCII") {
        return "ASCII";
      }
      if (encoding === "UTF8") {
        return "UTF8";
      }
      if (encoding === "UTF16LE") {
        return "UTF16LE";
      }
      if (encoding === "UCS2") {
        return "UCS2";
      }
      if (encoding === "Base64") {
        return "Base64";
      }
      if (encoding === "Base64Url") {
        return "Base64Url";
      }
      if (encoding === "Latin1") {
        return "Latin1";
      }
      if (encoding === "Binary") {
        return "Binary";
      }
      if (encoding === "Hex") {
        return "Hex";
      }
      fail();
    })()
  };
  return () => readFileSync(file, $0);
};
var mkdir = (path2) => {
  const $0 = {
    recursive: false,
    mode: permsToString({ u: semiringPerm.one, g: semiringPerm.one, o: semiringPerm.one })
  };
  return () => mkdirSync(path2, $0);
};

// output-es/Data.FoldableWithIndex/index.js
var foldableWithIndexArray = {
  foldrWithIndex: (f) => (z) => {
    const $0 = foldrArray((v) => {
      const $02 = v._1;
      const $12 = v._2;
      return (y) => f($02)($12)(y);
    })(z);
    const $1 = mapWithIndexArray(Tuple);
    return (x) => $0($1(x));
  },
  foldlWithIndex: (f) => (z) => {
    const $0 = foldlArray((y) => (v) => f(v._1)(y)(v._2))(z);
    const $1 = mapWithIndexArray(Tuple);
    return (x) => $0($1(x));
  },
  foldMapWithIndex: (dictMonoid) => {
    const mempty = dictMonoid.mempty;
    return (f) => foldableWithIndexArray.foldrWithIndex((i) => (x) => (acc) => dictMonoid.Semigroup0().append(f(i)(x))(acc))(mempty);
  },
  Foldable0: () => foldableArray
};

// output-es/Foreign.Object/foreign.js
var empty = {};
function _lookup(no, yes, k, m) {
  return k in m ? yes(m[k]) : no;
}
function toArrayWithKey(f) {
  return function(m) {
    var r = [];
    for (var k in m) {
      if (hasOwnProperty.call(m, k)) {
        r.push(f(k)(m[k]));
      }
    }
    return r;
  };
}
var keys = Object.keys || toArrayWithKey(function(k) {
  return function() {
    return k;
  };
});

// output-es/Node.Process/foreign.js
import process2 from "process";
var abortImpl = process2.abort ? () => process2.abort() : null;
var argv = () => process2.argv.slice();
var channelRefImpl = process2.channel && process2.channel.ref ? () => process2.channel.ref() : null;
var channelUnrefImpl = process2.channel && process2.channel.unref ? () => process2.channel.unref() : null;
var debugPort = process2.debugPort;
var disconnectImpl = process2.disconnect ? () => process2.disconnect() : null;
var pid = process2.pid;
var platformStr = process2.platform;
var ppid = process2.ppid;
var stdin = process2.stdin;
var stdout = process2.stdout;
var stderr = process2.stderr;
var stdinIsTTY = process2.stdinIsTTY;
var stdoutIsTTY = process2.stdoutIsTTY;
var stderrIsTTY = process2.stderrIsTTY;
var version = process2.version;

// output-es/Data.Argonaut.Core/foreign.js
function stringify(j) {
  return JSON.stringify(j);
}
function _caseJson(isNull2, isBool, isNum, isStr, isArr, isObj, j) {
  if (j == null) return isNull2();
  else if (typeof j === "boolean") return isBool(j);
  else if (typeof j === "number") return isNum(j);
  else if (typeof j === "string") return isStr(j);
  else if (Object.prototype.toString.call(j) === "[object Array]")
    return isArr(j);
  else return isObj(j);
}

// output-es/Data.Argonaut.Decode.Error/index.js
var $JsonDecodeError = (tag, _1, _2) => ({ tag, _1, _2 });
var AtIndex = (value0) => (value1) => $JsonDecodeError("AtIndex", value0, value1);
var Named = (value0) => (value1) => $JsonDecodeError("Named", value0, value1);
var MissingValue = /* @__PURE__ */ $JsonDecodeError("MissingValue");
var printJsonDecodeError = (err) => {
  const go = (v) => {
    if (v.tag === "TypeMismatch") {
      return "  Expected value of type '" + v._1 + "'.";
    }
    if (v.tag === "UnexpectedValue") {
      return "  Unexpected value " + stringify(v._1) + ".";
    }
    if (v.tag === "AtIndex") {
      return "  At array index " + showIntImpl(v._1) + ":\n" + go(v._2);
    }
    if (v.tag === "AtKey") {
      return "  At object key '" + v._1 + "':\n" + go(v._2);
    }
    if (v.tag === "Named") {
      return "  Under '" + v._1 + "':\n" + go(v._2);
    }
    if (v.tag === "MissingValue") {
      return "  No value was found.";
    }
    fail();
  };
  return "An error occurred while decoding a JSON value:\n" + go(err);
};

// output-es/Data.Argonaut.Parser/foreign.js
function _jsonParser(fail2, succ, s) {
  try {
    return succ(JSON.parse(s));
  } catch (e) {
    return fail2(e.message);
  }
}

// output-es/Node.FS.Async/foreign.js
import {
  access,
  copyFile,
  mkdtemp,
  rename,
  truncate,
  chown,
  chmod,
  stat,
  lstat,
  link,
  symlink,
  readlink,
  realpath,
  unlink,
  rmdir,
  rm,
  mkdir as mkdir2,
  readdir,
  utimes,
  readFile,
  writeFile,
  appendFile,
  open,
  read as read2,
  write as write2,
  close
} from "node:fs";

// output-es/Node.FS.Async/index.js
var handleCallback = (cb) => (err, a) => {
  const v = nullable(err, Nothing, Just);
  if (v.tag === "Nothing") {
    return cb($Either("Right", a))();
  }
  if (v.tag === "Just") {
    return cb($Either("Left", v._1))();
  }
  fail();
};
var readTextFile2 = (encoding) => (file) => (cb) => {
  const $0 = {
    encoding: (() => {
      if (encoding === "ASCII") {
        return "ASCII";
      }
      if (encoding === "UTF8") {
        return "UTF8";
      }
      if (encoding === "UTF16LE") {
        return "UTF16LE";
      }
      if (encoding === "UCS2") {
        return "UCS2";
      }
      if (encoding === "Base64") {
        return "Base64";
      }
      if (encoding === "Base64Url") {
        return "Base64Url";
      }
      if (encoding === "Latin1") {
        return "Latin1";
      }
      if (encoding === "Binary") {
        return "Binary";
      }
      if (encoding === "Hex") {
        return "Hex";
      }
      fail();
    })()
  };
  return () => readFile(file, $0, handleCallback(cb));
};
var readdir2 = (file) => (cb) => () => readdir(file, handleCallback(cb));
var stat2 = (file) => (cb) => () => stat(file, handleCallback(cb));

// output-es/Node.FS.Aff/index.js
var toAff1 = (f) => (a) => {
  const $0 = f(a);
  return makeAff((k) => {
    const $1 = $0(k);
    return () => {
      $1();
      return nonCanceler;
    };
  });
};
var toAff2 = (f) => (a) => (b) => {
  const $0 = f(a)(b);
  return makeAff((k) => {
    const $1 = $0(k);
    return () => {
      $1();
      return nonCanceler;
    };
  });
};

// output-es/Node.FS.Stats/foreign.js
var isDirectoryImpl = (s) => s.isDirectory();
var isFileImpl = (s) => s.isFile();

// output-es/Data.TraversableWithIndex/index.js
var traversableWithIndexArray = {
  traverseWithIndex: (dictApplicative) => {
    const sequence1 = traversableWithIndexArray.Traversable2().sequence(dictApplicative);
    return (f) => {
      const $0 = traversableWithIndexArray.FunctorWithIndex0().mapWithIndex(f);
      return (x) => sequence1($0(x));
    };
  },
  FunctorWithIndex0: () => functorWithIndexArray,
  FoldableWithIndex1: () => foldableWithIndexArray,
  Traversable2: () => traversableArray
};

// output-es/Data.Argonaut.Decode.Decoders/index.js
var traverseWithIndex = /* @__PURE__ */ (() => traversableWithIndexArray.traverseWithIndex(applicativeEither))();
var decodeJArray = (x) => {
  const $0 = _caseJson(
    (v) => Nothing,
    (v) => Nothing,
    (v) => Nothing,
    (v) => Nothing,
    Just,
    (v) => Nothing,
    x
  );
  if ($0.tag === "Nothing") {
    return $Either("Left", $JsonDecodeError("TypeMismatch", "Array"));
  }
  if ($0.tag === "Just") {
    return $Either("Right", $0._1);
  }
  fail();
};
var decodeInt = (a) => {
  const $0 = _caseJson(
    (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
    (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
    Right,
    (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
    (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
    (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
    a
  );
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = fromNumber($0._1);
    if ($1.tag === "Nothing") {
      return $Either("Left", $JsonDecodeError("TypeMismatch", "Integer"));
    }
    if ($1.tag === "Just") {
      return $Either("Right", $1._1);
    }
  }
  fail();
};
var decodeArray = (decoder) => {
  const $0 = Named("Array");
  const $1 = traverseWithIndex((i) => {
    const $12 = AtIndex(i);
    return (x) => {
      const $2 = decoder(x);
      if ($2.tag === "Left") {
        return $Either("Left", $12($2._1));
      }
      if ($2.tag === "Right") {
        return $Either("Right", $2._1);
      }
      fail();
    };
  });
  return (a) => {
    const $2 = decodeJArray(a);
    if ($2.tag === "Left") {
      return $Either("Left", $2._1);
    }
    if ($2.tag === "Right") {
      const $3 = $1($2._1);
      if ($3.tag === "Left") {
        return $Either("Left", $0($3._1));
      }
      if ($3.tag === "Right") {
        return $Either("Right", $3._1);
      }
    }
    fail();
  };
};
var decodeTuple = (decoderA) => (decoderB) => (json) => {
  const $0 = decodeArray(Right)(json);
  return (() => {
    if ($0.tag === "Left") {
      const $1 = $0._1;
      return (v) => $Either("Left", $1);
    }
    if ($0.tag === "Right") {
      const $1 = $0._1;
      return (f) => f($1);
    }
    fail();
  })()((v) => {
    if (v.length === 2) {
      const $1 = decoderA(v[0]);
      if ($1.tag === "Left") {
        return $Either("Left", $1._1);
      }
      if ($1.tag === "Right") {
        const $2 = decoderB(v[1]);
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Tuple($1._1, $2._1));
        }
      }
      fail();
    }
    return $Either("Left", $JsonDecodeError("TypeMismatch", "Tuple"));
  });
};

// output-es/PureScript.Backend.Optimizer.CoreFn/index.js
var $Bind = (tag, _1) => ({ tag, _1 });
var $Binder = (tag, _1, _2, _3, _4) => ({ tag, _1, _2, _3, _4 });
var $Binding = (_1, _2, _3) => ({ tag: "Binding", _1, _2, _3 });
var $CaseAlternative = (_1, _2) => ({ tag: "CaseAlternative", _1, _2 });
var $CaseGuard = (tag, _1) => ({ tag, _1 });
var $Comment = (tag, _1) => ({ tag, _1 });
var $ConstructorType = (tag) => tag;
var $Expr = (tag, _1, _2, _3, _4) => ({ tag, _1, _2, _3, _4 });
var $ExprType = (tag, _1, _2, _3) => ({ tag, _1, _2, _3 });
var $Guard = (_1, _2) => ({ tag: "Guard", _1, _2 });
var $Import = (_1, _2) => ({ tag: "Import", _1, _2 });
var $Literal = (tag, _1) => ({ tag, _1 });
var $Meta = (tag, _1, _2) => ({ tag, _1, _2 });
var $Prop = (_1, _2) => ({ tag: "Prop", _1, _2 });
var $Qualified = (_1, _2) => ({ tag: "Qualified", _1, _2 });
var $ReExport = (_1, _2) => ({ tag: "ReExport", _1, _2 });
var eqArray = { eq: /* @__PURE__ */ eqArrayImpl(eqStringImpl) };
var eqTuple1 = (dictEq1) => ({ eq: (x) => (y) => eqArray.eq(x._1)(y._1) && dictEq1.eq(x._2)(y._2) });
var zero = /* @__PURE__ */ (() => semiringRecordCons({ reflectSymbol: () => "column" })()(semiringRecordCons({ reflectSymbol: () => "line" })()(semiringRecordNil)(semiringInt))(semiringInt).zeroRecord($$Proxy)($$Proxy))();
var Prop = (value0) => (value1) => $Prop(value0, value1);
var LitArray = (value0) => $Literal("LitArray", value0);
var LitRecord = (value0) => $Literal("LitRecord", value0);
var ReExport = (value0) => (value1) => $ReExport(value0, value1);
var Int = /* @__PURE__ */ $ExprType("Int");
var $$Number = /* @__PURE__ */ $ExprType("Number");
var $$String = /* @__PURE__ */ $ExprType("String");
var Char = /* @__PURE__ */ $ExprType("Char");
var $$Boolean = /* @__PURE__ */ $ExprType("Boolean");
var Unit = /* @__PURE__ */ $ExprType("Unit");
var Any = /* @__PURE__ */ $ExprType("Any");
var ProductType = /* @__PURE__ */ $ConstructorType("ProductType");
var SumType = /* @__PURE__ */ $ConstructorType("SumType");
var IsNewtype = /* @__PURE__ */ $Meta("IsNewtype");
var IsTypeClassConstructor = /* @__PURE__ */ $Meta("IsTypeClassConstructor");
var IsForeign = /* @__PURE__ */ $Meta("IsForeign");
var IsWhere = /* @__PURE__ */ $Meta("IsWhere");
var IsSyntheticApp = /* @__PURE__ */ $Meta("IsSyntheticApp");
var BinderVar = (value0) => (value1) => $Binder("BinderVar", value0, value1);
var BinderLit = (value0) => (value1) => $Binder("BinderLit", value0, value1);
var ExprVar = (value0) => (value1) => $Expr("ExprVar", value0, value1);
var ExprLit = (value0) => (value1) => $Expr("ExprLit", value0, value1);
var eqLiteral = (dictEq) => {
  const eq12 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  return {
    eq: (x) => (y) => {
      if (x.tag === "LitInt") {
        return y.tag === "LitInt" && x._1 === y._1;
      }
      if (x.tag === "LitNumber") {
        return y.tag === "LitNumber" && x._1 === y._1;
      }
      if (x.tag === "LitString") {
        return y.tag === "LitString" && x._1 === y._1;
      }
      if (x.tag === "LitChar") {
        return y.tag === "LitChar" && x._1 === y._1;
      }
      if (x.tag === "LitBoolean") {
        return y.tag === "LitBoolean" && x._1 === y._1;
      }
      if (x.tag === "LitArray") {
        return y.tag === "LitArray" && eqArrayImpl(dictEq.eq)(x._1)(y._1);
      }
      return x.tag === "LitRecord" && y.tag === "LitRecord" && eq12(x._1)(y._1);
    }
  };
};
var propKey = (v) => v._1;
var compare2 = (x) => (y) => {
  if (x.tag === "Nothing") {
    if (y.tag === "Nothing") {
      return EQ;
    }
    return LT;
  }
  if (y.tag === "Nothing") {
    return GT;
  }
  if (x.tag === "Just" && y.tag === "Just") {
    return ordString.compare(x._1)(y._1);
  }
  fail();
};
var functorProp = { map: (f) => (m) => $Prop(m._1, f(m._2)) };
var functorLiteral = {
  map: (f) => (m) => {
    if (m.tag === "LitInt") {
      return $Literal("LitInt", m._1);
    }
    if (m.tag === "LitNumber") {
      return $Literal("LitNumber", m._1);
    }
    if (m.tag === "LitString") {
      return $Literal("LitString", m._1);
    }
    if (m.tag === "LitChar") {
      return $Literal("LitChar", m._1);
    }
    if (m.tag === "LitBoolean") {
      return $Literal("LitBoolean", m._1);
    }
    if (m.tag === "LitArray") {
      return $Literal("LitArray", arrayMap(f)(m._1));
    }
    if (m.tag === "LitRecord") {
      return $Literal("LitRecord", arrayMap((m$1) => $Prop(m$1._1, f(m$1._2)))(m._1));
    }
    fail();
  }
};
var foldableProp = { foldl: (k) => (a) => (v) => k(a)(v._2), foldr: (k) => (b) => (v) => k(v._2)(b), foldMap: (dictMonoid) => (k) => (v) => k(v._2) };
var traversableProp = {
  traverse: (dictApplicative) => (k) => (v) => dictApplicative.Apply0().Functor0().map(Prop(v._1))(k(v._2)),
  sequence: (dictApplicative) => (v) => dictApplicative.Apply0().Functor0().map(Prop(v._1))(v._2),
  Functor0: () => functorProp,
  Foldable1: () => foldableProp
};
var foldableLiteral = {
  foldl: (k) => foldlDefault(foldableLiteral)(k),
  foldr: (k) => foldrDefault(foldableLiteral)(k),
  foldMap: (dictMonoid) => {
    const foldMap23 = foldableArray.foldMap(dictMonoid);
    const mempty = dictMonoid.mempty;
    return (k) => (v) => {
      if (v.tag === "LitArray") {
        return foldMap23(k)(v._1);
      }
      if (v.tag === "LitRecord") {
        return foldMap23((v$1) => k(v$1._2))(v._1);
      }
      return mempty;
    };
  }
};
var traversableLiteral = {
  traverse: (dictApplicative) => {
    const $0 = dictApplicative.Apply0().Functor0();
    const traverse22 = traversableArray.traverse(dictApplicative);
    return (k) => (v) => {
      if (v.tag === "LitArray") {
        return $0.map(LitArray)(traverse22(k)(v._1));
      }
      if (v.tag === "LitRecord") {
        return $0.map(LitRecord)(traverse22(traversableProp.traverse(dictApplicative)(k))(v._1));
      }
      if (v.tag === "LitInt") {
        return dictApplicative.pure($Literal("LitInt", v._1));
      }
      if (v.tag === "LitNumber") {
        return dictApplicative.pure($Literal("LitNumber", v._1));
      }
      if (v.tag === "LitString") {
        return dictApplicative.pure($Literal("LitString", v._1));
      }
      if (v.tag === "LitChar") {
        return dictApplicative.pure($Literal("LitChar", v._1));
      }
      if (v.tag === "LitBoolean") {
        return dictApplicative.pure($Literal("LitBoolean", v._1));
      }
      fail();
    };
  },
  sequence: (dictApplicative) => (a) => traversableLiteral.traverse(dictApplicative)(identity3)(a),
  Functor0: () => functorLiteral,
  Foldable1: () => foldableLiteral
};
var ordQualified = (dictOrd) => {
  const $0 = dictOrd.Eq0();
  const eqQualified1 = { eq: (x) => (y) => (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && $0.eq(x._2)(y._2) };
  return {
    compare: (x) => (y) => {
      const v = compare2(x._1)(y._1);
      if (v === "LT") {
        return LT;
      }
      if (v === "GT") {
        return GT;
      }
      return dictOrd.compare(x._2)(y._2);
    },
    Eq0: () => eqQualified1
  };
};
var eq9 = /* @__PURE__ */ eqArrayImpl(eqStringImpl);
var eqReExport = { eq: (x) => (y) => x._1 === y._1 && x._2 === y._2 };
var ordReExport = {
  compare: (x) => (y) => {
    const v = ordString.compare(x._1)(y._1);
    if (v === "LT") {
      return LT;
    }
    if (v === "GT") {
      return GT;
    }
    return ordString.compare(x._2)(y._2);
  },
  Eq0: () => eqReExport
};
var eqExprType = {
  eq: (x) => (y) => {
    if (x.tag === "Int") {
      return y.tag === "Int";
    }
    if (x.tag === "Number") {
      return y.tag === "Number";
    }
    if (x.tag === "String") {
      return y.tag === "String";
    }
    if (x.tag === "Char") {
      return y.tag === "Char";
    }
    if (x.tag === "Boolean") {
      return y.tag === "Boolean";
    }
    if (x.tag === "Unit") {
      return y.tag === "Unit";
    }
    if (x.tag === "Any") {
      return y.tag === "Any";
    }
    if (x.tag === "TypeLevelString") {
      return y.tag === "TypeLevelString" && x._1 === y._1;
    }
    if (x.tag === "Array") {
      return y.tag === "Array" && eqExprType.eq(x._1)(y._1);
    }
    if (x.tag === "TypeVar") {
      return y.tag === "TypeVar" && x._1 === y._1;
    }
    if (x.tag === "ADT") {
      return y.tag === "ADT" && x._1 === y._1 && eqArray.eq(x._2)(y._2) && eqArrayImpl(eqExprType.eq)(x._3)(y._3);
    }
    if (x.tag === "TypeApp") {
      return y.tag === "TypeApp" && eqExprType.eq(x._1)(y._1) && eqArrayImpl(eqExprType.eq)(x._2)(y._2);
    }
    if (x.tag === "Func") {
      return y.tag === "Func" && eqArrayImpl(eqExprType.eq)(x._1)(y._1) && eqExprType.eq(x._2)(y._2);
    }
    if (x.tag === "Row") {
      return y.tag === "Row" && eqArrayImpl((x$1) => (y$1) => x$1._1 === y$1._1 && eqExprType.eq(x$1._2)(y$1._2))(x._1)(y._1) && (x._2.tag === "Nothing" ? y._2.tag === "Nothing" : x._2.tag === "Just" && y._2.tag === "Just" && eqExprType.eq(x._2._1)(y._2._1));
    }
    if (x.tag === "Record") {
      return y.tag === "Record" && eqExprType.eq(x._1)(y._1);
    }
    if (x.tag === "ForAll") {
      return y.tag === "ForAll" && eqArray.eq(x._1)(y._1) && eqExprType.eq(x._2)(y._2);
    }
    return x.tag === "ConstrainedType" && y.tag === "ConstrainedType" && eqArrayImpl(eqTuple1({ eq: eqArrayImpl(eqExprType.eq) }).eq)(x._1)(y._1) && eqExprType.eq(x._2)(y._2);
  }
};
var eqMeta = {
  eq: (x) => (y) => {
    if (x.tag === "IsConstructor") {
      return y.tag === "IsConstructor" && (x._1 === "ProductType" ? y._1 === "ProductType" : x._1 === "SumType" && y._1 === "SumType") && eq9(x._2)(y._2);
    }
    if (x.tag === "IsNewtype") {
      return y.tag === "IsNewtype";
    }
    if (x.tag === "IsTypeClassConstructor") {
      return y.tag === "IsTypeClassConstructor";
    }
    if (x.tag === "IsForeign") {
      return y.tag === "IsForeign";
    }
    if (x.tag === "IsWhere") {
      return y.tag === "IsWhere";
    }
    return x.tag === "IsSyntheticApp" && y.tag === "IsSyntheticApp";
  }
};
var emptySpan = { path: "<internal>", start: zero, end: zero };

// output-es/PureScript.Backend.Optimizer.CoreFn.Json/index.js
var intercalate = (sep) => (xs) => foldlArray((v) => (v1) => {
  if (v.init) {
    return { init: false, acc: v1 };
  }
  return { init: false, acc: v.acc + sep + v1 };
})({ init: true, acc: "" })(xs).acc;
var traverse = /* @__PURE__ */ (() => traversableArray.traverse(applicativeEither))();
var fromFoldable2 = /* @__PURE__ */ fromFoldable(ordString)(foldableArray);
var getFieldOptional$p = (decode) => (obj) => (prop) => {
  const v = _lookup(Nothing, Just, prop, obj);
  if (v.tag === "Nothing") {
    return $Either("Right", Nothing);
  }
  if (v.tag === "Just") {
    if (_caseJson((v$1) => true, (v$1) => false, (v$1) => false, (v$1) => false, (v$1) => false, (v$1) => false, v._1)) {
      return $Either("Right", Nothing);
    }
    const $0 = decode(v._1);
    if ($0.tag === "Left") {
      return $Either("Left", $0._1);
    }
    if ($0.tag === "Right") {
      return $Either("Right", $Maybe("Just", $0._1));
    }
  }
  fail();
};
var getField = (decode) => (obj) => (prop) => {
  const v = _lookup(Nothing, Just, prop, obj);
  if (v.tag === "Nothing") {
    return $Either("Left", $JsonDecodeError("AtKey", prop, MissingValue));
  }
  if (v.tag === "Just") {
    return decode(v._1);
  }
  fail();
};
var decodeString = (json) => _caseJson(
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "String")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "String")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "String")),
  Right,
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "String")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "String")),
  json
);
var decodeNumber = (json) => _caseJson(
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
  Right,
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Number")),
  json
);
var decodeJObject = (json) => _caseJson(
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Object")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Object")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Object")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Object")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Object")),
  Right,
  json
);
var decodeJArray2 = (json) => _caseJson(
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Array")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Array")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Array")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Array")),
  Right,
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Array")),
  json
);
var decodeBoolean = (json) => _caseJson(
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Boolean")),
  Right,
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Boolean")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Boolean")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Boolean")),
  (v) => $Either("Left", $JsonDecodeError("TypeMismatch", "Boolean")),
  json
);
var decodeArray2 = (decoder) => (json) => {
  const v = decodeJArray2(json);
  if (v.tag === "Left") {
    return $Either("Left", v._1);
  }
  if (v.tag === "Right") {
    const $0 = v._1;
    return (() => {
      const out = [];
      const ix = newSTRef(0)();
      const con = newSTRef(true)();
      const res = newSTRef()();
      const len = $0.length;
      while (con.value) {
        const ix$p = ix.value;
        if (ix$p === len) {
          con.value = false;
          res.value = $Either("Right", out);
          continue;
        }
        const v1 = decoder($0[ix$p]);
        if (v1.tag === "Left") {
          con.value = false;
          res.value = $Either("Left", $JsonDecodeError("AtIndex", ix$p, v1._1));
          continue;
        }
        if (v1.tag === "Right") {
          out.push(v1._1);
          ix.value = ix$p + 1 | 0;
          continue;
        }
        fail();
      }
      return res.value;
    })();
  }
  fail();
};
var decodeModuleName = (x) => {
  const $0 = decodeArray2(decodeString)(x);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    return $Either("Right", intercalate(".")($0._1));
  }
  fail();
};
var decodeConstructorType = (json) => {
  const $0 = decodeString(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    if ($0._1 === "ProductType") {
      return $Either("Right", ProductType);
    }
    if ($0._1 === "SumType") {
      return $Either("Right", SumType);
    }
    return $Either("Left", $JsonDecodeError("TypeMismatch", "ConstructorType"));
  }
  fail();
};
var decodeImport = (decodeAnn$p) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeAnn$p)($0._1)("annotation");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeModuleName)($0._1)("moduleName");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Import($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeInt2 = (json) => {
  const $0 = decodeNumber(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const v = fromNumber($0._1);
    if (v.tag === "Nothing") {
      if ($0._1 === 2147483648) {
        return $Either("Right", -2147483648);
      }
      return $Either("Left", $JsonDecodeError("TypeMismatch", "Int"));
    }
    if (v.tag === "Just") {
      return $Either("Right", v._1);
    }
  }
  fail();
};
var decodeCodePoint = (a) => {
  const $0 = decodeInt2(a);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    if ($0._1 >= 0 && $0._1 <= 1114111) {
      return $Either("Right", $0._1);
    }
    return $Either("Left", $JsonDecodeError("TypeMismatch", "CodePoint"));
  }
  fail();
};
var decodeMeta = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("metaType");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      if ($1._1 === "IsConstructor") {
        const $2 = getField(decodeConstructorType)($0._1)("constructorType");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          const $3 = getField(decodeArray2(decodeString))($0._1)("identifiers");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            return $Either("Right", $Meta("IsConstructor", $2._1, $3._1));
          }
        }
        fail();
      }
      if ($1._1 === "IsNewtype") {
        return $Either("Right", IsNewtype);
      }
      if ($1._1 === "IsTypeClassConstructor") {
        return $Either("Right", IsTypeClassConstructor);
      }
      if ($1._1 === "IsForeign") {
        return $Either("Right", IsForeign);
      }
      if ($1._1 === "IsWhere") {
        return $Either("Right", IsWhere);
      }
      if ($1._1 === "IsSyntheticApp") {
        return $Either("Right", IsSyntheticApp);
      }
      return $Either("Left", $JsonDecodeError("TypeMismatch", "Meta"));
    }
  }
  fail();
};
var decodeQualified = (k) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getFieldOptional$p(decodeModuleName)($0._1)("moduleName");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(k)($0._1)("identifier");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Qualified($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeReExports = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = traverse(traversableTuple.traverse(applicativeEither)(decodeArray2(decodeString)))(toArrayWithKey(Tuple)($0._1));
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      return $Either("Right", arrayBind($1._1)((v) => arrayMap(ReExport(v._1))(v._2)));
    }
  }
  fail();
};
var decodeSourcePos = (json) => {
  const $0 = decodeTuple(decodeInt)(decodeInt)(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    return $Either("Right", { line: $0._1._1, column: $0._1._2 });
  }
  fail();
};
var decodeSourceSpan = (path2) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeSourcePos)($0._1)("start");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeSourcePos)($0._1)("end");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", { path: path2, start: $1._1, end: $2._1 });
      }
    }
  }
  fail();
};
var decodeComment = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("LineComment");
    const $2 = (() => {
      if ($1.tag === "Left") {
        return $Either("Left", $1._1);
      }
      if ($1.tag === "Right") {
        return $Either("Right", $Comment("LineComment", $1._1));
      }
      fail();
    })();
    if ($2.tag === "Left") {
      const $3 = getField(decodeString)($0._1)("BlockComment");
      if ($3.tag === "Left") {
        return $Either("Left", $3._1);
      }
      if ($3.tag === "Right") {
        return $Either("Right", $Comment("BlockComment", $3._1));
      }
      fail();
    }
    if ($2.tag === "Right") {
      return $2;
    }
  }
  fail();
};
var decodeField = (j) => {
  const $0 = decodeJObject(j);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("label");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeExprType)($0._1)("type");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Tuple($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeExprType = (json) => {
  const $0 = decodeString(json);
  const $1 = (() => {
    if ($0.tag === "Left") {
      return $Either("Left", $0._1);
    }
    if ($0.tag === "Right") {
      if ($0._1 === "Int") {
        return $Either("Right", Int);
      }
      if ($0._1 === "Number") {
        return $Either("Right", $$Number);
      }
      if ($0._1 === "String") {
        return $Either("Right", $$String);
      }
      if ($0._1 === "Char") {
        return $Either("Right", Char);
      }
      if ($0._1 === "Boolean") {
        return $Either("Right", $$Boolean);
      }
      if ($0._1 === "Unit") {
        return $Either("Right", Unit);
      }
      if ($0._1 === "Any") {
        return $Either("Right", Any);
      }
      return $Either("Left", $JsonDecodeError("TypeMismatch", "ExprType"));
    }
    fail();
  })();
  if ($1.tag === "Left") {
    const $2 = decodeJObject(json);
    if ($2.tag === "Left") {
      return $Either("Left", $2._1);
    }
    if ($2.tag === "Right") {
      const v1 = _lookup(Nothing, Just, "Func", $2._1);
      if (v1.tag === "Just") {
        const $3 = decodeJObject(v1._1);
        if ($3.tag === "Left") {
          return $Either("Left", $3._1);
        }
        if ($3.tag === "Right") {
          const $4 = getField(decodeArray2(decodeExprType))($3._1)("args");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            const $5 = getField(decodeExprType)($3._1)("ret");
            if ($5.tag === "Left") {
              return $Either("Left", $5._1);
            }
            if ($5.tag === "Right") {
              return $Either("Right", $ExprType("Func", $4._1, $5._1));
            }
          }
        }
        fail();
      }
      if (v1.tag === "Nothing") {
        const v2 = _lookup(Nothing, Just, "Record", $2._1);
        if (v2.tag === "Just") {
          const $3 = decodeJObject(v2._1);
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = traverse((v3) => {
              const $42 = Tuple(v3._1);
              const $5 = decodeExprType(v3._2);
              if ($5.tag === "Left") {
                return $Either("Left", $5._1);
              }
              if ($5.tag === "Right") {
                return $Either("Right", $42($5._1));
              }
              fail();
            })(toArrayWithKey(Tuple)($3._1));
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either(
                "Right",
                $ExprType("Record", $ExprType("Row", $4._1, Nothing))
              );
            }
          }
          fail();
        }
        if (v2.tag === "Nothing") {
          const v3 = _lookup(Nothing, Just, "Array", $2._1);
          if (v3.tag === "Just") {
            const $3 = decodeExprType(v3._1);
            if ($3.tag === "Left") {
              return $Either("Left", $3._1);
            }
            if ($3.tag === "Right") {
              return $Either("Right", $ExprType("Array", $3._1));
            }
            fail();
          }
          if (v3.tag === "Nothing") {
            const v4 = _lookup(Nothing, Just, "ADT", $2._1);
            if (v4.tag === "Just") {
              const $3 = decodeJObject(v4._1);
              if ($3.tag === "Left") {
                return $Either("Left", $3._1);
              }
              if ($3.tag === "Right") {
                const $4 = getField(decodeArray2(decodeString))($3._1)("path");
                if ($4.tag === "Left") {
                  return $Either("Left", $4._1);
                }
                if ($4.tag === "Right") {
                  const $5 = getField(decodeArray2(decodeExprType))($3._1)("args");
                  if ($5.tag === "Left") {
                    return $Either("Left", $5._1);
                  }
                  if ($5.tag === "Right") {
                    return $Either("Right", $ExprType("ADT", intercalate(".")($4._1), $4._1, $5._1));
                  }
                }
              }
              fail();
            }
            if (v4.tag === "Nothing") {
              const v5 = _lookup(Nothing, Just, "TypeVar", $2._1);
              if (v5.tag === "Just") {
                const $3 = decodeString(v5._1);
                if ($3.tag === "Left") {
                  return $Either("Left", $3._1);
                }
                if ($3.tag === "Right") {
                  return $Either("Right", $ExprType("TypeVar", $3._1));
                }
                fail();
              }
              if (v5.tag === "Nothing") {
                const $3 = getField(decodeString)($2._1)("type");
                if ($3.tag === "Left") {
                  return $Either("Left", $3._1);
                }
                if ($3.tag === "Right") {
                  if ($3._1 === "Int") {
                    return $Either("Right", Int);
                  }
                  if ($3._1 === "Number") {
                    return $Either("Right", $$Number);
                  }
                  if ($3._1 === "String") {
                    return $Either("Right", $$String);
                  }
                  if ($3._1 === "Char") {
                    return $Either("Right", Char);
                  }
                  if ($3._1 === "Boolean") {
                    return $Either("Right", $$Boolean);
                  }
                  if ($3._1 === "Unit") {
                    return $Either("Right", Unit);
                  }
                  if ($3._1 === "Any") {
                    return $Either("Right", Any);
                  }
                  if ($3._1 === "TypeLevelString") {
                    const $4 = getField(decodeString)($2._1)("value");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      return $Either("Right", $ExprType("TypeLevelString", $4._1));
                    }
                    fail();
                  }
                  if ($3._1 === "Array") {
                    const $4 = getField(decodeExprType)($2._1)("element");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      return $Either("Right", $ExprType("Array", $4._1));
                    }
                    fail();
                  }
                  if ($3._1 === "TypeVar") {
                    const $4 = getField(decodeString)($2._1)("name");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      return $Either("Right", $ExprType("TypeVar", $4._1));
                    }
                    fail();
                  }
                  if ($3._1 === "Adt") {
                    const $4 = getField(decodeArray2(decodeString))($2._1)("fqn");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getField(decodeArray2(decodeExprType))($2._1)("args");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("ADT", intercalate(".")($4._1), $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  if ($3._1 === "TypeApp") {
                    const $4 = getField(decodeExprType)($2._1)("constructor");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getField(decodeArray2(decodeExprType))($2._1)("args");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("TypeApp", $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  if ($3._1 === "Func") {
                    const $4 = getField(decodeArray2(decodeExprType))($2._1)("args");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getField(decodeExprType)($2._1)("ret");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("Func", $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  if ($3._1 === "Row") {
                    const $4 = getField(decodeArray2(decodeField))($2._1)("fields");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getFieldOptional$p(decodeExprType)($2._1)("tail");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("Row", $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  if ($3._1 === "Record") {
                    const $4 = getField(decodeExprType)($2._1)("row");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      return $Either("Right", $ExprType("Record", $4._1));
                    }
                    fail();
                  }
                  if ($3._1 === "ForAll") {
                    const $4 = getField(decodeArray2(decodeString))($2._1)("vars");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getField(decodeExprType)($2._1)("body");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("ForAll", $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  if ($3._1 === "ConstrainedType") {
                    const $4 = getField(decodeArray2(decodeConstraint))($2._1)("constraints");
                    if ($4.tag === "Left") {
                      return $Either("Left", $4._1);
                    }
                    if ($4.tag === "Right") {
                      const $5 = getField(decodeExprType)($2._1)("body");
                      if ($5.tag === "Left") {
                        return $Either("Left", $5._1);
                      }
                      if ($5.tag === "Right") {
                        return $Either("Right", $ExprType("ConstrainedType", $4._1, $5._1));
                      }
                    }
                    fail();
                  }
                  return $Either("Left", $JsonDecodeError("TypeMismatch", "ExprType"));
                }
              }
            }
          }
        }
      }
    }
    fail();
  }
  if ($1.tag === "Right") {
    return $1;
  }
  fail();
};
var decodeConstraint = (j) => {
  const $0 = decodeJObject(j);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeArray2(decodeString))($0._1)("fqn");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeArray2(decodeExprType))($0._1)("args");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Tuple($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeAnn = (_path) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getFieldOptional$p(decodeMeta)($0._1)("meta");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getFieldOptional$p(decodeExprType)($0._1)("type");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", { span: emptySpan, meta: $1._1, type: $2._1 });
      }
    }
  }
  fail();
};
var decodeDataConstructor = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("name");
    const $2 = (() => {
      if ($1.tag === "Left") {
        return getField(decodeString)($0._1)("constructorName");
      }
      if ($1.tag === "Right") {
        return $1;
      }
      fail();
    })();
    if ($2.tag === "Left") {
      return $Either("Left", $2._1);
    }
    if ($2.tag === "Right") {
      const $3 = getField(decodeArray2(decodeExprType))($0._1)("fields");
      const $4 = (() => {
        if ($3.tag === "Left") {
          return getField(decodeArray2(decodeExprType))($0._1)("fieldTypes");
        }
        if ($3.tag === "Right") {
          return $3;
        }
        fail();
      })();
      if ($4.tag === "Left") {
        return $Either("Left", $4._1);
      }
      if ($4.tag === "Right") {
        return $Either("Right", { name: $2._1, fields: $4._1 });
      }
    }
  }
  fail();
};
var decodeDataDecl = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("name");
    const $2 = (() => {
      if ($1.tag === "Left") {
        return getField(decodeString)($0._1)("typeName");
      }
      if ($1.tag === "Right") {
        return $1;
      }
      fail();
    })();
    if ($2.tag === "Left") {
      return $Either("Left", $2._1);
    }
    if ($2.tag === "Right") {
      const $3 = getFieldOptional$p(decodeArray2(decodeString))($0._1)("vars");
      const $4 = (() => {
        if ($3.tag === "Left") {
          return getFieldOptional$p(decodeArray2(decodeString))($0._1)("typeVars");
        }
        if ($3.tag === "Right") {
          return $3;
        }
        fail();
      })();
      if ($4.tag === "Left") {
        return $Either("Left", $4._1);
      }
      if ($4.tag === "Right") {
        const vars = (() => {
          if ($4._1.tag === "Nothing") {
            return [];
          }
          if ($4._1.tag === "Just") {
            return $4._1._1;
          }
          fail();
        })();
        const $5 = getField(decodeArray2(decodeDataConstructor))($0._1)("constructors");
        if ($5.tag === "Left") {
          return $Either("Left", $5._1);
        }
        if ($5.tag === "Right") {
          return $Either("Right", { name: $2._1, vars, constructors: $5._1 });
        }
      }
    }
  }
  fail();
};
var decodeMethod = (j) => {
  const $0 = decodeJObject(j);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("name");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeExprType)($0._1)("type");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Tuple($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeClassDecl = (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("name");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getFieldOptional$p(decodeArray2(decodeString))($0._1)("vars");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        const vars = (() => {
          if ($2._1.tag === "Nothing") {
            return [];
          }
          if ($2._1.tag === "Just") {
            return $2._1._1;
          }
          fail();
        })();
        const $3 = getField(decodeArray2(decodeConstraint))($0._1)("superclasses");
        if ($3.tag === "Left") {
          return $Either("Left", $3._1);
        }
        if ($3.tag === "Right") {
          const $4 = getField(decodeArray2(decodeMethod))($0._1)("methods");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            return $Either("Right", { name: $1._1, vars, superclasses: $3._1, methods: $4._1 });
          }
        }
      }
    }
  }
  fail();
};
var decodeStringLiteral = (json) => {
  const $0 = decodeString(json);
  if ($0.tag === "Left") {
    const $1 = decodeArray2(decodeCodePoint)(json);
    const $2 = (() => {
      if ($1.tag === "Left") {
        return $Either("Left", $1._1);
      }
      if ($1.tag === "Right") {
        return $Either("Right", fromCodePointArray($1._1));
      }
      fail();
    })();
    if ($2.tag === "Left") {
      return $Either("Left", $JsonDecodeError("TypeMismatch", "StringLiteral"));
    }
    if ($2.tag === "Right") {
      return $2;
    }
    fail();
  }
  if ($0.tag === "Right") {
    return $0;
  }
  fail();
};
var decodeRecord = (x) => decodeArray2((json) => {
  const $0 = decodeJArray2(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    if ($0._1.length === 2) {
      const $1 = decodeStringLiteral($0._1[0]);
      if ($1.tag === "Left") {
        return $Either("Left", $1._1);
      }
      if ($1.tag === "Right") {
        const $2 = x($0._1[1]);
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Prop($1._1, $2._1));
        }
      }
      fail();
    }
    return $Either("Left", $JsonDecodeError("TypeMismatch", "Tuple"));
  }
  fail();
});
var decodeLiteral = (dec) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("literalType");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      if ($1._1 === "IntLiteral") {
        const $2 = getField(decodeInt2)($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitInt", $2._1));
        }
        fail();
      }
      if ($1._1 === "NumberLiteral") {
        const $2 = getField(decodeNumber)($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitNumber", $2._1));
        }
        fail();
      }
      if ($1._1 === "StringLiteral") {
        const $2 = getField(decodeStringLiteral)($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitString", $2._1));
        }
        fail();
      }
      if ($1._1 === "CharLiteral") {
        const $2 = getField(decodeString)($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          if (length2($2._1) === 1) {
            const $3 = toCharArray($2._1);
            if (0 < $3.length) {
              return $Either("Right", $Literal("LitChar", $3[0]));
            }
          }
          return $Either("Left", $JsonDecodeError("TypeMismatch", "Char"));
        }
        fail();
      }
      if ($1._1 === "BooleanLiteral") {
        const $2 = getField(decodeBoolean)($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitBoolean", $2._1));
        }
        fail();
      }
      if ($1._1 === "ArrayLiteral") {
        const $2 = getField(decodeArray2(dec))($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitArray", $2._1));
        }
        fail();
      }
      if ($1._1 === "ObjectLiteral") {
        const $2 = getField(decodeRecord(dec))($0._1)("value");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Literal("LitRecord", $2._1));
        }
        fail();
      }
      return $Either("Left", $JsonDecodeError("TypeMismatch", "Literal"));
    }
  }
  fail();
};
var decodeBinder = (decAnn) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decAnn)($0._1)("annotation");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeString)($0._1)("binderType");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        if ($2._1 === "NullBinder") {
          return $Either("Right", $Binder("BinderNull", $1._1));
        }
        if ($2._1 === "VarBinder") {
          const $3 = BinderVar($1._1);
          const $4 = getField(decodeString)($0._1)("identifier");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            return $Either("Right", $3($4._1));
          }
          fail();
        }
        if ($2._1 === "LiteralBinder") {
          const $3 = BinderLit($1._1);
          const $4 = getField(decodeLiteral(decodeBinder(decAnn)))($0._1)("literal");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            return $Either("Right", $3($4._1));
          }
          fail();
        }
        if ($2._1 === "ConstructorBinder") {
          const $3 = getField(decodeQualified(decodeString))($0._1)("typeName");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeQualified(decodeString))($0._1)("name");
            const $5 = (() => {
              if ($4.tag === "Left") {
                return getField(decodeQualified(decodeString))($0._1)("constructorName");
              }
              if ($4.tag === "Right") {
                return $4;
              }
              fail();
            })();
            if ($5.tag === "Left") {
              return $Either("Left", $5._1);
            }
            if ($5.tag === "Right") {
              const $6 = getField(decodeArray2(decodeBinder(decAnn)))($0._1)("binders");
              if ($6.tag === "Left") {
                return $Either("Left", $6._1);
              }
              if ($6.tag === "Right") {
                return $Either("Right", $Binder("BinderConstructor", $1._1, $3._1, $5._1, $6._1));
              }
            }
          }
          fail();
        }
        if ($2._1 === "NamedBinder") {
          const $3 = getField(decodeString)($0._1)("identifier");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeBinder(decAnn))($0._1)("binder");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Binder("BinderNamed", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        return $Either("Left", $JsonDecodeError("TypeMismatch", "Binder"));
      }
    }
  }
  fail();
};
var decodeGuard = (decAnn) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeExpr(decAnn))($0._1)("guard");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeExpr(decAnn))($0._1)("expression");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Guard($1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeExpr = (decAnn) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decAnn)($0._1)("annotation");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeString)($0._1)("type");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        if ($2._1 === "Var") {
          const $3 = ExprVar($1._1);
          const $4 = getField(decodeQualified(decodeString))($0._1)("value");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            return $Either("Right", $3($4._1));
          }
          fail();
        }
        if ($2._1 === "Literal") {
          const $3 = ExprLit($1._1);
          const $4 = getField(decodeLiteral(decodeExpr(decAnn)))($0._1)("value");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            return $Either("Right", $3($4._1));
          }
          fail();
        }
        if ($2._1 === "Constructor") {
          const $3 = getField(decodeString)($0._1)("typeName");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeString)($0._1)("name");
            const $5 = (() => {
              if ($4.tag === "Left") {
                return getField(decodeString)($0._1)("constructorName");
              }
              if ($4.tag === "Right") {
                return $4;
              }
              fail();
            })();
            if ($5.tag === "Left") {
              return $Either("Left", $5._1);
            }
            if ($5.tag === "Right") {
              const $6 = getField(decodeArray2(decodeStringLiteral))($0._1)("fields");
              const $7 = (() => {
                if ($6.tag === "Left") {
                  return getField(decodeArray2(decodeStringLiteral))($0._1)("fieldNames");
                }
                if ($6.tag === "Right") {
                  return $6;
                }
                fail();
              })();
              if ($7.tag === "Left") {
                return $Either("Left", $7._1);
              }
              if ($7.tag === "Right") {
                return $Either("Right", $Expr("ExprConstructor", $1._1, $3._1, $5._1, $7._1));
              }
            }
          }
          fail();
        }
        if ($2._1 === "Accessor") {
          const $3 = getField(decodeExpr(decAnn))($0._1)("expression");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeStringLiteral)($0._1)("fieldName");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprAccessor", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        if ($2._1 === "ObjectUpdate") {
          const $3 = getField(decodeExpr(decAnn))($0._1)("expression");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeRecord(decodeExpr(decAnn)))($0._1)("updates");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprUpdate", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        if ($2._1 === "Abs") {
          const $3 = getField(decodeString)($0._1)("argument");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeExpr(decAnn))($0._1)("body");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprAbs", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        if ($2._1 === "App") {
          const $3 = getField(decodeExpr(decAnn))($0._1)("abstraction");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeExpr(decAnn))($0._1)("argument");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprApp", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        if ($2._1 === "Case") {
          const $3 = getField(decodeArray2(decodeExpr(decAnn)))($0._1)("caseExpressions");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeArray2(decodeCaseAlternative(decAnn)))($0._1)("caseAlternatives");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprCase", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        if ($2._1 === "Let") {
          const $3 = getField(decodeArray2(decodeBind(decAnn)))($0._1)("binds");
          if ($3.tag === "Left") {
            return $Either("Left", $3._1);
          }
          if ($3.tag === "Right") {
            const $4 = getField(decodeExpr(decAnn))($0._1)("expression");
            if ($4.tag === "Left") {
              return $Either("Left", $4._1);
            }
            if ($4.tag === "Right") {
              return $Either("Right", $Expr("ExprLet", $1._1, $3._1, $4._1));
            }
          }
          fail();
        }
        return $Either("Left", $JsonDecodeError("TypeMismatch", "Expr"));
      }
    }
  }
  fail();
};
var decodeCaseAlternative = (decAnn) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeArray2(decodeBinder(decAnn)))($0._1)("binders");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeBoolean)($0._1)("isGuarded");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        if ($2._1) {
          const $32 = getField(decodeArray2(decodeGuard(decAnn)))($0._1)("expressions");
          if ($32.tag === "Left") {
            return $Either("Left", $32._1);
          }
          if ($32.tag === "Right") {
            return $Either(
              "Right",
              $CaseAlternative($1._1, $CaseGuard("Guarded", $32._1))
            );
          }
          fail();
        }
        const $3 = getField(decodeExpr(decAnn))($0._1)("expression");
        if ($3.tag === "Left") {
          return $Either("Left", $3._1);
        }
        if ($3.tag === "Right") {
          return $Either(
            "Right",
            $CaseAlternative($1._1, $CaseGuard("Unconditional", $3._1))
          );
        }
      }
    }
  }
  fail();
};
var decodeBinding = (decAnn) => (obj) => {
  const $0 = getField(decAnn)(obj)("annotation");
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)(obj)("identifier");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeExpr(decAnn))(obj)("expression");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        return $Either("Right", $Binding($0._1, $1._1, $2._1));
      }
    }
  }
  fail();
};
var decodeBind = (decAnn) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeString)($0._1)("bindType");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      if ($1._1 === "NonRec") {
        const $2 = decodeBinding(decAnn)($0._1);
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Bind("NonRec", $2._1));
        }
        fail();
      }
      if ($1._1 === "Rec") {
        const $2 = getField(decodeArray2((a) => {
          const $22 = decodeJObject(a);
          if ($22.tag === "Left") {
            return $Either("Left", $22._1);
          }
          if ($22.tag === "Right") {
            return decodeBinding(decAnn)($22._1);
          }
          fail();
        }))($0._1)("binds");
        if ($2.tag === "Left") {
          return $Either("Left", $2._1);
        }
        if ($2.tag === "Right") {
          return $Either("Right", $Bind("Rec", $2._1));
        }
        fail();
      }
      return $Either("Left", $JsonDecodeError("TypeMismatch", "Bind"));
    }
  }
  fail();
};
var decodeModule$p = (decodeAnn$p) => (json) => {
  const $0 = decodeJObject(json);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    const $1 = getField(decodeModuleName)($0._1)("moduleName");
    if ($1.tag === "Left") {
      return $Either("Left", $1._1);
    }
    if ($1.tag === "Right") {
      const $2 = getField(decodeString)($0._1)("modulePath");
      if ($2.tag === "Left") {
        return $Either("Left", $2._1);
      }
      if ($2.tag === "Right") {
        const $3 = getField(decodeSourceSpan($2._1))($0._1)("sourceSpan");
        if ($3.tag === "Left") {
          return $Either("Left", $3._1);
        }
        if ($3.tag === "Right") {
          const $4 = getField(decodeArray2(decodeImport(decodeAnn$p($2._1))))($0._1)("imports");
          if ($4.tag === "Left") {
            return $Either("Left", $4._1);
          }
          if ($4.tag === "Right") {
            const $5 = getField(decodeArray2(decodeString))($0._1)("exports");
            if ($5.tag === "Left") {
              return $Either("Left", $5._1);
            }
            if ($5.tag === "Right") {
              const $6 = getField(decodeReExports)($0._1)("reExports");
              if ($6.tag === "Left") {
                return $Either("Left", $6._1);
              }
              if ($6.tag === "Right") {
                const $7 = getFieldOptional$p(decodeArray2(decodeDataDecl))($0._1)("dataDecls");
                if ($7.tag === "Left") {
                  return $Either("Left", $7._1);
                }
                if ($7.tag === "Right") {
                  const dataDecls = (() => {
                    if ($7._1.tag === "Nothing") {
                      return [];
                    }
                    if ($7._1.tag === "Just") {
                      return $7._1._1;
                    }
                    fail();
                  })();
                  const $8 = getFieldOptional$p(decodeArray2(decodeClassDecl))($0._1)("classDecls");
                  if ($8.tag === "Left") {
                    return $Either("Left", $8._1);
                  }
                  if ($8.tag === "Right") {
                    const classDecls = (() => {
                      if ($8._1.tag === "Nothing") {
                        return [];
                      }
                      if ($8._1.tag === "Just") {
                        return $8._1._1;
                      }
                      fail();
                    })();
                    const $9 = getField(decodeArray2(decodeBind(decodeAnn$p($2._1))))($0._1)("decls");
                    if ($9.tag === "Left") {
                      return $Either("Left", $9._1);
                    }
                    if ($9.tag === "Right") {
                      const $10 = getField(decodeArray2(decodeString))($0._1)("foreign");
                      if ($10.tag === "Left") {
                        return $Either("Left", $10._1);
                      }
                      if ($10.tag === "Right") {
                        const $11 = getFieldOptional$p(decodeJObject)($0._1)("foreignAnnotations");
                        if ($11.tag === "Left") {
                          return $Either("Left", $11._1);
                        }
                        if ($11.tag === "Right") {
                          const $12 = (() => {
                            if ($11._1.tag === "Nothing") {
                              return empty;
                            }
                            if ($11._1.tag === "Just") {
                              return $11._1._1;
                            }
                            fail();
                          })();
                          const $13 = traverse((v) => {
                            const v1 = _lookup(Nothing, Just, v, $12);
                            if (v1.tag === "Just") {
                              const $132 = decodeAnn($2._1)(v1._1);
                              if ($132.tag === "Left") {
                                return $Either("Left", $132._1);
                              }
                              if ($132.tag === "Right") {
                                return $Either("Right", $Tuple(v, $132._1.type));
                              }
                              fail();
                            }
                            if (v1.tag === "Nothing") {
                              return $Either("Right", $Tuple(v, Nothing));
                            }
                            fail();
                          })($10._1);
                          if ($13.tag === "Left") {
                            return $Either("Left", $13._1);
                          }
                          if ($13.tag === "Right") {
                            const foreignMap = fromFoldable2($13._1);
                            const $14 = getField(decodeArray2(decodeComment))($0._1)("comments");
                            if ($14.tag === "Left") {
                              return $Either("Left", $14._1);
                            }
                            if ($14.tag === "Right") {
                              return $Either(
                                "Right",
                                {
                                  name: $1._1,
                                  path: $2._1,
                                  span: $3._1,
                                  imports: $4._1,
                                  exports: $5._1,
                                  reExports: $6._1,
                                  dataDecls,
                                  classDecls,
                                  decls: $9._1,
                                  foreign: foreignMap,
                                  comments: $14._1
                                }
                              );
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  fail();
};

// output-es/Data.Lazy/foreign.js
var defer = function(thunk) {
  var v = null;
  return function() {
    if (thunk === void 0) return v;
    v = thunk();
    thunk = void 0;
    return v;
  };
};
var force = function(l) {
  return l();
};

// output-es/PureScript.Backend.Optimizer.CoreFn.Sort/index.js
var lookup2 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var runSort = /* @__PURE__ */ (() => {
  const go = (go$a0$copy) => (go$a1$copy) => (go$a2$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$a2 = go$a2$copy, go$c = true, go$r;
    while (go$c) {
      const acc = go$a0, modIndex = go$a1, v = go$a2;
      if (v.tag === "Cons" && v._1.tag === "Left") {
        go$a0 = $List("Cons", v._1._1, acc);
        go$a1 = modIndex;
        go$a2 = v._2;
        continue;
      }
      const v1 = (v2) => {
        if (v.tag === "Cons") {
          go$a0 = acc;
          go$a1 = modIndex;
          go$a2 = v._2;
          return;
        }
        if (v.tag === "Nil") {
          const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
            let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
            while (go$1$c) {
              const v$1 = go$1$a0, v12 = go$1$a1;
              if (v12.tag === "Nil") {
                go$1$c = false;
                go$1$r = v$1;
                continue;
              }
              if (v12.tag === "Cons") {
                go$1$a0 = $List("Cons", v12._1, v$1);
                go$1$a1 = v12._2;
                continue;
              }
              fail();
            }
            return go$1$r;
          };
          go$c = false;
          go$r = go$1(Nil)(acc);
          return;
        }
        fail();
      };
      if (v.tag === "Cons" && v._1.tag === "Right") {
        const $0 = lookup2(v._1._1)(modIndex);
        if ($0.tag === "Just" && !$0._1._1) {
          go$a0 = acc;
          go$a1 = insert(ordString)(v._1._1)($Tuple(true, $0._1._2))(modIndex);
          go$a2 = foldrArray((x) => Cons($Either("Right", x._2)))($List(
            "Cons",
            $Either("Left", $0._1._2),
            v._2
          ))($0._1._2.imports);
          continue;
        }
      }
      v1(true);
    }
    return go$r;
  };
  return go(Nil);
})();
var sortModules = (dictFoldable) => (init) => runSort(dictFoldable.foldr((m) => insert(ordString)(m.name)($Tuple(false, m)))(Leaf)(init))(dictFoldable.foldr((x) => Cons($Either(
  "Right",
  x.name
)))(Nil)(init));

// output-es/Data.Semigroup.Foldable/index.js
var maximum = (dictOrd) => {
  const semigroupMax = {
    append: (v) => (v1) => {
      const v$1 = dictOrd.compare(v)(v1);
      if (v$1 === "LT") {
        return v1;
      }
      if (v$1 === "EQ") {
        return v;
      }
      if (v$1 === "GT") {
        return v;
      }
      fail();
    }
  };
  return (dictFoldable1) => dictFoldable1.foldMap1(semigroupMax)(unsafeCoerce);
};

// output-es/Data.Array.NonEmpty.Internal/foreign.js
var foldr1Impl = function(f, xs) {
  var acc = xs[xs.length - 1];
  for (var i = xs.length - 2; i >= 0; i--) {
    acc = f(xs[i])(acc);
  }
  return acc;
};
var foldl1Impl = function(f, xs) {
  var acc = xs[0];
  var len = xs.length;
  for (var i = 1; i < len; i++) {
    acc = f(acc)(xs[i]);
  }
  return acc;
};

// output-es/Data.Array.NonEmpty.Internal/index.js
var foldable1NonEmptyArray = {
  foldMap1: (dictSemigroup) => {
    const append = dictSemigroup.append;
    return (f) => {
      const $0 = arrayMap(f);
      const $1 = foldable1NonEmptyArray.foldl1(append);
      return (x) => $1($0(x));
    };
  },
  foldr1: ($0) => ($1) => foldr1Impl($0, $1),
  foldl1: ($0) => ($1) => foldl1Impl($0, $1),
  Foldable0: () => foldableArray
};

// output-es/Data.Array.NonEmpty/index.js
var head = (x) => {
  if (0 < x.length) {
    return x[0];
  }
  fail();
};
var uncons2 = (x) => {
  const $0 = unconsImpl((v) => Nothing, (x$1) => (xs) => $Maybe("Just", { head: x$1, tail: xs }), x);
  if ($0.tag === "Just") {
    return $0._1;
  }
  fail();
};

// output-es/Data.HeytingAlgebra/foreign.js
var boolConj = function(b1) {
  return function(b2) {
    return b1 && b2;
  };
};
var boolDisj = function(b1) {
  return function(b2) {
    return b1 || b2;
  };
};
var boolNot = function(b) {
  return !b;
};

// output-es/Data.HeytingAlgebra/index.js
var heytingAlgebraBoolean = { ff: false, tt: true, implies: (a) => (b) => heytingAlgebraBoolean.disj(heytingAlgebraBoolean.not(a))(b), conj: boolConj, disj: boolDisj, not: boolNot };

// output-es/PureScript.Backend.Optimizer.Syntax/index.js
var $BackendAccessor = (tag, _1, _2, _3, _4, _5, _6) => ({ tag, _1, _2, _3, _4, _5, _6 });
var $BackendEffect = (tag, _1, _2) => ({ tag, _1, _2 });
var $BackendOperator = (tag, _1, _2, _3) => ({ tag, _1, _2, _3 });
var $BackendOperator1 = (tag, _1) => ({ tag, _1 });
var $BackendOperator2 = (tag, _1) => ({ tag, _1 });
var $BackendOperatorNum = (tag) => tag;
var $BackendOperatorOrd = (tag) => tag;
var $BackendSyntax = (tag, _1, _2, _3, _4, _5) => ({ tag, _1, _2, _3, _4, _5 });
var $Pair = (_1, _2) => ({ tag: "Pair", _1, _2 });
var eq7 = /* @__PURE__ */ eqArrayImpl(eqStringImpl);
var Pair = (value0) => (value1) => $Pair(value0, value1);
var OpEq = /* @__PURE__ */ $BackendOperatorOrd("OpEq");
var OpNotEq = /* @__PURE__ */ $BackendOperatorOrd("OpNotEq");
var OpGt = /* @__PURE__ */ $BackendOperatorOrd("OpGt");
var OpGte = /* @__PURE__ */ $BackendOperatorOrd("OpGte");
var OpLt = /* @__PURE__ */ $BackendOperatorOrd("OpLt");
var OpLte = /* @__PURE__ */ $BackendOperatorOrd("OpLte");
var OpAdd = /* @__PURE__ */ $BackendOperatorNum("OpAdd");
var OpDivide = /* @__PURE__ */ $BackendOperatorNum("OpDivide");
var OpMultiply = /* @__PURE__ */ $BackendOperatorNum("OpMultiply");
var OpSubtract = /* @__PURE__ */ $BackendOperatorNum("OpSubtract");
var OpArrayIndex = /* @__PURE__ */ $BackendOperator2("OpArrayIndex");
var OpBooleanAnd = /* @__PURE__ */ $BackendOperator2("OpBooleanAnd");
var OpBooleanOr = /* @__PURE__ */ $BackendOperator2("OpBooleanOr");
var OpBooleanOrd = (value0) => $BackendOperator2("OpBooleanOrd", value0);
var OpCharOrd = (value0) => $BackendOperator2("OpCharOrd", value0);
var OpIntBitAnd = /* @__PURE__ */ $BackendOperator2("OpIntBitAnd");
var OpIntBitOr = /* @__PURE__ */ $BackendOperator2("OpIntBitOr");
var OpIntBitShiftLeft = /* @__PURE__ */ $BackendOperator2("OpIntBitShiftLeft");
var OpIntBitShiftRight = /* @__PURE__ */ $BackendOperator2("OpIntBitShiftRight");
var OpIntBitXor = /* @__PURE__ */ $BackendOperator2("OpIntBitXor");
var OpIntBitZeroFillShiftRight = /* @__PURE__ */ $BackendOperator2("OpIntBitZeroFillShiftRight");
var OpIntOrd = (value0) => $BackendOperator2("OpIntOrd", value0);
var OpNumberOrd = (value0) => $BackendOperator2("OpNumberOrd", value0);
var OpStringAppend = /* @__PURE__ */ $BackendOperator2("OpStringAppend");
var OpStringOrd = (value0) => $BackendOperator2("OpStringOrd", value0);
var OpBooleanNot = /* @__PURE__ */ $BackendOperator1("OpBooleanNot");
var OpIntBitNot = /* @__PURE__ */ $BackendOperator1("OpIntBitNot");
var OpIntNegate = /* @__PURE__ */ $BackendOperator1("OpIntNegate");
var OpNumberNegate = /* @__PURE__ */ $BackendOperator1("OpNumberNegate");
var OpArrayLength = /* @__PURE__ */ $BackendOperator1("OpArrayLength");
var Op1 = (value0) => (value1) => $BackendOperator("Op1", value0, value1);
var Op2 = (value0) => (value1) => (value2) => $BackendOperator("Op2", value0, value1, value2);
var EffectRefNew = (value0) => $BackendEffect("EffectRefNew", value0);
var EffectRefRead = (value0) => $BackendEffect("EffectRefRead", value0);
var EffectRefWrite = (value0) => (value1) => $BackendEffect("EffectRefWrite", value0, value1);
var App2 = (value0) => (value1) => $BackendSyntax("App", value0, value1);
var Abs = (value0) => (value1) => $BackendSyntax("Abs", value0, value1);
var UncurriedApp = (value0) => (value1) => $BackendSyntax("UncurriedApp", value0, value1);
var UncurriedAbs = (value0) => (value1) => $BackendSyntax("UncurriedAbs", value0, value1);
var UncurriedEffectApp = (value0) => (value1) => $BackendSyntax("UncurriedEffectApp", value0, value1);
var UncurriedEffectAbs = (value0) => (value1) => $BackendSyntax("UncurriedEffectAbs", value0, value1);
var Update = (value0) => (value1) => $BackendSyntax("Update", value0, value1);
var CtorSaturated = (value0) => (value1) => (value2) => (value3) => (value4) => $BackendSyntax("CtorSaturated", value0, value1, value2, value3, value4);
var LetRec = (value0) => (value1) => (value2) => $BackendSyntax("LetRec", value0, value1, value2);
var Let = (value0) => (value1) => (value2) => (value3) => $BackendSyntax("Let", value0, value1, value2, value3);
var EffectBind = (value0) => (value1) => (value2) => (value3) => $BackendSyntax("EffectBind", value0, value1, value2, value3);
var EffectPure = (value0) => $BackendSyntax("EffectPure", value0);
var EffectDefer = (value0) => $BackendSyntax("EffectDefer", value0);
var Branch = (value0) => (value1) => $BackendSyntax("Branch", value0, value1);
var PrimOp = (value0) => $BackendSyntax("PrimOp", value0);
var PrimEffect = (value0) => $BackendSyntax("PrimEffect", value0);
var PrimUndefined = /* @__PURE__ */ $BackendSyntax("PrimUndefined");
var Typed = (value0) => (value1) => $BackendSyntax("Typed", value0, value1);
var functorPair = { map: (f) => (m) => $Pair(f(m._1), f(m._2)) };
var functorBackendOperator = {
  map: (f) => (m) => {
    if (m.tag === "Op1") {
      return $BackendOperator("Op1", m._1, f(m._2));
    }
    if (m.tag === "Op2") {
      return $BackendOperator("Op2", m._1, f(m._2), f(m._3));
    }
    fail();
  }
};
var functorBackendEffect = {
  map: (f) => (m) => {
    if (m.tag === "EffectRefNew") {
      return $BackendEffect("EffectRefNew", f(m._1));
    }
    if (m.tag === "EffectRefRead") {
      return $BackendEffect("EffectRefRead", f(m._1));
    }
    if (m.tag === "EffectRefWrite") {
      return $BackendEffect("EffectRefWrite", f(m._1), f(m._2));
    }
    fail();
  }
};
var functorBackendSyntax = {
  map: (f) => (m) => {
    if (m.tag === "Var") {
      return $BackendSyntax("Var", m._1);
    }
    if (m.tag === "Local") {
      return $BackendSyntax("Local", m._1, m._2);
    }
    if (m.tag === "Lit") {
      return $BackendSyntax("Lit", functorLiteral.map(f)(m._1));
    }
    if (m.tag === "App") {
      return $BackendSyntax("App", f(m._1), arrayMap(f)(m._2));
    }
    if (m.tag === "Abs") {
      return $BackendSyntax("Abs", m._1, f(m._2));
    }
    if (m.tag === "UncurriedApp") {
      return $BackendSyntax("UncurriedApp", f(m._1), arrayMap(f)(m._2));
    }
    if (m.tag === "UncurriedAbs") {
      return $BackendSyntax("UncurriedAbs", m._1, f(m._2));
    }
    if (m.tag === "UncurriedEffectApp") {
      return $BackendSyntax("UncurriedEffectApp", f(m._1), arrayMap(f)(m._2));
    }
    if (m.tag === "UncurriedEffectAbs") {
      return $BackendSyntax("UncurriedEffectAbs", m._1, f(m._2));
    }
    if (m.tag === "Accessor") {
      return $BackendSyntax("Accessor", f(m._1), m._2);
    }
    if (m.tag === "Update") {
      return $BackendSyntax("Update", f(m._1), arrayMap((m$1) => $Prop(m$1._1, f(m$1._2)))(m._2));
    }
    if (m.tag === "CtorSaturated") {
      return $BackendSyntax("CtorSaturated", m._1, m._2, m._3, m._4, arrayMap((m$1) => $Tuple(m$1._1, f(m$1._2)))(m._5));
    }
    if (m.tag === "CtorDef") {
      return $BackendSyntax("CtorDef", m._1, m._2, m._3, m._4);
    }
    if (m.tag === "LetRec") {
      return $BackendSyntax("LetRec", m._1, arrayMap((m$1) => $Tuple(m$1._1, f(m$1._2)))(m._2), f(m._3));
    }
    if (m.tag === "Let") {
      return $BackendSyntax("Let", m._1, m._2, f(m._3), f(m._4));
    }
    if (m.tag === "EffectBind") {
      return $BackendSyntax("EffectBind", m._1, m._2, f(m._3), f(m._4));
    }
    if (m.tag === "EffectPure") {
      return $BackendSyntax("EffectPure", f(m._1));
    }
    if (m.tag === "EffectDefer") {
      return $BackendSyntax("EffectDefer", f(m._1));
    }
    if (m.tag === "Branch") {
      return $BackendSyntax("Branch", arrayMap((m$1) => $Pair(f(m$1._1), f(m$1._2)))(m._1), f(m._2));
    }
    if (m.tag === "PrimOp") {
      return $BackendSyntax(
        "PrimOp",
        (() => {
          if (m._1.tag === "Op1") {
            return $BackendOperator("Op1", m._1._1, f(m._1._2));
          }
          if (m._1.tag === "Op2") {
            return $BackendOperator("Op2", m._1._1, f(m._1._2), f(m._1._3));
          }
          fail();
        })()
      );
    }
    if (m.tag === "PrimEffect") {
      return $BackendSyntax(
        "PrimEffect",
        (() => {
          if (m._1.tag === "EffectRefNew") {
            return $BackendEffect("EffectRefNew", f(m._1._1));
          }
          if (m._1.tag === "EffectRefRead") {
            return $BackendEffect("EffectRefRead", f(m._1._1));
          }
          if (m._1.tag === "EffectRefWrite") {
            return $BackendEffect("EffectRefWrite", f(m._1._1), f(m._1._2));
          }
          fail();
        })()
      );
    }
    if (m.tag === "PrimUndefined") {
      return PrimUndefined;
    }
    if (m.tag === "Fail") {
      return $BackendSyntax("Fail", m._1);
    }
    if (m.tag === "Typed") {
      return $BackendSyntax("Typed", m._1, f(m._2));
    }
    fail();
  }
};
var foldablePair = {
  foldl: (f) => (acc) => (v) => f(f(acc)(v._1))(v._2),
  foldr: (f) => (acc) => (v) => f(v._1)(f(v._2)(acc)),
  foldMap: (dictMonoid) => (f) => (v) => dictMonoid.Semigroup0().append(f(v._1))(f(v._2))
};
var traversablePair = {
  sequence: (dictApplicative) => (a) => traversablePair.traverse(dictApplicative)(identity3)(a),
  traverse: (dictApplicative) => {
    const Apply0 = dictApplicative.Apply0();
    return (f) => (v) => Apply0.apply(Apply0.Functor0().map(Pair)(f(v._1)))(f(v._2));
  },
  Functor0: () => functorPair,
  Foldable1: () => foldablePair
};
var foldableBackendOperator = {
  foldr: (a) => foldrDefault(foldableBackendOperator)(a),
  foldl: (a) => foldlDefault(foldableBackendOperator)(a),
  foldMap: (dictMonoid) => (f) => (v) => {
    if (v.tag === "Op1") {
      return f(v._2);
    }
    if (v.tag === "Op2") {
      return dictMonoid.Semigroup0().append(f(v._2))(f(v._3));
    }
    fail();
  }
};
var traversableBackendOperato = {
  sequence: (dictApplicative) => (a) => traversableBackendOperato.traverse(dictApplicative)(identity3)(a),
  traverse: (dictApplicative) => {
    const Apply0 = dictApplicative.Apply0();
    const $0 = Apply0.Functor0();
    return (f) => (v) => {
      if (v.tag === "Op1") {
        return $0.map(Op1(v._1))(f(v._2));
      }
      if (v.tag === "Op2") {
        return Apply0.apply($0.map(Op2(v._1))(f(v._2)))(f(v._3));
      }
      fail();
    };
  },
  Functor0: () => functorBackendOperator,
  Foldable1: () => foldableBackendOperator
};
var foldableBackendEffect = {
  foldr: (a) => foldrDefault(foldableBackendEffect)(a),
  foldl: (a) => foldlDefault(foldableBackendEffect)(a),
  foldMap: (dictMonoid) => (f) => (v) => {
    if (v.tag === "EffectRefNew") {
      return f(v._1);
    }
    if (v.tag === "EffectRefRead") {
      return f(v._1);
    }
    if (v.tag === "EffectRefWrite") {
      return dictMonoid.Semigroup0().append(f(v._1))(f(v._2));
    }
    fail();
  }
};
var foldableBackendSyntax = {
  foldr: (a) => foldrDefault(foldableBackendSyntax)(a),
  foldl: (a) => foldlDefault(foldableBackendSyntax)(a),
  foldMap: (dictMonoid) => {
    const mempty = dictMonoid.mempty;
    const foldMap72 = foldableArray.foldMap(dictMonoid);
    const $0 = dictMonoid.Semigroup0();
    const foldMap9 = foldableArray.foldMap(dictMonoid);
    return (f) => (v) => {
      if (v.tag === "Var") {
        return mempty;
      }
      if (v.tag === "Local") {
        return mempty;
      }
      if (v.tag === "Lit") {
        if (v._1.tag === "LitArray") {
          return foldMap72(f)(v._1._1);
        }
        if (v._1.tag === "LitRecord") {
          return foldMap72((v$1) => f(v$1._2))(v._1._1);
        }
        return mempty;
      }
      if (v.tag === "App") {
        return $0.append(f(v._1))(foldMap9(f)(v._2));
      }
      if (v.tag === "Abs") {
        return f(v._2);
      }
      if (v.tag === "UncurriedApp") {
        return $0.append(f(v._1))(foldMap72(f)(v._2));
      }
      if (v.tag === "UncurriedAbs") {
        return f(v._2);
      }
      if (v.tag === "UncurriedEffectApp") {
        return $0.append(f(v._1))(foldMap72(f)(v._2));
      }
      if (v.tag === "UncurriedEffectAbs") {
        return f(v._2);
      }
      if (v.tag === "Accessor") {
        return f(v._1);
      }
      if (v.tag === "Update") {
        return $0.append(f(v._1))(foldMap72((v$1) => f(v$1._2))(v._2));
      }
      if (v.tag === "LetRec") {
        return $0.append(foldMap9((v$1) => f(v$1._2))(v._2))(f(v._3));
      }
      if (v.tag === "Let") {
        return $0.append(f(v._3))(f(v._4));
      }
      if (v.tag === "EffectBind") {
        return $0.append(f(v._3))(f(v._4));
      }
      if (v.tag === "EffectPure") {
        return f(v._1);
      }
      if (v.tag === "EffectDefer") {
        return f(v._1);
      }
      if (v.tag === "Branch") {
        return $0.append(foldMap9((v$1) => dictMonoid.Semigroup0().append(f(v$1._1))(f(v$1._2)))(v._1))(f(v._2));
      }
      if (v.tag === "PrimOp") {
        if (v._1.tag === "Op1") {
          return f(v._1._2);
        }
        if (v._1.tag === "Op2") {
          return dictMonoid.Semigroup0().append(f(v._1._2))(f(v._1._3));
        }
        fail();
      }
      if (v.tag === "PrimEffect") {
        if (v._1.tag === "EffectRefNew") {
          return f(v._1._1);
        }
        if (v._1.tag === "EffectRefRead") {
          return f(v._1._1);
        }
        if (v._1.tag === "EffectRefWrite") {
          return dictMonoid.Semigroup0().append(f(v._1._1))(f(v._1._2));
        }
        fail();
      }
      if (v.tag === "PrimUndefined") {
        return mempty;
      }
      if (v.tag === "CtorSaturated") {
        return foldMap72((v$1) => f(v$1._2))(v._5);
      }
      if (v.tag === "CtorDef") {
        return mempty;
      }
      if (v.tag === "Fail") {
        return mempty;
      }
      if (v.tag === "Typed") {
        return f(v._2);
      }
      fail();
    };
  }
};
var traversableBackendEffect = {
  sequence: (dictApplicative) => (a) => traversableBackendEffect.traverse(dictApplicative)(identity3)(a),
  traverse: (dictApplicative) => {
    const Apply0 = dictApplicative.Apply0();
    const $0 = Apply0.Functor0();
    return (f) => (v) => {
      if (v.tag === "EffectRefNew") {
        return $0.map(EffectRefNew)(f(v._1));
      }
      if (v.tag === "EffectRefRead") {
        return $0.map(EffectRefRead)(f(v._1));
      }
      if (v.tag === "EffectRefWrite") {
        return Apply0.apply($0.map(EffectRefWrite)(f(v._1)))(f(v._2));
      }
      fail();
    };
  },
  Functor0: () => functorBackendEffect,
  Foldable1: () => foldableBackendEffect
};
var traversableBackendSyntax = {
  sequence: (dictApplicative) => (a) => traversableBackendSyntax.traverse(dictApplicative)(identity3)(a),
  traverse: (dictApplicative) => {
    const Apply0 = dictApplicative.Apply0();
    const $0 = Apply0.Functor0();
    const traverse7 = traversableArray.traverse(dictApplicative);
    const traverse9 = traversableArray.traverse(dictApplicative);
    const traverse11 = traversablePair.traverse(dictApplicative);
    const traverse12 = traversableBackendOperato.traverse(dictApplicative);
    const traverse13 = traversableBackendEffect.traverse(dictApplicative);
    return (f) => (v) => {
      if (v.tag === "Var") {
        return dictApplicative.pure($BackendSyntax("Var", v._1));
      }
      if (v.tag === "Local") {
        return dictApplicative.pure($BackendSyntax("Local", v._1, v._2));
      }
      if (v.tag === "Lit") {
        if (v._1.tag === "LitInt") {
          return dictApplicative.pure($BackendSyntax("Lit", $Literal("LitInt", v._1._1)));
        }
        if (v._1.tag === "LitNumber") {
          return dictApplicative.pure($BackendSyntax("Lit", $Literal("LitNumber", v._1._1)));
        }
        if (v._1.tag === "LitString") {
          return dictApplicative.pure($BackendSyntax("Lit", $Literal("LitString", v._1._1)));
        }
        if (v._1.tag === "LitChar") {
          return dictApplicative.pure($BackendSyntax("Lit", $Literal("LitChar", v._1._1)));
        }
        if (v._1.tag === "LitBoolean") {
          return dictApplicative.pure($BackendSyntax("Lit", $Literal("LitBoolean", v._1._1)));
        }
        if (v._1.tag === "LitArray") {
          return $0.map((x) => $BackendSyntax("Lit", $Literal("LitArray", x)))(traverse7(f)(v._1._1));
        }
        if (v._1.tag === "LitRecord") {
          return $0.map((x) => $BackendSyntax("Lit", $Literal("LitRecord", x)))(traverse7(traversableProp.traverse(dictApplicative)(f))(v._1._1));
        }
        fail();
      }
      if (v.tag === "App") {
        return Apply0.apply($0.map(App2)(f(v._1)))(traverse9(f)(v._2));
      }
      if (v.tag === "Abs") {
        return $0.map(Abs(v._1))(f(v._2));
      }
      if (v.tag === "UncurriedApp") {
        return Apply0.apply($0.map(UncurriedApp)(f(v._1)))(traverse7(f)(v._2));
      }
      if (v.tag === "UncurriedAbs") {
        return $0.map(UncurriedAbs(v._1))(f(v._2));
      }
      if (v.tag === "UncurriedEffectApp") {
        return Apply0.apply($0.map(UncurriedEffectApp)(f(v._1)))(traverse7(f)(v._2));
      }
      if (v.tag === "UncurriedEffectAbs") {
        return $0.map(UncurriedEffectAbs(v._1))(f(v._2));
      }
      if (v.tag === "Accessor") {
        const $1 = v._2;
        return $0.map((a) => $BackendSyntax("Accessor", a, $1))(f(v._1));
      }
      if (v.tag === "Update") {
        return Apply0.apply($0.map(Update)(f(v._1)))(traverse7(traversableProp.traverse(dictApplicative)(f))(v._2));
      }
      if (v.tag === "CtorDef") {
        return dictApplicative.pure($BackendSyntax("CtorDef", v._1, v._2, v._3, v._4));
      }
      if (v.tag === "CtorSaturated") {
        return $0.map(CtorSaturated(v._1)(v._2)(v._3)(v._4))(traverse7(traversableTuple.traverse(dictApplicative)(f))(v._5));
      }
      if (v.tag === "LetRec") {
        return Apply0.apply($0.map(LetRec(v._1))(traverse9(traversableTuple.traverse(dictApplicative)(f))(v._2)))(f(v._3));
      }
      if (v.tag === "Let") {
        return Apply0.apply($0.map(Let(v._1)(v._2))(f(v._3)))(f(v._4));
      }
      if (v.tag === "EffectBind") {
        return Apply0.apply($0.map(EffectBind(v._1)(v._2))(f(v._3)))(f(v._4));
      }
      if (v.tag === "EffectPure") {
        return $0.map(EffectPure)(f(v._1));
      }
      if (v.tag === "EffectDefer") {
        return $0.map(EffectDefer)(f(v._1));
      }
      if (v.tag === "Branch") {
        return Apply0.apply($0.map(Branch)(traverse9(traverse11(f))(v._1)))(f(v._2));
      }
      if (v.tag === "PrimOp") {
        return $0.map(PrimOp)(traverse12(f)(v._1));
      }
      if (v.tag === "PrimEffect") {
        return $0.map(PrimEffect)(traverse13(f)(v._1));
      }
      if (v.tag === "PrimUndefined") {
        return dictApplicative.pure(PrimUndefined);
      }
      if (v.tag === "Fail") {
        return dictApplicative.pure($BackendSyntax("Fail", v._1));
      }
      if (v.tag === "Typed") {
        return $0.map(Typed(v._1))(f(v._2));
      }
      fail();
    };
  },
  Functor0: () => functorBackendSyntax,
  Foldable1: () => foldableBackendSyntax
};
var eqTuple2 = { eq: (x) => (y) => (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 };
var eq10 = /* @__PURE__ */ (() => eqArrayImpl(eqTuple2.eq))();
var eq11 = /* @__PURE__ */ (() => eqArrayImpl(eqTuple2.eq))();
var eqBackendOperator2 = {
  eq: (x) => (y) => {
    if (x.tag === "OpArrayIndex") {
      return y.tag === "OpArrayIndex";
    }
    if (x.tag === "OpBooleanAnd") {
      return y.tag === "OpBooleanAnd";
    }
    if (x.tag === "OpBooleanOr") {
      return y.tag === "OpBooleanOr";
    }
    if (x.tag === "OpBooleanOrd") {
      return y.tag === "OpBooleanOrd" && (() => {
        if (x._1 === "OpEq") {
          return y._1 === "OpEq";
        }
        if (x._1 === "OpNotEq") {
          return y._1 === "OpNotEq";
        }
        if (x._1 === "OpGt") {
          return y._1 === "OpGt";
        }
        if (x._1 === "OpGte") {
          return y._1 === "OpGte";
        }
        if (x._1 === "OpLt") {
          return y._1 === "OpLt";
        }
        return x._1 === "OpLte" && y._1 === "OpLte";
      })();
    }
    if (x.tag === "OpCharOrd") {
      return y.tag === "OpCharOrd" && (() => {
        if (x._1 === "OpEq") {
          return y._1 === "OpEq";
        }
        if (x._1 === "OpNotEq") {
          return y._1 === "OpNotEq";
        }
        if (x._1 === "OpGt") {
          return y._1 === "OpGt";
        }
        if (x._1 === "OpGte") {
          return y._1 === "OpGte";
        }
        if (x._1 === "OpLt") {
          return y._1 === "OpLt";
        }
        return x._1 === "OpLte" && y._1 === "OpLte";
      })();
    }
    if (x.tag === "OpIntBitAnd") {
      return y.tag === "OpIntBitAnd";
    }
    if (x.tag === "OpIntBitOr") {
      return y.tag === "OpIntBitOr";
    }
    if (x.tag === "OpIntBitShiftLeft") {
      return y.tag === "OpIntBitShiftLeft";
    }
    if (x.tag === "OpIntBitShiftRight") {
      return y.tag === "OpIntBitShiftRight";
    }
    if (x.tag === "OpIntBitXor") {
      return y.tag === "OpIntBitXor";
    }
    if (x.tag === "OpIntBitZeroFillShiftRight") {
      return y.tag === "OpIntBitZeroFillShiftRight";
    }
    if (x.tag === "OpIntNum") {
      return y.tag === "OpIntNum" && (() => {
        if (x._1 === "OpAdd") {
          return y._1 === "OpAdd";
        }
        if (x._1 === "OpDivide") {
          return y._1 === "OpDivide";
        }
        if (x._1 === "OpMultiply") {
          return y._1 === "OpMultiply";
        }
        return x._1 === "OpSubtract" && y._1 === "OpSubtract";
      })();
    }
    if (x.tag === "OpIntOrd") {
      return y.tag === "OpIntOrd" && (() => {
        if (x._1 === "OpEq") {
          return y._1 === "OpEq";
        }
        if (x._1 === "OpNotEq") {
          return y._1 === "OpNotEq";
        }
        if (x._1 === "OpGt") {
          return y._1 === "OpGt";
        }
        if (x._1 === "OpGte") {
          return y._1 === "OpGte";
        }
        if (x._1 === "OpLt") {
          return y._1 === "OpLt";
        }
        return x._1 === "OpLte" && y._1 === "OpLte";
      })();
    }
    if (x.tag === "OpNumberNum") {
      return y.tag === "OpNumberNum" && (() => {
        if (x._1 === "OpAdd") {
          return y._1 === "OpAdd";
        }
        if (x._1 === "OpDivide") {
          return y._1 === "OpDivide";
        }
        if (x._1 === "OpMultiply") {
          return y._1 === "OpMultiply";
        }
        return x._1 === "OpSubtract" && y._1 === "OpSubtract";
      })();
    }
    if (x.tag === "OpNumberOrd") {
      return y.tag === "OpNumberOrd" && (() => {
        if (x._1 === "OpEq") {
          return y._1 === "OpEq";
        }
        if (x._1 === "OpNotEq") {
          return y._1 === "OpNotEq";
        }
        if (x._1 === "OpGt") {
          return y._1 === "OpGt";
        }
        if (x._1 === "OpGte") {
          return y._1 === "OpGte";
        }
        if (x._1 === "OpLt") {
          return y._1 === "OpLt";
        }
        return x._1 === "OpLte" && y._1 === "OpLte";
      })();
    }
    if (x.tag === "OpStringAppend") {
      return y.tag === "OpStringAppend";
    }
    return x.tag === "OpStringOrd" && y.tag === "OpStringOrd" && (() => {
      if (x._1 === "OpEq") {
        return y._1 === "OpEq";
      }
      if (x._1 === "OpNotEq") {
        return y._1 === "OpNotEq";
      }
      if (x._1 === "OpGt") {
        return y._1 === "OpGt";
      }
      if (x._1 === "OpGte") {
        return y._1 === "OpGte";
      }
      if (x._1 === "OpLt") {
        return y._1 === "OpLt";
      }
      return x._1 === "OpLte" && y._1 === "OpLte";
    })();
  }
};
var eqBackendOperator = (dictEq) => ({
  eq: (x) => (y) => {
    if (x.tag === "Op1") {
      return y.tag === "Op1" && (() => {
        if (x._1.tag === "OpBooleanNot") {
          return y._1.tag === "OpBooleanNot";
        }
        if (x._1.tag === "OpIntBitNot") {
          return y._1.tag === "OpIntBitNot";
        }
        if (x._1.tag === "OpIntNegate") {
          return y._1.tag === "OpIntNegate";
        }
        if (x._1.tag === "OpNumberNegate") {
          return y._1.tag === "OpNumberNegate";
        }
        if (x._1.tag === "OpArrayLength") {
          return y._1.tag === "OpArrayLength";
        }
        return x._1.tag === "OpIsTag" && y._1.tag === "OpIsTag" && (x._1._1._1.tag === "Nothing" ? y._1._1._1.tag === "Nothing" : x._1._1._1.tag === "Just" && y._1._1._1.tag === "Just" && x._1._1._1._1 === y._1._1._1._1) && x._1._1._2 === y._1._1._2;
      })() && dictEq.eq(x._2)(y._2);
    }
    return x.tag === "Op2" && y.tag === "Op2" && eqBackendOperator2.eq(x._1)(y._1) && dictEq.eq(x._2)(y._2) && dictEq.eq(x._3)(y._3);
  }
});
var eqBackendAccessor = {
  eq: (x) => (y) => {
    if (x.tag === "GetProp") {
      return y.tag === "GetProp" && x._1 === y._1;
    }
    if (x.tag === "GetIndex") {
      return y.tag === "GetIndex" && x._1 === y._1;
    }
    return x.tag === "GetCtorField" && y.tag === "GetCtorField" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2 && (x._2 === "ProductType" ? y._2 === "ProductType" : x._2 === "SumType" && y._2 === "SumType") && x._3 === y._3 && x._4 === y._4 && x._5 === y._5 && x._6 === y._6;
  }
};
var eqBackendSyntax = (dictEq) => {
  const $0 = eqArrayImpl(dictEq.eq);
  const eq21 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  const eq22 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  const eq23 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  const eq24 = eqArrayImpl((x) => (y) => dictEq.eq(x._1)(y._1) && dictEq.eq(x._2)(y._2));
  return {
    eq: (x) => (y) => {
      if (x.tag === "Var") {
        return y.tag === "Var" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2;
      }
      if (x.tag === "Local") {
        return y.tag === "Local" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2;
      }
      if (x.tag === "Lit") {
        return y.tag === "Lit" && eqLiteral(dictEq).eq(x._1)(y._1);
      }
      if (x.tag === "App") {
        return y.tag === "App" && dictEq.eq(x._1)(y._1) && eqArrayImpl(dictEq.eq)(x._2)(y._2);
      }
      if (x.tag === "Abs") {
        return y.tag === "Abs" && eq10(x._1)(y._1) && dictEq.eq(x._2)(y._2);
      }
      if (x.tag === "UncurriedApp") {
        return y.tag === "UncurriedApp" && dictEq.eq(x._1)(y._1) && $0(x._2)(y._2);
      }
      if (x.tag === "UncurriedAbs") {
        return y.tag === "UncurriedAbs" && eq11(x._1)(y._1) && dictEq.eq(x._2)(y._2);
      }
      if (x.tag === "UncurriedEffectApp") {
        return y.tag === "UncurriedEffectApp" && dictEq.eq(x._1)(y._1) && $0(x._2)(y._2);
      }
      if (x.tag === "UncurriedEffectAbs") {
        return y.tag === "UncurriedEffectAbs" && eq11(x._1)(y._1) && dictEq.eq(x._2)(y._2);
      }
      if (x.tag === "Accessor") {
        return y.tag === "Accessor" && dictEq.eq(x._1)(y._1) && eqBackendAccessor.eq(x._2)(y._2);
      }
      if (x.tag === "Update") {
        return y.tag === "Update" && dictEq.eq(x._1)(y._1) && eq21(x._2)(y._2);
      }
      if (x.tag === "CtorSaturated") {
        return y.tag === "CtorSaturated" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2 && (x._2 === "ProductType" ? y._2 === "ProductType" : x._2 === "SumType" && y._2 === "SumType") && x._3 === y._3 && x._4 === y._4 && eq22(x._5)(y._5);
      }
      if (x.tag === "CtorDef") {
        return y.tag === "CtorDef" && (x._1 === "ProductType" ? y._1 === "ProductType" : x._1 === "SumType" && y._1 === "SumType") && x._2 === y._2 && x._3 === y._3 && eq7(x._4)(y._4);
      }
      if (x.tag === "LetRec") {
        return y.tag === "LetRec" && x._1 === y._1 && eq23(x._2)(y._2) && dictEq.eq(x._3)(y._3);
      }
      if (x.tag === "Let") {
        return y.tag === "Let" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && dictEq.eq(x._3)(y._3) && dictEq.eq(x._4)(y._4);
      }
      if (x.tag === "EffectBind") {
        return y.tag === "EffectBind" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && dictEq.eq(x._3)(y._3) && dictEq.eq(x._4)(y._4);
      }
      if (x.tag === "EffectPure") {
        return y.tag === "EffectPure" && dictEq.eq(x._1)(y._1);
      }
      if (x.tag === "EffectDefer") {
        return y.tag === "EffectDefer" && dictEq.eq(x._1)(y._1);
      }
      if (x.tag === "Branch") {
        return y.tag === "Branch" && eq24(x._1)(y._1) && dictEq.eq(x._2)(y._2);
      }
      if (x.tag === "PrimOp") {
        return y.tag === "PrimOp" && eqBackendOperator(dictEq).eq(x._1)(y._1);
      }
      if (x.tag === "PrimEffect") {
        return y.tag === "PrimEffect" && (() => {
          if (x._1.tag === "EffectRefNew") {
            return y._1.tag === "EffectRefNew" && dictEq.eq(x._1._1)(y._1._1);
          }
          if (x._1.tag === "EffectRefRead") {
            return y._1.tag === "EffectRefRead" && dictEq.eq(x._1._1)(y._1._1);
          }
          return x._1.tag === "EffectRefWrite" && y._1.tag === "EffectRefWrite" && dictEq.eq(x._1._1)(y._1._1) && dictEq.eq(x._1._2)(y._1._2);
        })();
      }
      if (x.tag === "PrimUndefined") {
        return y.tag === "PrimUndefined";
      }
      if (x.tag === "Fail") {
        return y.tag === "Fail" && x._1 === y._1;
      }
      return x.tag === "Typed" && y.tag === "Typed" && eqExprType.eq(x._1)(y._1) && dictEq.eq(x._2)(y._2);
    }
  };
};

// output-es/PureScript.Backend.Optimizer.Analysis/index.js
var $Capture = (tag) => tag;
var $Complexity = (tag) => tag;
var $ResultTerm = (tag) => tag;
var ordQualified2 = /* @__PURE__ */ ordQualified(ordString);
var pop2 = /* @__PURE__ */ pop(ordInt);
var KnownNeutral = /* @__PURE__ */ $ResultTerm("KnownNeutral");
var Unknown = /* @__PURE__ */ $ResultTerm("Unknown");
var Trivial = /* @__PURE__ */ $Complexity("Trivial");
var Deref = /* @__PURE__ */ $Complexity("Deref");
var KnownSize = /* @__PURE__ */ $Complexity("KnownSize");
var NonTrivial = /* @__PURE__ */ $Complexity("NonTrivial");
var CaptureNone = /* @__PURE__ */ $Capture("CaptureNone");
var CaptureBranch = /* @__PURE__ */ $Capture("CaptureBranch");
var CaptureClosure = /* @__PURE__ */ $Capture("CaptureClosure");
var semigroupResultTerm = {
  append: (v) => (v1) => {
    if (v === "Unknown") {
      return Unknown;
    }
    if (v1 === "Unknown") {
      return Unknown;
    }
    return KnownNeutral;
  }
};
var monoidResultTerm = { mempty: KnownNeutral, Semigroup0: () => semigroupResultTerm };
var foldMap1 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidResultTerm))();
var semigroupUsage = {
  append: (v) => (v1) => ({
    total: v.total + v1.total | 0,
    captured: (() => {
      if (v.captured === "CaptureNone") {
        if (v1.captured === "CaptureNone") {
          return v.captured;
        }
        return v1.captured;
      }
      if (v1.captured === "CaptureNone") {
        return v.captured;
      }
      if (v.captured === "CaptureBranch") {
        if (v1.captured === "CaptureBranch") {
          return v.captured;
        }
        return v1.captured;
      }
      if (v1.captured === "CaptureBranch") {
        return v.captured;
      }
      if (v.captured === "CaptureClosure" && v1.captured === "CaptureClosure") {
        return v.captured;
      }
      fail();
    })(),
    arities: unsafeUnionWith(ordInt.compare, $$const, v.arities, v1.arities),
    call: v.call + v1.call | 0,
    access: v.access + v1.access | 0,
    case: v.case + v1.case | 0,
    update: v.update + v1.update | 0
  })
};
var monoidUsage = { mempty: { total: 0, captured: CaptureNone, arities: Leaf, call: 0, access: 0, case: 0, update: 0 }, Semigroup0: () => semigroupUsage };
var semigroupBackendAnalysis = {
  append: (v) => (v1) => ({
    usages: unsafeUnionWith(ordInt.compare, semigroupUsage.append, v.usages, v1.usages),
    size: v.size + v1.size | 0,
    complexity: (() => {
      if (v.complexity === "Trivial") {
        if (v1.complexity === "Trivial") {
          return v.complexity;
        }
        return v1.complexity;
      }
      if (v1.complexity === "Trivial") {
        return v.complexity;
      }
      if (v.complexity === "Deref") {
        if (v1.complexity === "Deref") {
          return v.complexity;
        }
        return v1.complexity;
      }
      if (v1.complexity === "Deref") {
        return v.complexity;
      }
      if (v.complexity === "KnownSize") {
        if (v1.complexity === "KnownSize") {
          return v.complexity;
        }
        return v1.complexity;
      }
      if (v1.complexity === "KnownSize") {
        return v.complexity;
      }
      if (v.complexity === "NonTrivial" && v1.complexity === "NonTrivial") {
        return v.complexity;
      }
      fail();
    })(),
    args: [],
    rewrite: v.rewrite || v1.rewrite,
    deps: unsafeUnionWith(ordQualified2.compare, $$const, v.deps, v1.deps),
    result: (() => {
      if (v.result === "Unknown") {
        return Unknown;
      }
      if (v1.result === "Unknown") {
        return Unknown;
      }
      return KnownNeutral;
    })(),
    externs: v.externs || v1.externs
  })
};
var monoidBackendAnalysis = {
  mempty: { usages: Leaf, size: 0, complexity: Trivial, args: [], rewrite: false, deps: Leaf, result: KnownNeutral, externs: false },
  Semigroup0: () => semigroupBackendAnalysis
};
var foldMap2 = /* @__PURE__ */ (() => foldableBackendSyntax.foldMap(monoidBackendAnalysis))();
var foldMap3 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidBackendAnalysis))();
var foldMap4 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidBackendAnalysis))();
var foldMap6 = (f) => (v) => semigroupBackendAnalysis.append(f(v._1))(f(v._2));
var used = (level) => ({
  ...monoidBackendAnalysis.mempty,
  usages: $$$Map(
    "Node",
    1,
    1,
    level,
    { total: 1, captured: CaptureNone, arities: Leaf, call: 0, access: 0, case: 0, update: 0 },
    Leaf,
    Leaf
  )
});
var updated = (level) => (v) => ({ ...v, usages: update(ordInt)((x) => $Maybe("Just", { ...x, update: x.update + 1 | 0 }))(level)(v.usages) });
var cased = (level) => (v) => ({ ...v, usages: update(ordInt)((x) => $Maybe("Just", { ...x, case: x.case + 1 | 0 }))(level)(v.usages) });
var callArity = (lvl) => (arity) => (v) => ({
  ...v,
  usages: update(ordInt)((x) => $Maybe(
    "Just",
    { ...x, arities: insert(ordInt)(arity)()(x.arities), call: x.call + 1 | 0 }
  ))(lvl)(v.usages)
});
var boundArg = (level) => (v) => {
  const v1 = pop2(level)(v.usages);
  if (v1.tag === "Nothing") {
    return { ...v, args: [monoidUsage.mempty, ...v.args] };
  }
  if (v1.tag === "Just") {
    return { ...v, usages: v1._1._2, args: [v1._1._1, ...v.args] };
  }
  fail();
};
var analyzeDefault = (dictHasAnalysis) => {
  const $0 = foldMap2(dictHasAnalysis.analysisOf);
  return (x) => {
    const $1 = $0(x);
    return { ...$1, size: $1.size + 1 | 0 };
  };
};
var accessed = (level) => (v) => ({ ...v, usages: update(ordInt)((x) => $Maybe("Just", { ...x, access: x.access + 1 | 0 }))(level)(v.usages) });
var analyze = (dictHasAnalysis) => {
  const analysisOf1 = dictHasAnalysis.analysisOf;
  const analyzeDefault1 = analyzeDefault(dictHasAnalysis);
  return (dictHasSyntax) => (externAnalysis) => (expr) => {
    if (expr.tag === "Var") {
      const analysis = { ...monoidBackendAnalysis.mempty, deps: insert(ordQualified2)(expr._1)()(monoidBackendAnalysis.mempty.deps), externs: true, size: 1 };
      const v = externAnalysis(expr._1)(Nothing);
      if (v.tag === "Just") {
        return { ...analysis, args: v._1.args };
      }
      if (v.tag === "Nothing") {
        return analysis;
      }
      fail();
    }
    if (expr.tag === "Local") {
      const $0 = used(expr._2);
      return { ...$0, size: $0.size + 1 | 0 };
    }
    if (expr.tag === "Let") {
      const $0 = semigroupBackendAnalysis.append(analysisOf1(expr._3))((() => {
        const $02 = analysisOf1(expr._4);
        return { ...$02, usages: $$delete(ordInt)(expr._2)($02.usages) };
      })());
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: dictHasAnalysis.analysisOf(expr._4).result,
        size: $0.size + 1 | 0
      };
    }
    if (expr.tag === "LetRec") {
      const $0 = semigroupBackendAnalysis.append(foldMap3((x) => analysisOf1(x._2))(expr._2))(analysisOf1(expr._3));
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: dictHasAnalysis.analysisOf(expr._3).result,
        size: $0.size + 1 | 0,
        usages: $$delete(ordInt)(expr._1)($0.usages)
      };
    }
    if (expr.tag === "EffectBind") {
      const $0 = semigroupBackendAnalysis.append(analysisOf1(expr._3))((() => {
        const $02 = analysisOf1(expr._4);
        return { ...$02, usages: $$delete(ordInt)(expr._2)($02.usages) };
      })());
      const go = (v) => {
        if (v.tag === "Leaf") {
          return Leaf;
        }
        if (v.tag === "Node") {
          return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
        }
        fail();
      };
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: Unknown,
        size: $0.size + 1 | 0,
        usages: go($0.usages)
      };
    }
    if (expr.tag === "EffectPure") {
      const $0 = analysisOf1(expr._1);
      return {
        ...$0,
        result: Unknown,
        size: $0.size + 1 | 0,
        usages: (() => {
          const go = (v) => {
            if (v.tag === "Leaf") {
              return Leaf;
            }
            if (v.tag === "Node") {
              return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
            }
            fail();
          };
          return go($0.usages);
        })()
      };
    }
    if (expr.tag === "EffectDefer") {
      const $0 = analysisOf1(expr._1);
      return {
        ...$0,
        result: Unknown,
        size: $0.size + 1 | 0,
        usages: (() => {
          const go = (v) => {
            if (v.tag === "Leaf") {
              return Leaf;
            }
            if (v.tag === "Node") {
              return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
            }
            fail();
          };
          return go($0.usages);
        })()
      };
    }
    if (expr.tag === "Abs") {
      const $0 = foldrArray((x) => boundArg(x._2))(analyzeDefault1(expr))(expr._1);
      const go = (v) => {
        if (v.tag === "Leaf") {
          return Leaf;
        }
        if (v.tag === "Node") {
          return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
        }
        fail();
      };
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return KnownSize;
          }
          if ($0.complexity === "Deref") {
            return KnownSize;
          }
          return $0.complexity;
        })(),
        result: KnownNeutral,
        usages: go($0.usages)
      };
    }
    if (expr.tag === "UncurriedAbs") {
      const $0 = foldrArray((x) => boundArg(x._2))(analyzeDefault1(expr))(expr._1);
      const go = (v) => {
        if (v.tag === "Leaf") {
          return Leaf;
        }
        if (v.tag === "Node") {
          return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
        }
        fail();
      };
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return KnownSize;
          }
          if ($0.complexity === "Deref") {
            return KnownSize;
          }
          return $0.complexity;
        })(),
        result: KnownNeutral,
        usages: go($0.usages)
      };
    }
    if (expr.tag === "UncurriedApp") {
      const $0 = analyzeDefault1(expr);
      const analysis = {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: Unknown
      };
      const v = dictHasSyntax.syntaxOf(expr._1);
      if (v.tag === "Just" && v._1.tag === "Local") {
        return callArity(v._1._2)(expr._2.length)(analysis);
      }
      return analysis;
    }
    if (expr.tag === "UncurriedEffectAbs") {
      const $0 = foldrArray((x) => boundArg(x._2))(analyzeDefault1(expr))(expr._1);
      const go = (v) => {
        if (v.tag === "Leaf") {
          return Leaf;
        }
        if (v.tag === "Node") {
          return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
        }
        fail();
      };
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return KnownSize;
          }
          if ($0.complexity === "Deref") {
            return KnownSize;
          }
          return $0.complexity;
        })(),
        result: KnownNeutral,
        usages: go($0.usages)
      };
    }
    if (expr.tag === "UncurriedEffectApp") {
      const $0 = analyzeDefault1(expr);
      const go = (v2) => {
        if (v2.tag === "Leaf") {
          return Leaf;
        }
        if (v2.tag === "Node") {
          return $$$Map("Node", v2._1, v2._2, v2._3, { ...v2._4, captured: CaptureClosure }, go(v2._5), go(v2._6));
        }
        fail();
      };
      const analysis = {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: Unknown,
        usages: go($0.usages)
      };
      const v = dictHasSyntax.syntaxOf(expr._1);
      if (v.tag === "Just" && v._1.tag === "Local") {
        return callArity(v._1._2)(expr._2.length)(analysis);
      }
      return analysis;
    }
    if (expr.tag === "App") {
      const $0 = analysisOf1(expr._1).args;
      const $1 = expr._2.length;
      const remainingArgs = $1 < 1 ? $0 : sliceImpl($1, $0.length, $0);
      const analysis = (() => {
        if (remainingArgs.length === 0) {
          const $2 = analyzeDefault1(expr);
          return {
            ...$2,
            complexity: (() => {
              if ($2.complexity === "Trivial") {
                return NonTrivial;
              }
              if ($2.complexity === "Deref") {
                return NonTrivial;
              }
              if ($2.complexity === "KnownSize") {
                return NonTrivial;
              }
              if ($2.complexity === "NonTrivial") {
                return $2.complexity;
              }
              fail();
            })()
          };
        }
        return analyzeDefault1(expr);
      })();
      const v1 = dictHasSyntax.syntaxOf(expr._1);
      return {
        ...v1.tag === "Just" && v1._1.tag === "Local" ? { ...callArity(v1._1._2)(expr._2.length)({ ...analysis, size: analysis.size + 1 | 0 }), result: Unknown } : { ...analysis, result: Unknown, size: analysis.size + 1 | 0 },
        args: remainingArgs
      };
    }
    if (expr.tag === "Update") {
      const $0 = analyzeDefault1(expr);
      const analysis = {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: Unknown
      };
      const v2 = dictHasSyntax.syntaxOf(expr._1);
      if (v2.tag === "Just" && v2._1.tag === "Local") {
        return updated(v2._1._2)(analysis);
      }
      return analysis;
    }
    if (expr.tag === "CtorSaturated") {
      const $0 = foldMap4((v) => analysisOf1(v._2))(expr._5);
      return { ...$0, deps: insert(ordQualified2)(expr._1)()($0.deps), result: KnownNeutral, size: $0.size + 1 | 0 };
    }
    if (expr.tag === "CtorDef") {
      const $0 = analyzeDefault1(expr);
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })()
      };
    }
    if (expr.tag === "Branch") {
      const v2 = (() => {
        if (0 < expr._1.length) {
          return expr._1[0];
        }
        fail();
      })();
      const $0 = semigroupBackendAnalysis.append(analysisOf1(v2._1))(semigroupBackendAnalysis.append((() => {
        const $02 = analysisOf1(v2._2);
        return {
          ...$02,
          usages: (() => {
            const go = (v) => {
              if (v.tag === "Leaf") {
                return Leaf;
              }
              if (v.tag === "Node") {
                return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureBranch }, go(v._5), go(v._6));
              }
              fail();
            };
            return go($02.usages);
          })()
        };
      })())(semigroupBackendAnalysis.append((() => {
        const $02 = foldMap4(foldMap6(analysisOf1))((() => {
          const $03 = unconsImpl((v) => Nothing, (v) => (xs) => $Maybe("Just", xs), expr._1);
          if ($03.tag === "Just") {
            return $03._1;
          }
          fail();
        })());
        return {
          ...$02,
          usages: (() => {
            const go = (v) => {
              if (v.tag === "Leaf") {
                return Leaf;
              }
              if (v.tag === "Node") {
                return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureBranch }, go(v._5), go(v._6));
              }
              fail();
            };
            return go($02.usages);
          })()
        };
      })())((() => {
        const $02 = analysisOf1(expr._2);
        return {
          ...$02,
          usages: (() => {
            const go = (v) => {
              if (v.tag === "Leaf") {
                return Leaf;
              }
              if (v.tag === "Node") {
                return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureBranch }, go(v._5), go(v._6));
              }
              fail();
            };
            return go($02.usages);
          })()
        };
      })())));
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: foldMap1((x) => dictHasAnalysis.analysisOf(x._2).result)(expr._1)
      };
    }
    if (expr.tag === "Fail") {
      const $0 = analyzeDefault1(expr);
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })()
      };
    }
    if (expr.tag === "PrimOp") {
      const $0 = expr._1;
      const $1 = analyzeDefault1(expr);
      const analysis = {
        ...$1,
        complexity: (() => {
          if ($1.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($1.complexity === "Deref") {
            return NonTrivial;
          }
          if ($1.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($1.complexity === "NonTrivial") {
            return $1.complexity;
          }
          fail();
        })(),
        result: Unknown
      };
      const v2 = (v3) => {
        if ($0.tag === "Op1" && $0._1.tag === "OpIsTag") {
          return { ...analysis, deps: insert(ordQualified2)($0._1._1)()(analysis.deps) };
        }
        return analysis;
      };
      if ($0.tag === "Op1" && $0._1.tag === "OpIsTag") {
        const $2 = dictHasSyntax.syntaxOf($0._2);
        if ($2.tag === "Just" && $2._1.tag === "Local") {
          return cased($2._1._2)({ ...analysis, deps: insert(ordQualified2)($0._1._1)()(analysis.deps) });
        }
      }
      return v2(true);
    }
    if (expr.tag === "PrimEffect") {
      const $0 = analyzeDefault1(expr);
      const go = (v) => {
        if (v.tag === "Leaf") {
          return Leaf;
        }
        if (v.tag === "Node") {
          return $$$Map("Node", v._1, v._2, v._3, { ...v._4, captured: CaptureClosure }, go(v._5), go(v._6));
        }
        fail();
      };
      return {
        ...$0,
        complexity: (() => {
          if ($0.complexity === "Trivial") {
            return NonTrivial;
          }
          if ($0.complexity === "Deref") {
            return NonTrivial;
          }
          if ($0.complexity === "KnownSize") {
            return NonTrivial;
          }
          if ($0.complexity === "NonTrivial") {
            return $0.complexity;
          }
          fail();
        })(),
        result: Unknown,
        usages: go($0.usages)
      };
    }
    if (expr.tag === "PrimUndefined") {
      return analyzeDefault1(expr);
    }
    if (expr.tag === "Accessor") {
      const analysis = (() => {
        if (expr._2.tag === "GetCtorField") {
          const $0 = analyzeDefault1(expr);
          return { ...$0, deps: insert(ordQualified2)(expr._2._1)()($0.deps), result: Unknown };
        }
        return { ...analyzeDefault1(expr), result: Unknown };
      })();
      const v2 = dictHasSyntax.syntaxOf(expr._1);
      if (v2.tag === "Just") {
        if (v2._1.tag === "Accessor") {
          return analysis;
        }
        if (v2._1.tag === "Local") {
          return accessed(v2._1._2)({ ...analysis, complexity: analysis.complexity === "Trivial" ? Deref : analysis.complexity });
        }
        if (v2._1.tag === "Var") {
          if (expr._2.tag === "GetProp") {
            const $0 = externAnalysis(v2._1._1)($Maybe("Just", expr._2._1));
            if ($0.tag === "Just") {
              return { ...analysis, args: $0._1.args, complexity: analysis.complexity };
            }
          }
          return { ...analysis, complexity: analysis.complexity };
        }
      }
      return { ...analysis, complexity: analysis.complexity === "Trivial" ? Deref : analysis.complexity };
    }
    if (expr.tag === "Lit") {
      const analysis = { ...analyzeDefault1(expr), result: KnownNeutral };
      if (expr._1.tag === "LitArray") {
        if (expr._1._1.length > 0) {
          return {
            ...analysis,
            complexity: (() => {
              if (analysis.complexity === "Trivial") {
                return KnownSize;
              }
              if (analysis.complexity === "Deref") {
                return KnownSize;
              }
              return analysis.complexity;
            })()
          };
        }
        return analysis;
      }
      if (expr._1.tag === "LitRecord") {
        if (expr._1._1.length > 0) {
          return {
            ...analysis,
            complexity: (() => {
              if (analysis.complexity === "Trivial") {
                return KnownSize;
              }
              if (analysis.complexity === "Deref") {
                return KnownSize;
              }
              return analysis.complexity;
            })()
          };
        }
        return analysis;
      }
      if (expr._1.tag === "LitString" && length2(expr._1._1) > 128) {
        return {
          ...analysis,
          complexity: (() => {
            if (analysis.complexity === "Trivial") {
              return KnownSize;
            }
            if (analysis.complexity === "Deref") {
              return KnownSize;
            }
            return analysis.complexity;
          })()
        };
      }
      return analysis;
    }
    if (expr.tag === "Typed") {
      return analysisOf1(expr._2);
    }
    fail();
  };
};
var analyzeEffectBlock = (dictHasAnalysis) => {
  const analyzeDefault1 = analyzeDefault(dictHasAnalysis);
  const analyze1 = analyze(dictHasAnalysis);
  return (dictHasSyntax) => {
    const analyze22 = analyze1(dictHasSyntax);
    return (externAnalysis) => (expr) => {
      if (expr.tag === "Let") {
        const $0 = semigroupBackendAnalysis.append(dictHasAnalysis.analysisOf(expr._3))((() => {
          const $02 = dictHasAnalysis.analysisOf(expr._4);
          return { ...$02, usages: $$delete(ordInt)(expr._2)($02.usages) };
        })());
        return {
          ...$0,
          complexity: (() => {
            if ($0.complexity === "Trivial") {
              return NonTrivial;
            }
            if ($0.complexity === "Deref") {
              return NonTrivial;
            }
            if ($0.complexity === "KnownSize") {
              return NonTrivial;
            }
            if ($0.complexity === "NonTrivial") {
              return $0.complexity;
            }
            fail();
          })(),
          result: dictHasAnalysis.analysisOf(expr._4).result,
          size: $0.size + 1 | 0
        };
      }
      if (expr.tag === "LetRec") {
        const $0 = semigroupBackendAnalysis.append(foldMap3((x) => dictHasAnalysis.analysisOf(x._2))(expr._2))(dictHasAnalysis.analysisOf(expr._3));
        return {
          ...$0,
          complexity: (() => {
            if ($0.complexity === "Trivial") {
              return NonTrivial;
            }
            if ($0.complexity === "Deref") {
              return NonTrivial;
            }
            if ($0.complexity === "KnownSize") {
              return NonTrivial;
            }
            if ($0.complexity === "NonTrivial") {
              return $0.complexity;
            }
            fail();
          })(),
          result: dictHasAnalysis.analysisOf(expr._3).result,
          size: $0.size + 1 | 0,
          usages: $$delete(ordInt)(expr._1)($0.usages)
        };
      }
      if (expr.tag === "EffectBind") {
        const $0 = semigroupBackendAnalysis.append(dictHasAnalysis.analysisOf(expr._3))((() => {
          const $02 = dictHasAnalysis.analysisOf(expr._4);
          return { ...$02, usages: $$delete(ordInt)(expr._2)($02.usages) };
        })());
        return {
          ...$0,
          complexity: (() => {
            if ($0.complexity === "Trivial") {
              return NonTrivial;
            }
            if ($0.complexity === "Deref") {
              return NonTrivial;
            }
            if ($0.complexity === "KnownSize") {
              return NonTrivial;
            }
            if ($0.complexity === "NonTrivial") {
              return $0.complexity;
            }
            fail();
          })(),
          result: Unknown,
          size: $0.size + 1 | 0
        };
      }
      if (expr.tag === "EffectPure") {
        const $0 = dictHasAnalysis.analysisOf(expr._1);
        return { ...$0, result: Unknown, size: $0.size + 1 | 0 };
      }
      if (expr.tag === "EffectDefer") {
        const $0 = dictHasAnalysis.analysisOf(expr._1);
        return { ...$0, result: Unknown, size: $0.size + 1 | 0 };
      }
      if (expr.tag === "UncurriedEffectApp") {
        const $0 = analyzeDefault1(expr);
        const analysis = {
          ...$0,
          complexity: (() => {
            if ($0.complexity === "Trivial") {
              return NonTrivial;
            }
            if ($0.complexity === "Deref") {
              return NonTrivial;
            }
            if ($0.complexity === "KnownSize") {
              return NonTrivial;
            }
            if ($0.complexity === "NonTrivial") {
              return $0.complexity;
            }
            fail();
          })(),
          result: Unknown
        };
        const v = dictHasSyntax.syntaxOf(expr._1);
        if (v.tag === "Just" && v._1.tag === "Local") {
          return callArity(v._1._2)(expr._2.length)(analysis);
        }
        return analysis;
      }
      if (expr.tag === "PrimEffect") {
        const $0 = analyzeDefault1(expr);
        return {
          ...$0,
          complexity: (() => {
            if ($0.complexity === "Trivial") {
              return NonTrivial;
            }
            if ($0.complexity === "Deref") {
              return NonTrivial;
            }
            if ($0.complexity === "KnownSize") {
              return NonTrivial;
            }
            if ($0.complexity === "NonTrivial") {
              return $0.complexity;
            }
            fail();
          })(),
          result: Unknown
        };
      }
      if (expr.tag === "Typed") {
        return dictHasAnalysis.analysisOf(expr._2);
      }
      return analyze22(externAnalysis)(expr);
    };
  };
};

// output-es/PureScript.Backend.Optimizer.Semantics/index.js
var $BackendExpr = (tag, _1, _2) => ({ tag, _1, _2 });
var $BackendRewrite = (tag, _1, _2, _3, _4, _5) => ({ tag, _1, _2, _3, _4, _5 });
var $BackendSemantics = (tag, _1, _2, _3, _4, _5) => ({ tag, _1, _2, _3, _4, _5 });
var $DistOp = (tag, _1, _2) => ({ tag, _1, _2 });
var $EvalRef = (tag, _1, _2) => ({ tag, _1, _2 });
var $ExternImpl = (tag, _1, _2, _3, _4, _5) => ({ tag, _1, _2, _3, _4, _5 });
var $ExternSpine = (tag, _1) => ({ tag, _1 });
var $InlineAccessor = (tag, _1) => ({ tag, _1 });
var $InlineDirective = (tag, _1) => ({ tag, _1 });
var $LocalBinding = (tag, _1) => ({ tag, _1 });
var $MkFn = (tag, _1, _2) => ({ tag, _1, _2 });
var $SemConditional = (_1, _2) => ({ tag: "SemConditional", _1, _2 });
var $UnpackOp = (tag, _1, _2, _3, _4, _5) => ({ tag, _1, _2, _3, _4, _5 });
var compare1 = /* @__PURE__ */ (() => ordQualified(ordString).compare)();
var compare22 = (x) => (y) => {
  if (x.tag === "Nothing") {
    if (y.tag === "Nothing") {
      return EQ;
    }
    return LT;
  }
  if (y.tag === "Nothing") {
    return GT;
  }
  if (x.tag === "Just" && y.tag === "Just") {
    return ordString.compare(x._1)(y._1);
  }
  fail();
};
var eq102 = /* @__PURE__ */ eqArrayImpl((x) => (y) => (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2);
var lookup3 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordInt.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var toUnfoldable = /* @__PURE__ */ (() => {
  const $0 = unfoldableArray.unfoldr((xs) => {
    if (xs.tag === "Nil") {
      return Nothing;
    }
    if (xs.tag === "Cons") {
      return $Maybe("Just", $Tuple(xs._1, xs._2));
    }
    fail();
  });
  return (x) => $0((() => {
    const go = (m$p, z$p) => {
      if (m$p.tag === "Leaf") {
        return z$p;
      }
      if (m$p.tag === "Node") {
        return go(m$p._5, $List("Cons", m$p._3, go(m$p._6, z$p)));
      }
      fail();
    };
    return go(x, Nil);
  })());
})();
var or2 = /* @__PURE__ */ or(foldableArray)(heytingAlgebraBoolean);
var and2 = /* @__PURE__ */ and(foldableArray)(heytingAlgebraBoolean);
var foldMap = /* @__PURE__ */ (() => foldableArray.foldMap(monoidBackendAnalysis))();
var foldMap12 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidBackendAnalysis))();
var power2 = /* @__PURE__ */ power(monoidBackendAnalysis);
var toUnfoldable1 = /* @__PURE__ */ (() => unfoldableArray.unfoldr((xs) => {
  if (xs.tag === "Nil") {
    return Nothing;
  }
  if (xs.tag === "Cons") {
    return $Maybe("Just", $Tuple(xs._1, xs._2));
  }
  fail();
}))();
var fromFoldable3 = /* @__PURE__ */ foldrArray(Cons)(Nil);
var eq16 = (x) => (y) => {
  if (x.tag === "Left") {
    return y.tag === "Left" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2;
  }
  return x.tag === "Right" && y.tag === "Right" && eqBackendOperator2.eq(x._1)(y._1);
};
var identity7 = (x) => x;
var lookup1 = /* @__PURE__ */ lookup(foldableArray)(eqString);
var NeutralExpr = (x) => x;
var InlineDefault = /* @__PURE__ */ $InlineDirective("InlineDefault");
var InlineNever = /* @__PURE__ */ $InlineDirective("InlineNever");
var InlineAlways = /* @__PURE__ */ $InlineDirective("InlineAlways");
var InlineRef = /* @__PURE__ */ $InlineAccessor("InlineRef");
var SemEffectPure = (value0) => $BackendSemantics("SemEffectPure", value0);
var NeutData = (value0) => (value1) => (value2) => (value3) => (value4) => $BackendSemantics("NeutData", value0, value1, value2, value3, value4);
var NeutUpdate = (value0) => (value1) => $BackendSemantics("NeutUpdate", value0, value1);
var NeutLit = (value0) => $BackendSemantics("NeutLit", value0);
var NeutUncurriedApp = (value0) => (value1) => $BackendSemantics("NeutUncurriedApp", value0, value1);
var NeutUncurriedEffectApp = (value0) => (value1) => $BackendSemantics("NeutUncurriedEffectApp", value0, value1);
var NeutPrimEffect = (value0) => $BackendSemantics("NeutPrimEffect", value0);
var NeutPrimUndefined = /* @__PURE__ */ $BackendSemantics("NeutPrimUndefined");
var hasSyntaxBackendExpr = {
  syntaxOf: /* @__PURE__ */ (() => {
    const go = (go$a0$copy) => {
      let go$a0 = go$a0$copy, go$c = true, go$r;
      while (go$c) {
        const v = go$a0;
        if (v.tag === "ExprSyntax") {
          if (v._2.tag === "Typed") {
            go$a0 = v._2._2;
            continue;
          }
          go$c = false;
          go$r = $Maybe("Just", v._2);
          continue;
        }
        go$c = false;
        go$r = Nothing;
      }
      return go$r;
    };
    return go;
  })()
};
var hasAnalysisBackendExpr = {
  analysisOf: (v) => {
    if (v.tag === "ExprSyntax") {
      return v._1;
    }
    if (v.tag === "ExprRewrite") {
      return v._1;
    }
    fail();
  }
};
var eqUnpackOp = (dictEq) => {
  const eq19 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  const eq22 = eqArrayImpl((x) => (y) => x._1 === y._1 && dictEq.eq(x._2)(y._2));
  return {
    eq: (x) => (y) => {
      if (x.tag === "UnpackRecord") {
        return y.tag === "UnpackRecord" && eq19(x._1)(y._1);
      }
      if (x.tag === "UnpackUpdate") {
        return y.tag === "UnpackUpdate" && dictEq.eq(x._1)(y._1) && eq19(x._2)(y._2);
      }
      if (x.tag === "UnpackArray") {
        return y.tag === "UnpackArray" && eqArrayImpl(dictEq.eq)(x._1)(y._1);
      }
      return x.tag === "UnpackData" && y.tag === "UnpackData" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2 && (x._2 === "ProductType" ? y._2 === "ProductType" : x._2 === "SumType" && y._2 === "SumType") && x._3 === y._3 && x._4 === y._4 && eq22(x._5)(y._5);
    }
  };
};
var eqInlineAccessor = {
  eq: (x) => (y) => {
    if (x.tag === "InlineProp") {
      return y.tag === "InlineProp" && x._1 === y._1;
    }
    if (x.tag === "InlineSpineProp") {
      return y.tag === "InlineSpineProp" && x._1 === y._1;
    }
    return x.tag === "InlineRef" && y.tag === "InlineRef";
  }
};
var ordInlineAccessor = {
  compare: (x) => (y) => {
    if (x.tag === "InlineProp") {
      if (y.tag === "InlineProp") {
        return ordString.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "InlineProp") {
      return GT;
    }
    if (x.tag === "InlineSpineProp") {
      if (y.tag === "InlineSpineProp") {
        return ordString.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "InlineSpineProp") {
      return GT;
    }
    if (x.tag === "InlineRef" && y.tag === "InlineRef") {
      return EQ;
    }
    fail();
  },
  Eq0: () => eqInlineAccessor
};
var lookup22 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordInlineAccessor.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var eqEvalRef = {
  eq: (x) => (y) => {
    if (x.tag === "EvalExtern") {
      return y.tag === "EvalExtern" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2;
    }
    return x.tag === "EvalLocal" && y.tag === "EvalLocal" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2;
  }
};
var ordEvalRef = {
  compare: (x) => (y) => {
    if (x.tag === "EvalExtern") {
      if (y.tag === "EvalExtern") {
        return compare1(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "EvalExtern") {
      return GT;
    }
    if (x.tag === "EvalLocal" && y.tag === "EvalLocal") {
      const v = compare22(x._1)(y._1);
      if (v === "LT") {
        return LT;
      }
      if (v === "GT") {
        return GT;
      }
      return ordInt.compare(x._2)(y._2);
    }
    fail();
  },
  Eq0: () => eqEvalRef
};
var alter2 = /* @__PURE__ */ alter(ordEvalRef);
var lookup32 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordEvalRef.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var eqDistOp = (dictEq) => ({
  eq: (x) => (y) => {
    if (x.tag === "DistApp") {
      return y.tag === "DistApp" && eqArrayImpl(dictEq.eq)(x._1)(y._1);
    }
    if (x.tag === "DistUncurriedApp") {
      return y.tag === "DistUncurriedApp" && eqArrayImpl(dictEq.eq)(x._1)(y._1);
    }
    if (x.tag === "DistAccessor") {
      return y.tag === "DistAccessor" && eqBackendAccessor.eq(x._1)(y._1);
    }
    if (x.tag === "DistPrimOp1") {
      return y.tag === "DistPrimOp1" && (() => {
        if (x._1.tag === "OpBooleanNot") {
          return y._1.tag === "OpBooleanNot";
        }
        if (x._1.tag === "OpIntBitNot") {
          return y._1.tag === "OpIntBitNot";
        }
        if (x._1.tag === "OpIntNegate") {
          return y._1.tag === "OpIntNegate";
        }
        if (x._1.tag === "OpNumberNegate") {
          return y._1.tag === "OpNumberNegate";
        }
        if (x._1.tag === "OpArrayLength") {
          return y._1.tag === "OpArrayLength";
        }
        return x._1.tag === "OpIsTag" && y._1.tag === "OpIsTag" && (x._1._1._1.tag === "Nothing" ? y._1._1._1.tag === "Nothing" : x._1._1._1.tag === "Just" && y._1._1._1.tag === "Just" && x._1._1._1._1 === y._1._1._1._1) && x._1._1._2 === y._1._1._2;
      })();
    }
    if (x.tag === "DistPrimOp2L") {
      return y.tag === "DistPrimOp2L" && eqBackendOperator2.eq(x._1)(y._1) && dictEq.eq(x._2)(y._2);
    }
    return x.tag === "DistPrimOp2R" && y.tag === "DistPrimOp2R" && dictEq.eq(x._1)(y._1) && eqBackendOperator2.eq(x._2)(y._2);
  }
});
var eqBackendRewrite = (dictEq) => {
  const eq21 = eqArrayImpl((x) => (y) => dictEq.eq(x._1)(y._1) && dictEq.eq(x._2)(y._2));
  return {
    eq: (x) => (y) => {
      if (x.tag === "RewriteInline") {
        return y.tag === "RewriteInline" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && dictEq.eq(x._3)(y._3) && dictEq.eq(x._4)(y._4);
      }
      if (x.tag === "RewriteUncurry") {
        return y.tag === "RewriteUncurry" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && eq102(x._3)(y._3) && dictEq.eq(x._4)(y._4) && dictEq.eq(x._5)(y._5);
      }
      if (x.tag === "RewriteStop") {
        return y.tag === "RewriteStop" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2;
      }
      if (x.tag === "RewriteUnpackOp") {
        return y.tag === "RewriteUnpackOp" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && eqUnpackOp(dictEq).eq(x._3)(y._3) && dictEq.eq(x._4)(y._4);
      }
      if (x.tag === "RewriteDistBranchesLet") {
        return y.tag === "RewriteDistBranchesLet" && (x._1.tag === "Nothing" ? y._1.tag === "Nothing" : x._1.tag === "Just" && y._1.tag === "Just" && x._1._1 === y._1._1) && x._2 === y._2 && eq21(x._3)(y._3) && dictEq.eq(x._4)(y._4) && dictEq.eq(x._5)(y._5);
      }
      return x.tag === "RewriteDistBranchesOp" && y.tag === "RewriteDistBranchesOp" && eq21(x._1)(y._1) && dictEq.eq(x._2)(y._2) && eqDistOp(dictEq).eq(x._3)(y._3);
    }
  };
};
var eqBackendExpr = {
  eq: (v) => (v1) => {
    if (v.tag === "ExprSyntax") {
      return v1.tag === "ExprSyntax" && v._1.size === v1._1.size && eqBackendSyntax(eqBackendExpr).eq(v._2)(v1._2);
    }
    return v.tag === "ExprRewrite" && v1.tag === "ExprRewrite" && v._1.size === v1._1.size && eqBackendRewrite(eqBackendExpr).eq(v._2)(v1._2);
  }
};
var unwrapSemTyped = (unwrapSemTyped$a0$copy) => {
  let unwrapSemTyped$a0 = unwrapSemTyped$a0$copy, unwrapSemTyped$c = true, unwrapSemTyped$r;
  while (unwrapSemTyped$c) {
    const v = unwrapSemTyped$a0;
    if (v.tag === "SemTyped") {
      unwrapSemTyped$a0 = v._2;
      continue;
    }
    unwrapSemTyped$c = false;
    unwrapSemTyped$r = v;
  }
  return unwrapSemTyped$r;
};
var unwrapBackendExpr = (unwrapBackendExpr$a0$copy) => {
  let unwrapBackendExpr$a0 = unwrapBackendExpr$a0$copy, unwrapBackendExpr$c = true, unwrapBackendExpr$r;
  while (unwrapBackendExpr$c) {
    const v = unwrapBackendExpr$a0;
    if (v.tag === "ExprSyntax" && v._2.tag === "Typed") {
      unwrapBackendExpr$a0 = v._2._2;
      continue;
    }
    unwrapBackendExpr$c = false;
    unwrapBackendExpr$r = v;
  }
  return unwrapBackendExpr$r;
};
var untypedExpr = (untypedExpr$a0$copy) => {
  let untypedExpr$a0 = untypedExpr$a0$copy, untypedExpr$c = true, untypedExpr$r;
  while (untypedExpr$c) {
    const v = untypedExpr$a0;
    if (v.tag === "ExprSyntax" && v._2.tag === "Typed") {
      untypedExpr$a0 = v._2._2;
      continue;
    }
    untypedExpr$c = false;
    untypedExpr$r = v;
  }
  return untypedExpr$r;
};
var snocApp = (prev) => (next) => {
  const $0 = prev.length - 1 | 0;
  if ($0 >= 0 && $0 < prev.length && prev[$0].tag === "ExternApp") {
    return snoc((() => {
      const $1 = prev.length - 1 | 0;
      if ($1 < 1) {
        return [];
      }
      return sliceImpl(0, $1, prev);
    })())($ExternSpine("ExternApp", snoc(prev[$0]._1)(next)));
  }
  return snoc(prev)($ExternSpine("ExternApp", [next]));
};
var simplifyCondIsTag = (v) => (v1) => (def) => {
  const $0 = v1._1.tag === "ExprSyntax" && v1._1._2.tag === "Typed" ? untypedExpr(v1._1._2._2) : v1._1;
  if ($0.tag === "ExprSyntax" && $0._2.tag === "PrimOp" && $0._2._1.tag === "Op1" && $0._2._1._1.tag === "OpIsTag") {
    const $1 = v1._2.tag === "ExprSyntax" && v1._2._2.tag === "Typed" ? untypedExpr(v1._2._2._2) : v1._2;
    if ($1.tag === "ExprSyntax" && $1._2.tag === "Lit" && $1._2._1.tag === "LitBoolean" && !$1._2._1._1) {
      const $2 = def.tag === "ExprSyntax" && def._2.tag === "Typed" ? untypedExpr(def._2._2) : def;
      if ($2.tag === "ExprSyntax" && $2._2.tag === "PrimOp" && $2._2._1.tag === "Op1" && $2._2._1._1.tag === "OpIsTag" && eqBackendExpr.eq($0._2._1._2)($2._2._1._2)) {
        return $Maybe("Just", def);
      }
    }
  }
  return Nothing;
};
var shouldUnpackUpdate = (ident) => (level) => (binding2) => (body) => {
  const $0 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  if (binding2.tag === "ExprSyntax" && binding2._2.tag === "Update") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just" && $1._1.total === ($1._1.access + $1._1.update | 0)) {
      return $Maybe(
        "Just",
        $BackendExpr(
          "ExprRewrite",
          {
            ...updated(level)(semigroupBackendAnalysis.append((() => {
              if (binding2._2._1.tag === "ExprSyntax") {
                return binding2._2._1._1;
              }
              if (binding2._2._1.tag === "ExprRewrite") {
                return binding2._2._1._1;
              }
              fail();
            })())(foldrArray((x) => semigroupBackendAnalysis.append((() => {
              if (x._2.tag === "ExprSyntax") {
                return x._2._1;
              }
              if (x._2.tag === "ExprRewrite") {
                return x._2._1;
              }
              fail();
            })()))({
              ...$0,
              complexity: (() => {
                if ($0.complexity === "Trivial") {
                  return NonTrivial;
                }
                if ($0.complexity === "Deref") {
                  return NonTrivial;
                }
                if ($0.complexity === "KnownSize") {
                  return NonTrivial;
                }
                if ($0.complexity === "NonTrivial") {
                  return $0.complexity;
                }
                fail();
              })(),
              usages: $$delete(ordInt)(level)($0.usages)
            })(binding2._2._2))),
            rewrite: true
          },
          $BackendRewrite("RewriteUnpackOp", ident, level, $UnpackOp("UnpackUpdate", binding2._2._1, binding2._2._2), body)
        )
      );
    }
  }
  return Nothing;
};
var shouldUnpackRecord = (ident) => (level) => (binding2) => (body) => {
  const $0 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  if (binding2.tag === "ExprSyntax" && binding2._2.tag === "Lit" && binding2._2._1.tag === "LitRecord") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just" && $1._1.total === ($1._1.access + $1._1.update | 0)) {
      return $Maybe(
        "Just",
        $BackendExpr(
          "ExprRewrite",
          {
            ...foldrArray((x) => semigroupBackendAnalysis.append((() => {
              if (x._2.tag === "ExprSyntax") {
                return x._2._1;
              }
              if (x._2.tag === "ExprRewrite") {
                return x._2._1;
              }
              fail();
            })()))({
              ...$0,
              complexity: (() => {
                if ($0.complexity === "Trivial") {
                  return NonTrivial;
                }
                if ($0.complexity === "Deref") {
                  return NonTrivial;
                }
                if ($0.complexity === "KnownSize") {
                  return NonTrivial;
                }
                if ($0.complexity === "NonTrivial") {
                  return $0.complexity;
                }
                fail();
              })(),
              usages: $$delete(ordInt)(level)($0.usages)
            })(binding2._2._1._1),
            rewrite: true
          },
          $BackendRewrite("RewriteUnpackOp", ident, level, $UnpackOp("UnpackRecord", binding2._2._1._1), body)
        )
      );
    }
  }
  return Nothing;
};
var shouldUnpackCtor = (ident) => (level) => (a) => (body) => {
  const $0 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  if (a.tag === "ExprSyntax" && a._2.tag === "CtorSaturated") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just" && $1._1.total === ($1._1.access + $1._1.case | 0)) {
      return $Maybe(
        "Just",
        $BackendExpr(
          "ExprRewrite",
          {
            ...foldrArray((x) => semigroupBackendAnalysis.append((() => {
              if (x._2.tag === "ExprSyntax") {
                return x._2._1;
              }
              if (x._2.tag === "ExprRewrite") {
                return x._2._1;
              }
              fail();
            })()))({
              ...$0,
              complexity: (() => {
                if ($0.complexity === "Trivial") {
                  return NonTrivial;
                }
                if ($0.complexity === "Deref") {
                  return NonTrivial;
                }
                if ($0.complexity === "KnownSize") {
                  return NonTrivial;
                }
                if ($0.complexity === "NonTrivial") {
                  return $0.complexity;
                }
                fail();
              })(),
              usages: $$delete(ordInt)(level)($0.usages)
            })(a._2._5),
            rewrite: true
          },
          $BackendRewrite("RewriteUnpackOp", ident, level, $UnpackOp("UnpackData", a._2._1, a._2._2, a._2._3, a._2._4, a._2._5), body)
        )
      );
    }
  }
  return Nothing;
};
var shouldUnpackArray = (ident) => (level) => (binding2) => (body) => {
  const $0 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  if (binding2.tag === "ExprSyntax" && binding2._2.tag === "Lit" && binding2._2._1.tag === "LitArray") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just" && $1._1.total === $1._1.access) {
      return $Maybe(
        "Just",
        $BackendExpr(
          "ExprRewrite",
          {
            ...foldrArray((x) => semigroupBackendAnalysis.append((() => {
              if (x.tag === "ExprSyntax") {
                return x._1;
              }
              if (x.tag === "ExprRewrite") {
                return x._1;
              }
              fail();
            })()))({
              ...$0,
              complexity: (() => {
                if ($0.complexity === "Trivial") {
                  return NonTrivial;
                }
                if ($0.complexity === "Deref") {
                  return NonTrivial;
                }
                if ($0.complexity === "KnownSize") {
                  return NonTrivial;
                }
                if ($0.complexity === "NonTrivial") {
                  return $0.complexity;
                }
                fail();
              })(),
              usages: $$delete(ordInt)(level)($0.usages)
            })(binding2._2._1._1),
            rewrite: true
          },
          $BackendRewrite("RewriteUnpackOp", ident, level, $UnpackOp("UnpackArray", binding2._2._1._1), body)
        )
      );
    }
  }
  return Nothing;
};
var shouldUncurryAbs = (ident) => (level) => (a) => (b) => {
  const $0 = (() => {
    if (b.tag === "ExprSyntax") {
      return b._1;
    }
    if (b.tag === "ExprRewrite") {
      return b._1;
    }
    fail();
  })();
  if (a.tag === "ExprSyntax" && a._2.tag === "Abs") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just") {
      const $2 = toUnfoldable($1._1.arities);
      if ($2.length === 1 && $2[0] === a._2._1.length) {
        return $Maybe(
          "Just",
          $BackendExpr(
            "ExprRewrite",
            (() => {
              const $3 = semigroupBackendAnalysis.append((() => {
                if (a.tag === "ExprSyntax") {
                  return a._1;
                }
                if (a.tag === "ExprRewrite") {
                  return a._1;
                }
                fail();
              })())((() => {
                const $32 = (() => {
                  if (b.tag === "ExprSyntax") {
                    return b._1;
                  }
                  if (b.tag === "ExprRewrite") {
                    return b._1;
                  }
                  fail();
                })();
                return { ...$32, usages: $$delete(ordInt)(level)($32.usages) };
              })());
              return {
                ...$3,
                complexity: (() => {
                  if ($3.complexity === "Trivial") {
                    return NonTrivial;
                  }
                  if ($3.complexity === "Deref") {
                    return NonTrivial;
                  }
                  if ($3.complexity === "KnownSize") {
                    return NonTrivial;
                  }
                  if ($3.complexity === "NonTrivial") {
                    return $3.complexity;
                  }
                  fail();
                })(),
                result: (() => {
                  if (b.tag === "ExprSyntax") {
                    return b._1.result;
                  }
                  if (b.tag === "ExprRewrite") {
                    return b._1.result;
                  }
                  fail();
                })(),
                rewrite: true,
                size: $3.size + 1 | 0
              };
            })(),
            $BackendRewrite("RewriteUncurry", ident, level, a._2._1, a._2._2, b)
          )
        );
      }
    }
  }
  return Nothing;
};
var shouldInlineExternLiteral = (v) => {
  if (v.tag === "LitInt") {
    return true;
  }
  if (v.tag === "LitNumber") {
    return true;
  }
  if (v.tag === "LitString") {
    return toCodePointArray(v._1).length <= 32;
  }
  if (v.tag === "LitChar") {
    return true;
  }
  if (v.tag === "LitBoolean") {
    return true;
  }
  if (v.tag === "LitArray") {
    return v._1.length === 0;
  }
  if (v.tag === "LitRecord") {
    return v._1.length === 0;
  }
  fail();
};
var shouldInlineExternAppArg = (v) => (v1) => v1.tag === "SemLam" && (v.captured === "CaptureNone" || v.captured === "CaptureBranch") && v.total > 0 && v.call === v.total;
var shouldInlineExternApp = (v) => (v1) => (v2) => (args) => {
  const delayed = v1.args.length > 0;
  return (v1.complexity === "Trivial" || v1.complexity === "Deref") && v1.size < 16 || v1.usages.tag === "Leaf" && !v1.externs && v1.size < 64 || delayed && v1.args.length <= args.length && v1.size < 16 || delayed && or2(zipWithImpl(
    shouldInlineExternAppArg,
    v1.args,
    args
  )) && v1.size < 16;
};
var shouldEtaReduce = (level1) => (binding2) => (v) => {
  if (v.tag === "ExprSyntax" && v._2.tag === "Abs" && v._2._2.tag === "ExprSyntax" && v._2._2._2.tag === "App" && v._2._2._2._1.tag === "ExprSyntax" && v._2._2._2._1._2.tag === "Local") {
    const $0 = v._2._2._2._2;
    if (level1 === v._2._2._2._1._2._2 && v._2._1.length === $0.length && and2(zipWithImpl(
      (v$1) => {
        const $1 = v$1._2;
        return (v1) => v1.tag === "ExprSyntax" && v1._2.tag === "Local" && $1 === v1._2._2;
      },
      v._2._1,
      $0
    ))) {
      return $Maybe("Just", binding2);
    }
  }
  return Nothing;
};
var shouldDistributeBranches = (ident) => (level) => (a) => (body) => {
  const $0 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  const v1 = a.tag === "ExprSyntax" && a._2.tag === "Typed" ? untypedExpr(a._2._2) : a;
  if (v1.tag === "ExprSyntax" && v1._2.tag === "Branch" && $0.size <= 128 && v1._1.result === "KnownNeutral") {
    const $1 = lookup3(level)($0.usages);
    if ($1.tag === "Just" && $1._1.total === ($1._1.access + $1._1.case | 0)) {
      return $Maybe(
        "Just",
        $BackendExpr(
          "ExprRewrite",
          {
            ...semigroupBackendAnalysis.append((() => {
              if (a.tag === "ExprSyntax") {
                return a._1;
              }
              if (a.tag === "ExprRewrite") {
                return a._1;
              }
              fail();
            })())((() => {
              const $2 = (() => {
                if (body.tag === "ExprSyntax") {
                  return body._1;
                }
                if (body.tag === "ExprRewrite") {
                  return body._1;
                }
                fail();
              })();
              return { ...$2, usages: $$delete(ordInt)(level)($2.usages) };
            })()),
            rewrite: true
          },
          $BackendRewrite("RewriteDistBranchesLet", ident, level, v1._2._1, v1._2._2, body)
        )
      );
    }
  }
  return Nothing;
};
var shouldDistributeBranchUncurriedApps = (analysis1) => (branches) => (def) => (spine) => {
  if (allImpl(
    (x) => {
      const $0 = (() => {
        if (x.tag === "ExprSyntax") {
          return x._1;
        }
        if (x.tag === "ExprRewrite") {
          return x._1;
        }
        fail();
      })();
      return $0.complexity === "Trivial" || $0.complexity === "Deref";
    },
    spine
  )) {
    return $Maybe(
      "Just",
      $BackendExpr(
        "ExprRewrite",
        { ...semigroupBackendAnalysis.append(analysis1)(foldMap(hasAnalysisBackendExpr.analysisOf)(spine)), rewrite: true },
        $BackendRewrite("RewriteDistBranchesOp", branches, def, $DistOp("DistUncurriedApp", spine))
      )
    );
  }
  return Nothing;
};
var shouldDistributeBranchPrimOp2R = (analysis1) => (branches) => (def) => (lhs) => (op2) => {
  if ((() => {
    const $0 = (() => {
      if (lhs.tag === "ExprSyntax") {
        return lhs._1.complexity;
      }
      if (lhs.tag === "ExprRewrite") {
        return lhs._1.complexity;
      }
      fail();
    })();
    return $0 === "Trivial" || $0 === "Deref";
  })()) {
    return $Maybe(
      "Just",
      $BackendExpr(
        "ExprRewrite",
        (() => {
          const $0 = semigroupBackendAnalysis.append(analysis1)((() => {
            if (lhs.tag === "ExprSyntax") {
              return lhs._1;
            }
            if (lhs.tag === "ExprRewrite") {
              return lhs._1;
            }
            fail();
          })());
          return { ...$0, rewrite: true, size: $0.size + 1 | 0 };
        })(),
        $BackendRewrite("RewriteDistBranchesOp", branches, def, $DistOp("DistPrimOp2R", lhs, op2))
      )
    );
  }
  return Nothing;
};
var shouldDistributeBranchPrimOp2L = (analysis1) => (branches) => (def) => (op2) => (rhs) => {
  if ((() => {
    const $0 = (() => {
      if (rhs.tag === "ExprSyntax") {
        return rhs._1.complexity;
      }
      if (rhs.tag === "ExprRewrite") {
        return rhs._1.complexity;
      }
      fail();
    })();
    return $0 === "Trivial" || $0 === "Deref";
  })()) {
    return $Maybe(
      "Just",
      $BackendExpr(
        "ExprRewrite",
        (() => {
          const $0 = semigroupBackendAnalysis.append(analysis1)((() => {
            if (rhs.tag === "ExprSyntax") {
              return rhs._1;
            }
            if (rhs.tag === "ExprRewrite") {
              return rhs._1;
            }
            fail();
          })());
          return { ...$0, rewrite: true, size: $0.size + 1 | 0 };
        })(),
        $BackendRewrite("RewriteDistBranchesOp", branches, def, $DistOp("DistPrimOp2L", op2, rhs))
      )
    );
  }
  return Nothing;
};
var shouldDistributeBranchApps = (analysis1) => (branches) => (def) => (spine) => {
  if (allImpl(
    (x) => {
      const $0 = (() => {
        if (x.tag === "ExprSyntax") {
          return x._1;
        }
        if (x.tag === "ExprRewrite") {
          return x._1;
        }
        fail();
      })();
      return $0.complexity === "Trivial" || $0.complexity === "Deref";
    },
    spine
  )) {
    return $Maybe(
      "Just",
      $BackendExpr(
        "ExprRewrite",
        { ...semigroupBackendAnalysis.append(analysis1)(foldMap12(hasAnalysisBackendExpr.analysisOf)(spine)), rewrite: true },
        $BackendRewrite("RewriteDistBranchesOp", branches, def, $DistOp("DistApp", spine))
      )
    );
  }
  return Nothing;
};
var rewriteInline = (ident) => (level) => (binding2) => (body) => {
  const s2 = (() => {
    if (body.tag === "ExprSyntax") {
      return body._1;
    }
    if (body.tag === "ExprRewrite") {
      return body._1;
    }
    fail();
  })();
  return $BackendExpr(
    "ExprRewrite",
    (() => {
      const v = lookup3(level)(s2.usages);
      const $0 = (() => {
        if (v.tag === "Just") {
          return semigroupBackendAnalysis.append(s2)(power2((() => {
            if (binding2.tag === "ExprSyntax") {
              return binding2._1;
            }
            if (binding2.tag === "ExprRewrite") {
              return binding2._1;
            }
            fail();
          })())(v._1.total));
        }
        if (v.tag === "Nothing") {
          return s2;
        }
        fail();
      })();
      return { ...$0, rewrite: true, usages: $$delete(ordInt)(level)($0.usages) };
    })(),
    $BackendRewrite("RewriteInline", ident, level, binding2, body)
  );
};
var rewriteBranches = (k) => {
  const go = (v) => {
    if (v.tag === "SemLet") {
      return $BackendSemantics("SemLet", v._1, v._2, (x) => go(v._3(x)));
    }
    if (v.tag === "SemLetRec") {
      return $BackendSemantics("SemLetRec", v._1, (x) => go(v._2(x)));
    }
    if (v.tag === "SemBranch") {
      const $0 = v._2;
      return $BackendSemantics(
        "SemBranch",
        arrayMap((v1) => {
          const $1 = v1._2;
          return $SemConditional(v1._1, defer((v$1) => go(force($1))));
        })(v._1),
        defer((v$1) => go(force($0)))
      );
    }
    return k(v);
  };
  return go;
};
var neutralSpine = /* @__PURE__ */ foldlArray((hd) => (v) => {
  if (v.tag === "ExternApp") {
    return $BackendSemantics("NeutApp", hd, v._1);
  }
  if (v.tag === "ExternUncurriedApp") {
    return $BackendSemantics("NeutUncurriedApp", hd, v._1);
  }
  if (v.tag === "ExternAccessor") {
    return $BackendSemantics("NeutAccessor", hd, v._1);
  }
  if (v.tag === "ExternPrimOp") {
    return $BackendSemantics("NeutPrimOp", $BackendOperator("Op1", v._1, hd));
  }
  fail();
});
var isSimplePredicate = (e) => {
  const v = e.tag === "ExprSyntax" && e._2.tag === "Typed" ? untypedExpr(e._2._2) : e;
  return v.tag === "ExprSyntax" && (v._2.tag === "Lit" || v._2.tag === "Var" || v._2.tag === "Local" || v._2.tag === "PrimOp");
};
var shouldInlineLet = (level) => (a) => (b) => {
  const $0 = (() => {
    if (a.tag === "ExprSyntax") {
      return a._1;
    }
    if (a.tag === "ExprRewrite") {
      return a._1;
    }
    fail();
  })();
  const v2 = lookup3(level)((() => {
    if (b.tag === "ExprSyntax") {
      return b._1.usages;
    }
    if (b.tag === "ExprRewrite") {
      return b._1.usages;
    }
    fail();
  })());
  if (v2.tag === "Nothing") {
    return true;
  }
  if (v2.tag === "Just") {
    return $0.complexity === "Trivial" || v2._1.captured === "CaptureNone" && v2._1.total === 1 || (v2._1.captured === "CaptureNone" || v2._1.captured === "CaptureBranch") && ($0.complexity === "Trivial" || $0.complexity === "Deref") && $0.size < 5 || $0.complexity === "Deref" && v2._1.call === v2._1.total || (() => {
      const go = (go$a0$copy) => {
        let go$a0 = go$a0$copy, go$c = true, go$r;
        while (go$c) {
          const v = go$a0;
          if (v.tag === "ExprSyntax") {
            if (v._2.tag === "Typed") {
              go$a0 = v._2._2;
              continue;
            }
            go$c = false;
            go$r = $Maybe("Just", v._2);
            continue;
          }
          go$c = false;
          go$r = Nothing;
        }
        return go$r;
      };
      const $1 = go(a);
      return $0.complexity === "KnownSize" && v2._1.total === 1 || (() => {
        const go$1 = (go$1$a0$copy) => {
          let go$1$a0 = go$1$a0$copy, go$1$c = true, go$1$r;
          while (go$1$c) {
            const v = go$1$a0;
            if (v.tag === "ExprSyntax") {
              if (v._2.tag === "Typed") {
                go$1$a0 = v._2._2;
                continue;
              }
              go$1$c = false;
              go$1$r = $Maybe("Just", v._2);
              continue;
            }
            go$1$c = false;
            go$1$r = Nothing;
          }
          return go$1$r;
        };
        const $2 = go$1(a);
        return $1.tag === "Just" && ($1._1.tag === "Abs" || $1._1.tag === "UncurriedAbs" || $1._1.tag === "UncurriedEffectAbs" || $1._1.tag === "EffectDefer") && (v2._1.total === 1 || $0.usages.tag === "Leaf" || $0.size < 16) || $2.tag === "Just" && ($2._1.tag === "PrimEffect" || $2._1.tag === "UncurriedEffectApp" || $2._1.tag === "EffectBind" || $2._1.tag === "EffectDefer") && v2._1.total === 1;
      })();
    })();
  }
  fail();
};
var insertDirective = (ref) => (acc) => (dir) => alter2((v) => {
  if (v.tag === "Just") {
    return $Maybe("Just", insert(ordInlineAccessor)(acc)(dir)(v._1));
  }
  if (v.tag === "Nothing") {
    return $Maybe("Just", $$$Map("Node", 1, 1, acc, dir, Leaf, Leaf));
  }
  fail();
})(ref);
var guardFailOver1 = (f) => (as) => (k) => {
  const v = foldlArray((v2) => (v1) => {
    if (v2.tag === "Nothing") {
      const $0 = f(v1);
      if ($0.tag === "NeutFail") {
        return $Maybe("Just", $0);
      }
      return Nothing;
    }
    return v2;
  })(Nothing)(as);
  if (v.tag === "Just") {
    return v._1;
  }
  if (v.tag === "Nothing") {
    return k(as);
  }
  fail();
};
var guardFailOver2 = (f) => (as) => (k) => {
  const v = foldlDefault(foldableBackendEffect)((v2) => (v1) => {
    if (v2.tag === "Nothing") {
      const $0 = f(v1);
      if ($0.tag === "NeutFail") {
        return $Maybe("Just", $0);
      }
      return Nothing;
    }
    return v2;
  })(Nothing)(as);
  if (v.tag === "Just") {
    return v._1;
  }
  if (v.tag === "Nothing") {
    return k(as);
  }
  fail();
};
var guardFailOver3 = (f) => (as) => (k) => {
  const v = foldlDefault(foldableLiteral)((v2) => (v1) => {
    if (v2.tag === "Nothing") {
      const $0 = f(v1);
      if ($0.tag === "NeutFail") {
        return $Maybe("Just", $0);
      }
      return Nothing;
    }
    return v2;
  })(Nothing)(as);
  if (v.tag === "Just") {
    return v._1;
  }
  if (v.tag === "Nothing") {
    return k(as);
  }
  fail();
};
var foldBackendExpr = (foldSyntax) => (foldRewrite) => {
  const go = (v) => {
    if (v.tag === "ExprSyntax") {
      return foldSyntax(functorBackendSyntax.map(go)(v._2));
    }
    if (v.tag === "ExprRewrite") {
      return foldRewrite(v._2)((() => {
        if (v._2.tag === "RewriteInline") {
          return foldSyntax($BackendSyntax("Let", v._2._1, v._2._2, go(v._2._3), go(v._2._4)));
        }
        if (v._2.tag === "RewriteUncurry") {
          return foldSyntax($BackendSyntax(
            "Let",
            v._2._1,
            v._2._2,
            foldSyntax($BackendSyntax("Abs", v._2._3, go(v._2._4))),
            go(v._2._5)
          ));
        }
        if (v._2.tag === "RewriteStop") {
          return foldSyntax($BackendSyntax("Var", v._2._1));
        }
        if (v._2.tag === "RewriteUnpackOp") {
          if (v._2._3.tag === "UnpackRecord") {
            return foldSyntax($BackendSyntax(
              "Let",
              v._2._1,
              v._2._2,
              foldSyntax($BackendSyntax(
                "Lit",
                $Literal("LitRecord", arrayMap((m) => $Prop(m._1, go(m._2)))(v._2._3._1))
              )),
              go(v._2._4)
            ));
          }
          if (v._2._3.tag === "UnpackUpdate") {
            return foldSyntax($BackendSyntax(
              "Let",
              v._2._1,
              v._2._2,
              foldSyntax($BackendSyntax(
                "Update",
                go(v._2._3._1),
                arrayMap((m) => $Prop(m._1, go(m._2)))(v._2._3._2)
              )),
              go(v._2._4)
            ));
          }
          if (v._2._3.tag === "UnpackArray") {
            return foldSyntax($BackendSyntax(
              "Let",
              v._2._1,
              v._2._2,
              foldSyntax($BackendSyntax(
                "Lit",
                $Literal("LitArray", arrayMap(go)(v._2._3._1))
              )),
              go(v._2._4)
            ));
          }
          if (v._2._3.tag === "UnpackData") {
            return foldSyntax($BackendSyntax(
              "Let",
              v._2._1,
              v._2._2,
              foldSyntax($BackendSyntax(
                "CtorSaturated",
                v._2._3._1,
                v._2._3._2,
                v._2._3._3,
                v._2._3._4,
                arrayMap((m) => $Tuple(m._1, go(m._2)))(v._2._3._5)
              )),
              go(v._2._4)
            ));
          }
          fail();
        }
        if (v._2.tag === "RewriteDistBranchesLet") {
          return foldSyntax($BackendSyntax(
            "Let",
            v._2._1,
            v._2._2,
            foldSyntax($BackendSyntax(
              "Branch",
              arrayMap((m) => $Pair(go(m._1), go(m._2)))(v._2._3),
              go(v._2._4)
            )),
            go(v._2._5)
          ));
        }
        if (v._2.tag === "RewriteDistBranchesOp") {
          const branches$p = foldSyntax($BackendSyntax(
            "Branch",
            arrayMap((m) => $Pair(go(m._1), go(m._2)))(v._2._1),
            go(v._2._2)
          ));
          if (v._2._3.tag === "DistApp") {
            return foldSyntax($BackendSyntax("App", branches$p, arrayMap(go)(v._2._3._1)));
          }
          if (v._2._3.tag === "DistUncurriedApp") {
            return foldSyntax($BackendSyntax("UncurriedApp", branches$p, arrayMap(go)(v._2._3._1)));
          }
          if (v._2._3.tag === "DistAccessor") {
            return foldSyntax($BackendSyntax("Accessor", branches$p, v._2._3._1));
          }
          if (v._2._3.tag === "DistPrimOp1") {
            return foldSyntax($BackendSyntax(
              "PrimOp",
              $BackendOperator("Op1", v._2._3._1, branches$p)
            ));
          }
          if (v._2._3.tag === "DistPrimOp2L") {
            return foldSyntax($BackendSyntax(
              "PrimOp",
              $BackendOperator("Op2", v._2._3._1, branches$p, go(v._2._3._2))
            ));
          }
          if (v._2._3.tag === "DistPrimOp2R") {
            return foldSyntax($BackendSyntax(
              "PrimOp",
              $BackendOperator("Op2", v._2._3._2, go(v._2._3._1), branches$p)
            ));
          }
        }
        fail();
      })());
    }
    fail();
  };
  return go;
};
var freeze = (init) => $Tuple(
  (() => {
    if (init.tag === "ExprSyntax") {
      return init._1;
    }
    if (init.tag === "ExprRewrite") {
      return init._1;
    }
    fail();
  })(),
  foldBackendExpr(NeutralExpr)((v) => (neutExpr) => neutExpr)(init)
);
var floatLetWith$lazy = /* @__PURE__ */ binding(() => {
  const go = (go$a0$copy) => (go$a1$copy) => (go$a2$copy) => (go$a3$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$a2 = go$a2$copy, go$a3 = go$a3$copy, go$c = true, go$r;
    while (go$c) {
      const f = go$a0, ident1 = go$a1, binding1 = go$a2, k1 = go$a3;
      if (binding1.tag === "SemLet") {
        go$a0 = makeLet$lazy();
        go$a1 = binding1._1;
        go$a2 = binding1._2;
        go$a3 = (nextBinding2) => f(ident1)(binding1._3(nextBinding2))(k1);
        continue;
      }
      if (binding1.tag === "SemLetRec") {
        go$c = false;
        go$r = $BackendSemantics("SemLetRec", binding1._1, (nextBindings) => makeLet$lazy()(ident1)(binding1._2(nextBindings))(k1));
        continue;
      }
      if (binding1.tag === "NeutFail") {
        go$c = false;
        go$r = binding1;
        continue;
      }
      go$c = false;
      go$r = f(ident1)(binding1)(k1);
    }
    return go$r;
  };
  return go;
});
var makeLet$lazy = /* @__PURE__ */ binding(() => floatLetWith$lazy()((ident) => (binding2) => (k) => {
  if (binding2.tag === "SemRef") {
    if (binding2._2.length === 0) {
      return k(binding2);
    }
    return $BackendSemantics("SemLet", ident, binding2, k);
  }
  if (binding2.tag === "NeutLocal") {
    return k(binding2);
  }
  if (binding2.tag === "NeutStop") {
    return k(binding2);
  }
  if (binding2.tag === "NeutVar") {
    return k(binding2);
  }
  if (binding2.tag === "NeutLit") {
    return k(binding2);
  }
  if (binding2.tag === "NeutData") {
    return k(binding2);
  }
  return $BackendSemantics("SemLet", ident, binding2, k);
}));
var floatLetWith = /* @__PURE__ */ floatLetWith$lazy();
var makeLet = /* @__PURE__ */ makeLet$lazy();
var floatLet = /* @__PURE__ */ floatLetWith((v) => applyFlipped)(Nothing);
var makeEffectBind$lazy = /* @__PURE__ */ binding(() => {
  const go = (go$a0$copy) => (go$a1$copy) => (go$a2$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$a2 = go$a2$copy, go$c = true, go$r;
    while (go$c) {
      const ident1 = go$a0, binding1 = go$a1, k1 = go$a2;
      if (binding1.tag === "SemLet") {
        go$c = false;
        go$r = makeLet(binding1._1)(binding1._2)((nextBinding2) => makeEffectBind$lazy()(ident1)(binding1._3(nextBinding2))(k1));
        continue;
      }
      if (binding1.tag === "SemEffectBind") {
        go$a0 = binding1._1;
        go$a1 = binding1._2;
        go$a2 = (nextBinding2) => makeEffectBind$lazy()(ident1)(binding1._3(nextBinding2))(k1);
        continue;
      }
      if (binding1.tag === "SemEffectDefer") {
        go$c = false;
        go$r = $BackendSemantics("SemEffectDefer", floatLet(binding1._1)((nextBinding2) => makeEffectBind$lazy()(ident1)(nextBinding2)(k1)));
        continue;
      }
      go$c = false;
      go$r = floatLet(binding1)((nextBinding2) => $BackendSemantics("SemEffectBind", ident1, nextBinding2, k1));
    }
    return go$r;
  };
  return go;
});
var makeEffectBind = /* @__PURE__ */ makeEffectBind$lazy();
var evalUpdate = (lhs) => (props) => floatLet(lhs)((v) => {
  if (v.tag === "SemTyped") {
    return evalUpdate(v._2)(props);
  }
  if (v.tag === "NeutLit") {
    if (v._1.tag === "LitRecord") {
      return $BackendSemantics(
        "NeutLit",
        $Literal(
          "LitRecord",
          arrayMap(head)(groupAllBy((x) => (y) => ordString.compare(x._1)(y._1))([...props, ...v._1._1]))
        )
      );
    }
    return $BackendSemantics("NeutUpdate", v, props);
  }
  if (v.tag === "NeutUpdate") {
    return $BackendSemantics(
      "NeutUpdate",
      v._1,
      arrayMap(head)(groupAllBy((x) => (y) => ordString.compare(x._1)(y._1))([...props, ...v._2]))
    );
  }
  return $BackendSemantics("NeutUpdate", v, props);
});
var evalUncurriedBeta = (fn) => (mk) => (spine) => {
  const go = (v) => (v1) => {
    if (v.tag === "MkFnNext") {
      if (v1.tag === "Cons") {
        if (v1._1.tag === "NeutFail") {
          return $BackendSemantics("NeutFail", v1._1._1);
        }
        const $0 = v1._2;
        return makeLet(Nothing)(v1._1)((nextArg) => go(v._2(nextArg))($0));
      }
      return _crashWith("Uncurried function applied to too few arguments");
    }
    if (v.tag === "MkFnApplied") {
      if (v1.tag === "Nil") {
        return v._1;
      }
      return fn(v._1)(toUnfoldable1(v1));
    }
    fail();
  };
  return go(mk)(fromFoldable3(spine));
};
var evalPrimOpOrd = (dictOrd) => {
  const Eq0 = dictOrd.Eq0();
  return (op) => (x) => (y) => {
    if (op === "OpEq") {
      return Eq0.eq(x)(y);
    }
    if (op === "OpNotEq") {
      return !Eq0.eq(x)(y);
    }
    if (op === "OpGt") {
      return dictOrd.compare(x)(y) === "GT";
    }
    if (op === "OpGte") {
      return dictOrd.compare(x)(y) !== "LT";
    }
    if (op === "OpLt") {
      return dictOrd.compare(x)(y) === "LT";
    }
    if (op === "OpLte") {
      return dictOrd.compare(x)(y) !== "GT";
    }
    fail();
  };
};
var evalPrimOpOrd1 = /* @__PURE__ */ evalPrimOpOrd(ordString);
var evalPrimOpOrd2 = /* @__PURE__ */ evalPrimOpOrd(ordInt);
var evalPrimOpOrd3 = /* @__PURE__ */ evalPrimOpOrd(ordChar);
var evalPrimOpOrd4 = /* @__PURE__ */ evalPrimOpOrd(ordBoolean);
var evalPrimOpNot = (v) => {
  if (v.tag === "Op1") {
    if (v._1.tag === "OpBooleanNot") {
      return v._2;
    }
    return $BackendSemantics(
      "NeutPrimOp",
      $BackendOperator(
        "Op1",
        OpBooleanNot,
        $BackendSemantics("NeutPrimOp", $BackendOperator("Op1", v._1, v._2))
      )
    );
  }
  if (v.tag === "Op2") {
    if (v._1.tag === "OpIntOrd") {
      return $BackendSemantics(
        "NeutPrimOp",
        $BackendOperator(
          "Op2",
          $BackendOperator2(
            "OpIntOrd",
            (() => {
              if (v._1._1 === "OpEq") {
                return OpNotEq;
              }
              if (v._1._1 === "OpNotEq") {
                return OpEq;
              }
              if (v._1._1 === "OpLt") {
                return OpGte;
              }
              if (v._1._1 === "OpLte") {
                return OpGt;
              }
              if (v._1._1 === "OpGt") {
                return OpLte;
              }
              if (v._1._1 === "OpGte") {
                return OpLt;
              }
              fail();
            })()
          ),
          v._2,
          v._3
        )
      );
    }
    if (v._1.tag === "OpNumberOrd") {
      return $BackendSemantics(
        "NeutPrimOp",
        $BackendOperator(
          "Op2",
          $BackendOperator2(
            "OpNumberOrd",
            (() => {
              if (v._1._1 === "OpEq") {
                return OpNotEq;
              }
              if (v._1._1 === "OpNotEq") {
                return OpEq;
              }
              if (v._1._1 === "OpLt") {
                return OpGte;
              }
              if (v._1._1 === "OpLte") {
                return OpGt;
              }
              if (v._1._1 === "OpGt") {
                return OpLte;
              }
              if (v._1._1 === "OpGte") {
                return OpLt;
              }
              fail();
            })()
          ),
          v._2,
          v._3
        )
      );
    }
    if (v._1.tag === "OpStringOrd") {
      return $BackendSemantics(
        "NeutPrimOp",
        $BackendOperator(
          "Op2",
          $BackendOperator2(
            "OpStringOrd",
            (() => {
              if (v._1._1 === "OpEq") {
                return OpNotEq;
              }
              if (v._1._1 === "OpNotEq") {
                return OpEq;
              }
              if (v._1._1 === "OpLt") {
                return OpGte;
              }
              if (v._1._1 === "OpLte") {
                return OpGt;
              }
              if (v._1._1 === "OpGt") {
                return OpLte;
              }
              if (v._1._1 === "OpGte") {
                return OpLt;
              }
              fail();
            })()
          ),
          v._2,
          v._3
        )
      );
    }
    if (v._1.tag === "OpCharOrd") {
      return $BackendSemantics(
        "NeutPrimOp",
        $BackendOperator(
          "Op2",
          $BackendOperator2(
            "OpCharOrd",
            (() => {
              if (v._1._1 === "OpEq") {
                return OpNotEq;
              }
              if (v._1._1 === "OpNotEq") {
                return OpEq;
              }
              if (v._1._1 === "OpLt") {
                return OpGte;
              }
              if (v._1._1 === "OpLte") {
                return OpGt;
              }
              if (v._1._1 === "OpGt") {
                return OpLte;
              }
              if (v._1._1 === "OpGte") {
                return OpLt;
              }
              fail();
            })()
          ),
          v._2,
          v._3
        )
      );
    }
    if (v._1.tag === "OpBooleanOrd") {
      return $BackendSemantics(
        "NeutPrimOp",
        $BackendOperator(
          "Op2",
          $BackendOperator2(
            "OpBooleanOrd",
            (() => {
              if (v._1._1 === "OpEq") {
                return OpNotEq;
              }
              if (v._1._1 === "OpNotEq") {
                return OpEq;
              }
              if (v._1._1 === "OpLt") {
                return OpGte;
              }
              if (v._1._1 === "OpLte") {
                return OpGt;
              }
              if (v._1._1 === "OpGt") {
                return OpLte;
              }
              if (v._1._1 === "OpGte") {
                return OpLt;
              }
              fail();
            })()
          ),
          v._2,
          v._3
        )
      );
    }
    return $BackendSemantics(
      "NeutPrimOp",
      $BackendOperator(
        "Op1",
        OpBooleanNot,
        $BackendSemantics("NeutPrimOp", $BackendOperator("Op2", v._1, v._2, v._3))
      )
    );
  }
  fail();
};
var evalPair = (dictEval) => (env) => (v) => {
  const $0 = v._1;
  const $1 = v._2;
  return $SemConditional(defer((v1) => dictEval.eval(env)($0)), defer((v1) => dictEval.eval(env)($1)));
};
var deref = (deref$a0$copy) => {
  let deref$a0 = deref$a0$copy, deref$c = true, deref$r;
  while (deref$c) {
    const v = deref$a0;
    if (v.tag === "SemTyped") {
      deref$a0 = v._2;
      continue;
    }
    if (v.tag === "SemRef") {
      deref$c = false;
      deref$r = force(v._3);
      continue;
    }
    deref$c = false;
    deref$r = v;
  }
  return deref$r;
};
var evalBranches = (v) => (initConds) => (initDef) => {
  const go = (go$a0$copy) => (go$a1$copy) => (go$a2$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$a2 = go$a2$copy, go$c = true, go$r;
    while (go$c) {
      const acc = go$a0, conds = go$a1, def = go$a2;
      const v1 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), conds);
      if (v1.tag === "Just") {
        const v2 = deref(force(v1._1.head._1));
        if (v2.tag === "NeutLit") {
          if (v2._1.tag === "LitBoolean") {
            if (v2._1._1) {
              go$a0 = acc;
              go$a1 = [];
              go$a2 = v1._1.head._2;
              continue;
            }
            go$a0 = acc;
            go$a1 = v1._1.tail;
            go$a2 = def;
            continue;
          }
          go$a0 = snoc(acc)(v1._1.head);
          go$a1 = v1._1.tail;
          go$a2 = def;
          continue;
        }
        if (v2.tag === "NeutFail") {
          const $0 = v2._1;
          go$a0 = acc;
          go$a1 = [];
          go$a2 = defer((v3) => $BackendSemantics("NeutFail", $0));
          continue;
        }
        go$a0 = snoc(acc)(v1._1.head);
        go$a1 = v1._1.tail;
        go$a2 = def;
        continue;
      }
      if (v1.tag === "Nothing") {
        if (acc.length > 0) {
          go$c = false;
          go$r = $BackendSemantics("SemBranch", acc, def);
          continue;
        }
        go$c = false;
        go$r = force(def);
        continue;
      }
      fail();
    }
    return go$r;
  };
  return go([])(initConds)(initDef);
};
var evalPrimOpNumInt = (op) => (x) => (y) => {
  const $0 = deref(x);
  if ($0.tag === "NeutLit" && $0._1.tag === "LitInt") {
    const $1 = deref(y);
    if ($1.tag === "NeutLit" && $1._1.tag === "LitInt") {
      if (op === "OpAdd") {
        const res = $0._1._1 + $1._1._1 | 0;
        if ($1._1._1 > 0 && res < $0._1._1 || $1._1._1 < 0 && res > $0._1._1) {
          return Nothing;
        }
        return $Maybe("Just", $BackendSemantics("NeutLit", $Literal("LitInt", res)));
      }
      if (op === "OpMultiply") {
        const res = $0._1._1 * $1._1._1 | 0;
        if ($0._1._1 !== intDiv(res, $1._1._1)) {
          return Nothing;
        }
        return $Maybe("Just", $BackendSemantics("NeutLit", $Literal("LitInt", res)));
      }
      if (op === "OpSubtract") {
        const res = $0._1._1 - $1._1._1 | 0;
        if ($1._1._1 > 0 && res > $0._1._1 || $1._1._1 < 0 && res < $0._1._1) {
          return Nothing;
        }
        return $Maybe("Just", $BackendSemantics("NeutLit", $Literal("LitInt", res)));
      }
      if (op === "OpDivide") {
        return $Maybe("Just", $BackendSemantics("NeutLit", $Literal("LitInt", intDiv($0._1._1, $1._1._1))));
      }
      fail();
    }
  }
  return Nothing;
};
var evalPrimOpNumNumber = (op) => (x) => (y) => {
  const $0 = deref(x);
  if ($0.tag === "NeutLit" && $0._1.tag === "LitNumber") {
    const $1 = deref(y);
    if ($1.tag === "NeutLit" && $1._1.tag === "LitNumber") {
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal(
            "LitNumber",
            (() => {
              if (op === "OpAdd") {
                return $0._1._1 + $1._1._1;
              }
              if (op === "OpMultiply") {
                return $0._1._1 * $1._1._1;
              }
              if (op === "OpSubtract") {
                return $0._1._1 - $1._1._1;
              }
              if (op === "OpDivide") {
                return $0._1._1 / $1._1._1;
              }
              fail();
            })()
          )
        )
      );
    }
  }
  return Nothing;
};
var evalRefSpine = (env) => (ref) => (spine) => (sem) => (v) => {
  if (v.tag === "ExternApp") {
    return neutralSpine((() => {
      if (ref.tag === "EvalExtern") {
        return $BackendSemantics("NeutVar", ref._1);
      }
      if (ref.tag === "EvalLocal") {
        return $BackendSemantics("NeutLocal", ref._1, ref._2);
      }
      fail();
    })())(spine);
  }
  if (v.tag === "ExternUncurriedApp") {
    return neutralSpine((() => {
      if (ref.tag === "EvalExtern") {
        return $BackendSemantics("NeutVar", ref._1);
      }
      if (ref.tag === "EvalLocal") {
        return $BackendSemantics("NeutLocal", ref._1, ref._2);
      }
      fail();
    })())(spine);
  }
  if (v.tag === "ExternAccessor") {
    return evalAccessor(env)(force(sem))(v._1);
  }
  if (v.tag === "ExternPrimOp") {
    return evalPrimOp(env)($BackendOperator("Op1", v._1, force(sem)));
  }
  fail();
};
var evalRef = (v) => (ref) => (spine) => (last) => (sem) => {
  const spine$p = last.tag === "ExternApp" ? foldlArray(snocApp)(spine)(last._1) : snoc(spine)(last);
  const v1 = (v2) => $BackendSemantics("SemRef", ref, spine$p, defer((v3) => deref(evalRefSpine(v)(ref)(spine$p)(sem)(last))));
  if (ref.tag === "EvalExtern") {
    const $0 = v.evalExternSpine(v)(ref._1)(spine$p);
    if ($0.tag === "Just") {
      return $0._1;
    }
  }
  return v1(true);
};
var evalPrimOp = (env) => (v) => {
  if (v.tag === "Op1") {
    const $0 = v._1;
    const $1 = v._2;
    const v1 = (v2) => {
      if ($0.tag === "OpBooleanNot" && $1.tag === "NeutPrimOp") {
        return evalPrimOpNot($1._1);
      }
      const v5 = (v6) => {
        const v7 = (v8) => {
          const v9 = (v10) => {
            const v11 = (v12) => {
              const v13 = (v14) => {
                const v15 = $1.tag === "SemTyped" ? unwrapSemTyped($1._2) : $1;
                if (v15.tag === "SemRef") {
                  return evalRef(env)(v15._1)(v15._2)($ExternSpine("ExternPrimOp", $0))(v15._3);
                }
                const v16 = $1.tag === "SemTyped" ? unwrapSemTyped($1._2) : $1;
                if (v16.tag === "NeutFail") {
                  return $BackendSemantics("NeutFail", v16._1);
                }
                return floatLet($1)((() => {
                  const $2 = Op1($0);
                  return (x) => $BackendSemantics("NeutPrimOp", $2(x));
                })());
              };
              if ($0.tag === "OpNumberNegate") {
                const $2 = deref($1);
                if ($2.tag === "NeutLit" && $2._1.tag === "LitNumber") {
                  return $BackendSemantics("NeutLit", $Literal("LitNumber", -$2._1._1));
                }
              }
              return v13(true);
            };
            if ($0.tag === "OpIntNegate") {
              const $2 = deref($1);
              if ($2.tag === "NeutLit" && $2._1.tag === "LitInt") {
                return $BackendSemantics("NeutLit", $Literal("LitInt", -$2._1._1));
              }
            }
            return v11(true);
          };
          if ($0.tag === "OpArrayLength") {
            const $2 = deref($1);
            if ($2.tag === "NeutLit" && $2._1.tag === "LitArray") {
              return $BackendSemantics("NeutLit", $Literal("LitInt", $2._1._1.length));
            }
          }
          return v9(true);
        };
        if ($0.tag === "OpIsTag") {
          const $2 = deref($1);
          if ($2.tag === "NeutData") {
            return $BackendSemantics(
              "NeutLit",
              $Literal(
                "LitBoolean",
                ($0._1._1.tag === "Nothing" ? $2._1._1.tag === "Nothing" : $0._1._1.tag === "Just" && $2._1._1.tag === "Just" && $0._1._1._1 === $2._1._1._1) && $0._1._2 === $2._1._2
              )
            );
          }
        }
        return v7(true);
      };
      if ($0.tag === "OpIntBitNot") {
        const $2 = deref($1);
        if ($2.tag === "NeutLit" && $2._1.tag === "LitInt") {
          return $BackendSemantics("NeutLit", $Literal("LitInt", ~$2._1._1));
        }
      }
      return v5(true);
    };
    if ($0.tag === "OpBooleanNot") {
      const $2 = deref($1);
      if ($2.tag === "NeutLit" && $2._1.tag === "LitBoolean") {
        return $BackendSemantics("NeutLit", $Literal("LitBoolean", !$2._1._1));
      }
    }
    return v1(true);
  }
  if (v.tag === "Op2") {
    const $0 = v._1;
    const $1 = v._2;
    const $2 = v._3;
    const v1 = (v2) => {
      const v3 = (v4) => {
        const v5 = (v6) => {
          const v7 = (v8) => {
            const v9 = (v10) => {
              const v11 = (v12) => {
                const v13 = (v14) => {
                  const v15 = (v16) => {
                    const v17 = (v18) => {
                      const v19 = (v20) => {
                        const v21 = (v22) => {
                          const v23 = (v24) => {
                            const v25 = (v26) => {
                              const v27 = (v28) => {
                                const v29 = (v30) => {
                                  const v31 = (v32) => {
                                    const v33 = (v34) => {
                                      const v35 = (v36) => {
                                        const v37 = (v38) => {
                                          const v39 = (v40) => {
                                            const v41 = (v42) => {
                                              const v43 = (v44) => {
                                                const v45 = (v46) => {
                                                  const v47 = (v48) => {
                                                    const v49 = (v50) => {
                                                      if ($0.tag === "OpStringAppend" && $1.tag === "NeutLit" && $1._1.tag === "LitString" && $2.tag === "NeutLit" && $2._1.tag === "LitString") {
                                                        return $BackendSemantics("NeutLit", $Literal("LitString", $1._1._1 + $2._1._1));
                                                      }
                                                      if ($0.tag === "OpArrayIndex" && $2.tag === "NeutLit" && $2._1.tag === "LitInt") {
                                                        return evalAccessor(env)($1)($BackendAccessor("GetIndex", $2._1._1));
                                                      }
                                                      if ($0.tag === "OpBooleanAnd") {
                                                        if ($1.tag === "NeutFail") {
                                                          return $BackendSemantics("NeutFail", $1._1);
                                                        }
                                                        if ($2.tag === "NeutFail") {
                                                          return $BackendSemantics("NeutFail", $2._1);
                                                        }
                                                        return $BackendSemantics("NeutPrimOp", $BackendOperator("Op2", $0, $1, $2));
                                                      }
                                                      if ($0.tag === "OpBooleanOr") {
                                                        if ($1.tag === "NeutFail") {
                                                          return $BackendSemantics("NeutFail", $1._1);
                                                        }
                                                        if ($2.tag === "NeutFail") {
                                                          return $BackendSemantics("NeutFail", $2._1);
                                                        }
                                                        return $BackendSemantics("NeutPrimOp", $BackendOperator("Op2", $0, $1, $2));
                                                      }
                                                      if ($1.tag === "NeutFail") {
                                                        return $BackendSemantics("NeutFail", $1._1);
                                                      }
                                                      if ($2.tag === "NeutFail") {
                                                        return $BackendSemantics("NeutFail", $2._1);
                                                      }
                                                      return floatLet($1)((x$p) => floatLet($2)((y$p) => {
                                                        if ((() => {
                                                          if ($0.tag === "OpIntNum") {
                                                            return $0._1 === "OpAdd" || $0._1 === "OpMultiply";
                                                          }
                                                          if ($0.tag === "OpNumberNum") {
                                                            return $0._1 === "OpAdd" || $0._1 === "OpMultiply";
                                                          }
                                                          return $0.tag === "OpStringAppend";
                                                        })()) {
                                                          return evalAssocOp(env)($Either("Right", $0))(x$p)(y$p);
                                                        }
                                                        return $BackendSemantics("NeutPrimOp", $BackendOperator("Op2", $0, x$p, y$p));
                                                      }));
                                                    };
                                                    if ($0.tag === "OpStringOrd") {
                                                      const $3 = deref($1);
                                                      if ($3.tag === "NeutLit" && $3._1.tag === "LitString") {
                                                        const $4 = deref($2);
                                                        if ($4.tag === "NeutLit" && $4._1.tag === "LitString") {
                                                          return $BackendSemantics(
                                                            "NeutLit",
                                                            $Literal("LitBoolean", evalPrimOpOrd1($0._1)($3._1._1)($4._1._1))
                                                          );
                                                        }
                                                      }
                                                    }
                                                    return v49(true);
                                                  };
                                                  if ($0.tag === "OpNumberOrd") {
                                                    const $3 = deref($1);
                                                    if ($3.tag === "NeutLit" && $3._1.tag === "LitNumber") {
                                                      const $4 = deref($2);
                                                      if ($4.tag === "NeutLit" && $4._1.tag === "LitNumber") {
                                                        return $BackendSemantics(
                                                          "NeutLit",
                                                          $Literal(
                                                            "LitBoolean",
                                                            (() => {
                                                              if ($0._1 === "OpEq") {
                                                                return $3._1._1 === $4._1._1;
                                                              }
                                                              if ($0._1 === "OpNotEq") {
                                                                return $3._1._1 !== $4._1._1;
                                                              }
                                                              if ($0._1 === "OpGt") {
                                                                return $3._1._1 > $4._1._1;
                                                              }
                                                              if ($0._1 === "OpGte") {
                                                                return $3._1._1 >= $4._1._1;
                                                              }
                                                              if ($0._1 === "OpLt") {
                                                                return $3._1._1 < $4._1._1;
                                                              }
                                                              if ($0._1 === "OpLte") {
                                                                return $3._1._1 <= $4._1._1;
                                                              }
                                                              fail();
                                                            })()
                                                          )
                                                        );
                                                      }
                                                    }
                                                  }
                                                  return v47(true);
                                                };
                                                if ($0.tag === "OpNumberNum") {
                                                  const $3 = evalPrimOpNumNumber($0._1)($1)($2);
                                                  if ($3.tag === "Just") {
                                                    return $3._1;
                                                  }
                                                }
                                                return v45(true);
                                              };
                                              if ($0.tag === "OpNumberNum" && $0._1 === "OpSubtract") {
                                                const $3 = deref($1);
                                                if ($3.tag === "NeutLit" && $3._1.tag === "LitNumber" && $3._1._1 === 0) {
                                                  return evalPrimOp(env)($BackendOperator(
                                                    "Op1",
                                                    OpNumberNegate,
                                                    $2
                                                  ));
                                                }
                                              }
                                              return v43(true);
                                            };
                                            if ($0.tag === "OpIntOrd") {
                                              const $3 = deref($1);
                                              if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                                const $4 = deref($2);
                                                if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                                  return $BackendSemantics(
                                                    "NeutLit",
                                                    $Literal("LitBoolean", evalPrimOpOrd2($0._1)($3._1._1)($4._1._1))
                                                  );
                                                }
                                              }
                                            }
                                            return v41(true);
                                          };
                                          if ($0.tag === "OpIntNum") {
                                            const $3 = evalPrimOpNumInt($0._1)($1)($2);
                                            if ($3.tag === "Just") {
                                              return $3._1;
                                            }
                                          }
                                          return v39(true);
                                        };
                                        if ($0.tag === "OpIntNum" && $0._1 === "OpSubtract") {
                                          const $3 = deref($1);
                                          if ($3.tag === "NeutLit" && $3._1.tag === "LitInt" && $3._1._1 === 0) {
                                            return evalPrimOp(env)($BackendOperator(
                                              "Op1",
                                              OpIntNegate,
                                              $2
                                            ));
                                          }
                                        }
                                        return v37(true);
                                      };
                                      if ($0.tag === "OpIntBitZeroFillShiftRight") {
                                        const $3 = deref($1);
                                        if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                          const $4 = deref($2);
                                          if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                            return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 >>> $4._1._1));
                                          }
                                        }
                                      }
                                      return v35(true);
                                    };
                                    if ($0.tag === "OpIntBitXor") {
                                      const $3 = deref($1);
                                      if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                        const $4 = deref($2);
                                        if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                          return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 ^ $4._1._1));
                                        }
                                      }
                                    }
                                    return v33(true);
                                  };
                                  if ($0.tag === "OpIntBitShiftRight") {
                                    const $3 = deref($1);
                                    if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                      const $4 = deref($2);
                                      if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                        return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 >> $4._1._1));
                                      }
                                    }
                                  }
                                  return v31(true);
                                };
                                if ($0.tag === "OpIntBitShiftLeft") {
                                  const $3 = deref($1);
                                  if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                    const $4 = deref($2);
                                    if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                      return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 << $4._1._1));
                                    }
                                  }
                                }
                                return v29(true);
                              };
                              if ($0.tag === "OpIntBitOr") {
                                const $3 = deref($1);
                                if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                  const $4 = deref($2);
                                  if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                    return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 | $4._1._1));
                                  }
                                }
                              }
                              return v27(true);
                            };
                            if ($0.tag === "OpIntBitAnd") {
                              const $3 = deref($1);
                              if ($3.tag === "NeutLit" && $3._1.tag === "LitInt") {
                                const $4 = deref($2);
                                if ($4.tag === "NeutLit" && $4._1.tag === "LitInt") {
                                  return $BackendSemantics("NeutLit", $Literal("LitInt", $3._1._1 & $4._1._1));
                                }
                              }
                            }
                            return v25(true);
                          };
                          if ($0.tag === "OpCharOrd") {
                            const $3 = deref($1);
                            if ($3.tag === "NeutLit" && $3._1.tag === "LitChar") {
                              const $4 = deref($2);
                              if ($4.tag === "NeutLit" && $4._1.tag === "LitChar") {
                                return $BackendSemantics("NeutLit", $Literal("LitBoolean", evalPrimOpOrd3($0._1)($3._1._1)($4._1._1)));
                              }
                            }
                          }
                          return v23(true);
                        };
                        if ($0.tag === "OpBooleanOrd") {
                          const $3 = deref($1);
                          if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean") {
                            const $4 = deref($2);
                            if ($4.tag === "NeutLit" && $4._1.tag === "LitBoolean") {
                              return $BackendSemantics("NeutLit", $Literal("LitBoolean", evalPrimOpOrd4($0._1)($3._1._1)($4._1._1)));
                            }
                          }
                        }
                        return v21(true);
                      };
                      if ($0.tag === "OpBooleanOrd" && $0._1 === "OpEq") {
                        const $3 = deref($2);
                        if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean") {
                          if ($3._1._1) {
                            return $1;
                          }
                          return evalPrimOp(env)($BackendOperator("Op1", OpBooleanNot, $1));
                        }
                      }
                      return v19(true);
                    };
                    if ($0.tag === "OpBooleanOrd" && $0._1 === "OpEq") {
                      const $3 = deref($1);
                      if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean") {
                        if ($3._1._1) {
                          return $2;
                        }
                        return evalPrimOp(env)($BackendOperator("Op1", OpBooleanNot, $2));
                      }
                    }
                    return v17(true);
                  };
                  if ($0.tag === "OpBooleanOr") {
                    const $3 = deref($2);
                    if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && $3._1._1) {
                      return $2;
                    }
                  }
                  return v15(true);
                };
                if ($0.tag === "OpBooleanOr") {
                  const $3 = deref($1);
                  if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && $3._1._1) {
                    return $1;
                  }
                }
                return v13(true);
              };
              if ($0.tag === "OpBooleanOr") {
                const $3 = deref($2);
                if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && !$3._1._1) {
                  return $1;
                }
              }
              return v11(true);
            };
            if ($0.tag === "OpBooleanOr") {
              const $3 = deref($1);
              if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && !$3._1._1) {
                return $2;
              }
            }
            return v9(true);
          };
          if ($0.tag === "OpBooleanAnd") {
            const $3 = deref($2);
            if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && $3._1._1) {
              return $1;
            }
          }
          return v7(true);
        };
        if ($0.tag === "OpBooleanAnd") {
          const $3 = deref($1);
          if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && $3._1._1) {
            return $2;
          }
        }
        return v5(true);
      };
      if ($0.tag === "OpBooleanAnd") {
        const $3 = deref($2);
        if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && !$3._1._1) {
          return $2;
        }
      }
      return v3(true);
    };
    if ($0.tag === "OpBooleanAnd") {
      const $3 = deref($1);
      if ($3.tag === "NeutLit" && $3._1.tag === "LitBoolean" && !$3._1._1) {
        return $1;
      }
    }
    return v1(true);
  }
  fail();
};
var evalAssocOp$p = (v) => (op) => (a) => (b) => {
  if (op.tag === "Left") {
    const v1 = v.evalExternSpine(v)(op._1)([$ExternSpine("ExternApp", [a, b])]);
    if (v1.tag === "Just") {
      return v1._1;
    }
    if (v1.tag === "Nothing") {
      return $BackendSemantics("SemAssocOp", op, [a, b]);
    }
    fail();
  }
  if (op.tag === "Right") {
    return evalPrimOp(v)($BackendOperator("Op2", op._1, a, b));
  }
  fail();
};
var evalAssocOp = (env) => (op1) => (v) => (v1) => {
  if (v.tag === "SemTyped") {
    return evalAssocOp(env)(op1)(v._2)(v1);
  }
  if (v1.tag === "SemTyped") {
    return evalAssocOp(env)(op1)(v)(v1._2);
  }
  if (v.tag === "SemAssocOp" && v1.tag === "SemAssocOp" && eq16(op1)(v._1) && eq16(v._1)(v1._1)) {
    const v3 = evalAssocOp$p(env)(op1)((() => {
      const $02 = v._2.length - 1 | 0;
      if ($02 >= 0 && $02 < v._2.length) {
        return v._2[$02];
      }
      fail();
    })())((() => {
      if (0 < v1._2.length) {
        return v1._2[0];
      }
      fail();
    })());
    if (v3.tag === "SemAssocOp" && eq16(v1._1)(v3._1)) {
      return $BackendSemantics(
        "SemAssocOp",
        op1,
        (() => {
          const $02 = unconsImpl((v$1) => Nothing, (v$1) => (xs) => $Maybe("Just", xs), v1._2);
          return [
            ...(() => {
              if (v._2.length === 0) {
                fail();
              }
              return sliceImpl(0, v._2.length - 1 | 0, v._2);
            })(),
            ...v3._2,
            ...(() => {
              if ($02.tag === "Just") {
                return $02._1;
              }
              fail();
            })()
          ];
        })()
      );
    }
    return $BackendSemantics(
      "SemAssocOp",
      op1,
      (() => {
        const $02 = unconsImpl((v$1) => Nothing, (v$1) => (xs) => $Maybe("Just", xs), v1._2);
        return [
          ...(() => {
            if (v._2.length === 0) {
              fail();
            }
            return sliceImpl(0, v._2.length - 1 | 0, v._2);
          })(),
          v3,
          ...(() => {
            if ($02.tag === "Just") {
              return $02._1;
            }
            fail();
          })()
        ];
      })()
    );
  }
  const $0 = (as, b, op2) => {
    const v4 = evalAssocOp$p(env)(op1)((() => {
      const $02 = as.length - 1 | 0;
      if ($02 >= 0 && $02 < as.length) {
        return as[$02];
      }
      fail();
    })())(b);
    if (v4.tag === "SemAssocOp" && eq16(op2)(v4._1)) {
      return $BackendSemantics(
        "SemAssocOp",
        op1,
        [
          ...(() => {
            if (as.length === 0) {
              fail();
            }
            return sliceImpl(0, as.length - 1 | 0, as);
          })(),
          ...v4._2
        ]
      );
    }
    return $BackendSemantics(
      "SemAssocOp",
      op1,
      snoc((() => {
        if (as.length === 0) {
          fail();
        }
        return sliceImpl(0, as.length - 1 | 0, as);
      })())(v4)
    );
  };
  if (v1.tag === "SemAssocOp" && eq16(op1)(v1._1)) {
    const v4 = evalAssocOp$p(env)(op1)(v)((() => {
      if (0 < v1._2.length) {
        return v1._2[0];
      }
      fail();
    })());
    if (v4.tag === "SemAssocOp" && eq16(v1._1)(v4._1)) {
      return $BackendSemantics(
        "SemAssocOp",
        op1,
        (() => {
          const $1 = unconsImpl((v$1) => Nothing, (v$1) => (xs) => $Maybe("Just", xs), v1._2);
          return [
            ...v4._2,
            ...(() => {
              if ($1.tag === "Just") {
                return $1._1;
              }
              fail();
            })()
          ];
        })()
      );
    }
    return $BackendSemantics(
      "SemAssocOp",
      op1,
      (() => {
        const $1 = unconsImpl((v$1) => Nothing, (v$1) => (xs) => $Maybe("Just", xs), v1._2);
        return [
          v4,
          ...(() => {
            if ($1.tag === "Just") {
              return $1._1;
            }
            fail();
          })()
        ];
      })()
    );
  }
  if (v.tag === "SemAssocOp" && eq16(op1)(v._1)) {
    return $0(v._2, v1, v._1);
  }
  return $BackendSemantics("SemAssocOp", op1, [v, v1]);
};
var evalAccessor = (env) => (lhs) => (accessor) => floatLet(lhs)((v) => {
  if (v.tag === "SemTyped") {
    return evalAccessor(env)(v._2)(accessor);
  }
  if (v.tag === "SemRef") {
    return evalRef(env)(v._1)(v._2)($ExternSpine("ExternAccessor", accessor))(v._3);
  }
  const v1 = (v2) => {
    if (v.tag === "NeutUpdate" && accessor.tag === "GetProp") {
      const $0 = accessor._1;
      const v4 = findMapImpl(
        Nothing,
        isJust,
        (v5) => {
          if (v5._1 === $0) {
            return $Maybe("Just", v5._2);
          }
          return Nothing;
        },
        v._2
      );
      if (v4.tag === "Just") {
        return v4._1;
      }
      if (v4.tag === "Nothing") {
        return evalAccessor(env)(v._1)(accessor);
      }
      fail();
    }
    if (v.tag === "NeutLit" && v._1.tag === "LitArray" && accessor.tag === "GetIndex" && accessor._1 >= 0 && accessor._1 < v._1._1.length) {
      return v._1._1[accessor._1];
    }
    if (v.tag === "NeutData" && accessor.tag === "GetCtorField" && accessor._6 >= 0 && accessor._6 < v._5.length) {
      return v._5[accessor._6]._2;
    }
    if (v.tag === "NeutFail") {
      return $BackendSemantics("NeutFail", v._1);
    }
    return $BackendSemantics("NeutAccessor", v, accessor);
  };
  if (v.tag === "NeutLit" && v._1.tag === "LitRecord" && accessor.tag === "GetProp") {
    const $0 = accessor._1;
    const $1 = findMapImpl(
      Nothing,
      isJust,
      (v2) => {
        if (v2._1 === $0) {
          return $Maybe("Just", v2._2);
        }
        return Nothing;
      },
      v._1._1
    );
    if ($1.tag === "Just") {
      return $1._1;
    }
  }
  return v1(true);
});
var build = (ctx) => (v) => {
  const $0 = () => {
    const v1 = (v2) => {
      const v3 = (v4) => {
        const v5 = (v6) => {
          const v7 = (v8) => {
            const v9 = (v10) => {
              const v11 = (v12) => {
                const v13 = (v14) => {
                  const v15 = (v16) => {
                    const v17 = (v18) => {
                      const v19 = (v20) => {
                        const v21 = (v22) => {
                          const v23 = (v24) => {
                            const v25 = (v26) => {
                              if (v.tag === "EffectBind" && v._3.tag === "ExprSyntax" && v._3._2.tag === "EffectPure") {
                                return build(ctx)($BackendSyntax(
                                  "EffectDefer",
                                  build(ctx)($BackendSyntax("Let", v._1, v._2, v._3._2._1, v._4))
                                ));
                              }
                              const v27 = (v28) => {
                                const v29 = (v30) => {
                                  const v31 = (v32) => {
                                    const v33 = (v34) => {
                                      if (v.tag === "PrimOp" && v._1.tag === "Op1" && v._1._1.tag === "OpBooleanNot" && v._1._2.tag === "ExprSyntax" && v._1._2._2.tag === "PrimOp" && v._1._2._2._1.tag === "Op1" && v._1._2._2._1._1.tag === "OpBooleanNot") {
                                        return v._1._2._2._1._2;
                                      }
                                      return $BackendExpr("ExprSyntax", ctx.analyze(ctx)(v), v);
                                    };
                                    if (v.tag === "EffectDefer") {
                                      const $02 = v._1.tag === "ExprSyntax" && v._1._2.tag === "Typed" ? unwrapBackendExpr(v._1._2._2) : v._1;
                                      if ($02.tag === "ExprSyntax" && $02._2.tag === "EffectDefer") {
                                        return v._1;
                                      }
                                    }
                                    return v33(true);
                                  };
                                  if (v.tag === "EffectBind") {
                                    const $02 = v._4.tag === "ExprSyntax" && v._4._2.tag === "Typed" ? unwrapBackendExpr(v._4._2._2) : v._4;
                                    if ($02.tag === "ExprSyntax" && $02._2.tag === "EffectPure") {
                                      const $1 = $02._2._1.tag === "ExprSyntax" && $02._2._1._2.tag === "Typed" ? unwrapBackendExpr($02._2._1._2._2) : $02._2._1;
                                      if ($1.tag === "ExprSyntax" && $1._2.tag === "Local" && v._2 === $1._2._2) {
                                        return v._3;
                                      }
                                    }
                                  }
                                  return v31(true);
                                };
                                if (v.tag === "EffectBind") {
                                  const $02 = v._4.tag === "ExprSyntax" && v._4._2.tag === "Typed" ? unwrapBackendExpr(v._4._2._2) : v._4;
                                  if ($02.tag === "ExprSyntax" && $02._2.tag === "EffectDefer") {
                                    return build(ctx)($BackendSyntax("EffectBind", v._1, v._2, v._3, $02._2._1));
                                  }
                                }
                                return v29(true);
                              };
                              if (v.tag === "EffectBind") {
                                const $02 = v._3.tag === "ExprSyntax" && v._3._2.tag === "Typed" ? unwrapBackendExpr(v._3._2._2) : v._3;
                                if ($02.tag === "ExprSyntax" && $02._2.tag === "EffectDefer") {
                                  return build(ctx)($BackendSyntax("EffectBind", v._1, v._2, $02._2._1, v._4));
                                }
                              }
                              return v27(true);
                            };
                            if (v.tag === "PrimOp" && v._1.tag === "Op2") {
                              const $02 = v._1._3.tag === "ExprSyntax" && v._1._3._2.tag === "Typed" ? untypedExpr(v._1._3._2._2) : v._1._3;
                              if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                                const $1 = shouldDistributeBranchPrimOp2R((() => {
                                  if (v._1._3.tag === "ExprSyntax") {
                                    return v._1._3._1;
                                  }
                                  if (v._1._3.tag === "ExprRewrite") {
                                    return v._1._3._1;
                                  }
                                  fail();
                                })())($02._2._1)($02._2._2)(v._1._2)(v._1._1);
                                if ($1.tag === "Just") {
                                  return $1._1;
                                }
                              }
                            }
                            return v25(true);
                          };
                          if (v.tag === "PrimOp" && v._1.tag === "Op2") {
                            const $02 = v._1._2.tag === "ExprSyntax" && v._1._2._2.tag === "Typed" ? untypedExpr(v._1._2._2._2) : v._1._2;
                            if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                              const $1 = shouldDistributeBranchPrimOp2L((() => {
                                if (v._1._2.tag === "ExprSyntax") {
                                  return v._1._2._1;
                                }
                                if (v._1._2.tag === "ExprRewrite") {
                                  return v._1._2._1;
                                }
                                fail();
                              })())($02._2._1)($02._2._2)(v._1._1)(v._1._3);
                              if ($1.tag === "Just") {
                                return $1._1;
                              }
                            }
                          }
                          return v23(true);
                        };
                        if (v.tag === "PrimOp" && v._1.tag === "Op1") {
                          const $02 = v._1._2.tag === "ExprSyntax" && v._1._2._2.tag === "Typed" ? untypedExpr(v._1._2._2._2) : v._1._2;
                          if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                            const $1 = (() => {
                              if (v._1._2.tag === "ExprSyntax") {
                                return v._1._2._1;
                              }
                              if (v._1._2.tag === "ExprRewrite") {
                                return v._1._2._1;
                              }
                              fail();
                            })();
                            return $BackendExpr(
                              "ExprRewrite",
                              { ...$1, rewrite: true, size: $1.size + 1 | 0 },
                              $BackendRewrite("RewriteDistBranchesOp", $02._2._1, $02._2._2, $DistOp("DistPrimOp1", v._1._1))
                            );
                          }
                        }
                        return v21(true);
                      };
                      if (v.tag === "Accessor") {
                        const $02 = v._1.tag === "ExprSyntax" && v._1._2.tag === "Typed" ? untypedExpr(v._1._2._2) : v._1;
                        if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                          const $1 = (() => {
                            if (v._1.tag === "ExprSyntax") {
                              return v._1._1;
                            }
                            if (v._1.tag === "ExprRewrite") {
                              return v._1._1;
                            }
                            fail();
                          })();
                          return $BackendExpr(
                            "ExprRewrite",
                            { ...$1, rewrite: true, size: $1.size + 1 | 0 },
                            $BackendRewrite("RewriteDistBranchesOp", $02._2._1, $02._2._2, $DistOp("DistAccessor", v._2))
                          );
                        }
                      }
                      return v19(true);
                    };
                    if (v.tag === "UncurriedApp") {
                      const $02 = v._1.tag === "ExprSyntax" && v._1._2.tag === "Typed" ? untypedExpr(v._1._2._2) : v._1;
                      if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                        const $1 = shouldDistributeBranchUncurriedApps((() => {
                          if (v._1.tag === "ExprSyntax") {
                            return v._1._1;
                          }
                          if (v._1.tag === "ExprRewrite") {
                            return v._1._1;
                          }
                          fail();
                        })())($02._2._1)($02._2._2)(v._2);
                        if ($1.tag === "Just") {
                          return $1._1;
                        }
                      }
                    }
                    return v17(true);
                  };
                  if (v.tag === "App") {
                    const $02 = v._1.tag === "ExprSyntax" && v._1._2.tag === "Typed" ? untypedExpr(v._1._2._2) : v._1;
                    if ($02.tag === "ExprSyntax" && $02._2.tag === "Branch") {
                      const $1 = shouldDistributeBranchApps((() => {
                        if (v._1.tag === "ExprSyntax") {
                          return v._1._1;
                        }
                        if (v._1.tag === "ExprRewrite") {
                          return v._1._1;
                        }
                        fail();
                      })())($02._2._1)($02._2._2)(v._2);
                      if ($1.tag === "Just") {
                        return $1._1;
                      }
                    }
                  }
                  return v15(true);
                };
                if (v.tag === "Let") {
                  const $02 = shouldEtaReduce(v._2)(v._3)(v._4);
                  if ($02.tag === "Just") {
                    return $02._1;
                  }
                }
                return v13(true);
              };
              if (v.tag === "Let") {
                const $02 = shouldDistributeBranches(v._1)(v._2)(v._3)(v._4);
                if ($02.tag === "Just") {
                  return $02._1;
                }
              }
              return v11(true);
            };
            if (v.tag === "Let") {
              const $02 = shouldUnpackArray(v._1)(v._2)(v._3)(v._4);
              if ($02.tag === "Just") {
                return $02._1;
              }
            }
            return v9(true);
          };
          if (v.tag === "Let") {
            const $02 = shouldUnpackCtor(v._1)(v._2)(v._3)(v._4);
            if ($02.tag === "Just") {
              return $02._1;
            }
          }
          return v7(true);
        };
        if (v.tag === "Let") {
          const $02 = shouldUnpackUpdate(v._1)(v._2)(v._3)(v._4);
          if ($02.tag === "Just") {
            return $02._1;
          }
        }
        return v5(true);
      };
      if (v.tag === "Let") {
        const $02 = shouldUnpackRecord(v._1)(v._2)(v._3)(v._4);
        if ($02.tag === "Just") {
          return $02._1;
        }
      }
      return v3(true);
    };
    if (v.tag === "Let") {
      const $02 = shouldUncurryAbs(v._1)(v._2)(v._3)(v._4);
      if ($02.tag === "Just") {
        return $02._1;
      }
    }
    return v1(true);
  };
  if (v.tag === "App") {
    if (v._1.tag === "ExprSyntax" && v._1._2.tag === "App") {
      return build(ctx)($BackendSyntax("App", v._1._2._1, [...v._1._2._2, ...v._2]));
    }
    return $0();
  }
  if (v.tag === "Abs") {
    if (v._2.tag === "ExprSyntax" && v._2._2.tag === "Abs") {
      return build(ctx)($BackendSyntax("Abs", [...v._1, ...v._2._2._1], v._2._2._2));
    }
    return $0();
  }
  if (v.tag === "Let" && shouldInlineLet(v._2)(v._3)(v._4)) {
    return rewriteInline(v._1)(v._2)(v._3)(v._4);
  }
  return $0();
};
var simplifyCondBoolean = (ctx) => (v) => (other) => {
  const v1 = other.tag === "ExprSyntax" && other._2.tag === "Typed" ? untypedExpr(other._2._2) : other;
  const v2 = v._2.tag === "ExprSyntax" && v._2._2.tag === "Typed" ? untypedExpr(v._2._2._2) : v._2;
  if (v2.tag === "ExprSyntax" && v2._2.tag === "Lit" && v2._2._1.tag === "LitBoolean") {
    if (v1.tag === "ExprSyntax" && v1._2.tag === "Lit" && v1._2._1.tag === "LitBoolean") {
      if (v2._2._1._1 === v1._2._1._1) {
        return $Maybe("Just", v._2);
      }
      if (v2._2._1._1 && !v1._2._1._1) {
        return $Maybe("Just", v._1);
      }
      if (!v2._2._1._1 && v1._2._1._1) {
        return $Maybe(
          "Just",
          build(ctx)($BackendSyntax(
            "PrimOp",
            $BackendOperator("Op1", OpBooleanNot, v._1)
          ))
        );
      }
      if (v2._2._1._1 && isSimplePredicate(other)) {
        return $Maybe(
          "Just",
          build(ctx)($BackendSyntax(
            "PrimOp",
            $BackendOperator("Op2", OpBooleanOr, v._1, other)
          ))
        );
      }
      if (!v1._2._1._1) {
        return $Maybe(
          "Just",
          build(ctx)($BackendSyntax(
            "PrimOp",
            $BackendOperator("Op2", OpBooleanAnd, v._1, v._2)
          ))
        );
      }
      return Nothing;
    }
    if (v2._2._1._1 && isSimplePredicate(other)) {
      return $Maybe(
        "Just",
        build(ctx)($BackendSyntax(
          "PrimOp",
          $BackendOperator("Op2", OpBooleanOr, v._1, other)
        ))
      );
    }
    return Nothing;
  }
  if (v1.tag === "ExprSyntax" && v1._2.tag === "Lit" && v1._2._1.tag === "LitBoolean" && !v1._2._1._1) {
    return $Maybe(
      "Just",
      build(ctx)($BackendSyntax(
        "PrimOp",
        $BackendOperator("Op2", OpBooleanAnd, v._1, v._2)
      ))
    );
  }
  return Nothing;
};
var simplifyCondRedundantElse = (ctx) => (v) => (def) => {
  const $0 = def.tag === "ExprSyntax" && def._2.tag === "Typed" ? untypedExpr(def._2._2) : def;
  if ($0.tag === "ExprSyntax" && $0._2.tag === "Branch") {
    const $1 = (() => {
      if (0 < $0._2._1.length) {
        return $0._2._1[0];
      }
      fail();
    })();
    const $2 = $1._1.tag === "ExprSyntax" && $1._1._2.tag === "Typed" ? untypedExpr($1._1._2._2) : $1._1;
    if ($2.tag === "ExprSyntax" && $2._2.tag === "PrimOp" && $2._2._1.tag === "Op1" && $2._2._1._1.tag === "OpBooleanNot" && eqBackendExpr.eq(v._1)($2._2._1._2)) {
      return $Maybe("Just", buildBranchCond(ctx)($Pair(v._1, v._2))($1._2));
    }
  }
  return Nothing;
};
var simplifyCondLiftAnd = (ctx) => (v) => (def1) => {
  const $0 = v._2.tag === "ExprSyntax" && v._2._2.tag === "Typed" ? untypedExpr(v._2._2._2) : v._2;
  if ($0.tag === "ExprSyntax" && $0._2.tag === "Branch" && $0._2._1.length === 1 && eqBackendExpr.eq(def1)($0._2._2)) {
    return $Maybe(
      "Just",
      buildBranchCond(ctx)($Pair(
        build(ctx)($BackendSyntax(
          "PrimOp",
          $BackendOperator("Op2", OpBooleanAnd, v._1, $0._2._1[0]._1)
        )),
        $0._2._1[0]._2
      ))(def1)
    );
  }
  return Nothing;
};
var buildBranchCond = (ctx) => (pair) => (def) => {
  const $0 = simplifyCondIsTag(ctx)(pair)(def);
  if ($0.tag === "Just") {
    return $0._1;
  }
  const $1 = simplifyCondBoolean(ctx)(pair)(def);
  if ($1.tag === "Just") {
    return $1._1;
  }
  const $2 = simplifyCondLiftAnd(ctx)(pair)(def);
  if ($2.tag === "Just") {
    return $2._1;
  }
  const $3 = simplifyCondRedundantElse(ctx)(pair)(def);
  if ($3.tag === "Just") {
    return $3._1;
  }
  if (def.tag === "ExprSyntax" && def._2.tag === "Branch") {
    return build(ctx)($BackendSyntax("Branch", [pair, ...def._2._1], def._2._2));
  }
  return build(ctx)($BackendSyntax("Branch", [pair], def));
};
var quote$lazy = /* @__PURE__ */ binding(() => {
  const go = (ctx) => (v) => {
    if (v.tag === "SemTyped") {
      return build(ctx)($BackendSyntax("Typed", v._1, go(ctx)(v._2)));
    }
    if (v.tag === "SemLet") {
      const $0 = v._2;
      return build(ctx)($BackendSyntax(
        "Let",
        v._1,
        ctx.currentLevel,
        quote$lazy()(ctx.effect ? { ...ctx, effect: false } : ctx)($0),
        quote$lazy()({ ...ctx, currentLevel: ctx.currentLevel + 1 | 0 })(v._3($BackendSemantics(
          "SemRef",
          $EvalRef("EvalLocal", v._1, ctx.currentLevel),
          [],
          defer((v2) => deref($0))
        )))
      ));
    }
    if (v.tag === "SemLetRec") {
      const $0 = ctx.currentLevel;
      const $1 = { ...ctx, currentLevel: ctx.currentLevel + 1 | 0 };
      const neutBindings = arrayMap((v2) => {
        const $2 = v2._1;
        return $Tuple($2, defer((v3) => $BackendSemantics("NeutLocal", $Maybe("Just", $2), $0)));
      })(v._1);
      return build(ctx)($BackendSyntax(
        "LetRec",
        $0,
        arrayMap((m) => $Tuple(m._1, quote$lazy()($1.effect ? { ...$1, effect: false } : $1)(m._2(neutBindings))))(v._1),
        quote$lazy()($1)(v._2(neutBindings))
      ));
    }
    if (v.tag === "SemEffectBind") {
      const ctx$p = ctx.effect ? ctx : { ...ctx, effect: true };
      return build(ctx)($BackendSyntax(
        "EffectBind",
        v._1,
        ctx$p.currentLevel,
        quote$lazy()(ctx$p)(v._2),
        quote$lazy()({ ...ctx$p, currentLevel: ctx$p.currentLevel + 1 | 0 })(v._3($BackendSemantics("NeutLocal", v._1, ctx$p.currentLevel)))
      ));
    }
    if (v.tag === "SemEffectPure") {
      return build(ctx)($BackendSyntax("EffectPure", quote$lazy()(ctx.effect ? { ...ctx, effect: false } : ctx)(v._1)));
    }
    if (v.tag === "SemEffectDefer") {
      return build(ctx)($BackendSyntax("EffectDefer", quote$lazy()(ctx.effect ? ctx : { ...ctx, effect: true })(v._1)));
    }
    if (v.tag === "SemBranch") {
      const ctx$p = ctx.effect ? { ...ctx, effect: false } : ctx;
      return foldrArray(buildBranchCond(ctx))(quote$lazy()(ctx)(force(v._2)))(arrayMap((v1) => $Pair(
        quote$lazy()(ctx$p)(force(v1._1)),
        quote$lazy()(ctx)(force(v1._2))
      ))(v._1));
    }
    if (v.tag === "SemRef") {
      if (v._1.tag === "EvalExtern") {
        return go(ctx)(neutralSpine($BackendSemantics("NeutVar", v._1._1))(v._2));
      }
      if (v._1.tag === "EvalLocal") {
        return go(ctx)(neutralSpine($BackendSemantics("NeutLocal", v._1._1, v._1._2))(v._2));
      }
      fail();
    }
    if (v.tag === "SemLam") {
      const $0 = { ...ctx, currentLevel: ctx.currentLevel + 1 | 0 };
      return build(ctx)($BackendSyntax(
        "Abs",
        [$Tuple(v._1, ctx.currentLevel)],
        quote$lazy()($0.effect ? { ...$0, effect: false } : $0)(v._2($BackendSemantics("NeutLocal", v._1, ctx.currentLevel)))
      ));
    }
    if (v.tag === "SemMkFn") {
      const loop = (loop$a0$copy) => (loop$a1$copy) => (loop$a2$copy) => {
        let loop$a0 = loop$a0$copy, loop$a1 = loop$a1$copy, loop$a2 = loop$a2$copy, loop$c = true, loop$r;
        while (loop$c) {
          const ctx$p = loop$a0, idents = loop$a1, v1 = loop$a2;
          if (v1.tag === "MkFnNext") {
            loop$a0 = { ...ctx$p, currentLevel: ctx$p.currentLevel + 1 | 0 };
            loop$a1 = snoc(idents)($Tuple(v1._1, ctx$p.currentLevel));
            loop$a2 = v1._2($BackendSemantics("NeutLocal", v1._1, ctx$p.currentLevel));
            continue;
          }
          if (v1.tag === "MkFnApplied") {
            loop$c = false;
            loop$r = build(ctx$p)($BackendSyntax(
              "UncurriedAbs",
              idents,
              quote$lazy()(ctx$p.effect ? { ...ctx$p, effect: false } : ctx$p)(v1._1)
            ));
            continue;
          }
          fail();
        }
        return loop$r;
      };
      return loop(ctx)([])(v._1);
    }
    if (v.tag === "SemMkEffectFn") {
      const loop = (loop$a0$copy) => (loop$a1$copy) => (loop$a2$copy) => {
        let loop$a0 = loop$a0$copy, loop$a1 = loop$a1$copy, loop$a2 = loop$a2$copy, loop$c = true, loop$r;
        while (loop$c) {
          const ctx$p = loop$a0, idents = loop$a1, v1 = loop$a2;
          if (v1.tag === "MkFnNext") {
            loop$a0 = { ...ctx$p, currentLevel: ctx$p.currentLevel + 1 | 0 };
            loop$a1 = snoc(idents)($Tuple(v1._1, ctx$p.currentLevel));
            loop$a2 = v1._2($BackendSemantics("NeutLocal", v1._1, ctx$p.currentLevel));
            continue;
          }
          if (v1.tag === "MkFnApplied") {
            loop$c = false;
            loop$r = build(ctx$p)($BackendSyntax(
              "UncurriedEffectAbs",
              idents,
              quote$lazy()(ctx$p.effect ? { ...ctx$p, effect: false } : ctx$p)(v1._1)
            ));
            continue;
          }
          fail();
        }
        return loop$r;
      };
      return loop(ctx)([])(v._1);
    }
    if (v.tag === "SemAssocOp") {
      const $0 = v._1;
      const $1 = v._2;
      const len = $1.length;
      const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
        let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
        while (go$1$c) {
          const ix = go$1$a0, acc = go$1$a1;
          if (ix === len) {
            go$1$c = false;
            go$1$r = acc;
            continue;
          }
          go$1$a0 = ix + 1 | 0;
          go$1$a1 = (() => {
            const $2 = $1[ix];
            if ($0.tag === "Left") {
              return build(ctx)($BackendSyntax(
                "App",
                build(ctx)($BackendSyntax("Var", $0._1)),
                [acc, quote$lazy()(ctx)($2)]
              ));
            }
            if ($0.tag === "Right") {
              return build(ctx)($BackendSyntax(
                "PrimOp",
                $BackendOperator("Op2", $0._1, acc, quote$lazy()(ctx)($2))
              ));
            }
            fail();
          })();
        }
        return go$1$r;
      };
      return go$1(1)(quote$lazy()(ctx)((() => {
        if (0 < $1.length) {
          return $1[0];
        }
        fail();
      })()));
    }
    if (v.tag === "NeutLocal") {
      return build(ctx)($BackendSyntax("Local", v._1, v._2));
    }
    if (v.tag === "NeutVar") {
      return build(ctx)($BackendSyntax("Var", v._1));
    }
    if (v.tag === "NeutStop") {
      return $BackendExpr("ExprRewrite", ctx.analyze(ctx)($BackendSyntax("Var", v._1)), $BackendRewrite("RewriteStop", v._1));
    }
    if (v.tag === "NeutData") {
      return build(ctx)($BackendSyntax(
        "CtorSaturated",
        v._1,
        v._2,
        v._3,
        v._4,
        arrayMap((() => {
          const $0 = quote$lazy()(ctx);
          return (m) => $Tuple(m._1, $0(m._2));
        })())(v._5)
      ));
    }
    if (v.tag === "NeutCtorDef") {
      return build(ctx)($BackendSyntax("CtorDef", v._2, v._3, v._4, v._5));
    }
    if (v.tag === "NeutUncurriedApp") {
      const ctx$p = ctx.effect ? { ...ctx, effect: false } : ctx;
      return build(ctx)($BackendSyntax("UncurriedApp", quote$lazy()(ctx$p)(v._1), arrayMap(quote$lazy()(ctx$p))(v._2)));
    }
    if (v.tag === "NeutUncurriedEffectApp") {
      const ctx$p = ctx.effect ? { ...ctx, effect: false } : ctx;
      return build(ctx)($BackendSyntax("UncurriedEffectApp", quote$lazy()(ctx$p)(v._1), arrayMap(quote$lazy()(ctx$p))(v._2)));
    }
    if (v.tag === "NeutApp") {
      const ctx$p = ctx.effect ? { ...ctx, effect: false } : ctx;
      const hd$p = quote$lazy()(ctx$p)(v._1);
      const $0 = arrayMap(quote$lazy()(ctx$p))(v._2);
      if ($0.length > 0) {
        return build(ctx)($BackendSyntax("App", hd$p, $0));
      }
      return hd$p;
    }
    if (v.tag === "NeutAccessor") {
      return build(ctx)($BackendSyntax("Accessor", quote$lazy()(ctx)(v._1), v._2));
    }
    if (v.tag === "NeutUpdate") {
      return build(ctx)($BackendSyntax(
        "Update",
        quote$lazy()(ctx)(v._1),
        arrayMap((() => {
          const $0 = quote$lazy()(ctx);
          return (m) => $Prop(m._1, $0(m._2));
        })())(v._2)
      ));
    }
    if (v.tag === "NeutLit") {
      return build(ctx)($BackendSyntax("Lit", functorLiteral.map(quote$lazy()(ctx))(v._1)));
    }
    if (v.tag === "NeutPrimOp") {
      return build(ctx)($BackendSyntax(
        "PrimOp",
        (() => {
          const $0 = quote$lazy()(ctx);
          if (v._1.tag === "Op1") {
            return $BackendOperator("Op1", v._1._1, $0(v._1._2));
          }
          if (v._1.tag === "Op2") {
            return $BackendOperator("Op2", v._1._1, $0(v._1._2), $0(v._1._3));
          }
          fail();
        })()
      ));
    }
    if (v.tag === "NeutPrimEffect") {
      return build(ctx)($BackendSyntax(
        "PrimEffect",
        (() => {
          const $0 = quote$lazy()(ctx.effect ? { ...ctx, effect: false } : ctx);
          if (v._1.tag === "EffectRefNew") {
            return $BackendEffect("EffectRefNew", $0(v._1._1));
          }
          if (v._1.tag === "EffectRefRead") {
            return $BackendEffect("EffectRefRead", $0(v._1._1));
          }
          if (v._1.tag === "EffectRefWrite") {
            return $BackendEffect("EffectRefWrite", $0(v._1._1), $0(v._1._2));
          }
          fail();
        })()
      ));
    }
    if (v.tag === "NeutPrimUndefined") {
      return build(ctx)(PrimUndefined);
    }
    if (v.tag === "NeutFail") {
      return build(ctx)($BackendSyntax("Fail", v._1));
    }
    fail();
  };
  return go;
});
var quote = /* @__PURE__ */ quote$lazy();
var evalApp = (env) => (hd) => (spine) => {
  const go = (mbTy) => (env$p) => (v) => (v1) => {
    const $0 = (args, ident, k, val) => $BackendSemantics(
      "SemLet",
      ident,
      val,
      (nextVal) => makeLet(Nothing)(k(nextVal))((nextFn) => go(mbTy)({
        ...env$p,
        locals: snoc(snoc(env$p.locals)($LocalBinding("One", nextVal)))($LocalBinding("One", nextFn))
      })(nextFn)(args))
    );
    const $1 = (args, k, vals) => $BackendSemantics(
      "SemLetRec",
      vals,
      (nextVals) => makeLet(Nothing)(k(nextVals))((nextFn) => go(mbTy)({
        ...env$p,
        locals: snoc(snoc(env$p.locals)($LocalBinding("Group", nextVals)))($LocalBinding("One", nextFn))
      })(nextFn)(args))
    );
    const $2 = (args, fn) => {
      if (mbTy.tag === "Just" && mbTy._1.tag === "Func") {
        const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
          let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
          while (go$1$c) {
            const b = go$1$a0, v$1 = go$1$a1;
            if (v$1.tag === "Nil") {
              go$1$c = false;
              go$1$r = b;
              continue;
            }
            if (v$1.tag === "Cons") {
              go$1$a0 = b + 1 | 0;
              go$1$a1 = v$1._2;
              continue;
            }
            fail();
          }
          return go$1$r;
        };
        const $22 = go$1(0)(args);
        const remaining = $22 < 1 ? mbTy._1._1 : sliceImpl($22, mbTy._1._1.length, mbTy._1._1);
        if (remaining.length > 0) {
          return $BackendSemantics(
            "SemTyped",
            $ExprType("Func", remaining, mbTy._1._2),
            $BackendSemantics("NeutApp", fn, toUnfoldable1(args))
          );
        }
        return $BackendSemantics("SemTyped", mbTy._1._2, $BackendSemantics("NeutApp", fn, toUnfoldable1(args)));
      }
      const app = $BackendSemantics("NeutApp", fn, toUnfoldable1(args));
      if (mbTy.tag === "Just") {
        return $BackendSemantics("SemTyped", mbTy._1, app);
      }
      if (mbTy.tag === "Nothing") {
        return app;
      }
      fail();
    };
    if (v.tag === "SemTyped") {
      return go($Maybe("Just", v._1))(env$p)(v._2)(v1);
    }
    if (v1.tag === "Cons") {
      if (v1._1.tag === "NeutFail") {
        return $BackendSemantics("NeutFail", v1._1._1);
      }
      if (v.tag === "NeutFail") {
        return $BackendSemantics("NeutFail", v._1);
      }
      if (v.tag === "SemLam") {
        const $3 = v1._2;
        return makeLet(Nothing)(v1._1)((nextArg) => go((() => {
          if (mbTy.tag === "Just" && mbTy._1.tag === "Func") {
            const v2 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), mbTy._1._1);
            if (v2.tag === "Just" && v2._1.tail.length > 0) {
              return $Maybe("Just", $ExprType("Func", v2._1.tail, mbTy._1._2));
            }
            return $Maybe("Just", mbTy._1._2);
          }
          return Nothing;
        })())(env$p)(v._2(nextArg))($3));
      }
      if (v.tag === "SemRef") {
        return go((() => {
          if (mbTy.tag === "Just" && mbTy._1.tag === "Func") {
            const v2 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), mbTy._1._1);
            if (v2.tag === "Just" && v2._1.tail.length > 0) {
              return $Maybe("Just", $ExprType("Func", v2._1.tail, mbTy._1._2));
            }
            return $Maybe("Just", mbTy._1._2);
          }
          return Nothing;
        })())(env$p)(evalRef(env$p)(v._1)(v._2)($ExternSpine("ExternApp", [v1._1]))(v._3))(v1._2);
      }
      if (v.tag === "SemLet") {
        return $0(v1, v._1, v._3, v._2);
      }
      if (v.tag === "SemLetRec") {
        return $1(v1, v._2, v._1);
      }
      if (v.tag === "NeutCtorDef" && (() => {
        const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
          let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
          while (go$1$c) {
            const b = go$1$a0, v$1 = go$1$a1;
            if (v$1.tag === "Nil") {
              go$1$c = false;
              go$1$r = b;
              continue;
            }
            if (v$1.tag === "Cons") {
              go$1$a0 = b + 1 | 0;
              go$1$a1 = v$1._2;
              continue;
            }
            fail();
          }
          return go$1$r;
        };
        return v._5.length === go$1(0)(v1);
      })()) {
        return _crashWith("CRASH CtorDef");
      }
      return $2(v1, v);
    }
    if (v.tag === "NeutFail") {
      return $BackendSemantics("NeutFail", v._1);
    }
    if (v.tag === "SemLet") {
      return $0(v1, v._1, v._3, v._2);
    }
    if (v.tag === "SemLetRec") {
      return $1(v1, v._2, v._1);
    }
    if (v.tag === "NeutCtorDef" && (() => {
      const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
        let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
        while (go$1$c) {
          const b = go$1$a0, v$1 = go$1$a1;
          if (v$1.tag === "Nil") {
            go$1$c = false;
            go$1$r = b;
            continue;
          }
          if (v$1.tag === "Cons") {
            go$1$a0 = b + 1 | 0;
            go$1$a1 = v$1._2;
            continue;
          }
          fail();
        }
        return go$1$r;
      };
      return v._5.length === go$1(0)(v1);
    })()) {
      return _crashWith("CRASH CtorDef");
    }
    if (v1.tag === "Nil") {
      if (mbTy.tag === "Just") {
        return $BackendSemantics("SemTyped", mbTy._1, v);
      }
      if (mbTy.tag === "Nothing") {
        return v;
      }
      fail();
    }
    return $2(v1, v);
  };
  return go(Nothing)(env)(hd)(fromFoldable3(spine));
};
var evalMkFn = (env) => (n) => (sem) => {
  if (n === 0) {
    return $MkFn("MkFnApplied", sem);
  }
  if (sem.tag === "SemLam") {
    return $MkFn(
      "MkFnNext",
      sem._1,
      (() => {
        const $0 = evalMkFn(env)(n - 1 | 0);
        return (x) => $0(sem._2(x));
      })()
    );
  }
  return $MkFn(
    "MkFnNext",
    Nothing,
    (nextArg) => {
      const env$p = { ...env, locals: snoc(env.locals)($LocalBinding("One", nextArg)) };
      return evalMkFn(env$p)(n - 1 | 0)(evalApp(env$p)(sem)([nextArg]));
    }
  );
};
var evalUncurriedApp = (env) => (hd) => (spine) => {
  const go = (go$a0$copy) => (go$a1$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
    while (go$c) {
      const mbTy = go$a0, v = go$a1;
      if (v.tag === "SemTyped") {
        go$a0 = $Maybe("Just", v._1);
        go$a1 = v._2;
        continue;
      }
      if (v.tag === "SemMkFn") {
        go$c = false;
        go$r = evalUncurriedBeta(NeutUncurriedApp)(v._1)(spine);
        continue;
      }
      if (v.tag === "SemRef") {
        const $0 = v._1;
        const $1 = v._3;
        const $2 = v._2;
        go$c = false;
        go$r = guardFailOver1(identity7)(spine)((spine$p) => evalRef(env)($0)($2)($ExternSpine("ExternUncurriedApp", spine$p))($1));
        continue;
      }
      if (v.tag === "SemLet") {
        go$c = false;
        go$r = $BackendSemantics(
          "SemLet",
          v._1,
          v._2,
          (nextVal) => makeLet(Nothing)(v._3(nextVal))((nextFn) => evalUncurriedApp({
            ...env,
            locals: snoc(snoc(env.locals)($LocalBinding("One", nextVal)))($LocalBinding("One", nextFn))
          })(nextFn)(spine))
        );
        continue;
      }
      if (v.tag === "NeutFail") {
        go$c = false;
        go$r = $BackendSemantics("NeutFail", v._1);
        continue;
      }
      go$c = false;
      go$r = guardFailOver1(identity7)(spine)((spine$p) => {
        if (mbTy.tag === "Just") {
          return $BackendSemantics("SemTyped", mbTy._1, $BackendSemantics("NeutUncurriedApp", v, spine$p));
        }
        if (mbTy.tag === "Nothing") {
          return $BackendSemantics("NeutUncurriedApp", v, spine$p);
        }
        fail();
      });
    }
    return go$r;
  };
  return go(Nothing)(hd);
};
var evalSpine = (env) => foldlArray((hd) => (v) => {
  if (v.tag === "ExternApp") {
    return evalApp(env)(hd)(v._1);
  }
  if (v.tag === "ExternUncurriedApp") {
    return evalUncurriedApp(env)(hd)(v._1);
  }
  if (v.tag === "ExternAccessor") {
    return evalAccessor(env)(hd)(v._1);
  }
  if (v.tag === "ExternPrimOp") {
    return evalPrimOp(env)($BackendOperator("Op1", v._1, hd));
  }
  fail();
});
var mkUncurriedAppRewrite = (env) => (hd) => {
  const go = (acc) => (n) => {
    if (n === 0) {
      return evalUncurriedApp(env)(hd)(acc);
    }
    return $BackendSemantics("SemLam", Nothing, (arg) => go(snoc(acc)(arg))(n - 1 | 0));
  };
  return go([]);
};
var evalUncurriedEffectApp = (env) => (hd) => (spine) => {
  const go = (go$a0$copy) => (go$a1$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
    while (go$c) {
      const mbTy = go$a0, v = go$a1;
      if (v.tag === "SemTyped") {
        go$a0 = $Maybe("Just", v._1);
        go$a1 = v._2;
        continue;
      }
      if (v.tag === "SemMkEffectFn") {
        go$c = false;
        go$r = evalUncurriedBeta(NeutUncurriedEffectApp)(v._1)(spine);
        continue;
      }
      if (v.tag === "SemLet") {
        go$c = false;
        go$r = $BackendSemantics(
          "SemLet",
          v._1,
          v._2,
          (nextVal) => makeLet(Nothing)(v._3(nextVal))((nextFn) => evalUncurriedEffectApp({
            ...env,
            locals: snoc(snoc(env.locals)($LocalBinding("One", nextVal)))($LocalBinding("One", nextFn))
          })(nextFn)(spine))
        );
        continue;
      }
      if (v.tag === "NeutFail") {
        go$c = false;
        go$r = $BackendSemantics("NeutFail", v._1);
        continue;
      }
      go$c = false;
      go$r = guardFailOver1(identity7)(spine)((spine$p) => {
        if (mbTy.tag === "Just") {
          return $BackendSemantics("SemTyped", mbTy._1, $BackendSemantics("NeutUncurriedEffectApp", v, spine$p));
        }
        if (mbTy.tag === "Nothing") {
          return $BackendSemantics("NeutUncurriedEffectApp", v, spine$p);
        }
        fail();
      });
    }
    return go$r;
  };
  return go(Nothing)(hd);
};
var mkFnFromArgs = (dictEval) => (env) => (args) => (body) => $BackendSemantics(
  "SemMkFn",
  foldrArray((v) => {
    const $0 = v._1;
    return (next) => (env$p) => $MkFn("MkFnNext", $0, (x) => next({ ...env$p, locals: snoc(env$p.locals)($LocalBinding("One", x)) }));
  })((x) => $MkFn("MkFnApplied", dictEval.eval(x)(body)))(args)(env)
);
var evalBackendSyntax = (dictEval) => ({
  eval: (v) => (v1) => {
    if (v1.tag === "Var") {
      const v2 = v.evalExternSpine(v)(v1._1)([]);
      if (v2.tag === "Just") {
        return v2._1;
      }
      if (v2.tag === "Nothing") {
        return $BackendSemantics(
          "SemRef",
          $EvalRef("EvalExtern", v1._1),
          [],
          defer((v3) => {
            const v4 = v.evalExternRef(v)(v1._1);
            if (v4.tag === "Just") {
              return deref(v4._1);
            }
            if (v4.tag === "Nothing") {
              return $BackendSemantics("NeutVar", v1._1);
            }
            fail();
          })
        );
      }
      fail();
    }
    if (v1.tag === "Local") {
      if (v1._2 >= 0 && v1._2 < v.locals.length) {
        if (v.locals[v1._2].tag === "One") {
          return v.locals[v1._2]._1;
        }
        if (v.locals[v1._2].tag === "Group") {
          const $0 = v.locals[v1._2]._1;
          const $1 = (() => {
            if (v1._1.tag === "Just") {
              return lookup1(v1._1._1)($0);
            }
            if (v1._1.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if ($1.tag === "Just") {
            return force($1._1);
          }
        }
      }
      return _crashWith("Unbound local at level " + showIntImpl(v1._2));
    }
    if (v1.tag === "App") {
      return evalApp(v)(dictEval.eval(v)(v1._1))(arrayMap(dictEval.eval(v))(v1._2));
    }
    if (v1.tag === "UncurriedApp") {
      return evalUncurriedApp(v)(dictEval.eval(v)(v1._1))(arrayMap(dictEval.eval(v))(v1._2));
    }
    if (v1.tag === "UncurriedAbs") {
      const $0 = v1._2;
      const loop = (env$p) => (v2) => {
        if (v2.tag === "Nil") {
          return $MkFn("MkFnApplied", dictEval.eval(env$p)($0));
        }
        if (v2.tag === "Cons") {
          const $1 = v2._2;
          return $MkFn("MkFnNext", v2._1, (nextArg) => loop({ ...env$p, locals: snoc(env$p.locals)($LocalBinding("One", nextArg)) })($1));
        }
        fail();
      };
      return $BackendSemantics(
        "SemMkFn",
        loop(v)((() => {
          const $1 = arrayMap(fst)(v1._1);
          const len = $1.length;
          const go = (go$a0$copy) => (go$a1$copy) => {
            let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
            while (go$c) {
              const source2 = go$a0, memo = go$a1;
              if (source2 < len) {
                go$a0 = source2 + 1 | 0;
                go$a1 = $List("Cons", $1[source2], memo);
                continue;
              }
              const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
                let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
                while (go$1$c) {
                  const b = go$1$a0, v$1 = go$1$a1;
                  if (v$1.tag === "Nil") {
                    go$1$c = false;
                    go$1$r = b;
                    continue;
                  }
                  if (v$1.tag === "Cons") {
                    go$1$a0 = $List("Cons", v$1._1, b);
                    go$1$a1 = v$1._2;
                    continue;
                  }
                  fail();
                }
                return go$1$r;
              };
              go$c = false;
              go$r = go$1(Nil)(memo);
            }
            return go$r;
          };
          return go(0)(Nil);
        })())
      );
    }
    if (v1.tag === "UncurriedEffectApp") {
      return evalUncurriedEffectApp(v)(dictEval.eval(v)(v1._1))(arrayMap(dictEval.eval(v))(v1._2));
    }
    if (v1.tag === "UncurriedEffectAbs") {
      const $0 = v1._2;
      const loop = (env$p) => (v2) => {
        if (v2.tag === "Nil") {
          return $MkFn("MkFnApplied", dictEval.eval(env$p)($0));
        }
        if (v2.tag === "Cons") {
          const $1 = v2._2;
          return $MkFn("MkFnNext", v2._1, (nextArg) => loop({ ...env$p, locals: snoc(env$p.locals)($LocalBinding("One", nextArg)) })($1));
        }
        fail();
      };
      return $BackendSemantics(
        "SemMkEffectFn",
        loop(v)((() => {
          const $1 = arrayMap(fst)(v1._1);
          const len = $1.length;
          const go = (go$a0$copy) => (go$a1$copy) => {
            let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
            while (go$c) {
              const source2 = go$a0, memo = go$a1;
              if (source2 < len) {
                go$a0 = source2 + 1 | 0;
                go$a1 = $List("Cons", $1[source2], memo);
                continue;
              }
              const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
                let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
                while (go$1$c) {
                  const b = go$1$a0, v$1 = go$1$a1;
                  if (v$1.tag === "Nil") {
                    go$1$c = false;
                    go$1$r = b;
                    continue;
                  }
                  if (v$1.tag === "Cons") {
                    go$1$a0 = $List("Cons", v$1._1, b);
                    go$1$a1 = v$1._2;
                    continue;
                  }
                  fail();
                }
                return go$1$r;
              };
              go$c = false;
              go$r = go$1(Nil)(memo);
            }
            return go$r;
          };
          return go(0)(Nil);
        })())
      );
    }
    if (v1.tag === "Abs") {
      const $0 = v1._2;
      const $1 = v1._1;
      const go = (go$a0$copy) => (go$a1$copy) => {
        let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
        while (go$c) {
          const ix = go$a0, acc = go$a1;
          if (ix < 0) {
            go$c = false;
            go$r = acc;
            continue;
          }
          go$a0 = ix - 1 | 0;
          go$a1 = (() => {
            const $2 = $1[ix]._1;
            return (env$p) => $BackendSemantics("SemLam", $2, (x) => acc({ ...env$p, locals: snoc(env$p.locals)($LocalBinding("One", x)) }));
          })();
        }
        return go$r;
      };
      return go($1.length - 2 | 0)((() => {
        const $2 = $1.length - 1 | 0;
        const $3 = (() => {
          if ($2 >= 0 && $2 < $1.length) {
            return $1[$2]._1;
          }
          fail();
        })();
        return (env$p) => $BackendSemantics("SemLam", $3, (x) => dictEval.eval({ ...env$p, locals: snoc(env$p.locals)($LocalBinding("One", x)) })($0));
      })())(v);
    }
    if (v1.tag === "Let") {
      const $0 = v1._4;
      return makeLet(v1._1)(dictEval.eval(v)(v1._3))((x) => dictEval.eval({ ...v, locals: snoc(v.locals)($LocalBinding("One", x)) })($0));
    }
    if (v1.tag === "LetRec") {
      const bindGroup = (sem) => (x) => dictEval.eval({ ...v, locals: snoc(v.locals)($LocalBinding("Group", x)) })(sem);
      return $BackendSemantics("SemLetRec", arrayMap((m) => $Tuple(m._1, bindGroup(m._2)))(v1._2), bindGroup(v1._3));
    }
    if (v1.tag === "EffectBind") {
      const $0 = v1._4;
      return makeEffectBind(v1._1)(dictEval.eval(v)(v1._3))((x) => dictEval.eval({ ...v, locals: snoc(v.locals)($LocalBinding("One", x)) })($0));
    }
    if (v1.tag === "EffectPure") {
      const $0 = dictEval.eval(v)(v1._1);
      if ($0.tag === "NeutFail") {
        return $BackendSemantics("NeutFail", $0._1);
      }
      return $BackendSemantics("SemEffectPure", $0);
    }
    if (v1.tag === "EffectDefer") {
      const $0 = dictEval.eval(v)(v1._1);
      if ($0.tag === "NeutFail") {
        return $BackendSemantics("NeutFail", $0._1);
      }
      return $BackendSemantics("SemEffectDefer", $0);
    }
    if (v1.tag === "Accessor") {
      return evalAccessor(v)(dictEval.eval(v)(v1._1))(v1._2);
    }
    if (v1.tag === "Update") {
      return evalUpdate(dictEval.eval(v)(v1._1))(arrayMap((() => {
        const $0 = dictEval.eval(v);
        return (m) => $Prop(m._1, $0(m._2));
      })())(v1._2));
    }
    if (v1.tag === "Branch") {
      const $0 = v1._2;
      return evalBranches(v)(arrayMap(evalPair(dictEval)(v))(v1._1))(defer((v2) => dictEval.eval(v)($0)));
    }
    if (v1.tag === "PrimOp") {
      return evalPrimOp(v)((() => {
        const $0 = dictEval.eval(v);
        if (v1._1.tag === "Op1") {
          return $BackendOperator("Op1", v1._1._1, $0(v1._1._2));
        }
        if (v1._1.tag === "Op2") {
          return $BackendOperator("Op2", v1._1._1, $0(v1._1._2), $0(v1._1._3));
        }
        fail();
      })());
    }
    if (v1.tag === "PrimEffect") {
      return guardFailOver2(identity7)((() => {
        const $0 = dictEval.eval(v);
        if (v1._1.tag === "EffectRefNew") {
          return $BackendEffect("EffectRefNew", $0(v1._1._1));
        }
        if (v1._1.tag === "EffectRefRead") {
          return $BackendEffect("EffectRefRead", $0(v1._1._1));
        }
        if (v1._1.tag === "EffectRefWrite") {
          return $BackendEffect("EffectRefWrite", $0(v1._1._1), $0(v1._1._2));
        }
        fail();
      })())(NeutPrimEffect);
    }
    if (v1.tag === "PrimUndefined") {
      return NeutPrimUndefined;
    }
    if (v1.tag === "Lit") {
      return guardFailOver3(identity7)(functorLiteral.map(dictEval.eval(v))(v1._1))(NeutLit);
    }
    if (v1.tag === "Fail") {
      return $BackendSemantics("NeutFail", v1._1);
    }
    if (v1.tag === "CtorDef") {
      return $BackendSemantics("NeutCtorDef", $Qualified($Maybe("Just", v.currentModule), v1._3), v1._1, v1._2, v1._3, v1._4);
    }
    if (v1.tag === "CtorSaturated") {
      return guardFailOver1(snd)(arrayMap((() => {
        const $0 = dictEval.eval(v);
        return (m) => $Tuple(m._1, $0(m._2));
      })())(v1._5))(NeutData(v1._1)(v1._2)(v1._3)(v1._4));
    }
    if (v1.tag === "Typed") {
      return $BackendSemantics("SemTyped", v1._1, dictEval.eval(v)(v1._2));
    }
    fail();
  }
});
var evalBackendExpr$lazy = /* @__PURE__ */ binding(() => ({
  eval: /* @__PURE__ */ (() => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const env = go$a0, v = go$a1;
        if (v.tag === "ExprRewrite") {
          if (v._2.tag === "RewriteInline") {
            go$a0 = { ...env, locals: snoc(env.locals)($LocalBinding("One", evalBackendExpr$lazy().eval(env)(v._2._3))) };
            go$a1 = v._2._4;
            continue;
          }
          if (v._2.tag === "RewriteUncurry") {
            const $0 = v._2._3;
            const $1 = v._2._5;
            go$c = false;
            go$r = $BackendSemantics(
              "SemLet",
              v._2._1,
              mkFnFromArgs(evalBackendExpr$lazy())(env)($0)(v._2._4),
              (newFn) => evalBackendExpr$lazy().eval({ ...env, locals: snoc(env.locals)($LocalBinding("One", mkUncurriedAppRewrite(env)(newFn)($0.length))) })($1)
            );
            continue;
          }
          if (v._2.tag === "RewriteStop") {
            go$c = false;
            go$r = $BackendSemantics("NeutStop", v._2._1);
            continue;
          }
          if (v._2.tag === "RewriteUnpackOp") {
            if (v._2._3.tag === "UnpackRecord") {
              go$c = false;
              go$r = foldrArray((v1) => {
                const $0 = v1._2;
                const $1 = v1._1;
                return (next) => (props$p) => makeLet(Nothing)(evalBackendExpr$lazy().eval(env)($0))((val) => next(snoc(props$p)($Prop(
                  $1,
                  val
                ))));
              })((() => {
                const $0 = v._2._4;
                return (x) => evalBackendExpr$lazy().eval({
                  ...env,
                  locals: snoc(env.locals)($LocalBinding("One", $BackendSemantics("NeutLit", $Literal("LitRecord", x))))
                })($0);
              })())(v._2._3._1)([]);
              continue;
            }
            if (v._2._3.tag === "UnpackUpdate") {
              const $0 = v._2._3._2;
              go$c = false;
              go$r = makeLet(Nothing)(evalBackendExpr$lazy().eval(env)(v._2._3._1))((hd$p) => foldrArray((v1) => {
                const $1 = v1._2;
                const $2 = v1._1;
                return (next) => (props$p) => makeLet(Nothing)(evalBackendExpr$lazy().eval(env)($1))((val) => next(snoc(props$p)($Prop(
                  $2,
                  val
                ))));
              })((() => {
                const $1 = v._2._4;
                const $2 = NeutUpdate(hd$p);
                return (x) => evalBackendExpr$lazy().eval({ ...env, locals: snoc(env.locals)($LocalBinding("One", $2(x))) })($1);
              })())($0)([]));
              continue;
            }
            if (v._2._3.tag === "UnpackArray") {
              go$c = false;
              go$r = foldrArray((expr) => (next) => (exprs$p) => makeLet(Nothing)(evalBackendExpr$lazy().eval(env)(expr))((val) => next(snoc(exprs$p)(val))))((() => {
                const $0 = v._2._4;
                return (x) => evalBackendExpr$lazy().eval({
                  ...env,
                  locals: snoc(env.locals)($LocalBinding("One", $BackendSemantics("NeutLit", $Literal("LitArray", x))))
                })($0);
              })())(v._2._3._1)([]);
              continue;
            }
            if (v._2._3.tag === "UnpackData") {
              go$c = false;
              go$r = foldrArray((v1) => {
                const $0 = v1._2;
                const $1 = v1._1;
                return (next) => (props$p) => makeLet(Nothing)(evalBackendExpr$lazy().eval(env)($0))((val) => next(snoc(props$p)($Tuple($1, val))));
              })((() => {
                const $0 = v._2._4;
                const $1 = NeutData(v._2._3._1)(v._2._3._2)(v._2._3._3)(v._2._3._4);
                return (x) => evalBackendExpr$lazy().eval({ ...env, locals: snoc(env.locals)($LocalBinding("One", $1(x))) })($0);
              })())(v._2._3._5)([]);
              continue;
            }
            fail();
          }
          if (v._2.tag === "RewriteDistBranchesLet") {
            const $0 = v._2._4;
            go$c = false;
            go$r = rewriteBranches((() => {
              const $1 = v._2._5;
              return (x) => evalBackendExpr$lazy().eval({ ...env, locals: snoc(env.locals)($LocalBinding("One", x)) })($1);
            })())(evalBranches(env)(arrayMap(evalPair(evalBackendExpr$lazy())(env))(v._2._3))(defer((v1) => evalBackendExpr$lazy().eval(env)($0))));
            continue;
          }
          if (v._2.tag === "RewriteDistBranchesOp") {
            const $0 = v._2._2;
            go$c = false;
            go$r = rewriteBranches((() => {
              if (v._2._3.tag === "DistApp") {
                const $1 = arrayMap(evalBackendExpr$lazy().eval(env))(v._2._3._1);
                return (a) => evalApp(env)(a)($1);
              }
              if (v._2._3.tag === "DistUncurriedApp") {
                const $1 = arrayMap(evalBackendExpr$lazy().eval(env))(v._2._3._1);
                return (a) => evalUncurriedApp(env)(a)($1);
              }
              if (v._2._3.tag === "DistAccessor") {
                const $1 = v._2._3._1;
                return (a) => evalAccessor(env)(a)($1);
              }
              if (v._2._3.tag === "DistPrimOp1") {
                const $1 = Op1(v._2._3._1);
                return (x) => evalPrimOp(env)($1(x));
              }
              if (v._2._3.tag === "DistPrimOp2L") {
                const $1 = Op2(v._2._3._1);
                const $2 = evalBackendExpr$lazy().eval(env)(v._2._3._2);
                return (x) => evalPrimOp(env)($1(x)($2));
              }
              if (v._2._3.tag === "DistPrimOp2R") {
                const $1 = Op2(v._2._3._2)(evalBackendExpr$lazy().eval(env)(v._2._3._1));
                return (x) => evalPrimOp(env)($1(x));
              }
              fail();
            })())(evalBranches(env)(arrayMap(evalPair(evalBackendExpr$lazy())(env))(v._2._1))(defer((v1) => evalBackendExpr$lazy().eval(env)($0))));
            continue;
          }
          fail();
        }
        if (v.tag === "ExprSyntax") {
          go$c = false;
          go$r = evalBackendSyntax(evalBackendExpr$lazy()).eval(env)(v._2);
          continue;
        }
        fail();
      }
      return go$r;
    };
    return go;
  })()
}));
var evalBackendExpr = /* @__PURE__ */ evalBackendExpr$lazy();
var optimize = (traceSteps) => (ctx) => (env) => (v) => (initN) => (originalExpr) => {
  const $0 = v._2;
  const $1 = v._1;
  const go = (go$a0$copy) => (go$a1$copy) => (go$a2$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$a2 = go$a2$copy, go$c = true, go$r;
    while (go$c) {
      const steps = go$a0, n = go$a1, expr1 = go$a2;
      const v1 = (() => {
        if (n === 0) {
          return _crashWith((() => {
            if ($1.tag === "Nothing") {
              return "" + $0 + ": Possible infinite optimization loop.";
            }
            if ($1.tag === "Just") {
              return $1._1 + "." + $0 + ": Possible infinite optimization loop.";
            }
            fail();
          })());
        }
        const expr2 = quote(ctx)(evalBackendExpr.eval(env)(expr1));
        return $Tuple(
          (() => {
            if (expr2.tag === "ExprSyntax") {
              return expr2._1.rewrite;
            }
            if (expr2.tag === "ExprRewrite") {
              return expr2._1.rewrite;
            }
            fail();
          })(),
          expr2
        );
      })();
      const newSteps = traceSteps ? $List("Cons", v1._2, steps) : steps;
      if (v1._1) {
        go$a0 = newSteps;
        go$a1 = n - 1 | 0;
        go$a2 = v1._2;
        continue;
      }
      go$c = false;
      go$r = $Tuple(reverse(toUnfoldable1(newSteps)), v1._2);
    }
    return go$r;
  };
  return go(traceSteps ? $List("Cons", originalExpr, Nil) : Nil)(initN)(originalExpr);
};
var evalNeutralExpr = { eval: (env) => (v) => evalBackendSyntax(evalNeutralExpr).eval(env)(v) };
var eval3 = /* @__PURE__ */ (() => evalBackendSyntax(evalNeutralExpr).eval)();
var addStop = (v) => (ref) => (acc) => ({
  ...v,
  directives: alter2((v2) => {
    if (v2.tag === "Just") {
      return $Maybe("Just", insert(ordInlineAccessor)(acc)(InlineNever)(v2._1));
    }
    return $Maybe("Just", $$$Map("Node", 1, 1, acc, InlineNever, Leaf, Leaf));
  })(ref)(v.directives)
});
var evalExternFromImpl = (v) => (qual) => (v1) => (spine) => {
  const $0 = v1._2;
  const $1 = () => {
    const $12 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), spine);
    if ($12.tag === "Just" && $12._1.head.tag === "ExternAccessor" && $12._1.head._1.tag === "GetProp") {
      const $22 = $12._1.head._1._1;
      if ($0.tag === "ExternExpr") {
        const $3 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
        const $4 = lookup22($InlineAccessor("InlineProp", $22));
        const v3 = (() => {
          if ($3.tag === "Just") {
            return $4($3._1);
          }
          if ($3.tag === "Nothing") {
            return Nothing;
          }
          fail();
        })();
        if (v3.tag === "Just" && v3._1.tag === "InlineAlways") {
          return $Maybe(
            "Just",
            evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", $22)))($0._2))(spine)
          );
        }
        return Nothing;
      }
      if ($0.tag === "ExternDict") {
        const $3 = findMapImpl(
          Nothing,
          isJust,
          (v$1) => {
            if ($22 === v$1._1) {
              return $Maybe("Just", v$1._2);
            }
            return Nothing;
          },
          $0._2
        );
        if ($3.tag === "Just") {
          const $4 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
          const $5 = lookup22($InlineAccessor("InlineProp", $22));
          const v42 = (() => {
            if ($4.tag === "Just") {
              return $5($4._1);
            }
            if ($4.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if (v42.tag === "Just" && v42._1.tag === "InlineAlways") {
            return $Maybe(
              "Just",
              evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", $22)))($3._1._2))($12._1.tail)
            );
          }
        }
      }
      return Nothing;
    }
    const v4 = (v5) => {
      const $22 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), spine);
      if ($22.tag === "Just" && $22._1.head.tag === "ExternApp" && $0.tag === "ExternExpr") {
        const $3 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
        const $4 = lookup22(InlineRef);
        const v7 = (() => {
          if ($3.tag === "Just") {
            return $4($3._1);
          }
          if ($3.tag === "Nothing") {
            return Nothing;
          }
          fail();
        })();
        if (v7.tag === "Just" && v7._1.tag === "InlineAlways") {
          return $Maybe(
            "Just",
            evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($0._2))(spine)
          );
        }
      }
      return Nothing;
    };
    const $2 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), spine);
    if ($2.tag === "Just" && $2._1.head.tag === "ExternApp") {
      const $3 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), $2._1.tail);
      if ($3.tag === "Just" && $3._1.head.tag === "ExternAccessor" && $3._1.head._1.tag === "GetProp") {
        const $4 = $3._1.head._1._1;
        if ($0.tag === "ExternExpr") {
          const $5 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
          const $6 = lookup22($InlineAccessor("InlineSpineProp", $4));
          const v5 = (() => {
            if ($5.tag === "Just") {
              return $6($5._1);
            }
            if ($5.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if (v5.tag === "Just" && v5._1.tag === "InlineAlways") {
            return $Maybe(
              "Just",
              evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineSpineProp", $4)))($0._2))(spine)
            );
          }
        }
        return Nothing;
      }
    }
    return v4(true);
  };
  if (spine.length === 0) {
    if ($0.tag === "ExternExpr") {
      const $2 = $0._2;
      const $3 = $0._1;
      const $4 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
      const $5 = lookup22(InlineRef);
      const v2 = (() => {
        if ($4.tag === "Just") {
          return $5($4._1);
        }
        if ($4.tag === "Nothing") {
          return Nothing;
        }
        fail();
      })();
      const $6 = () => {
        if ($2.tag === "Lit" && shouldInlineExternLiteral($2._1)) {
          return $Maybe("Just", evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2));
        }
        if ((v1._1.complexity === "Trivial" || v1._1.complexity === "Deref") && v1._1.size < 16) {
          return $Maybe("Just", evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2));
        }
        return Nothing;
      };
      if (v2.tag === "Just") {
        if (v2._1.tag === "InlineNever") {
          return $Maybe("Just", $BackendSemantics("NeutStop", qual));
        }
        if (v2._1.tag === "InlineAlways") {
          return $Maybe("Just", evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2));
        }
        if (v2._1.tag === "InlineArity") {
          return Nothing;
        }
      }
      return $6();
    }
    if ($0.tag === "ExternCtor" && $0._5.length === 0) {
      return $Maybe("Just", $BackendSemantics("NeutData", qual, $0._2, $0._3, $0._4, []));
    }
    return Nothing;
  }
  if (spine.length === 1) {
    if (spine[0].tag === "ExternAccessor") {
      if (spine[0]._1.tag === "GetProp") {
        if ($0.tag === "ExternExpr") {
          const $2 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
          const $3 = lookup22($InlineAccessor("InlineProp", spine[0]._1._1));
          const v2 = (() => {
            if ($2.tag === "Just") {
              return $3($2._1);
            }
            if ($2.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if (v2.tag === "Just") {
            if (v2._1.tag === "InlineNever") {
              return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
            }
            if (v2._1.tag === "InlineAlways") {
              return $Maybe(
                "Just",
                evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($0._2))(spine)
              );
            }
          }
          return Nothing;
        }
        if ($0.tag === "ExternDict") {
          const $2 = findMapImpl(
            Nothing,
            isJust,
            (v$1) => {
              if (spine[0]._1._1 === v$1._1) {
                return $Maybe("Just", v$1._2);
              }
              return Nothing;
            },
            $0._2
          );
          if ($2.tag === "Just") {
            const $3 = $2._1._2;
            const $4 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
            const $5 = lookup22($InlineAccessor("InlineProp", spine[0]._1._1));
            const v3 = (() => {
              if ($4.tag === "Just") {
                return $5($4._1);
              }
              if ($4.tag === "Nothing") {
                return Nothing;
              }
              fail();
            })();
            const $6 = () => $Maybe(
              "Just",
              evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($3)
            );
            if (v3.tag === "Just") {
              if (v3._1.tag === "InlineNever") {
                return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
              }
              if (v3._1.tag === "InlineAlways") {
                return $Maybe(
                  "Just",
                  evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($3)
                );
              }
              if (v3._1.tag === "InlineArity") {
                return Nothing;
              }
            }
            if (($2._1._1.complexity === "Trivial" || $2._1._1.complexity === "Deref") && $2._1._1.size < 16) {
              return $6();
            }
          }
        }
        return Nothing;
      }
      return $1();
    }
    if (spine[0].tag === "ExternApp") {
      if ($0.tag === "ExternExpr") {
        const $2 = $0._2;
        const $3 = $0._1;
        const $4 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
        const $5 = lookup22(InlineRef);
        const v2 = (() => {
          if ($4.tag === "Just") {
            return $5($4._1);
          }
          if ($4.tag === "Nothing") {
            return Nothing;
          }
          fail();
        })();
        const $6 = () => $Maybe(
          "Just",
          evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2))(spine[0]._1)
        );
        if (v2.tag === "Just") {
          if (v2._1.tag === "InlineNever") {
            return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
          }
          if (v2._1.tag === "InlineAlways") {
            return $Maybe(
              "Just",
              evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2))(spine[0]._1)
            );
          }
          if (v2._1.tag === "InlineArity") {
            if (spine[0]._1.length >= v2._1._1) {
              return $Maybe(
                "Just",
                evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($3.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))(InlineRef))($2))(spine[0]._1)
              );
            }
            return Nothing;
          }
        }
        if (shouldInlineExternApp(qual)(v1._1)($2)(spine[0]._1)) {
          return $6();
        }
        return Nothing;
      }
      if ($0.tag === "ExternCtor" && $0._5.length === spine[0]._1.length) {
        return $Maybe("Just", $BackendSemantics("NeutData", qual, $0._2, $0._3, $0._4, zipWithImpl(Tuple, $0._5, spine[0]._1)));
      }
      return Nothing;
    }
    return $1();
  }
  if (spine.length === 2) {
    if (spine[0].tag === "ExternAccessor") {
      if (spine[0]._1.tag === "GetProp" && spine[1].tag === "ExternApp") {
        if ($0.tag === "ExternExpr") {
          const $2 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
          const $3 = lookup22($InlineAccessor("InlineProp", spine[0]._1._1));
          const v2 = (() => {
            if ($2.tag === "Just") {
              return $3($2._1);
            }
            if ($2.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if (v2.tag === "Just") {
            if (v2._1.tag === "InlineNever") {
              return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
            }
            if (v2._1.tag === "InlineAlways") {
              return $Maybe(
                "Just",
                evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($0._2))(spine)
              );
            }
            if (v2._1.tag === "InlineArity" && spine[1]._1.length >= v2._1._1) {
              return $Maybe(
                "Just",
                evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($0._2))(spine)
              );
            }
          }
          return Nothing;
        }
        if ($0.tag === "ExternDict") {
          const $2 = findMapImpl(
            Nothing,
            isJust,
            (v$1) => {
              if (spine[0]._1._1 === v$1._1) {
                return $Maybe("Just", v$1._2);
              }
              return Nothing;
            },
            $0._2
          );
          if ($2.tag === "Just") {
            const $3 = $2._1._2;
            const $4 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
            const $5 = lookup22($InlineAccessor("InlineProp", spine[0]._1._1));
            const v3 = (() => {
              if ($4.tag === "Just") {
                return $5($4._1);
              }
              if ($4.tag === "Nothing") {
                return Nothing;
              }
              fail();
            })();
            const $6 = () => $Maybe(
              "Just",
              evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($3))(spine[1]._1)
            );
            if (v3.tag === "Just") {
              if (v3._1.tag === "InlineNever") {
                return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
              }
              if (v3._1.tag === "InlineAlways") {
                return $Maybe(
                  "Just",
                  evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($3))(spine[1]._1)
                );
              }
              if (v3._1.tag === "InlineArity") {
                if (spine[1]._1.length >= v3._1._1) {
                  return $Maybe(
                    "Just",
                    evalApp(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", spine[0]._1._1)))($3))(spine[1]._1)
                  );
                }
                return Nothing;
              }
            }
            if (shouldInlineExternApp(qual)($2._1._1)($3)(spine[1]._1)) {
              return $6();
            }
          }
        }
        return Nothing;
      }
      return $1();
    }
    if (spine[0].tag === "ExternApp" && spine[1].tag === "ExternAccessor" && spine[1]._1.tag === "GetProp") {
      if ($0.tag === "ExternExpr") {
        const $2 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
        const $3 = lookup22($InlineAccessor("InlineSpineProp", spine[1]._1._1));
        const v2 = (() => {
          if ($2.tag === "Just") {
            return $3($2._1);
          }
          if ($2.tag === "Nothing") {
            return Nothing;
          }
          fail();
        })();
        if (v2.tag === "Just") {
          if (v2._1.tag === "InlineNever") {
            return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
          }
          if (v2._1.tag === "InlineAlways") {
            return $Maybe(
              "Just",
              evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineSpineProp", spine[1]._1._1)))($0._2))(spine)
            );
          }
        }
      }
      return Nothing;
    }
    return $1();
  }
  if (spine.length === 3 && spine[0].tag === "ExternApp" && spine[1].tag === "ExternAccessor" && spine[1]._1.tag === "GetProp" && spine[2].tag === "ExternApp") {
    if ($0.tag === "ExternExpr") {
      const $2 = lookup32($EvalRef("EvalExtern", qual))(v.directives);
      const $3 = lookup22($InlineAccessor("InlineSpineProp", spine[1]._1._1));
      const v2 = (() => {
        if ($2.tag === "Just") {
          return $3($2._1);
        }
        if ($2.tag === "Nothing") {
          return Nothing;
        }
        fail();
      })();
      if (v2.tag === "Just") {
        if (v2._1.tag === "InlineNever") {
          return $Maybe("Just", neutralSpine($BackendSemantics("NeutStop", qual))(spine));
        }
        if (v2._1.tag === "InlineAlways") {
          return $Maybe(
            "Just",
            evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineSpineProp", spine[1]._1._1)))($0._2))(spine)
          );
        }
        if (v2._1.tag === "InlineArity" && spine[2]._1.length >= v2._1._1) {
          return $Maybe(
            "Just",
            evalSpine(v)(evalBackendSyntax(evalNeutralExpr).eval($0._1.length === 0 ? v : addStop(v)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineSpineProp", spine[1]._1._1)))($0._2))(spine)
          );
        }
      }
    }
    return Nothing;
  }
  return $1();
};
var evalExternRefFromImpl = (env) => (qual) => (v) => {
  if (v._2.tag === "ExternExpr") {
    if (v._2._2.tag === "Var" || v._2._2.tag === "Lit" || v._2._2.tag === "CtorSaturated" || v._2._2.tag === "Accessor" || v._2._2.tag === "Update" || v._2._2.tag === "PrimOp") {
      return eval3(v._2._1.length === 0 ? env : addStop(env)($EvalRef("EvalExtern", qual))(InlineRef))(v._2._2);
    }
    return $BackendSemantics("NeutVar", qual);
  }
  if (v._2.tag === "ExternDict") {
    const $0 = v._2._1;
    return $BackendSemantics(
      "NeutLit",
      $Literal(
        "LitRecord",
        arrayMap((v1) => $Prop(
          v1._1,
          eval3($0.length === 0 ? env : addStop(env)($EvalRef("EvalExtern", qual))($InlineAccessor("InlineProp", v1._1)))(v1._2._2)
        ))(v._2._2)
      )
    );
  }
  return $BackendSemantics("NeutVar", qual);
};

// output-es/PureScript.CST.Errors/index.js
var $ParseError = (tag, _1, _2) => ({ tag, _1, _2 });
var UnexpectedEof = /* @__PURE__ */ $ParseError("UnexpectedEof");
var LexExpected = (value0) => (value1) => $ParseError("LexExpected", value0, value1);

// output-es/Data.String.Regex/foreign.js
var regexImpl = function(left) {
  return function(right) {
    return function(s1) {
      return function(s2) {
        try {
          return right(new RegExp(s1, s2));
        } catch (e) {
          return left(e.message);
        }
      };
    };
  };
};
var _match = function(just) {
  return function(nothing) {
    return function(r) {
      return function(s) {
        var m = s.match(r);
        if (m == null || m.length === 0) {
          return nothing;
        } else {
          for (var i = 0; i < m.length; i++) {
            m[i] = m[i] == null ? nothing : just(m[i]);
          }
          return just(m);
        }
      };
    };
  };
};

// output-es/Data.String.Regex/index.js
var regex = (s) => (f) => regexImpl(Left)(Right)(s)((f.global ? "g" : "") + (f.ignoreCase ? "i" : "") + (f.multiline ? "m" : "") + (f.dotAll ? "s" : "") + (f.sticky ? "y" : "") + (f.unicode ? "u" : ""));
var match = /* @__PURE__ */ _match(Just)(Nothing);

// output-es/Data.String.Regex.Flags/index.js
var unicode = { global: false, ignoreCase: false, multiline: false, dotAll: false, sticky: false, unicode: true };

// output-es/Data.String.Regex.Unsafe/index.js
var unsafeRegex = (s) => (f) => {
  const $0 = regex(s)(f);
  if ($0.tag === "Left") {
    return _crashWith($0._1);
  }
  if ($0.tag === "Right") {
    return $0._1;
  }
  fail();
};

// output-es/PureScript.CST.Types/index.js
var $Comment2 = (tag, _1, _2) => ({ tag, _1, _2 });
var $IntValue = (tag, _1) => ({ tag, _1 });
var $LineFeed = (tag) => tag;
var $SourceStyle = (tag) => tag;
var $Token = (tag, _1, _2) => ({ tag, _1, _2 });
var ASCII = /* @__PURE__ */ $SourceStyle("ASCII");
var Unicode = /* @__PURE__ */ $SourceStyle("Unicode");
var LF = /* @__PURE__ */ $LineFeed("LF");
var CRLF = /* @__PURE__ */ $LineFeed("CRLF");
var TokLeftParen = /* @__PURE__ */ $Token("TokLeftParen");
var TokRightParen = /* @__PURE__ */ $Token("TokRightParen");
var TokLeftBrace = /* @__PURE__ */ $Token("TokLeftBrace");
var TokRightBrace = /* @__PURE__ */ $Token("TokRightBrace");
var TokLeftSquare = /* @__PURE__ */ $Token("TokLeftSquare");
var TokRightSquare = /* @__PURE__ */ $Token("TokRightSquare");
var TokEquals = /* @__PURE__ */ $Token("TokEquals");
var TokPipe = /* @__PURE__ */ $Token("TokPipe");
var TokTick = /* @__PURE__ */ $Token("TokTick");
var TokDot = /* @__PURE__ */ $Token("TokDot");
var TokComma = /* @__PURE__ */ $Token("TokComma");
var TokUnderscore = /* @__PURE__ */ $Token("TokUnderscore");
var TokBackslash = /* @__PURE__ */ $Token("TokBackslash");
var TokAt = /* @__PURE__ */ $Token("TokAt");
var Line = (value0) => (value1) => $Comment2("Line", value0, value1);

// output-es/PureScript.CST.Layout/index.js
var $LayoutDelim = (tag) => tag;
var LytRoot = /* @__PURE__ */ $LayoutDelim("LytRoot");
var LytTopDecl = /* @__PURE__ */ $LayoutDelim("LytTopDecl");
var LytTopDeclHead = /* @__PURE__ */ $LayoutDelim("LytTopDeclHead");
var LytDeclGuard = /* @__PURE__ */ $LayoutDelim("LytDeclGuard");
var LytCase = /* @__PURE__ */ $LayoutDelim("LytCase");
var LytCaseBinders = /* @__PURE__ */ $LayoutDelim("LytCaseBinders");
var LytCaseGuard = /* @__PURE__ */ $LayoutDelim("LytCaseGuard");
var LytLambdaBinders = /* @__PURE__ */ $LayoutDelim("LytLambdaBinders");
var LytParen = /* @__PURE__ */ $LayoutDelim("LytParen");
var LytBrace = /* @__PURE__ */ $LayoutDelim("LytBrace");
var LytSquare = /* @__PURE__ */ $LayoutDelim("LytSquare");
var LytIf = /* @__PURE__ */ $LayoutDelim("LytIf");
var LytThen = /* @__PURE__ */ $LayoutDelim("LytThen");
var LytProperty = /* @__PURE__ */ $LayoutDelim("LytProperty");
var LytForall = /* @__PURE__ */ $LayoutDelim("LytForall");
var LytTick = /* @__PURE__ */ $LayoutDelim("LytTick");
var LytLet = /* @__PURE__ */ $LayoutDelim("LytLet");
var LytLetStmt = /* @__PURE__ */ $LayoutDelim("LytLetStmt");
var LytWhere = /* @__PURE__ */ $LayoutDelim("LytWhere");
var LytOf = /* @__PURE__ */ $LayoutDelim("LytOf");
var LytDo = /* @__PURE__ */ $LayoutDelim("LytDo");
var LytAdo = /* @__PURE__ */ $LayoutDelim("LytAdo");
var isIndented = (v) => v === "LytLet" || v === "LytLetStmt" || v === "LytWhere" || v === "LytOf" || v === "LytDo" || v === "LytAdo";
var eqLayoutDelim = {
  eq: (x) => (y) => {
    if (x === "LytRoot") {
      return y === "LytRoot";
    }
    if (x === "LytTopDecl") {
      return y === "LytTopDecl";
    }
    if (x === "LytTopDeclHead") {
      return y === "LytTopDeclHead";
    }
    if (x === "LytDeclGuard") {
      return y === "LytDeclGuard";
    }
    if (x === "LytCase") {
      return y === "LytCase";
    }
    if (x === "LytCaseBinders") {
      return y === "LytCaseBinders";
    }
    if (x === "LytCaseGuard") {
      return y === "LytCaseGuard";
    }
    if (x === "LytLambdaBinders") {
      return y === "LytLambdaBinders";
    }
    if (x === "LytParen") {
      return y === "LytParen";
    }
    if (x === "LytBrace") {
      return y === "LytBrace";
    }
    if (x === "LytSquare") {
      return y === "LytSquare";
    }
    if (x === "LytIf") {
      return y === "LytIf";
    }
    if (x === "LytThen") {
      return y === "LytThen";
    }
    if (x === "LytProperty") {
      return y === "LytProperty";
    }
    if (x === "LytForall") {
      return y === "LytForall";
    }
    if (x === "LytTick") {
      return y === "LytTick";
    }
    if (x === "LytLet") {
      return y === "LytLet";
    }
    if (x === "LytLetStmt") {
      return y === "LytLetStmt";
    }
    if (x === "LytWhere") {
      return y === "LytWhere";
    }
    if (x === "LytOf") {
      return y === "LytOf";
    }
    if (x === "LytDo") {
      return y === "LytDo";
    }
    return x === "LytAdo" && y === "LytAdo";
  }
};
var insertLayout = (v) => (nextPos) => (stack) => {
  const tokPos = v.range.start;
  const insertStart = (lyt) => (v1) => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const b = go$a0, v$1 = go$a1;
        if (v$1.tag === "Nil") {
          go$c = false;
          go$r = b;
          continue;
        }
        if (v$1.tag === "Cons") {
          go$a0 = b.tag === "Nothing" && (v$1._1._2 === "LytLet" || v$1._1._2 === "LytLetStmt" || v$1._1._2 === "LytWhere" || v$1._1._2 === "LytOf" || v$1._1._2 === "LytDo" || v$1._1._2 === "LytAdo") ? $Maybe("Just", v$1._1) : b;
          go$a1 = v$1._2;
          continue;
        }
        fail();
      }
      return go$r;
    };
    const v2 = go(Nothing)(v1._1);
    if (v2.tag === "Just" && nextPos.column <= v2._1._1.column) {
      return v1;
    }
    const $02 = $List("Cons", $Tuple(nextPos, lyt), v1._1);
    return $Tuple(
      $02,
      snoc(v1._2)($Tuple(
        { range: { start: nextPos, end: nextPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutStart", nextPos.column) },
        $02
      ))
    );
  };
  const insertSep = (v1) => {
    const sepTok = { range: { start: tokPos, end: tokPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutSep", tokPos.column) };
    const $02 = (lyt, lytPos) => {
      if (lyt === "LytOf") {
        return $Tuple($List("Cons", $Tuple(tokPos, LytCaseBinders), v1._1), snoc(v1._2)($Tuple(sepTok, v1._1)));
      }
      return $Tuple(v1._1, snoc(v1._2)($Tuple(sepTok, v1._1)));
    };
    if (v1._1.tag === "Cons") {
      if (v1._1._1._2 === "LytTopDecl") {
        if (tokPos.column === v1._1._1._1.column && tokPos.line !== v1._1._1._1.line) {
          return $Tuple(v1._1._2, snoc(v1._2)($Tuple(sepTok, v1._1._2)));
        }
        if ((v1._1._1._2 === "LytLet" || v1._1._1._2 === "LytLetStmt" || v1._1._1._2 === "LytWhere" || v1._1._1._2 === "LytOf" || v1._1._1._2 === "LytDo" || v1._1._1._2 === "LytAdo") && tokPos.column === v1._1._1._1.column && tokPos.line !== v1._1._1._1.line) {
          return $02(v1._1._1._2, v1._1._1._1);
        }
        return v1;
      }
      if (v1._1._1._2 === "LytTopDeclHead" && tokPos.column === v1._1._1._1.column && tokPos.line !== v1._1._1._1.line) {
        return $Tuple(v1._1._2, snoc(v1._2)($Tuple(sepTok, v1._1._2)));
      }
      if ((v1._1._1._2 === "LytLet" || v1._1._1._2 === "LytLetStmt" || v1._1._1._2 === "LytWhere" || v1._1._1._2 === "LytOf" || v1._1._1._2 === "LytDo" || v1._1._1._2 === "LytAdo") && tokPos.column === v1._1._1._1.column && tokPos.line !== v1._1._1._1.line) {
        return $02(v1._1._1._2, v1._1._1._1);
      }
    }
    return v1;
  };
  const collapse = (p) => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const v1 = go$a0, v2 = go$a1;
        if (v1.tag === "Cons" && p(v1._1._1)(v1._1._2)) {
          go$a0 = v1._2;
          go$a1 = v1._1._2 === "LytLet" || v1._1._2 === "LytLetStmt" || v1._1._2 === "LytWhere" || v1._1._2 === "LytOf" || v1._1._2 === "LytDo" || v1._1._2 === "LytAdo" ? snoc(v2)($Tuple(
            { range: { start: tokPos, end: tokPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutEnd", v1._1._1.column) },
            v1._2
          )) : v2;
          continue;
        }
        go$c = false;
        go$r = $Tuple(v1, v2);
      }
      return go$r;
    };
    return (v$1) => go(v$1._1)(v$1._2);
  };
  const insertKwProperty = (k, state) => {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)(state));
    const v1 = $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
    if (v1._1.tag === "Cons" && v1._1._1._2 === "LytProperty") {
      return $Tuple(v1._1._2, v1._2);
    }
    return k(v1);
  };
  if (v.value.tag === "TokLowerName") {
    if (v.value._1.tag === "Nothing") {
      if (v.value._2 === "data") {
        const $04 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
          stack,
          []
        )));
        const v2 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if (v2._1.tag === "Cons" && v2._1._1._2 === "LytWhere" && v2._1._2.tag === "Cons" && v2._1._2._1._2 === "LytRoot" && v2._1._2._2.tag === "Nil" && tokPos.column === v2._1._1._1.column) {
          return $Tuple($List("Cons", $Tuple(tokPos, LytTopDecl), v2._1), v2._2);
        }
        if (v2._1.tag === "Cons" && eqLayoutDelim.eq(v2._1._1._2)(LytProperty)) {
          return $Tuple(v2._1._2, v2._2);
        }
        return v2;
      }
      if (v.value._2 === "class") {
        const $04 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
          stack,
          []
        )));
        const v2 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if (v2._1.tag === "Cons" && v2._1._1._2 === "LytWhere" && v2._1._2.tag === "Cons" && v2._1._2._1._2 === "LytRoot" && v2._1._2._2.tag === "Nil" && tokPos.column === v2._1._1._1.column) {
          return $Tuple($List("Cons", $Tuple(tokPos, LytTopDeclHead), v2._1), v2._2);
        }
        if (v2._1.tag === "Cons" && eqLayoutDelim.eq(v2._1._1._2)(LytProperty)) {
          return $Tuple(v2._1._2, v2._2);
        }
        return v2;
      }
      if (v.value._2 === "where") {
        const whereP = (v2) => (v3) => v3 === "LytDo" || (v3 === "LytLet" || v3 === "LytLetStmt" || v3 === "LytWhere" || v3 === "LytOf" || v3 === "LytDo" || v3 === "LytAdo") && tokPos.column <= v2.column;
        if (stack.tag === "Cons") {
          if (stack._1._2 === "LytTopDeclHead") {
            return insertStart(LytWhere)($Tuple(stack._2, snoc([])($Tuple(v, stack._2))));
          }
          if (stack._1._2 === "LytProperty") {
            return $Tuple(stack._2, snoc([])($Tuple(v, stack._2)));
          }
        }
        return insertStart(LytWhere)((() => {
          const $04 = collapse(whereP)($Tuple(stack, []));
          return $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        })());
      }
      if (v.value._2 === "in") {
        const v2 = collapse((v22) => (v3) => {
          if (v3 === "LytLet") {
            return false;
          }
          if (v3 === "LytAdo") {
            return false;
          }
          return v3 === "LytLet" || v3 === "LytLetStmt" || v3 === "LytWhere" || v3 === "LytOf" || v3 === "LytDo" || v3 === "LytAdo";
        })($Tuple(stack, []));
        if (v2._1.tag === "Cons") {
          if (v2._1._1._2 === "LytLetStmt" && v2._1._2.tag === "Cons" && v2._1._2._1._2 === "LytAdo") {
            return $Tuple(
              v2._1._2._2,
              snoc(snoc(snoc(v2._2)($Tuple(
                { range: { start: tokPos, end: tokPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutEnd", v2._1._1._1.column) },
                v2._1._2._2
              )))($Tuple(
                { range: { start: tokPos, end: tokPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutEnd", v2._1._2._1._1.column) },
                v2._1._2._2
              )))($Tuple(v, v2._1._2._2))
            );
          }
          if (v2._1._1._2 === "LytLet" || v2._1._1._2 === "LytLetStmt" || v2._1._1._2 === "LytWhere" || v2._1._1._2 === "LytOf" || v2._1._1._2 === "LytDo" || v2._1._1._2 === "LytAdo") {
            return $Tuple(
              v2._1._2,
              snoc(snoc(v2._2)($Tuple(
                { range: { start: tokPos, end: tokPos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutEnd", v2._1._1._1.column) },
                v2._1._2
              )))($Tuple(v, v2._1._2))
            );
          }
        }
        const $04 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
          stack,
          []
        )));
        const $12 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if ($12._1.tag === "Cons" && eqLayoutDelim.eq($12._1._1._2)(LytProperty)) {
          return $Tuple($12._1._2, $12._2);
        }
        return $12;
      }
      if (v.value._2 === "let") {
        return insertKwProperty(
          (v2) => {
            if (v2._1.tag === "Cons") {
              if (v2._1._1._2 === "LytDo") {
                if (v2._1._1._1.column === tokPos.column) {
                  return insertStart(LytLetStmt)(v2);
                }
                return insertStart(LytLet)(v2);
              }
              if (v2._1._1._2 === "LytAdo" && v2._1._1._1.column === tokPos.column) {
                return insertStart(LytLetStmt)(v2);
              }
            }
            return insertStart(LytLet)(v2);
          },
          $Tuple(stack, [])
        );
      }
      if (v.value._2 === "do") {
        return insertKwProperty(insertStart(LytDo), $Tuple(stack, []));
      }
      if (v.value._2 === "ado") {
        return insertKwProperty(insertStart(LytAdo), $Tuple(stack, []));
      }
      if (v.value._2 === "case") {
        return insertKwProperty((v1) => $Tuple($List("Cons", $Tuple(tokPos, LytCase), v1._1), v1._2), $Tuple(stack, []));
      }
      if (v.value._2 === "of") {
        const v2 = collapse((v$1) => isIndented)($Tuple(stack, []));
        if (v2._1.tag === "Cons" && v2._1._1._2 === "LytCase") {
          const $05 = insertStart(LytOf)($Tuple(v2._1._2, snoc(v2._2)($Tuple(v, v2._1._2))));
          return $Tuple($List("Cons", $Tuple(nextPos, LytCaseBinders), $05._1), $05._2);
        }
        const $04 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)(v2));
        const $12 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if ($12._1.tag === "Cons" && eqLayoutDelim.eq($12._1._1._2)(LytProperty)) {
          return $Tuple($12._1._2, $12._2);
        }
        return $12;
      }
      if (v.value._2 === "if") {
        return insertKwProperty((v1) => $Tuple($List("Cons", $Tuple(tokPos, LytIf), v1._1), v1._2), $Tuple(stack, []));
      }
      if (v.value._2 === "then") {
        const v2 = collapse((v$1) => isIndented)($Tuple(stack, []));
        if (v2._1.tag === "Cons" && v2._1._1._2 === "LytIf") {
          return $Tuple($List("Cons", $Tuple(tokPos, LytThen), v2._1._2), snoc(v2._2)($Tuple(v, v2._1._2)));
        }
        const $04 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
          stack,
          []
        )));
        const $12 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if ($12._1.tag === "Cons" && eqLayoutDelim.eq($12._1._1._2)(LytProperty)) {
          return $Tuple($12._1._2, $12._2);
        }
        return $12;
      }
      if (v.value._2 === "else") {
        const v2 = collapse((v$1) => isIndented)($Tuple(stack, []));
        if (v2._1.tag === "Cons" && v2._1._1._2 === "LytThen") {
          return $Tuple(v2._1._2, snoc(v2._2)($Tuple(v, v2._1._2)));
        }
        const v3 = collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
          stack,
          []
        ));
        if (v3._1.tag === "Cons" && v3._1._1._2 === "LytWhere" && v3._1._2.tag === "Cons" && v3._1._2._1._2 === "LytRoot" && v3._1._2._2.tag === "Nil" && tokPos.column === v3._1._1._1.column) {
          return $Tuple(v3._1, snoc(v3._2)($Tuple(v, v3._1)));
        }
        const $04 = insertSep(v3);
        const $12 = $Tuple($04._1, snoc($04._2)($Tuple(v, $04._1)));
        if ($12._1.tag === "Cons" && eqLayoutDelim.eq($12._1._1._2)(LytProperty)) {
          return $Tuple($12._1._2, $12._2);
        }
        return $12;
      }
      const $03 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
        stack,
        []
      )));
      const $1 = $Tuple($03._1, snoc($03._2)($Tuple(v, $03._1)));
      if ($1._1.tag === "Cons" && eqLayoutDelim.eq($1._1._1._2)(LytProperty)) {
        return $Tuple($1._1._2, $1._2);
      }
      return $1;
    }
    if (v.value._2 === "do") {
      return insertKwProperty(insertStart(LytDo), $Tuple(stack, []));
    }
    if (v.value._2 === "ado") {
      return insertKwProperty(insertStart(LytAdo), $Tuple(stack, []));
    }
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokForall") {
    return insertKwProperty((v1) => $Tuple($List("Cons", $Tuple(tokPos, LytForall), v1._1), v1._2), $Tuple(stack, []));
  }
  if (v.value.tag === "TokBackslash") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($List("Cons", $Tuple(tokPos, LytLambdaBinders), $02._1), snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokRightArrow") {
    const $02 = collapse((v2) => (v3) => {
      if (v3 === "LytDo") {
        return true;
      }
      if (v3 === "LytOf") {
        return false;
      }
      return (v3 === "LytLet" || v3 === "LytLetStmt" || v3 === "LytWhere" || v3 === "LytOf" || v3 === "LytDo" || v3 === "LytAdo") && tokPos.column <= v2.column;
    })($Tuple(stack, []));
    if ($02._1.tag === "Cons" && ($02._1._1._2 === "LytCaseBinders" || $02._1._1._2 === "LytCaseGuard" || $02._1._1._2 === "LytLambdaBinders")) {
      return $Tuple($02._1._2, snoc($02._2)($Tuple(v, $02._1._2)));
    }
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokEquals") {
    const v2 = collapse((v22) => (v3) => v3 === "LytWhere" || v3 === "LytLet" || v3 === "LytLetStmt")($Tuple(stack, []));
    if (v2._1.tag === "Cons" && v2._1._1._2 === "LytDeclGuard") {
      return $Tuple(v2._1._2, snoc(v2._2)($Tuple(v, v2._1._2)));
    }
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokPipe") {
    const v2 = collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column <= lytPos.column)($Tuple(
      stack,
      []
    ));
    if (v2._1.tag === "Cons") {
      if (v2._1._1._2 === "LytOf") {
        const $03 = $List("Cons", $Tuple(tokPos, LytCaseGuard), v2._1);
        return $Tuple($03, snoc(v2._2)($Tuple(v, $03)));
      }
      if (v2._1._1._2 === "LytLet") {
        const $03 = $List("Cons", $Tuple(tokPos, LytDeclGuard), v2._1);
        return $Tuple($03, snoc(v2._2)($Tuple(v, $03)));
      }
      if (v2._1._1._2 === "LytLetStmt") {
        const $03 = $List("Cons", $Tuple(tokPos, LytDeclGuard), v2._1);
        return $Tuple($03, snoc(v2._2)($Tuple(v, $03)));
      }
      if (v2._1._1._2 === "LytWhere") {
        const $03 = $List("Cons", $Tuple(tokPos, LytDeclGuard), v2._1);
        return $Tuple($03, snoc(v2._2)($Tuple(v, $03)));
      }
    }
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokTick") {
    const v2 = collapse((v$1) => isIndented)($Tuple(stack, []));
    if (v2._1.tag === "Cons" && v2._1._1._2 === "LytTick") {
      return $Tuple(v2._1._2, snoc(v2._2)($Tuple(v, v2._1._2)));
    }
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column <= lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($List("Cons", $Tuple(tokPos, LytTick), $02._1), snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokComma") {
    const v2 = collapse((v$1) => isIndented)($Tuple(stack, []));
    if (v2._1.tag === "Cons" && v2._1._1._2 === "LytBrace") {
      return $Tuple($List("Cons", $Tuple(tokPos, LytProperty), v2._1), snoc(v2._2)($Tuple(v, v2._1)));
    }
    return $Tuple(v2._1, snoc(v2._2)($Tuple(v, v2._1)));
  }
  if (v.value.tag === "TokDot") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    const $1 = snoc($02._2)($Tuple(v, $02._1));
    if ($02._1.tag === "Cons" && $02._1._1._2 === "LytForall") {
      return $Tuple($02._1._2, $1);
    }
    return $Tuple($List("Cons", $Tuple(tokPos, LytProperty), $02._1), $1);
  }
  if (v.value.tag === "TokLeftParen") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($List("Cons", $Tuple(tokPos, LytParen), $02._1), snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokLeftBrace") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple(
      $List("Cons", $Tuple(tokPos, LytProperty), $List("Cons", $Tuple(tokPos, LytBrace), $02._1)),
      snoc($02._2)($Tuple(v, $02._1))
    );
  }
  if (v.value.tag === "TokLeftSquare") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($List("Cons", $Tuple(tokPos, LytSquare), $02._1), snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokRightParen") {
    const $02 = collapse((v$1) => isIndented)($Tuple(stack, []));
    if ($02._1.tag === "Cons" && eqLayoutDelim.eq($02._1._1._2)(LytParen)) {
      return $Tuple($02._1._2, snoc($02._2)($Tuple(v, $02._1._2)));
    }
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokRightBrace") {
    const $02 = collapse((v$1) => isIndented)($Tuple(stack, []));
    if ($02._1.tag === "Cons" && eqLayoutDelim.eq($02._1._1._2)(LytProperty)) {
      if ($02._1._2.tag === "Cons" && eqLayoutDelim.eq($02._1._2._1._2)(LytBrace)) {
        return $Tuple($02._1._2._2, snoc($02._2)($Tuple(v, $02._1._2._2)));
      }
      return $Tuple($02._1._2, snoc($02._2)($Tuple(v, $02._1._2)));
    }
    if ($02._1.tag === "Cons" && eqLayoutDelim.eq($02._1._1._2)(LytBrace)) {
      return $Tuple($02._1._2, snoc($02._2)($Tuple(v, $02._1._2)));
    }
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokRightSquare") {
    const $02 = collapse((v$1) => isIndented)($Tuple(stack, []));
    if ($02._1.tag === "Cons" && eqLayoutDelim.eq($02._1._1._2)(LytSquare)) {
      return $Tuple($02._1._2, snoc($02._2)($Tuple(v, $02._1._2)));
    }
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  if (v.value.tag === "TokString") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
      stack,
      []
    )));
    const $1 = $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
    if ($1._1.tag === "Cons" && eqLayoutDelim.eq($1._1._1._2)(LytProperty)) {
      return $Tuple($1._1._2, $1._2);
    }
    return $1;
  }
  if (v.value.tag === "TokOperator") {
    const $02 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column <= lytPos.column)($Tuple(
      stack,
      []
    )));
    return $Tuple($02._1, snoc($02._2)($Tuple(v, $02._1)));
  }
  const $0 = insertSep(collapse((lytPos) => (lyt) => (lyt === "LytLet" || lyt === "LytLetStmt" || lyt === "LytWhere" || lyt === "LytOf" || lyt === "LytDo" || lyt === "LytAdo") && tokPos.column < lytPos.column)($Tuple(
    stack,
    []
  )));
  return $Tuple($0._1, snoc($0._2)($Tuple(v, $0._1)));
};

// output-es/PureScript.CST.TokenStream/index.js
var $TokenStep = (tag, _1, _2, _3, _4) => ({ tag, _1, _2, _3, _4 });
var unwindLayout = (pos) => (eof2) => {
  const go = (stk) => defer((v) => {
    if (stk.tag === "Nil") {
      return force(eof2);
    }
    if (stk.tag === "Cons") {
      if (stk._1._2 === "LytRoot") {
        return force(eof2);
      }
      if (stk._1._2 === "LytLet" || stk._1._2 === "LytLetStmt" || stk._1._2 === "LytWhere" || stk._1._2 === "LytOf" || stk._1._2 === "LytDo" || stk._1._2 === "LytAdo") {
        return $TokenStep(
          "TokenCons",
          { range: { start: pos, end: pos }, leadingComments: [], trailingComments: [], value: $Token("TokLayoutEnd", stk._1._1.column) },
          pos,
          go(stk._2),
          stk._2
        );
      }
      return force(go(stk._2));
    }
    fail();
  });
  return go;
};
var consTokens = (dictFoldable) => {
  const $0 = dictFoldable.foldr((v) => (v1) => {
    const $02 = v1._2;
    const $1 = v1._1;
    const $2 = v._2;
    const $3 = v._1;
    return $Tuple($3.range.start, defer((v2) => $TokenStep("TokenCons", $3, $1, $02, $2)));
  });
  return (b) => (a) => $0(a)(b);
};

// output-es/PureScript.CST.Lexer/index.js
var $LexResult = (tag, _1, _2) => ({ tag, _1, _2 });
var fold1 = /* @__PURE__ */ (() => foldableArray.foldMap(/* @__PURE__ */ (() => {
  const semigroupRecord1 = { append: (ra) => (rb) => ({ raw: ra.raw + rb.raw, string: ra.string + rb.string }) };
  return { mempty: { raw: "", string: "" }, Semigroup0: () => semigroupRecord1 };
})())(identity2))();
var consTokens2 = /* @__PURE__ */ consTokens(foldableArray);
var isCharCodePoint = /* @__PURE__ */ (() => ({ fromChar: codePointFromChar, fromCharCode: boundedEnumCodePoint.toEnum }))();
var isCharChar = { fromChar: (x) => x, fromCharCode: charToEnum };
var toModuleName = (v) => {
  if (v === "") {
    return Nothing;
  }
  return $Maybe("Just", take(length2(v) - 1 | 0)(v));
};
var optional = (v) => (str) => {
  const v1 = v(str);
  if (v1.tag === "LexFail") {
    if (length2(str) === length2(v1._2)) {
      return $LexResult("LexSucc", Nothing, str);
    }
    return $LexResult("LexFail", v1._1, v1._2);
  }
  if (v1.tag === "LexSucc") {
    return $LexResult("LexSucc", $Maybe("Just", v1._1), v1._2);
  }
  fail();
};
var mkUnexpected = (str) => {
  const start = take2(6)(str);
  const len = toCodePointArray(start).length;
  if (len === 0) {
    return "end of file";
  }
  if (len < 6) {
    return start;
  }
  return start + "...";
};
var regex2 = (mkErr) => (regexStr) => {
  const matchRegex = unsafeRegex("^(?:" + regexStr + ")")(unicode);
  return (str) => {
    const v = match(matchRegex)(str);
    if (v.tag === "Just") {
      const $0 = (() => {
        if (0 < v._1.length) {
          return v._1[0];
        }
        fail();
      })();
      if ($0.tag === "Just") {
        return $LexResult("LexSucc", $0._1, drop(length2($0._1))(str));
      }
    }
    return $LexResult("LexFail", (v3) => mkErr(mkUnexpected(str)), str);
  };
};
var satisfy = (mkErr) => (p) => (str) => {
  const v = charAt2(0)(str);
  if (v.tag === "Just" && p(v._1)) {
    return $LexResult("LexSucc", v._1, drop(1)(str));
  }
  return $LexResult("LexFail", (v1) => mkErr(mkUnexpected(str)), str);
};
var string = (mkErr) => (match2) => (str) => {
  if (take(length2(match2))(str) === match2) {
    return $LexResult("LexSucc", match2, drop(length2(match2))(str));
  }
  return $LexResult("LexFail", (v) => mkErr(mkUnexpected(str)), str);
};
var many = (v) => (str) => {
  const valuesRef = [];
  const strRef = newSTRef(str)();
  const contRef = newSTRef(true)();
  const resRef = newSTRef($LexResult("LexSucc", [], str))();
  while (contRef.value) {
    const str$p = strRef.value;
    const v1 = v(str$p);
    if (v1.tag === "LexFail") {
      if (length2(str$p) === length2(v1._2)) {
        resRef.value = $LexResult("LexSucc", valuesRef, v1._2);
        contRef.value = false;
        continue;
      }
      resRef.value = $LexResult("LexFail", v1._1, v1._2);
      contRef.value = false;
      continue;
    }
    if (v1.tag === "LexSucc") {
      valuesRef.push(v1._1);
      strRef.value = v1._2;
      continue;
    }
    fail();
  }
  return resRef.value;
};
var functorLex = {
  map: (f) => (v) => (str) => {
    const v1 = v(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      return $LexResult("LexSucc", f(v1._1), v1._2);
    }
    fail();
  }
};
var spaceComment = /* @__PURE__ */ (() => {
  const $0 = regex2(LexExpected("spaces"))(" +");
  return (str) => {
    const v1 = $0(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      return $LexResult("LexSucc", length2(v1._1), v1._2);
    }
    fail();
  };
})();
var char$p = (mkErr) => (res) => (match2) => (str) => {
  if (singleton(match2) === take(1)(str)) {
    return $LexResult("LexSucc", res, drop(1)(str));
  }
  return $LexResult("LexFail", (v) => mkErr(mkUnexpected(str)), str);
};
var $$char = (mkErr) => (match2) => (str) => {
  if (singleton(match2) === take(1)(str)) {
    return $LexResult("LexSucc", match2, drop(1)(str));
  }
  return $LexResult("LexFail", (v) => mkErr(mkUnexpected(str)), str);
};
var bumpText = (v) => (colOffset) => (str) => {
  const $0 = v.column;
  const $1 = v.line;
  const go = (go$a0$copy) => (go$a1$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
    while (go$c) {
      const n = go$a0, ix = go$a1;
      const v1 = indexOf$p("\n")(ix)(str);
      if (v1.tag === "Just") {
        go$a0 = n + 1 | 0;
        go$a1 = v1._1 + 1 | 0;
        continue;
      }
      if (v1.tag === "Nothing") {
        if (n === 0) {
          go$c = false;
          go$r = { line: $1, column: ($0 + toCodePointArray(str).length | 0) + (colOffset * 2 | 0) | 0 };
          continue;
        }
        go$c = false;
        go$r = { line: $1 + n | 0, column: toCodePointArray(drop(ix)(str)).length + colOffset | 0 };
        continue;
      }
      fail();
    }
    return go$r;
  };
  return go(0)(0);
};
var bumpToken = (v) => {
  const $0 = v.column;
  const $1 = v.line;
  return (v1) => {
    if (v1.tag === "TokLeftParen") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokRightParen") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokLeftBrace") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokRightBrace") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokLeftSquare") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokRightSquare") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokLeftArrow") {
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 2 | 0 };
      }
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 1 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokRightArrow") {
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 2 | 0 };
      }
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 1 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokRightFatArrow") {
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 2 | 0 };
      }
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 1 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokDoubleColon") {
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 2 | 0 };
      }
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 1 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokForall") {
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 6 | 0 };
      }
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 1 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokEquals") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokPipe") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokTick") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokDot") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokComma") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokUnderscore") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokBackslash") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokAt") {
      return { line: $1, column: $0 + 1 | 0 };
    }
    if (v1.tag === "TokLowerName") {
      return {
        line: $1,
        column: (() => {
          if (v1._1.tag === "Nothing") {
            return $0 + 0 | 0;
          }
          if (v1._1.tag === "Just") {
            return ($0 + 1 | 0) + toCodePointArray(v1._1._1).length | 0;
          }
          fail();
        })() + toCodePointArray(v1._2).length | 0
      };
    }
    if (v1.tag === "TokUpperName") {
      return {
        line: $1,
        column: (() => {
          if (v1._1.tag === "Nothing") {
            return $0 + 0 | 0;
          }
          if (v1._1.tag === "Just") {
            return ($0 + 1 | 0) + toCodePointArray(v1._1._1).length | 0;
          }
          fail();
        })() + toCodePointArray(v1._2).length | 0
      };
    }
    if (v1.tag === "TokOperator") {
      return {
        line: $1,
        column: (() => {
          if (v1._1.tag === "Nothing") {
            return $0 + 0 | 0;
          }
          if (v1._1.tag === "Just") {
            return ($0 + 1 | 0) + toCodePointArray(v1._1._1).length | 0;
          }
          fail();
        })() + toCodePointArray(v1._2).length | 0
      };
    }
    if (v1.tag === "TokSymbolName") {
      return {
        line: $1,
        column: ((() => {
          if (v1._1.tag === "Nothing") {
            return $0 + 0 | 0;
          }
          if (v1._1.tag === "Just") {
            return ($0 + 1 | 0) + toCodePointArray(v1._1._1).length | 0;
          }
          fail();
        })() + toCodePointArray(v1._2).length | 0) + 2 | 0
      };
    }
    if (v1.tag === "TokSymbolArrow") {
      if (v1._1 === "Unicode") {
        return { line: $1, column: $0 + 3 | 0 };
      }
      if (v1._1 === "ASCII") {
        return { line: $1, column: $0 + 4 | 0 };
      }
      fail();
    }
    if (v1.tag === "TokHole") {
      return { line: $1, column: ($0 + toCodePointArray(v1._1).length | 0) + 1 | 0 };
    }
    if (v1.tag === "TokChar") {
      return { line: $1, column: ($0 + toCodePointArray(v1._1).length | 0) + 2 | 0 };
    }
    if (v1.tag === "TokInt") {
      return { line: $1, column: $0 + toCodePointArray(v1._1).length | 0 };
    }
    if (v1.tag === "TokNumber") {
      return { line: $1, column: $0 + toCodePointArray(v1._1).length | 0 };
    }
    if (v1.tag === "TokString") {
      return bumpText(v)(1)(v1._1);
    }
    if (v1.tag === "TokRawString") {
      return bumpText(v)(3)(v1._1);
    }
    if (v1.tag === "TokLayoutStart") {
      return v;
    }
    if (v1.tag === "TokLayoutSep") {
      return v;
    }
    if (v1.tag === "TokLayoutEnd") {
      return v;
    }
    fail();
  };
};
var bumpComment = (v) => {
  const $0 = v.column;
  const $1 = v.line;
  return (v1) => {
    if (v1.tag === "Comment") {
      return bumpText(v)(0)(v1._1);
    }
    if (v1.tag === "Space") {
      return { line: $1, column: $0 + v1._1 | 0 };
    }
    if (v1.tag === "Line") {
      return { line: $1 + v1._2 | 0, column: 0 };
    }
    fail();
  };
};
var altLex = {
  alt: (v) => (v1) => (str) => {
    const v2 = v(str);
    if (v2.tag === "LexFail") {
      if (length2(str) === length2(v2._2)) {
        return v1(str);
      }
      return $LexResult("LexFail", v2._1, v2._2);
    }
    if (v2.tag === "LexSucc") {
      return $LexResult("LexSucc", v2._1, v2._2);
    }
    fail();
  },
  Functor0: () => functorLex
};
var comment = /* @__PURE__ */ (() => altLex.alt(regex2(LexExpected("block comment"))("\\{-(-(?!\\})|[^-]+)*(-\\}|$)"))(regex2(LexExpected("line comment"))("--[^\\r\\n]*")))();
var lineComment = /* @__PURE__ */ (() => altLex.alt((() => {
  const $0 = Line(LF);
  const $1 = regex2(LexExpected("newline"))("\n+");
  return (str) => {
    const v1 = $1(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      return $LexResult("LexSucc", $0(toCodePointArray(v1._1).length), v1._2);
    }
    fail();
  };
})())((() => {
  const $0 = Line(CRLF);
  const $1 = regex2(LexExpected("newline"))("(?:\r\n)+");
  return (str) => {
    const v1 = $1(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      return $LexResult("LexSucc", $0(intDiv(toCodePointArray(v1._1).length, 2)), v1._2);
    }
    fail();
  };
})()))();
var leadingComments = /* @__PURE__ */ (() => many(altLex.alt((str) => {
  const v1 = comment(str);
  if (v1.tag === "LexFail") {
    return $LexResult("LexFail", v1._1, v1._2);
  }
  if (v1.tag === "LexSucc") {
    return $LexResult("LexSucc", $Comment2("Comment", v1._1), v1._2);
  }
  fail();
})(altLex.alt((str) => {
  const v1 = spaceComment(str);
  if (v1.tag === "LexFail") {
    return $LexResult("LexFail", v1._1, v1._2);
  }
  if (v1.tag === "LexSucc") {
    return $LexResult("LexSucc", $Comment2("Space", v1._1), v1._2);
  }
  fail();
})(lineComment))))();
var token = /* @__PURE__ */ (() => {
  const tokenRightParen = char$p(LexExpected("right paren"))(TokRightParen)(")");
  const tokenLeftParen = char$p(LexExpected("left paren"))(TokLeftParen)("(");
  const stripUnderscores = replaceAll("_")("");
  const parseSymbolIdent = regex2(LexExpected("symbol"))("(?:[:!#$%&*+./<=>?@\\\\^|~-]|(?!\\p{P})\\p{S})+");
  const parseProper = regex2(LexExpected("proper name"))("\\p{Lu}[\\p{L}0-9_']*");
  const parseIdent = regex2(LexExpected("ident"))("[\\p{Ll}_][\\p{L}0-9_']*");
  const intPartRegex = regex2(LexExpected("int part"))("(0|[1-9][0-9_]*)");
  const hexEscapeRegex = regex2(LexExpected("hex"))("[a-fA-F0-9]{1,6}");
  const charSingleQuote = $$char(LexExpected("single quote"))("'");
  const charQuote = $$char(LexExpected("quote"))('"');
  const charAny = satisfy(LexExpected("char"))((v) => true);
  const parseEscape = (dictIsChar) => (str) => {
    const v1 = charAny(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      if (v1._1 === "t") {
        return $LexResult("LexSucc", { raw: "\\t", char: dictIsChar.fromChar("	") }, v1._2);
      }
      if (v1._1 === "r") {
        return $LexResult("LexSucc", { raw: "\\r", char: dictIsChar.fromChar("\r") }, v1._2);
      }
      if (v1._1 === "n") {
        return $LexResult("LexSucc", { raw: "\\n", char: dictIsChar.fromChar("\n") }, v1._2);
      }
      if (v1._1 === '"') {
        return $LexResult("LexSucc", { raw: '\\"', char: dictIsChar.fromChar('"') }, v1._2);
      }
      if (v1._1 === "'") {
        return $LexResult("LexSucc", { raw: "\\'", char: dictIsChar.fromChar("'") }, v1._2);
      }
      if (v1._1 === "\\") {
        return $LexResult("LexSucc", { raw: "\\\\", char: dictIsChar.fromChar("\\") }, v1._2);
      }
      if (v1._1 === "x") {
        const v1$1 = hexEscapeRegex(v1._2);
        if (v1$1.tag === "LexFail") {
          return $LexResult("LexFail", v1$1._1, v1$1._2);
        }
        if (v1$1.tag === "LexSucc") {
          const $02 = fromStringAs(16)(v1$1._1);
          const v = (() => {
            if ($02.tag === "Just") {
              return dictIsChar.fromCharCode($02._1);
            }
            if ($02.tag === "Nothing") {
              return Nothing;
            }
            fail();
          })();
          if (v.tag === "Just") {
            return $LexResult("LexSucc", { raw: "\\x" + v1$1._1, char: v._1 }, v1$1._2);
          }
          if (v.tag === "Nothing") {
            return $LexResult("LexFail", (v$1) => $ParseError("LexCharEscapeOutOfRange", v1$1._1), v1$1._2);
          }
        }
        fail();
      }
      const $0 = $ParseError("LexInvalidCharEscape", singleton(v1._1));
      return $LexResult("LexFail", (v) => $0, v1._2);
    }
    fail();
  };
  const parseEscape1 = parseEscape(isCharChar);
  return altLex.alt((() => {
    const $0 = $$char(LexExpected("question mark"))("?");
    return (str) => {
      const v1 = $0(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, str);
      }
      if (v1.tag === "LexSucc") {
        const v3 = altLex.alt(parseIdent)(parseProper)(v1._2);
        if (v3.tag === "LexFail") {
          return $LexResult("LexFail", v3._1, str);
        }
        if (v3.tag === "LexSucc") {
          return $LexResult("LexSucc", $Token("TokHole", v3._1), v3._2);
        }
      }
      fail();
    };
  })())(altLex.alt((() => {
    const $0 = regex2(LexExpected("module name"))("(?:(?:\\p{Lu}[\\p{L}0-9_']*)\\.)*");
    const $1 = altLex.alt((str) => {
      const v1 = parseIdent(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        return $LexResult(
          "LexSucc",
          (() => {
            const $12 = v1._1;
            return (v1$1) => {
              if (v1$1.tag === "Nothing") {
                if ($12 === "forall") {
                  return $Token("TokForall", ASCII);
                }
                if ($12 === "_") {
                  return TokUnderscore;
                }
                return $Token("TokLowerName", Nothing, $12);
              }
              return $Token("TokLowerName", v1$1, $12);
            };
          })(),
          v1._2
        );
      }
      fail();
    })(altLex.alt((str) => {
      const v1 = parseProper(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        return $LexResult(
          "LexSucc",
          (() => {
            const $12 = v1._1;
            return (a) => $Token("TokUpperName", a, $12);
          })(),
          v1._2
        );
      }
      fail();
    })(altLex.alt((str) => {
      const v1 = parseSymbolIdent(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        return $LexResult(
          "LexSucc",
          (() => {
            const $12 = v1._1;
            return (v1$1) => {
              if (v1$1.tag === "Nothing") {
                if ($12 === "<-") {
                  return $Token("TokLeftArrow", ASCII);
                }
                if ($12 === "\u2190") {
                  return $Token("TokLeftArrow", Unicode);
                }
                if ($12 === "->") {
                  return $Token("TokRightArrow", ASCII);
                }
                if ($12 === "\u2192") {
                  return $Token("TokRightArrow", Unicode);
                }
                if ($12 === "=>") {
                  return $Token("TokRightFatArrow", ASCII);
                }
                if ($12 === "\u21D2") {
                  return $Token("TokRightFatArrow", Unicode);
                }
                if ($12 === "::") {
                  return $Token("TokDoubleColon", ASCII);
                }
                if ($12 === "\u2237") {
                  return $Token("TokDoubleColon", Unicode);
                }
                if ($12 === "\u2200") {
                  return $Token("TokForall", Unicode);
                }
                if ($12 === "=") {
                  return TokEquals;
                }
                if ($12 === ".") {
                  return TokDot;
                }
                if ($12 === "\\") {
                  return TokBackslash;
                }
                if ($12 === "|") {
                  return TokPipe;
                }
                if ($12 === "@") {
                  return TokAt;
                }
                if ($12 === "`") {
                  return TokTick;
                }
                return $Token("TokOperator", Nothing, $12);
              }
              return $Token("TokOperator", v1$1, $12);
            };
          })(),
          v1._2
        );
      }
      fail();
    })((str) => {
      const v1 = tokenLeftParen(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, str);
      }
      if (v1.tag === "LexSucc") {
        const v3 = parseSymbolIdent(v1._2);
        if (v3.tag === "LexFail") {
          return $LexResult("LexFail", v3._1, str);
        }
        if (v3.tag === "LexSucc") {
          const v3$1 = tokenRightParen(v3._2);
          if (v3$1.tag === "LexFail") {
            return $LexResult("LexFail", v3$1._1, str);
          }
          if (v3$1.tag === "LexSucc") {
            return $LexResult(
              "LexSucc",
              (() => {
                const $12 = v3._1;
                return (v1$1) => {
                  if (v1$1.tag === "Nothing") {
                    if ($12 === "->") {
                      return $Token("TokSymbolArrow", ASCII);
                    }
                    if ($12 === "\u2192") {
                      return $Token("TokSymbolArrow", Unicode);
                    }
                    return $Token("TokSymbolName", Nothing, $12);
                  }
                  return $Token("TokSymbolName", v1$1, $12);
                };
              })(),
              v3$1._2
            );
          }
        }
      }
      fail();
    })));
    return (str) => {
      const v1 = $0(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        const v3 = $1(v1._2);
        if (v3.tag === "LexFail") {
          return $LexResult("LexFail", v3._1, v3._2);
        }
        if (v3.tag === "LexSucc") {
          return $LexResult("LexSucc", v3._1(toModuleName(v1._1)), v3._2);
        }
      }
      fail();
    };
  })())(altLex.alt((str) => {
    const v1 = charSingleQuote(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      const v1$1 = charAny(v1._2);
      const v3 = (() => {
        if (v1$1.tag === "LexFail") {
          return $LexResult("LexFail", v1$1._1, v1$1._2);
        }
        if (v1$1.tag === "LexSucc") {
          if (v1$1._1 === "\\") {
            return parseEscape1(v1$1._2);
          }
          if (v1$1._1 === "'") {
            return $LexResult("LexFail", (v) => $ParseError("LexExpected", "character", "empty character literal"), v1$1._2);
          }
          return $LexResult("LexSucc", { raw: singleton(v1$1._1), char: v1$1._1 }, v1$1._2);
        }
        fail();
      })();
      if (v3.tag === "LexFail") {
        return $LexResult("LexFail", v3._1, v3._2);
      }
      if (v3.tag === "LexSucc") {
        const v3$1 = charSingleQuote(v3._2);
        if (v3$1.tag === "LexFail") {
          return $LexResult("LexFail", v3$1._1, v3$1._2);
        }
        if (v3$1.tag === "LexSucc") {
          return $LexResult("LexSucc", $Token("TokChar", v3._1.raw, v3._1.char), v3$1._2);
        }
      }
    }
    fail();
  })(altLex.alt(altLex.alt((() => {
    const $0 = regex2(LexExpected("raw string characters"))('""""{0,2}([^"]+"{1,2})*[^"]*"""');
    return (str) => {
      const v1 = $0(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        return $LexResult(
          "LexSucc",
          $Token(
            "TokRawString",
            (() => {
              const $1 = drop(3)(v1._1);
              return take(length2($1) - 3 | 0)($1);
            })()
          ),
          v1._2
        );
      }
      fail();
    };
  })())((() => {
    const $0 = many(altLex.alt((() => {
      const $02 = regex2(LexExpected("string characters"))('[^"\\\\]+');
      return (str) => {
        const v1 = $02(str);
        if (v1.tag === "LexFail") {
          return $LexResult("LexFail", v1._1, v1._2);
        }
        if (v1.tag === "LexSucc") {
          return $LexResult("LexSucc", { raw: v1._1, string: v1._1 }, v1._2);
        }
        fail();
      };
    })())(altLex.alt((() => {
      const $02 = regex2(LexExpected("whitespace escape"))("\\\\[ \\r\\n]+\\\\");
      return (str) => {
        const v1 = $02(str);
        if (v1.tag === "LexFail") {
          return $LexResult("LexFail", v1._1, v1._2);
        }
        if (v1.tag === "LexSucc") {
          return $LexResult("LexSucc", { raw: v1._1, string: "" }, v1._2);
        }
        fail();
      };
    })())((() => {
      const $02 = $$char(LexExpected("backslash"))("\\");
      const $1 = parseEscape(isCharCodePoint);
      return (str) => {
        const v1 = $02(str);
        if (v1.tag === "LexFail") {
          return $LexResult("LexFail", v1._1, v1._2);
        }
        if (v1.tag === "LexSucc") {
          const v3 = $1(v1._2);
          if (v3.tag === "LexFail") {
            return $LexResult("LexFail", v3._1, v3._2);
          }
          if (v3.tag === "LexSucc") {
            return $LexResult("LexSucc", { raw: v3._1.raw, string: singleton2(v3._1.char) }, v3._2);
          }
        }
        fail();
      };
    })())));
    return (str) => {
      const v1 = charQuote(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        const v3 = $0(v1._2);
        if (v3.tag === "LexFail") {
          return $LexResult("LexFail", v3._1, v3._2);
        }
        if (v3.tag === "LexSucc") {
          const v3$1 = charQuote(v3._2);
          if (v3$1.tag === "LexFail") {
            return $LexResult("LexFail", v3$1._1, v3$1._2);
          }
          if (v3$1.tag === "LexSucc") {
            return $LexResult(
              "LexSucc",
              (() => {
                const v1$1 = fold1(v3._1);
                return $Token("TokString", v1$1.raw, v1$1.string);
              })(),
              v3$1._2
            );
          }
        }
      }
      fail();
    };
  })()))(altLex.alt(altLex.alt((() => {
    const $0 = string(LexExpected("hex int prefix"))("0x");
    const $1 = regex2(LexExpected("hex int"))("[a-fA-F0-9]+");
    return (str) => {
      const v1 = $0(str);
      if (v1.tag === "LexFail") {
        return $LexResult("LexFail", v1._1, v1._2);
      }
      if (v1.tag === "LexSucc") {
        const v3 = $1(v1._2);
        if (v3.tag === "LexFail") {
          return $LexResult("LexFail", v3._1, v3._2);
        }
        if (v3.tag === "LexSucc") {
          const v = fromStringAs(16)(v3._1);
          if (v.tag === "Just") {
            return $LexResult("LexSucc", $Token("TokInt", "0x" + v3._1, $IntValue("SmallInt", v._1)), v3._2);
          }
          if (v.tag === "Nothing") {
            return $LexResult("LexSucc", $Token("TokInt", "0x" + v3._1, $IntValue("BigHex", v3._1)), v3._2);
          }
        }
      }
      fail();
    };
  })())((str) => {
    const v1 = intPartRegex(str);
    if (v1.tag === "LexFail") {
      return $LexResult("LexFail", v1._1, v1._2);
    }
    if (v1.tag === "LexSucc") {
      const v1$1 = optional((() => {
        const $0 = $$char(LexExpected("dot"))(".");
        const $1 = regex2(LexExpected("fraction part"))("[0-9_]+");
        return (str$1) => {
          const v1$12 = $0(str$1);
          if (v1$12.tag === "LexFail") {
            return $LexResult("LexFail", v1$12._1, str$1);
          }
          if (v1$12.tag === "LexSucc") {
            const v3 = $1(v1$12._2);
            if (v3.tag === "LexFail") {
              return $LexResult("LexFail", v3._1, str$1);
            }
            if (v3.tag === "LexSucc") {
              return $LexResult("LexSucc", v3._1, v3._2);
            }
          }
          fail();
        };
      })())(v1._2);
      if (v1$1.tag === "LexFail") {
        return $LexResult("LexFail", v1$1._1, v1$1._2);
      }
      if (v1$1.tag === "LexSucc") {
        const v1$2 = optional((() => {
          const $0 = $$char(LexExpected("exponent"))("e");
          const $1 = optional(altLex.alt(string(LexExpected("negative"))("-"))(string(LexExpected("positive"))("+")));
          return (str$1) => {
            const v1$22 = $0(str$1);
            if (v1$22.tag === "LexFail") {
              return $LexResult("LexFail", v1$22._1, v1$22._2);
            }
            if (v1$22.tag === "LexSucc") {
              const v1$3 = $1(v1$22._2);
              if (v1$3.tag === "LexFail") {
                return $LexResult("LexFail", v1$3._1, v1$3._2);
              }
              if (v1$3.tag === "LexSucc") {
                const v3 = intPartRegex(v1$3._2);
                if (v3.tag === "LexFail") {
                  return $LexResult("LexFail", v3._1, v3._2);
                }
                if (v3.tag === "LexSucc") {
                  return $LexResult("LexSucc", { sign: v1$3._1, exponent: v3._1 }, v3._2);
                }
              }
            }
            fail();
          };
        })())(v1$1._2);
        if (v1$2.tag === "LexFail") {
          return $LexResult("LexFail", v1$2._1, v1$2._2);
        }
        if (v1$2.tag === "LexSucc") {
          if ((() => {
            if (v1$1._1.tag === "Nothing") {
              return true;
            }
            if (v1$1._1.tag === "Just") {
              return false;
            }
            fail();
          })() && (() => {
            if (v1$2._1.tag === "Nothing") {
              return true;
            }
            if (v1$2._1.tag === "Just") {
              return false;
            }
            fail();
          })()) {
            const intVal = stripUnderscores(v1._1);
            const v2 = fromString(intVal);
            if (v2.tag === "Just") {
              return $LexResult("LexSucc", $Token("TokInt", v1._1, $IntValue("SmallInt", v2._1)), v1$2._2);
            }
            if (v2.tag === "Nothing") {
              return $LexResult("LexSucc", $Token("TokInt", v1._1, $IntValue("BigInt", intVal)), v1$2._2);
            }
            fail();
          }
          const raw = (() => {
            if (v1$1._1.tag === "Nothing") {
              return v1._1 + "";
            }
            if (v1$1._1.tag === "Just") {
              return v1._1 + "." + v1$1._1._1;
            }
            fail();
          })() + (() => {
            if (v1$2._1.tag === "Nothing") {
              return "";
            }
            if (v1$2._1.tag === "Just") {
              if (v1$2._1._1.sign.tag === "Nothing") {
                return "e" + v1$2._1._1.exponent;
              }
              if (v1$2._1._1.sign.tag === "Just") {
                return "e" + v1$2._1._1.sign._1 + v1$2._1._1.exponent;
              }
            }
            fail();
          })();
          const v = fromStringImpl(stripUnderscores(raw), isFiniteImpl, Just, Nothing);
          if (v.tag === "Just") {
            return $LexResult("LexSucc", $Token("TokNumber", raw, v._1), v1$2._2);
          }
          if (v.tag === "Nothing") {
            return $LexResult("LexFail", (v$1) => $ParseError("LexNumberOutOfRange", raw), v1$2._2);
          }
        }
      }
    }
    fail();
  }))(altLex.alt(tokenLeftParen)(altLex.alt(tokenRightParen)(altLex.alt(char$p(LexExpected("left brace"))(TokLeftBrace)("{"))(altLex.alt(char$p(LexExpected("right brace"))(TokRightBrace)("}"))(altLex.alt(char$p(LexExpected("left square"))(TokLeftSquare)("["))(altLex.alt(char$p(LexExpected("right square"))(TokRightSquare)("]"))(altLex.alt(char$p(LexExpected("backtick"))(TokTick)("`"))(char$p(LexExpected("comma"))(TokComma)(",")))))))))))));
})();
var trailingComments = /* @__PURE__ */ (() => many(altLex.alt((str) => {
  const v1 = comment(str);
  if (v1.tag === "LexFail") {
    return $LexResult("LexFail", v1._1, v1._2);
  }
  if (v1.tag === "LexSucc") {
    return $LexResult("LexSucc", $Comment2("Comment", v1._1), v1._2);
  }
  fail();
})((str) => {
  const v1 = spaceComment(str);
  if (v1.tag === "LexFail") {
    return $LexResult("LexFail", v1._1, v1._2);
  }
  if (v1.tag === "LexSucc") {
    return $LexResult("LexSucc", $Comment2("Space", v1._1), v1._2);
  }
  fail();
})))();
var lexWithState$p = (lexLeadingComments) => {
  const go = (stack) => (startPos) => (leading) => (str) => defer((v) => {
    if (str === "") {
      return force(unwindLayout(startPos)(defer((v12) => $TokenStep("TokenEOF", startPos, leading)))(stack));
    }
    const v1 = token(str);
    if (v1.tag === "LexFail") {
      return $TokenStep(
        "TokenError",
        bumpText(startPos)(0)(take(length2(str) - length2(v1._2) | 0)(str)),
        v1._1(),
        Nothing,
        stack
      );
    }
    if (v1.tag === "LexSucc") {
      const v3 = trailingComments(v1._2);
      if (v3.tag === "LexFail") {
        return $TokenStep(
          "TokenError",
          bumpText(startPos)(0)(take(length2(str) - length2(v3._2) | 0)(str)),
          v3._1(),
          Nothing,
          stack
        );
      }
      if (v3.tag === "LexSucc") {
        const v3$1 = leadingComments(v3._2);
        if (v3$1.tag === "LexFail") {
          return $TokenStep(
            "TokenError",
            bumpText(startPos)(0)(take(length2(str) - length2(v3$1._2) | 0)(str)),
            v3$1._1(),
            Nothing,
            stack
          );
        }
        if (v3$1.tag === "LexSucc") {
          const endPos = bumpToken(startPos)(v1._1);
          const nextStart = foldlArray(bumpComment)(foldlArray(bumpComment)(endPos)(v3._1))(v3$1._1);
          const v2 = insertLayout({ range: { start: startPos, end: endPos }, leadingComments: leading, trailingComments: v3._1, value: v1._1 })(nextStart)(stack);
          return force(consTokens2(v2._2)($Tuple(nextStart, go(v2._1)(nextStart)(v3$1._1)(v3$1._2)))._2);
        }
      }
    }
    fail();
  });
  return (initStack) => (initPos) => (str) => defer((v) => {
    const v1 = lexLeadingComments(str);
    if (v1.tag === "LexFail") {
      return _crashWith("Leading comments can't fail.");
    }
    if (v1.tag === "LexSucc") {
      return force(go(initStack)(foldlArray(bumpComment)(initPos)(v1._1))(v1._1)(v1._2));
    }
    fail();
  });
};
var lexWithState = /* @__PURE__ */ lexWithState$p(leadingComments);
var lex = /* @__PURE__ */ lexWithState(/* @__PURE__ */ $List(
  "Cons",
  /* @__PURE__ */ $Tuple({ line: 0, column: 0 }, LytRoot),
  Nil
))({ line: 0, column: 0 });

// output-es/PureScript.CST.Parser.Monad/index.js
var $ParserResult = (tag, _1, _2) => ({ tag, _1, _2 });
var $Trampoline = (tag, _1) => ({ tag, _1 });
var More = (value0) => $Trampoline("More", value0);
var take3 = (k) => (state, v, resume, done) => {
  const v1 = force(state.stream);
  if (v1.tag === "TokenError") {
    return resume(state, { error: v1._2, position: v1._1 });
  }
  if (v1.tag === "TokenEOF") {
    return resume(state, { error: UnexpectedEof, position: v1._1 });
  }
  if (v1.tag === "TokenCons") {
    const v2 = k(v1._1);
    if (v2.tag === "Left") {
      return resume(state, { error: v2._1, position: v1._1.range.start });
    }
    if (v2.tag === "Right") {
      return done({ ...state, consumed: true, stream: v1._3 }, v2._1);
    }
  }
  fail();
};
var runParser$p = (state1) => (v) => {
  const run2 = (run$a0$copy) => {
    let run$a0 = run$a0$copy, run$c = true, run$r;
    while (run$c) {
      const v1 = run$a0;
      if (v1.tag === "More") {
        run$a0 = v1._1();
        continue;
      }
      if (v1.tag === "Done") {
        run$c = false;
        run$r = v1._1;
        continue;
      }
      fail();
    }
    return run$r;
  };
  return run2(v(
    state1,
    More,
    (state2, error3) => $Trampoline("Done", $ParserResult("ParseFail", error3, state2)),
    (state2, value) => $Trampoline("Done", $ParserResult("ParseSucc", value, state2))
  ));
};
var runParser = (stream) => (x) => {
  const $0 = runParser$p({ consumed: false, errors: [], stream })(x);
  if ($0.tag === "ParseFail") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "ParseSucc") {
    return $Either("Right", $Tuple($0._1, $0._2.errors));
  }
  fail();
};
var eof = (state, v, resume, done) => {
  const v1 = force(state.stream);
  if (v1.tag === "TokenError") {
    return resume(state, { error: v1._2, position: v1._1 });
  }
  if (v1.tag === "TokenEOF") {
    return done({ ...state, consumed: true }, $Tuple(v1._1, v1._2));
  }
  if (v1.tag === "TokenCons") {
    return resume(state, { error: $ParseError("ExpectedEof", v1._1.value), position: v1._1.range.start });
  }
  fail();
};

// output-es/PureScript.Backend.Optimizer.Directives/index.js
var expectMap = (k) => take3((tok) => {
  const v = k(tok);
  if (v.tag === "Just") {
    return $Either("Right", v._1);
  }
  if (v.tag === "Nothing") {
    return $Either("Left", $ParseError("UnexpectedToken", tok.value));
  }
  fail();
});
var keyword = (word1) => expectMap((v) => {
  if (v.value.tag === "TokLowerName" && v.value._1.tag === "Nothing" && word1 === v.value._2) {
    return $Maybe("Just", void 0);
  }
  return Nothing;
});
var label = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokRawString") {
    return $Maybe("Just", v.value._1);
  }
  if (v.value.tag === "TokString") {
    return $Maybe("Just", v.value._2);
  }
  if (v.value.tag === "TokLowerName" && v.value._1.tag === "Nothing") {
    return $Maybe("Just", v.value._2);
  }
  return Nothing;
});
var natural = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokInt" && v.value._2.tag === "SmallInt" && v.value._2._1 > 0) {
    return $Maybe("Just", v.value._2._1);
  }
  return Nothing;
});
var qualified = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokLowerName" && v.value._1.tag === "Just") {
    return $Maybe("Just", $Qualified($Maybe("Just", v.value._1._1), v.value._2));
  }
  return Nothing;
});
var unqualified = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokLowerName" && v.value._1.tag === "Nothing") {
    return $Maybe("Just", v.value._2);
  }
  return Nothing;
});
var equals = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokEquals") {
    return $Maybe("Just", void 0);
  }
  return Nothing;
});
var parseInlineDirective = (state1, more, resume, done) => keyword("default")(
  state1.consumed ? { ...state1, consumed: false } : state1,
  more,
  (state3, error3) => {
    if (state3.consumed) {
      return resume(state3, error3);
    }
    return keyword("never")(
      state1.consumed ? { ...state1, consumed: false } : state1,
      more,
      (state3$1, error$1) => {
        if (state3$1.consumed) {
          return resume(state3$1, error$1);
        }
        return keyword("always")(
          state1.consumed ? { ...state1, consumed: false } : state1,
          more,
          (state3$2, error$2) => {
            if (state3$2.consumed) {
              return resume(state3$2, error$2);
            }
            return keyword("arity")(
              state1,
              more,
              resume,
              (state2, a) => more((v2) => equals(
                state2,
                more,
                resume,
                (state3$3, a$1) => more((v2$1) => natural(
                  state3$3,
                  more,
                  resume,
                  (state3$4, a$2) => done(state3$4, $InlineDirective("InlineArity", a$2))
                ))
              ))
            );
          },
          (state2, a) => done(state2, InlineAlways)
        );
      },
      (state2, a) => done(state2, InlineNever)
    );
  },
  (state2, a) => done(state2, InlineDefault)
);
var dotDot = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokSymbolName" && v.value._1.tag === "Nothing" && v.value._2 === "..") {
    return $Maybe("Just", void 0);
  }
  return Nothing;
});
var dot = /* @__PURE__ */ expectMap((v) => {
  if (v.value.tag === "TokDot") {
    return $Maybe("Just", void 0);
  }
  return Nothing;
});
var parseInlineAccessor = (state1, more, resume, done) => dot(
  state1.consumed ? { ...state1, consumed: false } : state1,
  more,
  (state3, error3) => {
    if (state3.consumed) {
      return resume(state3, error3);
    }
    return dotDot(
      state1.consumed ? { ...state1, consumed: false } : state1,
      more,
      (state3$1, error$1) => {
        if (state3$1.consumed) {
          return resume(state3$1, error$1);
        }
        return done(state1, InlineRef);
      },
      (state2, a) => more((v2) => dot(
        state2,
        more,
        (state3$1, error$1) => {
          if (state3$1.consumed) {
            return resume(state3$1, error$1);
          }
          return done(state1, InlineRef);
        },
        (state3$1, a$1) => more((v2$1) => label(
          state3$1,
          more,
          (state3$2, error$1) => {
            if (state3$2.consumed) {
              return resume(state3$2, error$1);
            }
            return done(state1, InlineRef);
          },
          (state3$2, a$2) => done(state3$2, $InlineAccessor("InlineSpineProp", a$2))
        ))
      ))
    );
  },
  (state2, a) => more((v2) => label(
    state2,
    more,
    (state3, error3) => {
      if (state3.consumed) {
        return resume(state3, error3);
      }
      return dotDot(
        state1.consumed ? { ...state1, consumed: false } : state1,
        more,
        (state3$1, error$1) => {
          if (state3$1.consumed) {
            return resume(state3$1, error$1);
          }
          return done(state1, InlineRef);
        },
        (state2$1, a$1) => more((v2$1) => dot(
          state2$1,
          more,
          (state3$1, error$1) => {
            if (state3$1.consumed) {
              return resume(state3$1, error$1);
            }
            return done(state1, InlineRef);
          },
          (state3$1, a$2) => more((v2$2) => label(
            state3$1,
            more,
            (state3$2, error$1) => {
              if (state3$2.consumed) {
                return resume(state3$2, error$1);
              }
              return done(state1, InlineRef);
            },
            (state3$2, a$3) => done(state3$2, $InlineAccessor("InlineSpineProp", a$3))
          ))
        ))
      );
    },
    (state3, a$1) => done(state3, $InlineAccessor("InlineProp", a$1))
  ))
);
var parseDirective = (state1, more, resume, done) => qualified(
  state1,
  more,
  resume,
  (state2, a) => more((v2) => parseInlineAccessor(
    state2,
    more,
    resume,
    (state3, a$1) => more((v2$1) => parseInlineDirective(
      state3,
      more,
      resume,
      (state3$1, a$2) => more((v2$2) => eof(
        state3$1,
        more,
        resume,
        (state3$2, a$3) => done(state3$2, $Tuple($EvalRef("EvalExtern", a), $Tuple(a$1, a$2)))
      ))
    ))
  ))
);
var parseDirectiveMaybe = (state1, more, resume, done) => parseDirective(
  state1.consumed ? { ...state1, consumed: false } : state1,
  more,
  (state3, error3) => {
    if (state3.consumed) {
      return resume(state3, error3);
    }
    return eof(state1, more, resume, (state2, a) => done(state2, Nothing));
  },
  (state2, a) => done(state2, $Maybe("Just", a))
);
var parseDirectiveLine = (line) => {
  const $0 = runParser(lex(line))(parseDirectiveMaybe);
  if ($0.tag === "Left") {
    return $Either("Left", $0._1);
  }
  if ($0.tag === "Right") {
    return $Either("Right", $0._1._1);
  }
  fail();
};
var parseDirectiveFile = /* @__PURE__ */ (() => {
  const $0 = foldableWithIndexArray.foldlWithIndex((line) => (v) => (str) => {
    const v1 = parseDirectiveLine(str);
    if (v1.tag === "Left") {
      return { errors: snoc(v.errors)($Tuple(str, { ...v1._1, position: { ...v1._1.position, line } })), directives: v.directives };
    }
    if (v1.tag === "Right") {
      if (v1._1.tag === "Nothing") {
        return { errors: v.errors, directives: v.directives };
      }
      if (v1._1.tag === "Just") {
        return { errors: v.errors, directives: insertDirective(v1._1._1._1)(v1._1._1._2._1)(v1._1._1._2._2)(v.directives) };
      }
    }
    fail();
  })({ errors: [], directives: Leaf });
  const $1 = split("\n");
  return (x) => $0($1(x));
})();
var parseDirectiveExport = (moduleName) => (state1, more, resume, done) => keyword("export")(
  state1,
  more,
  resume,
  (state2, a) => more((v2) => unqualified(
    state2,
    more,
    resume,
    (state3, a$1) => more((v2$1) => parseInlineAccessor(
      state3,
      more,
      resume,
      (state3$1, a$2) => more((v2$2) => parseInlineDirective(
        state3$1,
        more,
        resume,
        (state3$2, a$3) => more((v2$3) => eof(
          state3$2,
          more,
          resume,
          (state3$3, a$4) => done(
            state3$3,
            $Tuple(
              $EvalRef("EvalExtern", $Qualified($Maybe("Just", moduleName), a$1)),
              $Tuple(a$2, a$3)
            )
          )
        ))
      ))
    ))
  ))
);
var parseDirectiveHeader = (moduleName) => foldlArray((v) => {
  const $0 = v.errors;
  const $1 = v.exports;
  const $2 = v.locals;
  return (v1) => {
    if (v1.tag === "LineComment") {
      const $3 = stripPrefix("@inline")(trim(v1._1));
      if ($3.tag === "Just") {
        const line$p = trim($3._1);
        const v3 = runParser(lex(line$p))((state1, more, resume, done) => parseDirectiveExport(moduleName)(
          state1.consumed ? { ...state1, consumed: false } : state1,
          more,
          (state3, error3) => {
            if (state3.consumed) {
              return resume(state3, error3);
            }
            return parseDirective(state1, more, resume, (state2, a) => done(state2, $Either("Right", a)));
          },
          (state2, a) => done(state2, $Either("Left", a))
        ));
        if (v3.tag === "Left") {
          return { errors: snoc($0)($Tuple(line$p, v3._1)), locals: $2, exports: $1 };
        }
        if (v3.tag === "Right") {
          if (v3._1._1.tag === "Left") {
            return { errors: $0, locals: $2, exports: insertDirective(v3._1._1._1._1)(v3._1._1._1._2._1)(v3._1._1._1._2._2)($1) };
          }
          if (v3._1._1.tag === "Right") {
            return { errors: $0, locals: insertDirective(v3._1._1._1._1)(v3._1._1._1._2._1)(v3._1._1._1._2._2)($2), exports: $1 };
          }
        }
        fail();
      }
    }
    return { errors: $0, locals: $2, exports: $1 };
  };
})({ errors: [], locals: Leaf, exports: Leaf });

// output-es/PureScript.Backend.Optimizer.Directives.Defaults/index.js
var defaultDirectives = "\n  -- Prelude\n\n  Control.Applicative.liftA1 arity=1\n  Control.Applicative.when arity=1\n  Control.Applicative.unless arity=1\n  Control.Applicative.applicativeFn.pure arity=1\n  Control.Applicative.applicativeArray.pure arity=1\n\n  Control.Apply.applyFirst arity=1\n  Control.Apply.applySecond arity=1\n  Control.Apply.lift2 arity=1\n  Control.Apply.lift3 arity=1\n  Control.Apply.lift4 arity=1\n  Control.Apply.lift5 arity=1\n  Control.Apply.applyFn.apply arity=2\n\n  Control.Bind.bindFlipped arity=1\n  Control.Bind.join arity=1\n  Control.Bind.composeKleisli arity=1\n  Control.Bind.composeKleisliFlipped arity=1\n  Control.Bind.ifM arity=1\n  Control.Bind.bindFn arity=2\n  Control.Bind.discard arity=1\n\n  Control.Category.categoryFn.identity always\n\n  Data.Ring.negate always\n  Data.Ring.sub always\n  Data.Ring.ringInt always\n  Data.Ring.ringNumber always\n  Test.Polymorphism.intMonoidish always\n  Test.Polymorphism.polyLoop always\n  Test.Polymorphism.polyLoop1 always\n  Data.Semiring.add always\n  Data.Semiring.semiringInt always\n  Data.Semiring.semiringNumber always\n  Data.Ord.compare always\n  Data.Ord.lessThan always\n  Data.Ord.greaterThan always\n  Data.Ord.lessThanOrEq always\n  Data.Ord.greaterThanOrEq always\n  Data.Ord.ordInt always\n  Data.Eq.eq always\n  Data.Eq.notEq always\n  Data.Eq.eqInt always\n\n  Test.RBTree.lessThan always\n  Test.RBTree.greaterThan always\n  Test.RBTree.max always\n\n  Test.LazyEvaluation.force always\n  Test.LazyEvaluation.defer always\n\n  Control.Monad.ap arity=1\n  Control.Monad.lift1 arity=1\n  Control.Monad.whenM arity=1\n  Control.Monad.unlessM arity=1\n\n  Control.Semigroupoid.composeFlipped arity=1\n  Control.Semigroupoid.semigroupoidFn.compose arity=2\n\n  Data.Array.ST.freeze arity=1\n  Data.Array.ST.length arity=1\n  Data.Array.ST.pop arity=1\n  Data.Array.ST.poke arity=3\n  Data.Array.ST.peek arity=2\n  Data.Array.ST.pushAll arity=2\n  Data.Array.ST.push arity=2\n  Data.Array.ST.thaw arity=1\n  Data.Array.ST.toAssocArray arity=1\n  Data.Array.ST.shift arity=1\n  Data.Array.ST.unsafeFreeze arity=1\n  Data.Array.ST.unsafeThaw arity=1\n  Data.Array.ST.unshift arity=2\n  Data.Array.ST.unshiftAll arity=2\n\n  Data.Boolean.otherwise always\n\n  Data.Bounded.boundedRecordCons arity=5\n  Data.Bounded.boundedRecord arity=2\n\n  Data.Bounded.Generic.genericBottom arity=1\n  Data.Bounded.Generic.genericBottom' arity=1\n  Data.Bounded.Generic.genericBottomNoArguments.genericBottom' always\n  Data.Bounded.Generic.genericBottomArgument.genericBottom' arity=1\n  Data.Bounded.Generic.genericBottomSum.genericBottom' arity=1\n  Data.Bounded.Generic.genericBottomProduct.genericBottom' arity=2\n  Data.Bounded.Generic.genericBottomConstructor.genericBottom' arity=1\n  Data.Bounded.Generic.genericTop arity=1\n  Data.Bounded.Generic.genericTop' arity=1\n  Data.Bounded.Generic.genericTopNoArguments.genericTop' always\n  Data.Bounded.Generic.genericTopArgument.genericTop' arity=1\n  Data.Bounded.Generic.genericTopSum.genericTop' arity=1\n  Data.Bounded.Generic.genericTopProduct.genericTop' arity=2\n  Data.Bounded.Generic.genericTopConstructor.genericTop' arity=1\n\n  Data.DivisionRing.leftDiv arity=1\n  Data.DivisionRing.rightDiv arity=1\n  Data.DivisionRing.divisionringNumber.recip arity=1\n\n  Data.Eq.notEq arity=1\n  Data.Eq.eqArray arity=1\n  Data.Eq.eqRec arity=2\n  Data.Eq.eqRowCons arity=4\n  Data.Eq.notEq1 arity=1\n\n  Data.Eq.Generic.genericEq arity=1\n  Data.Eq.Generic.genericEq' arity=1\n  Data.Eq.Generic.genericEqSum.genericEq' arity=2\n  Data.Eq.Generic.genericEqProduct.genericEq' arity=2\n  Data.Eq.Generic.genericEqConstructor.genericEq' arity=1\n  Data.Eq.Generic.genericEqArgument.genericEq' arity=1\n\n  Data.EuclideanRing.gcd arity=4\n  Data.EuclideanRing.lcm arity=4\n\n  Data.Generic.Rep.showSum.show arity=2\n  Data.Generic.Rep.showProduct.show arity=2\n  Data.Generic.Rep.showConstructor.show arity=2\n  Data.Generic.Rep.showArgument.show arity=1\n  Data.Generic.Rep.repOf arity=1\n\n  Data.Function.flip arity=1\n  Data.Function.const arity=1\n  Data.Function.apply arity=2\n  Data.Function.applyFlipped arity=2\n  Data.Function.on arity=2\n\n  Data.Functor.mapFlipped arity=1\n  Data.Functor.void arity=1\n  Data.Functor.voidRight arity=1\n  Data.Functor.voidLeft arity=1\n  Data.Functor.flap arity=1\n\n  Data.HeytingAlgebra.heytingAlgebraBoolean.implies arity=2\n  Data.HeytingAlgebra.heytingAlgebraFunction arity=1\n  Data.HeytingAlgebra.heytingAlgebraRecord arity=2\n  Data.HeytingAlgebra.heytingAlgebraRecordCons arity=4\n\n  Data.HeytingAlgebra.Generic.genericHeytingAlgebraArgument arity=1\n  Data.HeytingAlgebra.Generic.genericHeytingAlgebraProduct arity=2\n  Data.HeytingAlgebra.Generic.genericHeytingAlgebraConstructor arity=1\n  Data.HeytingAlgebra.Generic.genericFF arity=1\n  Data.HeytingAlgebra.Generic.genericTT arity=1\n  Data.HeytingAlgebra.Generic.genericImplies arity=1\n  Data.HeytingAlgebra.Generic.genericConj arity=1\n  Data.HeytingAlgebra.Generic.genericDisj arity=1\n  Data.HeytingAlgebra.Generic.genericNot arity=1\n\n  Data.Monoid.guard arity=2\n  Data.Monoid.monoidRecordCons arity=4\n\n  Data.Ord.comparing arity=2\n  Data.Ord.ordRecordCons arity=4\n\n  Data.Semigroup.semigroupFn.append arity=2\n  Data.Semigroup.semigroupRecordCons arity=4\n\n  Data.Show.showArray arity=1\n  Data.Show.showRecord arity=3\n  Data.Show.showRecordFieldsConsNil arity=2\n  Data.Show.showRecordFieldsCons arity=3\n\n  Control.Monad.ST.Internal.modify arity=2\n  Effect.applyEffect.apply arity=2\n  Record.Builder.build arity=1\n  Record.Builder.rename arity=8\n  ";

// output-es/PureScript.Backend.Optimizer.App/index.js
var filterA2 = /* @__PURE__ */ filterA(applicativeAff);
var traverse2 = /* @__PURE__ */ (() => traversableArray.traverse(applicativeAff))();
var fromFoldable4 = /* @__PURE__ */ foldrArray(Cons)(Nil);
var readCoreFnModule = (filePath) => _bind($$try2(toAff1(stat2)(filePath)))((statRes) => {
  if (statRes.tag === "Right") {
    if (isFileImpl(statRes._1)) {
      return _bind(toAff2(readTextFile2)(UTF8)(filePath))((contents) => {
        const $0 = _jsonParser(Left, Right, contents);
        const v = (() => {
          if ($0.tag === "Left") {
            const $1 = $0._1;
            return (v2) => $Either("Left", $1);
          }
          if ($0.tag === "Right") {
            const $1 = $0._1;
            return (f) => f($1);
          }
          fail();
        })()((x) => {
          const $1 = decodeModule$p(decodeAnn)(x);
          if ($1.tag === "Left") {
            return $Either("Left", printJsonDecodeError($1._1));
          }
          if ($1.tag === "Right") {
            return $Either("Right", $1._1);
          }
          fail();
        });
        if (v.tag === "Left") {
          return _bind(_liftEffect(error2("Failed to decode " + filePath + ": " + v._1)))(() => _pure(Nothing));
        }
        if (v.tag === "Right") {
          return _pure($Maybe("Just", v._1));
        }
        fail();
      });
    }
    return _pure(Nothing);
  }
  if (statRes.tag === "Left") {
    const errStr = showErrorImpl(statRes._1);
    return _bind(contains("ENOENT")(errStr) ? _pure() : _liftEffect(error2("Failed to stat " + filePath + ": " + errStr)))(() => _pure(Nothing));
  }
  fail();
});
var loadDirectives = /* @__PURE__ */ (() => {
  const parsedDirectives = parseDirectiveFile(defaultDirectives);
  return _bind((() => {
    const $0 = _liftEffect(log2("DIRECTIVE PARSE ERRORS"));
    if (parsedDirectives.errors.length !== 0) {
      return $0;
    }
    return _pure();
  })())(() => _pure(parsedDirectives.directives));
})();
var coreFnModulesFromOutput = (outputDir) => _bind(toAff1(readdir2)(outputDir))((files) => _bind(filterA2((f) => _bind(toAff1(stat2)(outputDir + "/" + f))((stat3) => _pure(isDirectoryImpl(stat3))))(files))((validDirs) => _bind(traverse2((dir) => readCoreFnModule(outputDir + "/" + dir + "/corefn.json"))(validDirs))((mbModules) => _pure(sortModules(foldableList)(fromFoldable4(mapMaybe((x) => x)(mbModules)))))));

// output-es/Data.List/index.js
var foldM2 = (dictMonad) => (v) => (v1) => (v2) => {
  if (v2.tag === "Nil") {
    return dictMonad.Applicative0().pure(v1);
  }
  if (v2.tag === "Cons") {
    const $0 = v2._2;
    return dictMonad.Bind1().bind(v(v1)(v2._1))((b$p) => foldM2(dictMonad)(v)(b$p)($0));
  }
  fail();
};

// output-es/Data.Map/index.js
var semigroupSemigroupMap = (dictOrd) => {
  const compare3 = dictOrd.compare;
  return (dictSemigroup) => {
    const append = dictSemigroup.append;
    return { append: (v) => (v1) => unsafeUnionWith(compare3, append, v, v1) };
  };
};
var monoidSemigroupMap = (dictOrd) => {
  const semigroupSemigroupMap1 = semigroupSemigroupMap(dictOrd);
  return (dictSemigroup) => {
    const semigroupSemigroupMap2 = semigroupSemigroupMap1(dictSemigroup);
    return { mempty: Leaf, Semigroup0: () => semigroupSemigroupMap2 };
  };
};

// output-es/Data.Semigroup.First/index.js
var semigroupFirst2 = { append: (x) => (v) => x };

// output-es/Data.Set/index.js
var foldableSet = {
  foldMap: (dictMonoid) => {
    const foldMap14 = foldableList.foldMap(dictMonoid);
    return (f) => {
      const $0 = foldMap14(f);
      return (x) => $0((() => {
        const go = (m$p, z$p) => {
          if (m$p.tag === "Leaf") {
            return z$p;
          }
          if (m$p.tag === "Node") {
            return go(m$p._5, $List("Cons", m$p._3, go(m$p._6, z$p)));
          }
          fail();
        };
        return go(x, Nil);
      })());
    };
  },
  foldl: (f) => (x) => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const b = go$a0, v = go$a1;
        if (v.tag === "Nil") {
          go$c = false;
          go$r = b;
          continue;
        }
        if (v.tag === "Cons") {
          go$a0 = f(b)(v._1);
          go$a1 = v._2;
          continue;
        }
        fail();
      }
      return go$r;
    };
    const $0 = go(x);
    return (x$1) => $0((() => {
      const go$1 = (m$p, z$p) => {
        if (m$p.tag === "Leaf") {
          return z$p;
        }
        if (m$p.tag === "Node") {
          return go$1(m$p._5, $List("Cons", m$p._3, go$1(m$p._6, z$p)));
        }
        fail();
      };
      return go$1(x$1, Nil);
    })());
  },
  foldr: (f) => (x) => {
    const $0 = foldableList.foldr(f)(x);
    return (x$1) => $0((() => {
      const go = (m$p, z$p) => {
        if (m$p.tag === "Leaf") {
          return z$p;
        }
        if (m$p.tag === "Node") {
          return go(m$p._5, $List("Cons", m$p._3, go(m$p._6, z$p)));
        }
        fail();
      };
      return go(x$1, Nil);
    })());
  }
};
var mapMaybe2 = (dictOrd) => (f) => foldableSet.foldr((a) => (acc) => {
  const $0 = f(a);
  if ($0.tag === "Nothing") {
    return acc;
  }
  if ($0.tag === "Just") {
    return insert(dictOrd)($0._1)()(acc);
  }
  fail();
})(Leaf);
var monoidSet = (dictOrd) => {
  const semigroupSet1 = {
    append: (() => {
      const compare3 = dictOrd.compare;
      return (m1) => (m2) => unsafeUnionWith(compare3, $$const, m1, m2);
    })()
  };
  return { mempty: Leaf, Semigroup0: () => semigroupSet1 };
};

// output-es/PureScript.Backend.Optimizer.Convert/index.js
var $CaseRowGuardedExpr = (tag, _1) => ({ tag, _1 });
var $PatternCase = (tag, _1, _2) => ({ tag, _1, _2 });
var eq = /* @__PURE__ */ eqArrayImpl(eqStringImpl);
var compare = /* @__PURE__ */ (() => ordArray(ordString).compare)();
var compare12 = /* @__PURE__ */ (() => ordQualified(ordString).compare)();
var ordQualified3 = /* @__PURE__ */ ordQualified(ordString);
var lookup4 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var monoidSemigroupMap2 = /* @__PURE__ */ monoidSemigroupMap(ordString)(semigroupFirst2);
var foldMap5 = /* @__PURE__ */ (() => foldableSet.foldMap(monoidSemigroupMap2))();
var toUnfoldable2 = /* @__PURE__ */ (() => {
  const $0 = unfoldableArray.unfoldr((xs) => {
    if (xs.tag === "Nil") {
      return Nothing;
    }
    if (xs.tag === "Cons") {
      return $Maybe("Just", $Tuple(xs._1, xs._2));
    }
    fail();
  });
  return (x) => $0((() => {
    const go = (m$p, z$p) => {
      if (m$p.tag === "Leaf") {
        return z$p;
      }
      if (m$p.tag === "Node") {
        return go(m$p._5, $List("Cons", m$p._3, go(m$p._6, z$p)));
      }
      fail();
    };
    return go(x, Nil);
  })());
})();
var foldMap22 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidArray))();
var fromFoldable1 = /* @__PURE__ */ foldlArray((m) => (a) => insert(ordString)(a)()(m))(Leaf);
var lookup12 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordQualified3.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var lookup23 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordEvalRef.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var lookup33 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordInlineAccessor.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var fromFoldable22 = /* @__PURE__ */ fromFoldable(ordInlineAccessor)(foldableArray);
var analyzeEffectBlock2 = /* @__PURE__ */ analyzeEffectBlock(hasAnalysisBackendExpr)(hasSyntaxBackendExpr);
var analyze2 = /* @__PURE__ */ analyze(hasAnalysisBackendExpr)(hasSyntaxBackendExpr);
var foldMap32 = /* @__PURE__ */ (() => foldableArray.foldMap(/* @__PURE__ */ (() => {
  const semigroupRecord1 = { append: (ra) => (rb) => ({ rowsNoMatch: [...ra.rowsNoMatch, ...rb.rowsNoMatch], rowsWithMatch: [...ra.rowsWithMatch, ...rb.rowsWithMatch] }) };
  return { mempty: { rowsNoMatch: [], rowsWithMatch: [] }, Semigroup0: () => semigroupRecord1 };
})()))();
var forWithIndex = /* @__PURE__ */ (() => {
  const $0 = traversableWithIndexArray.traverseWithIndex(applicativeFn);
  return (b) => (a) => $0(a)(b);
})();
var zipWithA2 = /* @__PURE__ */ zipWithA(applicativeFn);
var lookup42 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var traverse3 = /* @__PURE__ */ (() => traversableLiteral.traverse(applicativeFn))();
var traverse1 = /* @__PURE__ */ (() => traversableArray.traverse(applicativeFn))();
var traverse32 = /* @__PURE__ */ (() => traversableArray.traverse(applicativeFn))();
var append3 = /* @__PURE__ */ (() => semigroupSemigroupMap(ordString)(semigroupFirst2).append)();
var toUnfoldable12 = /* @__PURE__ */ (() => {
  const $0 = unfoldableArray.unfoldr(stepUnfoldr);
  return (x) => $0($MapIter("IterNode", x, IterLeaf));
})();
var foldMap42 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidSemigroupMap2))();
var $$for = /* @__PURE__ */ (() => {
  const traverse22 = traversableArray.traverse(applicativeFn);
  return (x) => (f) => traverse22(f)(x);
})();
var member = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = false;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordQualified3.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = true;
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var alter3 = /* @__PURE__ */ alter(ordEvalRef);
var mapAccumL2 = /* @__PURE__ */ mapAccumL(traversableArray);
var fromFoldable32 = /* @__PURE__ */ foldlArray((m) => (a) => insert(ordString)(a)()(m))(Leaf);
var member1 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = false;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = true;
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var fromFoldable42 = /* @__PURE__ */ fromFoldable(ordString)(foldableArray);
var fromFoldable5 = /* @__PURE__ */ fromFoldable(ordString)(foldableArray);
var maximum2 = /* @__PURE__ */ maximum(ordInt)(foldable1NonEmptyArray);
var mapAccumR2 = /* @__PURE__ */ mapAccumR(traversableArray);
var foldMap52 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidSet(ordQualified3)))();
var fromFoldable6 = /* @__PURE__ */ foldlArray((m) => (a) => insert(ordReExport)(a)()(m))(Leaf);
var PatWild = /* @__PURE__ */ $PatternCase("PatWild");
var eqPatternCase = {
  eq: (x) => (y) => {
    if (x.tag === "PatWild") {
      return y.tag === "PatWild";
    }
    if (x.tag === "PatRecord") {
      return y.tag === "PatRecord" && eq(x._1)(y._1);
    }
    if (x.tag === "PatProduct") {
      return y.tag === "PatProduct" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2 && (x._2._1.tag === "Nothing" ? y._2._1.tag === "Nothing" : x._2._1.tag === "Just" && y._2._1.tag === "Just" && x._2._1._1 === y._2._1._1) && x._2._2 === y._2._2;
    }
    if (x.tag === "PatArray") {
      return y.tag === "PatArray" && x._1 === y._1;
    }
    if (x.tag === "PatSum") {
      return y.tag === "PatSum" && (x._1._1.tag === "Nothing" ? y._1._1.tag === "Nothing" : x._1._1.tag === "Just" && y._1._1.tag === "Just" && x._1._1._1 === y._1._1._1) && x._1._2 === y._1._2 && (x._2._1.tag === "Nothing" ? y._2._1.tag === "Nothing" : x._2._1.tag === "Just" && y._2._1.tag === "Just" && x._2._1._1 === y._2._1._1) && x._2._2 === y._2._2;
    }
    if (x.tag === "PatInt") {
      return y.tag === "PatInt" && x._1 === y._1;
    }
    if (x.tag === "PatNumber") {
      return y.tag === "PatNumber" && x._1 === y._1;
    }
    if (x.tag === "PatString") {
      return y.tag === "PatString" && x._1 === y._1;
    }
    if (x.tag === "PatChar") {
      return y.tag === "PatChar" && x._1 === y._1;
    }
    return x.tag === "PatBoolean" && y.tag === "PatBoolean" && x._1 === y._1;
  }
};
var ordPatternCase = {
  compare: (x) => (y) => {
    if (x.tag === "PatWild") {
      if (y.tag === "PatWild") {
        return EQ;
      }
      return LT;
    }
    if (y.tag === "PatWild") {
      return GT;
    }
    if (x.tag === "PatRecord") {
      if (y.tag === "PatRecord") {
        return compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatRecord") {
      return GT;
    }
    if (x.tag === "PatProduct") {
      if (y.tag === "PatProduct") {
        const v = compare12(x._1)(y._1);
        if (v === "LT") {
          return LT;
        }
        if (v === "GT") {
          return GT;
        }
        return ordQualified3.compare(x._2)(y._2);
      }
      return LT;
    }
    if (y.tag === "PatProduct") {
      return GT;
    }
    if (x.tag === "PatArray") {
      if (y.tag === "PatArray") {
        return ordInt.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatArray") {
      return GT;
    }
    if (x.tag === "PatSum") {
      if (y.tag === "PatSum") {
        const v = compare12(x._1)(y._1);
        if (v === "LT") {
          return LT;
        }
        if (v === "GT") {
          return GT;
        }
        return ordQualified3.compare(x._2)(y._2);
      }
      return LT;
    }
    if (y.tag === "PatSum") {
      return GT;
    }
    if (x.tag === "PatInt") {
      if (y.tag === "PatInt") {
        return ordInt.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatInt") {
      return GT;
    }
    if (x.tag === "PatNumber") {
      if (y.tag === "PatNumber") {
        return ordNumber.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatNumber") {
      return GT;
    }
    if (x.tag === "PatString") {
      if (y.tag === "PatString") {
        return ordString.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatString") {
      return GT;
    }
    if (x.tag === "PatChar") {
      if (y.tag === "PatChar") {
        return ordChar.compare(x._1)(y._1);
      }
      return LT;
    }
    if (y.tag === "PatChar") {
      return GT;
    }
    if (x.tag === "PatBoolean" && y.tag === "PatBoolean") {
      return ordBoolean.compare(x._1)(y._1);
    }
    fail();
  },
  Eq0: () => eqPatternCase
};
var monoidSet2 = /* @__PURE__ */ monoidSet(ordPatternCase);
var foldMapWithIndex = /* @__PURE__ */ (() => foldableWithIndexArray.foldMapWithIndex((() => {
  const Semigroup0 = monoidSet2.Semigroup0();
  const semigroupRecord1 = {
    append: (ra) => (rb) => ({ aScore: ra.aScore + rb.aScore | 0, ctors: Semigroup0.append(ra.ctors)(rb.ctors), tailRowIndices: [...ra.tailRowIndices, ...rb.tailRowIndices] })
  };
  return { mempty: { aScore: 0, ctors: monoidSet2.mempty, tailRowIndices: [] }, Semigroup0: () => semigroupRecord1 };
})()))();
var unwrapExternSpine = (v) => {
  if (v.tag === "ExternApp") {
    return $ExternSpine("ExternApp", arrayMap(unwrapSemTyped)(v._1));
  }
  if (v.tag === "ExternUncurriedApp") {
    return $ExternSpine("ExternUncurriedApp", arrayMap(unwrapSemTyped)(v._1));
  }
  if (v.tag === "ExternAccessor") {
    return $ExternSpine("ExternAccessor", v._1);
  }
  if (v.tag === "ExternPrimOp") {
    return $ExternSpine("ExternPrimOp", v._1);
  }
  fail();
};
var toExternImpl = (env) => (group2) => (isDict) => (expr) => {
  const unwrapTyped = (unwrapTyped$a0$copy) => {
    let unwrapTyped$a0 = unwrapTyped$a0$copy, unwrapTyped$c = true, unwrapTyped$r;
    while (unwrapTyped$c) {
      const v2 = unwrapTyped$a0;
      if (v2.tag === "ExprSyntax" && v2._2.tag === "Typed") {
        unwrapTyped$a0 = v2._2._2;
        continue;
      }
      unwrapTyped$c = false;
      unwrapTyped$r = v2;
    }
    return unwrapTyped$r;
  };
  const getLitRecord = (getLitRecord$a0$copy) => {
    let getLitRecord$a0 = getLitRecord$a0$copy, getLitRecord$c = true, getLitRecord$r;
    while (getLitRecord$c) {
      const v2 = getLitRecord$a0;
      if (v2.tag === "ExprSyntax") {
        if (v2._2.tag === "App") {
          getLitRecord$a0 = (() => {
            const $0 = v2._2._2.length - 1 | 0;
            if ($0 >= 0 && $0 < v2._2._2.length) {
              return v2._2._2[$0];
            }
            fail();
          })();
          continue;
        }
        if (v2._2.tag === "Lit" && v2._2._1.tag === "LitRecord") {
          getLitRecord$c = false;
          getLitRecord$r = $Maybe("Just", v2._2._1._1);
          continue;
        }
      }
      getLitRecord$c = false;
      getLitRecord$r = Nothing;
    }
    return getLitRecord$r;
  };
  const v = unwrapTyped(expr);
  if (v.tag === "ExprSyntax" && v._2.tag === "Lit" && v._2._1.tag === "LitRecord") {
    return $Tuple(
      $Tuple(
        (() => {
          if (expr.tag === "ExprSyntax") {
            return expr._1;
          }
          if (expr.tag === "ExprRewrite") {
            return expr._1;
          }
          fail();
        })(),
        $ExternImpl(
          "ExternDict",
          group2,
          arrayMap((m) => $Prop(m._1, freeze(m._2)))(v._2._1._1)
        )
      ),
      freeze(expr)._2
    );
  }
  const v1 = (v2) => {
    if (v.tag === "ExprSyntax" && v._2.tag === "CtorDef") {
      return $Tuple(
        $Tuple(
          (() => {
            if (expr.tag === "ExprSyntax") {
              return expr._1;
            }
            if (expr.tag === "ExprRewrite") {
              return expr._1;
            }
            fail();
          })(),
          $ExternImpl(
            "ExternCtor",
            (() => {
              const $0 = lookup4(v._2._2)(env.dataTypes);
              if ($0.tag === "Nothing") {
                return { constructors: Leaf, size: 0 };
              }
              if ($0.tag === "Just") {
                return $0._1;
              }
              fail();
            })(),
            v._2._1,
            v._2._2,
            v._2._3,
            v._2._4
          )
        ),
        freeze(expr)._2
      );
    }
    const v3 = freeze(expr);
    return $Tuple($Tuple(v3._1, $ExternImpl("ExternExpr", group2, v3._2)), v3._2);
  };
  if (isDict) {
    const $0 = getLitRecord(v);
    if ($0.tag === "Just") {
      return $Tuple(
        $Tuple(
          (() => {
            if (expr.tag === "ExprSyntax") {
              return expr._1;
            }
            if (expr.tag === "ExprRewrite") {
              return expr._1;
            }
            fail();
          })(),
          $ExternImpl(
            "ExternDict",
            group2,
            arrayMap((m) => $Prop(m._1, freeze(m._2)))($0._1)
          )
        ),
        freeze(expr)._2
      );
    }
  }
  return v1(true);
};
var toCaseRowVars = (v) => {
  const $0 = v.column;
  return foldMap5((x) => $$$Map("Node", 1, 1, x, $0, Leaf, Leaf))(v.pattern.vars);
};
var patternVars = (v) => [...toUnfoldable2(v.pattern.vars), ...foldMap22(patternVars)(v.pattern.subterms)];
var normalizeCaseRows = (x) => {
  const go = (go$a0$copy) => (go$a1$copy) => {
    let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
    while (go$c) {
      const columnIdx = go$a0, columnsAcc = go$a1;
      const nextColumnFields = foldlArray((acc) => (next) => {
        if (columnIdx >= 0 && columnIdx < next.patterns.length) {
          const $02 = next.patterns[columnIdx];
          return $Maybe(
            "Just",
            (() => {
              if ($02.pattern.patternCase.tag === "PatRecord") {
                const keys2 = fromFoldable1($02.pattern.patternCase._1);
                if (acc.tag === "Nothing") {
                  return keys2;
                }
                if (acc.tag === "Just") {
                  return unsafeUnionWith(ordString.compare, $$const, keys2, acc._1);
                }
                fail();
              }
              if (acc.tag === "Nothing") {
                return Leaf;
              }
              if (acc.tag === "Just") {
                return acc._1;
              }
              fail();
            })()
          );
        }
        return Nothing;
      })(Nothing)(x);
      if (nextColumnFields.tag === "Nothing") {
        go$c = false;
        go$r = columnsAcc;
        continue;
      }
      if (nextColumnFields.tag === "Just") {
        go$a0 = columnIdx + 1 | 0;
        go$a1 = snoc(columnsAcc)(nextColumnFields._1);
        continue;
      }
      fail();
    }
    return go$r;
  };
  const $0 = go(0)([]);
  return arrayMap((nextRow) => ({
    ...nextRow,
    patterns: zipWithImpl(
      (allFieldsSet) => (pat) => {
        if (pat.pattern.patternCase.tag === "PatRecord") {
          const v1 = unzip(arrayMap(head)(groupAllBy((x$1) => (y) => ordString.compare(x$1._1)(y._1))([
            ...zipWithImpl(Tuple, pat.pattern.patternCase._1, pat.pattern.subterms),
            ...arrayMap((fieldName) => $Tuple(
              fieldName,
              {
                accessor: $BackendAccessor("GetProp", fieldName),
                pattern: { vars: Leaf, patternCase: PatWild, subterms: [] }
              }
            ))(toUnfoldable2(allFieldsSet))
          ])));
          return { ...pat, pattern: { ...pat.pattern, patternCase: $PatternCase("PatRecord", v1._1), subterms: v1._2 } };
        }
        return pat;
      },
      $0,
      nextRow.patterns
    )
  }))(x);
};
var makeExternEvalSpine = (conv) => (env) => (qual) => (spine) => {
  const spine$p = arrayMap(unwrapExternSpine)(spine);
  const $0 = lookup12(qual)(conv.foreignSemantics);
  const result = (() => {
    if ($0.tag === "Just") {
      return $0._1(env)(qual)(spine$p);
    }
    if ($0.tag === "Nothing") {
      return Nothing;
    }
    fail();
  })();
  if (result.tag === "Nothing") {
    const $1 = lookup12(qual)(conv.implementations);
    if ($1.tag === "Just") {
      return evalExternFromImpl({ ...env, locals: [] })(qual)($1._1)(spine$p);
    }
    if ($1.tag === "Nothing") {
      return Nothing;
    }
    fail();
  }
  return result;
};
var makeExternEvalRef = (conv) => (env) => (qual) => {
  const $0 = lookup12(qual)(conv.implementations);
  if ($0.tag === "Just") {
    return $Maybe("Just", evalExternRefFromImpl(env)(qual)($0._1));
  }
  return Nothing;
};
var isConstrainedType = (v) => v.tag === "ConstrainedType" || v.tag === "ForAll" && isConstrainedType(v._2);
var isTypeClassDictionaryWithProps = (expr) => {
  const getConstructorMeta = (getConstructorMeta$a0$copy) => {
    let getConstructorMeta$a0 = getConstructorMeta$a0$copy, getConstructorMeta$c = true, getConstructorMeta$r;
    while (getConstructorMeta$c) {
      const v = getConstructorMeta$a0;
      if (v.tag === "ExprVar") {
        if (v._1.meta.tag === "Just") {
          getConstructorMeta$c = false;
          getConstructorMeta$r = $Maybe("Just", v._1.meta._1);
          continue;
        }
        getConstructorMeta$c = false;
        getConstructorMeta$r = Nothing;
        continue;
      }
      if (v.tag === "ExprApp") {
        getConstructorMeta$a0 = v._2;
        continue;
      }
      getConstructorMeta$c = false;
      getConstructorMeta$r = Nothing;
    }
    return getConstructorMeta$r;
  };
  if (expr.tag === "ExprAbs") {
    if (expr._1.type.tag === "Just" && (expr._1.type._1.tag === "ConstrainedType" || expr._1.type._1.tag === "ForAll" && isConstrainedType(expr._1.type._1._2))) {
      return $Tuple(true, isTypeClassDictionaryWithProps(expr._3)._2);
    }
    return isTypeClassDictionaryWithProps(expr._3);
  }
  if (expr.tag === "ExprLet") {
    return isTypeClassDictionaryWithProps(expr._3);
  }
  if (expr.tag === "ExprApp" && expr._3.tag === "ExprLit" && expr._3._2.tag === "LitRecord") {
    const $0 = getConstructorMeta(expr._2);
    if ($0.tag === "Just" && (eqMeta.eq($0._1)(IsTypeClassConstructor) || eqMeta.eq($0._1)(IsNewtype))) {
      return $Tuple(true, arrayMap(propKey)(expr._3._2._1));
    }
  }
  return $Tuple(false, []);
};
var intro = (dictFoldable) => (ident) => (lvl) => (f) => (env) => f({
  ...env,
  currentLevel: env.currentLevel + 1 | 0,
  toLevel: dictFoldable.foldr((a) => insert(ordString)(a)(lvl))(env.toLevel)(ident)
});
var inferTransitiveDirective = (directives) => (impl) => (backendExpr) => (cfn) => {
  const $0 = (() => {
    if (impl.tag === "ExternExpr") {
      if (impl._2.tag === "App") {
        if (impl._2._1.tag === "Var") {
          const v = lookup23($EvalRef("EvalExtern", impl._2._1._1))(directives);
          if (v.tag === "Just") {
            const go = (m$p, z$p) => {
              if (m$p.tag === "Leaf") {
                return z$p;
              }
              if (m$p.tag === "Node") {
                return go(
                  m$p._5,
                  (() => {
                    const $02 = m$p._4;
                    const $12 = go(m$p._6, z$p);
                    const $22 = (prop) => insert(ordInlineAccessor)($InlineAccessor(
                      "InlineSpineProp",
                      prop
                    ))($02)(insert(ordInlineAccessor)($InlineAccessor(
                      "InlineProp",
                      prop
                    ))($02)($12));
                    if ($02.tag === "InlineArity" && m$p._3.tag === "InlineRef") {
                      return insert(ordInlineAccessor)(InlineRef)($InlineDirective(
                        "InlineArity",
                        $02._1 - impl._2._2.length | 0
                      ))($12);
                    }
                    if (m$p._3.tag === "InlineSpineProp") {
                      return $22(m$p._3._1);
                    }
                    return $12;
                  })()
                );
              }
              fail();
            };
            const newDirs = go(v._1, Leaf);
            if (newDirs.tag === "Leaf") {
              return Nothing;
            }
            return $Maybe("Just", newDirs);
          }
        }
        return Nothing;
      }
      if (impl._2.tag === "Accessor" && impl._2._1.tag === "App" && impl._2._1._1.tag === "Var" && impl._2._2.tag === "GetProp") {
        const $02 = lookup23($EvalRef("EvalExtern", impl._2._1._1._1))(directives);
        const $12 = lookup33($InlineAccessor("InlineSpineProp", impl._2._2._1));
        const v = (() => {
          if ($02.tag === "Just") {
            return $12($02._1);
          }
          if ($02.tag === "Nothing") {
            return Nothing;
          }
          fail();
        })();
        if (v.tag === "Just" && v._1.tag === "InlineArity") {
          return $Maybe(
            "Just",
            $$$Map(
              "Node",
              1,
              1,
              InlineRef,
              $InlineDirective("InlineArity", v._1._1),
              Leaf,
              Leaf
            )
          );
        }
      }
    }
    return Nothing;
  })();
  const $1 = () => {
    const $12 = isTypeClassDictionaryWithProps(cfn);
    if ($12._1) {
      return $Maybe(
        "Just",
        fromFoldable22([
          $Tuple(InlineRef, InlineAlways),
          ...arrayMap((p) => $Tuple(
            $InlineAccessor("InlineProp", p),
            InlineAlways
          ))($12._2)
        ])
      );
    }
    if (backendExpr.tag === "ExprSyntax" && backendExpr._2.tag === "App" && backendExpr._2._1.tag === "ExprSyntax" && backendExpr._2._1._2.tag === "Var") {
      const $22 = lookup23($EvalRef("EvalExtern", backendExpr._2._1._2._1))(directives);
      const $3 = lookup33(InlineRef);
      const v2 = (() => {
        if ($22.tag === "Just") {
          return $3($22._1);
        }
        if ($22.tag === "Nothing") {
          return Nothing;
        }
        fail();
      })();
      if (v2.tag === "Just" && v2._1.tag === "InlineArity" && backendExpr._2._2.length >= v2._1._1) {
        return $Maybe(
          "Just",
          $$$Map(
            "Node",
            1,
            1,
            InlineRef,
            InlineAlways,
            Leaf,
            Leaf
          )
        );
      }
    }
    return Nothing;
  };
  const $2 = (() => {
    if (cfn.tag === "ExprApp") {
      if (cfn._1.meta.tag === "Just" && cfn._1.meta._1.tag === "IsSyntheticApp") {
        return $Maybe(
          "Just",
          $$$Map(
            "Node",
            1,
            1,
            InlineRef,
            InlineAlways,
            Leaf,
            Leaf
          )
        );
      }
      return $1();
    }
    if (cfn.tag === "ExprAbs" && cfn._1.meta.tag === "Just" && (eqMeta.eq(cfn._1.meta._1)(IsTypeClassConstructor) || eqMeta.eq(cfn._1.meta._1)(IsNewtype))) {
      return $Maybe(
        "Just",
        $$$Map(
          "Node",
          1,
          1,
          InlineRef,
          InlineAlways,
          Leaf,
          Leaf
        )
      );
    }
    return $1();
  })();
  if ($0.tag === "Nothing") {
    return $2;
  }
  return $0;
};
var getReturnType = (getReturnType$a0$copy) => {
  let getReturnType$a0 = getReturnType$a0$copy, getReturnType$c = true, getReturnType$r;
  while (getReturnType$c) {
    const v = getReturnType$a0;
    if (v.tag === "ForAll") {
      getReturnType$a0 = v._2;
      continue;
    }
    if (v.tag === "ConstrainedType") {
      getReturnType$a0 = v._2;
      continue;
    }
    if (v.tag === "Func") {
      const v1 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), v._1);
      if (v1.tag === "Just" && v1._1.tail.length > 0) {
        getReturnType$c = false;
        getReturnType$r = $Maybe("Just", $ExprType("Func", v1._1.tail, v._2));
        continue;
      }
      getReturnType$c = false;
      getReturnType$r = $Maybe("Just", v._2);
      continue;
    }
    getReturnType$c = false;
    getReturnType$r = Nothing;
  }
  return getReturnType$r;
};
var inferExprType = (v) => {
  if (v.tag === "ExprApp") {
    const v1 = (() => {
      if (v._2.tag === "ExprVar") {
        return v._2._1;
      }
      if (v._2.tag === "ExprLit") {
        return v._2._1;
      }
      if (v._2.tag === "ExprConstructor") {
        return v._2._1;
      }
      if (v._2.tag === "ExprAccessor") {
        return v._2._1;
      }
      if (v._2.tag === "ExprUpdate") {
        return v._2._1;
      }
      if (v._2.tag === "ExprAbs") {
        return v._2._1;
      }
      if (v._2.tag === "ExprApp") {
        return v._2._1;
      }
      if (v._2.tag === "ExprCase") {
        return v._2._1;
      }
      if (v._2.tag === "ExprLet") {
        return v._2._1;
      }
      fail();
    })();
    if (v1.type.tag === "Just") {
      return getReturnType(v1.type._1);
    }
    const v2 = inferExprType(v._2);
    if (v2.tag === "Just") {
      return getReturnType(v2._1);
    }
    if (v2.tag === "Nothing") {
      return Nothing;
    }
    fail();
  }
  return Nothing;
};
var getCtx = (env) => {
  const lookupExtern = (qual) => (acc) => {
    const $0 = lookup12(qual)(env.implementations);
    if ($0.tag === "Just") {
      if ($0._1._2.tag === "ExternExpr") {
        if (acc.tag === "Nothing") {
          return $Maybe("Just", $0._1._1);
        }
        return Nothing;
      }
      if ($0._1._2.tag === "ExternDict") {
        if (acc.tag === "Just") {
          const $1 = acc._1;
          const $2 = findMapImpl(
            Nothing,
            isJust,
            (v) => {
              if ($1 === v._1) {
                return $Maybe("Just", v._2);
              }
              return Nothing;
            },
            $0._1._2._2
          );
          if ($2.tag === "Just") {
            return $Maybe("Just", $2._1._1);
          }
          return Nothing;
        }
        if (acc.tag === "Nothing") {
          return $Maybe("Just", $0._1._1);
        }
        fail();
      }
      if ($0._1._2.tag === "ExternCtor") {
        return Nothing;
      }
      fail();
    }
    if ($0.tag === "Nothing") {
      return Nothing;
    }
    fail();
  };
  return {
    currentLevel: env.currentLevel,
    lookupExtern,
    analyze: (v) => {
      const $0 = v.effect;
      return (expr) => {
        const v1 = env.analyzeCustom(v)(expr);
        if (v1.tag === "Just") {
          return v1._1;
        }
        if (v1.tag === "Nothing") {
          if ($0) {
            return analyzeEffectBlock2(lookupExtern)(expr);
          }
          return analyze2(lookupExtern)(expr);
        }
        fail();
      };
    },
    effect: false
  };
};
var decompose = (chosenColumn) => {
  const checkMatch = (p) => {
    if (p.column === chosenColumn.column && (eqPatternCase.eq(p.pattern.patternCase)(PatWild) || eqPatternCase.eq(chosenColumn.pattern.patternCase)(p.pattern.patternCase))) {
      return { nonMatchesBefore: [], match: $Maybe("Just", { match: p, nonMatchesAfter: [] }) };
    }
    return { nonMatchesBefore: [p], match: Nothing };
  };
  return foldMap32((row) => {
    const v = row.patterns.length > 0 ? $Maybe("Just", row.patterns) : Nothing;
    if (v.tag === "Nothing") {
      return _crashWith("decompose - nextRow.patterns cannot be empty since the first row contains at least one `PatCtor` patternCase");
    }
    if (v.tag === "Just") {
      const $0 = v._1;
      const len = $0.length;
      const v1 = (() => {
        const go = (go$a0$copy) => (go$a1$copy) => {
          let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
          while (go$c) {
            const ix = go$a0, acc = go$a1;
            if (ix === len) {
              go$c = false;
              go$r = acc;
              continue;
            }
            go$a0 = ix + 1 | 0;
            go$a1 = (() => {
              const $1 = checkMatch($0[ix]);
              if (acc.match.tag === "Just") {
                if ($1.match.tag === "Just") {
                  return _crashWith("mergeResults - impossible: cannot match the same column twice in the same row");
                }
                if ($1.match.tag === "Nothing") {
                  return { ...acc, match: $Maybe("Just", { ...acc.match._1, nonMatchesAfter: [...acc.match._1.nonMatchesAfter, ...$1.nonMatchesBefore] }) };
                }
                fail();
              }
              if (acc.match.tag === "Nothing") {
                if ($1.match.tag === "Nothing") {
                  return { ...$1, nonMatchesBefore: [...acc.nonMatchesBefore, ...$1.nonMatchesBefore] };
                }
                if ($1.match.tag === "Just") {
                  return { ...$1, nonMatchesBefore: [...acc.nonMatchesBefore, ...$1.nonMatchesBefore] };
                }
              }
              fail();
            })();
          }
          return go$r;
        };
        return go(1)(checkMatch((() => {
          if (0 < $0.length) {
            return $0[0];
          }
          fail();
        })()));
      })();
      if (v1.match.tag === "Just") {
        return {
          rowsWithMatch: [{ guardFn: row.guardFn, vars: row.vars, nonMatchesBefore: v1.nonMatchesBefore, match: v1.match._1.match, nonMatchesAfter: v1.match._1.nonMatchesAfter }],
          rowsNoMatch: eqPatternCase.eq(v1.match._1.match.pattern.patternCase)(PatWild) ? [row] : []
        };
      }
      if (v1.match.tag === "Nothing") {
        return { rowsWithMatch: [], rowsNoMatch: [row] };
      }
    }
    fail();
  });
};
var chooseNextPattern = (row0Patterns) => (tailRows) => {
  const expandIfPossible = findMapImpl(
    Nothing,
    isJust,
    (v) => {
      if (v._2.pattern.patternCase.tag === "PatRecord") {
        return $Maybe("Just", v._2);
      }
      if (v._2.pattern.patternCase.tag === "PatProduct") {
        return $Maybe("Just", v._2);
      }
      return Nothing;
    },
    row0Patterns
  );
  if (expandIfPossible.tag === "Just") {
    return expandIfPossible._1;
  }
  if (expandIfPossible.tag === "Nothing") {
    const $0 = foldlArray((acc) => (next) => {
      if (acc.tag === "Nothing") {
        return $Maybe("Just", [next]);
      }
      if (acc.tag === "Just") {
        const v = ordInt.compare((() => {
          if (0 < acc._1.length) {
            return acc._1[0].bScore;
          }
          fail();
        })())(next.bScore);
        if (v === "GT") {
          return acc;
        }
        if (v === "EQ") {
          return $Maybe("Just", snoc(acc._1)(next));
        }
        if (v === "LT") {
          return $Maybe("Just", [next]);
        }
      }
      fail();
    })(Nothing);
    const $1 = foldlArray((acc) => (next) => {
      if (acc.tag === "Nothing") {
        return $Maybe("Just", [next]);
      }
      if (acc.tag === "Just") {
        const v = ordInt.compare((() => {
          if (0 < acc._1.length) {
            return acc._1[0].aScore;
          }
          fail();
        })())(next.aScore);
        if (v === "GT") {
          return acc;
        }
        if (v === "EQ") {
          return $Maybe("Just", snoc(acc._1)(next));
        }
        if (v === "LT") {
          return $Maybe("Just", [next]);
        }
      }
      fail();
    })(Nothing);
    const $2 = foldlArray((acc) => (next) => {
      if (acc.tag === "Nothing") {
        return $Maybe("Just", [next]);
      }
      if (acc.tag === "Just") {
        const v = ordInt.compare((() => {
          if (0 < acc._1.length) {
            return acc._1[0].pScore;
          }
          fail();
        })())(next.pScore);
        if (v === "GT") {
          return acc;
        }
        if (v === "EQ") {
          return $Maybe("Just", snoc(acc._1)(next));
        }
        if (v === "LT") {
          return $Maybe("Just", [next]);
        }
      }
      fail();
    })(Nothing)(arrayMap((v) => {
      const $22 = v._1;
      const $3 = v._2;
      const matchingCols = foldMapWithIndex((rowIdx) => (row) => {
        if ($22 >= 0 && $22 < row.patterns.length) {
          return {
            tailRowIndices: (() => {
              const $4 = [rowIdx + 1 | 0];
              if (eqPatternCase.eq($3.pattern.patternCase)(row.patterns[$22].pattern.patternCase)) {
                return $4;
              }
              return [];
            })(),
            ctors: (() => {
              const $4 = $$$Map("Node", 1, 1, row.patterns[$22].pattern.patternCase, void 0, Leaf, Leaf);
              if (!eqPatternCase.eq(row.patterns[$22].pattern.patternCase)(PatWild)) {
                return $4;
              }
              return monoidSet2.mempty;
            })(),
            aScore: -filterImpl((x) => !eqPatternCase.eq(PatWild)(x.pattern.patternCase), row.patterns[$22].pattern.subterms).length
          };
        }
        return _crashWith("Impossible: rows' column lengths differ in pattern match");
      })(tailRows);
      return {
        pattern: $3,
        pScore: foldlArray((l) => (r) => {
          if ((l + 1 | 0) === r) {
            return r;
          }
          return l;
        })(0)(matchingCols.tailRowIndices),
        bScore: (() => {
          const $4 = insert(ordPatternCase)($3.pattern.patternCase)()(matchingCols.ctors);
          if ($4.tag === "Leaf") {
            return 0;
          }
          if ($4.tag === "Node") {
            return -$4._2;
          }
          fail();
        })(),
        aScore: matchingCols.aScore
      };
    })(row0Patterns));
    if ($2.tag === "Just") {
      const $3 = $0($2._1);
      if ($3.tag === "Just") {
        const $4 = $1($3._1);
        if ($4.tag === "Just") {
          if (0 < $4._1.length) {
            return $4._1[0].pattern;
          }
          fail();
        }
        if (0 < row0Patterns.length) {
          return row0Patterns[0]._2;
        }
        fail();
      }
      if ($3.tag === "Nothing" && 0 < row0Patterns.length) {
        return row0Patterns[0]._2;
      }
      fail();
    }
    if ($2.tag === "Nothing" && 0 < row0Patterns.length) {
      return row0Patterns[0]._2;
    }
  }
  fail();
};
var buildM = (a) => (env) => build(getCtx(env))(a);
var make = (a) => {
  const $0 = traversableBackendSyntax.traverse(applicativeFn)(identity3)(a);
  return (x) => build(getCtx(x))($0(x));
};
var guardBoolean = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpBooleanOrd", OpEq),
    lhs,
    make($BackendSyntax("Lit", $Literal("LitBoolean", n)))
  )
);
var guardChar = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpCharOrd", OpEq),
    lhs,
    make($BackendSyntax("Lit", $Literal("LitChar", n)))
  )
);
var guardInt = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpIntOrd", OpEq),
    lhs,
    make($BackendSyntax("Lit", $Literal("LitInt", n)))
  )
);
var guardArrayLength = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpIntOrd", OpEq),
    make($BackendSyntax(
      "PrimOp",
      $BackendOperator("Op1", OpArrayLength, lhs)
    )),
    make($BackendSyntax("Lit", $Literal("LitInt", n)))
  )
);
var guardNumber = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpNumberOrd", OpEq),
    lhs,
    make($BackendSyntax("Lit", $Literal("LitNumber", n)))
  )
);
var guardString = (n) => (lhs) => $BackendSyntax(
  "PrimOp",
  $BackendOperator(
    "Op2",
    $BackendOperator2("OpStringOrd", OpEq),
    lhs,
    make($BackendSyntax("Lit", $Literal("LitString", n)))
  )
);
var makeGuard = (lvl) => (g) => (inner) => (def) => make($BackendSyntax(
  "Branch",
  [$Pair(make(g(make($BackendSyntax("Local", Nothing, lvl)))), inner)],
  def
));
var makeLet2 = (id2) => (a) => (k) => (x) => {
  if (id2.tag === "Nothing") {
    return make($BackendSyntax(
      "Let",
      id2,
      x.currentLevel,
      a,
      (() => {
        const $0 = k(x.currentLevel);
        return (env) => $0({ ...env, currentLevel: env.currentLevel + 1 | 0 });
      })()
    ))(x);
  }
  if (id2.tag === "Just") {
    return make($BackendSyntax("Let", id2, x.currentLevel, a, intro(foldableArray)([id2._1])(x.currentLevel)(k(x.currentLevel))))(x);
  }
  fail();
};
var makeUncurriedAbs = (args) => (cb) => foldrArray((ident) => (next) => (tmps) => (x) => intro(foldableArray)([ident])(x.currentLevel)(next(snoc(tmps)($Tuple(
  $Maybe("Just", ident),
  x.currentLevel
))))(x))((tmps) => make($BackendSyntax("UncurriedAbs", tmps, cb(tmps))))(args)([]);
var patternFail = /* @__PURE__ */ make(/* @__PURE__ */ $BackendSyntax("Fail", "Failed pattern match"));
var binderToPattern = (v) => {
  if (v.tag === "BinderNull") {
    return (v$1) => ({ vars: Leaf, patternCase: PatWild, subterms: [] });
  }
  if (v.tag === "BinderVar") {
    return (v$1) => ({ vars: $$$Map("Node", 1, 1, v._2, void 0, Leaf, Leaf), patternCase: PatWild, subterms: [] });
  }
  if (v.tag === "BinderNamed") {
    const $0 = v._2;
    const $1 = binderToPattern(v._3);
    return (x) => {
      const $2 = $1(x);
      return { ...$2, vars: insert(ordString)($0)()($2.vars) };
    };
  }
  if (v.tag === "BinderLit") {
    if (v._2.tag === "LitInt") {
      return (v$1) => ({ vars: Leaf, patternCase: $PatternCase("PatInt", v._2._1), subterms: [] });
    }
    if (v._2.tag === "LitNumber") {
      return (v$1) => ({ vars: Leaf, patternCase: $PatternCase("PatNumber", v._2._1), subterms: [] });
    }
    if (v._2.tag === "LitString") {
      return (v$1) => ({ vars: Leaf, patternCase: $PatternCase("PatString", v._2._1), subterms: [] });
    }
    if (v._2.tag === "LitChar") {
      return (v$1) => ({ vars: Leaf, patternCase: $PatternCase("PatChar", v._2._1), subterms: [] });
    }
    if (v._2.tag === "LitBoolean") {
      return (v$1) => ({ vars: Leaf, patternCase: $PatternCase("PatBoolean", v._2._1), subterms: [] });
    }
    if (v._2.tag === "LitArray") {
      const $0 = $PatternCase("PatArray", v._2._1.length);
      const $1 = forWithIndex(v._2._1)((idx) => (nextArg) => {
        const $12 = binderToPattern(nextArg);
        return (x) => ({ accessor: $BackendAccessor("GetIndex", idx), pattern: $12(x) });
      });
      return (x) => ({ vars: Leaf, patternCase: $0, subterms: $1(x) });
    }
    if (v._2.tag === "LitRecord") {
      const $0 = $PatternCase("PatRecord", arrayMap(propKey)(v._2._1));
      const $1 = forWithIndex(v._2._1)((idx) => (nextArg) => {
        const $12 = binderToPattern(nextArg._2);
        return (x) => ({ accessor: $BackendAccessor("GetProp", nextArg._1), pattern: $12(x) });
      });
      return (x) => ({ vars: Leaf, patternCase: $0, subterms: $1(x) });
    }
    fail();
  }
  if (v.tag === "BinderConstructor") {
    if (v._1.meta.tag === "Just" && v._1.meta._1.tag === "IsNewtype" && v._4.length === 1) {
      return binderToPattern(v._4[0]);
    }
    if (v._1.meta.tag === "Just") {
      if (v._1.meta._1.tag === "IsNewtype") {
        return _crashWith("Newtype binder didn't wrap 1 arg");
      }
      if (v._1.meta._1.tag === "IsConstructor") {
        if (v._1.meta._1._1 === "ProductType") {
          const $0 = forWithIndex(v._4)((idx) => (nextArg) => {
            const $02 = binderToPattern(nextArg);
            return (x) => ({
              accessor: $BackendAccessor(
                "GetCtorField",
                v._3,
                ProductType,
                v._2._2,
                v._3._2,
                "value" + showIntImpl(idx),
                idx
              ),
              pattern: $02(x)
            });
          });
          return (x) => ({ vars: Leaf, patternCase: $PatternCase("PatProduct", v._2, v._3), subterms: $0(x) });
        }
        if (v._1.meta._1._1 === "SumType") {
          const $0 = forWithIndex(v._4)((idx) => (nextArg) => {
            const $02 = binderToPattern(nextArg);
            return (x) => ({
              accessor: $BackendAccessor(
                "GetCtorField",
                v._3,
                SumType,
                v._2._2,
                v._3._2,
                "value" + showIntImpl(idx),
                idx
              ),
              pattern: $02(x)
            });
          });
          return (x) => ({ vars: Leaf, patternCase: $PatternCase("PatSum", v._2, v._3), subterms: $0(x) });
        }
      }
    }
    return _crashWith("binderToPattern - invalid meta");
  }
  fail();
};
var toBackendExprWithType = (mbTy) => (expr) => {
  const $0 = (() => {
    if (expr.tag === "ExprVar") {
      return expr._1;
    }
    if (expr.tag === "ExprLit") {
      return expr._1;
    }
    if (expr.tag === "ExprConstructor") {
      return expr._1;
    }
    if (expr.tag === "ExprAccessor") {
      return expr._1;
    }
    if (expr.tag === "ExprUpdate") {
      return expr._1;
    }
    if (expr.tag === "ExprAbs") {
      return expr._1;
    }
    if (expr.tag === "ExprApp") {
      return expr._1;
    }
    if (expr.tag === "ExprCase") {
      return expr._1;
    }
    if (expr.tag === "ExprLet") {
      return expr._1;
    }
    fail();
  })();
  const $1 = (() => {
    if (expr.tag === "ExprVar") {
      const $12 = expr._2;
      return (x) => {
        const $2 = x.currentModule;
        const $3 = x.toLevel;
        const v2 = (v3) => {
          const v4 = (v5) => {
            if ($12._2 === "undefined" && $12._1.tag === "Just") {
              if ($12._1._1 === "Prim") {
                return buildM(PrimUndefined);
              }
              return buildM($BackendSyntax("Var", $12));
            }
            if ($12._1.tag === "Nothing") {
              return buildM($BackendSyntax("Var", $Qualified($Maybe("Just", $2), $12._2)));
            }
            return buildM($BackendSyntax("Var", $12));
          };
          if ($12._1.tag === "Just" && $12._1._1 === $2) {
            const $4 = lookup42($12._2)($3);
            if ($4.tag === "Just") {
              return buildM($BackendSyntax("Local", $Maybe("Just", $12._2), $4._1));
            }
          }
          return v4(true);
        };
        if ($12._1.tag === "Nothing") {
          const $4 = lookup42($12._2)($3);
          if ($4.tag === "Just") {
            return build(getCtx(x))($BackendSyntax(
              "Local",
              $Maybe("Just", $12._2),
              $4._1
            ));
          }
        }
        return v2(true)(x);
      };
    }
    if (expr.tag === "ExprLit") {
      const $12 = traverse3(toBackendExpr)(expr._2);
      return (x) => build(getCtx(x))($BackendSyntax("Lit", $12(x)));
    }
    if (expr.tag === "ExprConstructor") {
      const $12 = expr._4;
      const $2 = expr._3;
      const $3 = expr._2;
      return (x) => build(getCtx(x))($BackendSyntax(
        "CtorDef",
        (() => {
          const v2 = lookup4($3)(x.dataTypes);
          if (v2.tag === "Just" && (() => {
            if (v2._1.constructors.tag === "Leaf") {
              return false;
            }
            if (v2._1.constructors.tag === "Node") {
              return v2._1.constructors._2 === 1;
            }
            fail();
          })()) {
            return ProductType;
          }
          return SumType;
        })(),
        $3,
        $2,
        $12
      ));
    }
    if (expr.tag === "ExprAccessor") {
      const $12 = toBackendExpr(expr._2);
      return (x) => build(getCtx(x))($BackendSyntax(
        "Accessor",
        $12(x),
        $BackendAccessor("GetProp", expr._3)
      ));
    }
    if (expr.tag === "ExprUpdate") {
      const $12 = toBackendExpr(expr._2);
      const $2 = traverse1(traversableProp.traverse(applicativeFn)(toBackendExpr))(expr._3);
      return (x) => build(getCtx(x))($BackendSyntax("Update", $12(x), $2(x)));
    }
    if (expr.tag === "ExprAbs") {
      const $12 = expr._2;
      const $2 = expr._3;
      return (x) => make($BackendSyntax(
        "Abs",
        [$Tuple($Maybe("Just", $12), x.currentLevel)],
        intro(foldableArray)([$12])(x.currentLevel)(toBackendExpr($2))
      ))(x);
    }
    if (expr.tag === "ExprApp" && expr._2.tag === "ExprVar" && expr._2._1.meta.tag === "Just" && expr._2._1.meta._1.tag === "IsNewtype") {
      return toBackendExpr(expr._3);
    }
    if (expr.tag === "ExprApp") {
      return make($BackendSyntax("App", toBackendExpr(expr._2), [toBackendExpr(expr._3)]));
    }
    if (expr.tag === "ExprLet") {
      return foldrArray((bind$p) => (next) => {
        if (bind$p.tag === "NonRec") {
          return makeLet2($Maybe("Just", bind$p._1._2))(toBackendExpr(bind$p._1._3))((v3) => next);
        }
        if (bind$p.tag === "Rec" && bind$p._1.length > 0) {
          const $12 = bind$p._1;
          return (x) => {
            const idents = arrayMap((v4) => v4._2)($12);
            return build(getCtx(x))($BackendSyntax(
              "LetRec",
              x.currentLevel,
              intro(foldableArray)(idents)(x.currentLevel)(traverse32(toBackendBinding)($12))(x),
              intro(foldableArray)(idents)(x.currentLevel)(next)(x)
            ));
          };
        }
        if (bind$p.tag === "Rec") {
          return _crashWith("CoreFn empty Rec binding group");
        }
        fail();
      })(toBackendExpr(expr._3))(expr._2);
    }
    if (expr.tag === "ExprCase") {
      const $12 = expr._3;
      const v3 = 0 < $12.length ? $Maybe("Just", $12[0]) : Nothing;
      const firstBinders = (() => {
        if (v3.tag === "Just") {
          return v3._1._1;
        }
        if (v3.tag === "Nothing") {
          return [];
        }
        fail();
      })();
      return foldrArray((v3$1) => {
        const $2 = v3$1._2;
        const $3 = v3$1._1;
        return (next) => (idents) => makeLet2(Nothing)(toBackendExprWithType((() => {
          if ($3 >= 0 && $3 < firstBinders.length) {
            if (firstBinders[$3].tag === "BinderNull") {
              return firstBinders[$3]._1.type;
            }
            if (firstBinders[$3].tag === "BinderVar") {
              return firstBinders[$3]._1.type;
            }
            if (firstBinders[$3].tag === "BinderNamed") {
              return firstBinders[$3]._1.type;
            }
            if (firstBinders[$3].tag === "BinderLit") {
              return firstBinders[$3]._1.type;
            }
            if (firstBinders[$3].tag === "BinderConstructor") {
              return firstBinders[$3]._1.type;
            }
            fail();
          }
          return Nothing;
        })())($2))((tmp) => next(snoc(idents)(tmp)));
      })((idents) => foldrArray((v) => {
        const $2 = v._1;
        const $3 = v._2;
        return (mainCb) => (caseRows) => {
          const $4 = zipWithA2((ident) => (b) => {
            const $42 = binderToPattern(b);
            return (x) => ({ column: ident, pattern: $42(x) });
          })(idents)($2);
          return (x) => {
            const $5 = $4(x);
            const args = sortBy(ordString.compare)(foldMap22(patternVars)($5));
            if ($3.tag === "Unconditional") {
              const $6 = $3._1;
              return makeLet2(Nothing)(makeUncurriedAbs(args)((v1) => toBackendExpr($6)))((tmp) => mainCb(snoc(caseRows)({
                patterns: $5,
                guardFn: $CaseRowGuardedExpr("UnconditionalFn", tmp),
                vars: Leaf
              })))(x);
            }
            if ($3.tag === "Guarded") {
              return foldrArray((v1) => {
                const $6 = v1._2;
                const $7 = v1._1;
                return (cb) => (xs) => makeLet2(Nothing)(makeUncurriedAbs(args)((v2) => toBackendExpr($6)))((tmp) => cb(snoc(xs)($Tuple($7, tmp))));
              })((xs) => {
                if (xs.length > 0) {
                  return mainCb(snoc(caseRows)({ patterns: $5, guardFn: $CaseRowGuardedExpr("GuardedFn", xs), vars: Leaf }));
                }
                return _crashWith("CoreFn empty Guarded");
              })($3._1)([])(x);
            }
            fail();
          };
        };
      })((caseRows) => buildCaseTreeFromRows(caseRows))($12)([]))(mapWithIndexArray(Tuple)(expr._2))([]);
    }
    fail();
  })();
  return (x) => {
    const $2 = $1(x);
    const v1 = (() => {
      if ($0.type.tag === "Just") {
        return $Maybe("Just", $0.type._1);
      }
      if ($0.type.tag === "Nothing") {
        if (mbTy.tag === "Just") {
          return $Maybe("Just", mbTy._1);
        }
        if (mbTy.tag === "Nothing") {
          return inferExprType(expr);
        }
      }
      fail();
    })();
    if (v1.tag === "Just") {
      return $BackendExpr(
        "ExprSyntax",
        (() => {
          if ($2.tag === "ExprSyntax") {
            return $2._1;
          }
          if ($2.tag === "ExprRewrite") {
            return $2._1;
          }
          fail();
        })(),
        $BackendSyntax("Typed", v1._1, $2)
      );
    }
    if (v1.tag === "Nothing") {
      return $2;
    }
    fail();
  };
};
var toBackendExpr = (expr) => toBackendExprWithType(Nothing)(expr);
var toBackendBinding = (v) => {
  const $0 = Tuple(v._2);
  const $1 = toBackendExprWithType(Nothing)(v._3);
  return (x) => $0($1(x));
};
var buildCaseTreeFromRows = (denormalizedRows) => {
  const $0 = normalizeCaseRows(denormalizedRows);
  if ($0.length > 0) {
    const v1 = uncons2($0);
    const $1 = foldableWithIndexArray.foldlWithIndex((idx) => (acc) => (p) => {
      if (!eqPatternCase.eq(p.pattern.patternCase)(PatWild)) {
        return snoc(acc)($Tuple(idx, p));
      }
      return acc;
    })([])(v1.head.patterns);
    if ($1.length > 0) {
      return buildCasePattern(chooseNextPattern($1)(v1.tail))($0);
    }
    return buildCaseLeaf(v1.head)(v1.tail);
  }
  return patternFail;
};
var buildCasePattern = (chosenColumn) => (rows) => {
  const letBindSubterm = (v) => (nextCb) => (idents) => makeLet2(Nothing)(make($BackendSyntax(
    "Accessor",
    make($BackendSyntax("Local", Nothing, chosenColumn.column)),
    v.accessor
  )))((tmp) => nextCb(snoc(idents)(tmp)));
  const $0 = decompose(chosenColumn)(rows).rowsWithMatch;
  const expandSubterms = foldrArray(letBindSubterm)((idents) => buildCaseTreeFromRows((() => {
    const inlineWildSubterms = arrayMap((column) => ({ column, pattern: { vars: Leaf, patternCase: PatWild, subterms: [] } }))(idents);
    return arrayMap((v) => ({
      guardFn: v.guardFn,
      vars: append3(v.vars)(toCaseRowVars(v.match)),
      patterns: [
        ...v.nonMatchesBefore,
        ...v.match.pattern.patternCase.tag === "PatWild" ? inlineWildSubterms : zipWithImpl((column) => (v$1) => ({ column, pattern: v$1.pattern }), idents, v.match.pattern.subterms),
        ...v.nonMatchesAfter
      ]
    }))($0);
  })()))(chosenColumn.pattern.subterms)([]);
  const buildCaseBranch = (guardExpr) => {
    const v = decompose(chosenColumn)(rows);
    const $1 = v.rowsWithMatch;
    return makeGuard(chosenColumn.column)(guardExpr)(foldrArray(letBindSubterm)((idents) => buildCaseTreeFromRows((() => {
      const inlineWildSubterms = arrayMap((column) => ({ column, pattern: { vars: Leaf, patternCase: PatWild, subterms: [] } }))(idents);
      return arrayMap((v$1) => ({
        guardFn: v$1.guardFn,
        vars: append3(v$1.vars)(toCaseRowVars(v$1.match)),
        patterns: [
          ...v$1.nonMatchesBefore,
          ...v$1.match.pattern.patternCase.tag === "PatWild" ? inlineWildSubterms : zipWithImpl((column) => (v$2) => ({ column, pattern: v$2.pattern }), idents, v$1.match.pattern.subterms),
          ...v$1.nonMatchesAfter
        ]
      }))($1);
    })()))(chosenColumn.pattern.subterms)([]))(buildCaseTreeFromRows(v.rowsNoMatch));
  };
  if (chosenColumn.pattern.patternCase.tag === "PatWild") {
    return _crashWith("Impossible: chosen column cannot be wild pattern");
  }
  if (chosenColumn.pattern.patternCase.tag === "PatRecord") {
    return expandSubterms;
  }
  if (chosenColumn.pattern.patternCase.tag === "PatProduct") {
    return expandSubterms;
  }
  if (chosenColumn.pattern.patternCase.tag === "PatSum") {
    const $1 = chosenColumn.pattern.patternCase._2;
    return buildCaseBranch((lhs) => $BackendSyntax(
      "PrimOp",
      $BackendOperator("Op1", $BackendOperator1("OpIsTag", $1), lhs)
    ));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatArray") {
    return buildCaseBranch(guardArrayLength(chosenColumn.pattern.patternCase._1));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatInt") {
    return buildCaseBranch(guardInt(chosenColumn.pattern.patternCase._1));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatNumber") {
    return buildCaseBranch(guardNumber(chosenColumn.pattern.patternCase._1));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatString") {
    return buildCaseBranch(guardString(chosenColumn.pattern.patternCase._1));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatChar") {
    return buildCaseBranch(guardChar(chosenColumn.pattern.patternCase._1));
  }
  if (chosenColumn.pattern.patternCase.tag === "PatBoolean") {
    return buildCaseBranch(guardBoolean(chosenColumn.pattern.patternCase._1));
  }
  fail();
};
var buildCaseLeaf = (row0) => (tailRows) => {
  const orderedArgs = toUnfoldable12(append3(row0.vars)(foldMap42(toCaseRowVars)(row0.patterns)));
  if (row0.guardFn.tag === "UnconditionalFn") {
    return make($BackendSyntax(
      "UncurriedApp",
      make($BackendSyntax("Local", Nothing, row0.guardFn._1)),
      arrayMap((v) => make($BackendSyntax("Local", $Maybe("Just", v._1), v._2)))(orderedArgs)
    ));
  }
  if (row0.guardFn.tag === "GuardedFn") {
    const $0 = row0.guardFn._1;
    return foldrArray((v) => {
      const $1 = v._1;
      const $2 = v._2;
      return (cb) => (args) => makeLet2($Maybe("Just", $1))(make($BackendSyntax("Local", Nothing, $2)))((tmp) => cb(snoc(args)($Tuple(
        $1,
        tmp
      ))));
    })((args) => {
      const $1 = $$for($0)((v) => {
        const $12 = toBackendExprWithType(Nothing)(v._1);
        const $2 = make($BackendSyntax(
          "UncurriedApp",
          make($BackendSyntax("Local", Nothing, v._2)),
          arrayMap((v$1) => make($BackendSyntax("Local", $Maybe("Just", v$1._1), v$1._2)))(args)
        ));
        return (x) => $Pair($12(x), $2(x));
      });
      return (x) => build(getCtx(x))($BackendSyntax(
        "Branch",
        $1(x),
        buildCaseTreeFromRows(tailRows)(x)
      ));
    })(orderedArgs)([]);
  }
  fail();
};
var toTopLevelBackendBinding = (group2) => (env) => (v) => {
  const qualifiedIdent = $Qualified($Maybe("Just", env.currentModule), v._2);
  const backendExpr = toBackendExprWithType(Nothing)(v._3)(env);
  const mbType = backendExpr.tag === "ExprSyntax" && backendExpr._2.tag === "Typed" ? $Maybe("Just", backendExpr._2._1) : Nothing;
  const v1 = optimize(member(qualifiedIdent)(env.traceIdents))(getCtx(env))({
    currentModule: env.currentModule,
    evalExternRef: makeExternEvalRef(env),
    evalExternSpine: makeExternEvalSpine(env),
    locals: [],
    directives: env.directives
  })(qualifiedIdent)(env.rewriteLimit)(backendExpr);
  const v2 = toExternImpl(env)(group2)(isTypeClassDictionaryWithProps(v._3)._1)((() => {
    if (mbType.tag === "Just") {
      return $BackendExpr(
        "ExprSyntax",
        (() => {
          if (v1._2.tag === "ExprSyntax") {
            return v1._2._1;
          }
          if (v1._2.tag === "ExprRewrite") {
            return v1._2._1;
          }
          fail();
        })(),
        $BackendSyntax("Typed", mbType._1, v1._2)
      );
    }
    if (mbType.tag === "Nothing") {
      return v1._2;
    }
    fail();
  })());
  return {
    accum: {
      ...env,
      implementations: insert(ordQualified3)(qualifiedIdent)(v2._1)(env.implementations),
      moduleImplementations: insert(ordQualified3)(qualifiedIdent)(v2._1)(env.moduleImplementations),
      optimizationSteps: (() => {
        const $0 = Tuple(qualifiedIdent);
        if (v1._1.length > 0) {
          return snoc(env.optimizationSteps)($0(v1._1));
        }
        return env.optimizationSteps;
      })(),
      directives: (() => {
        const v4 = inferTransitiveDirective(env.directives)(v2._1._2)(backendExpr)(v._3);
        if (v4.tag === "Just") {
          const $0 = v4._1;
          return alter3((v5) => {
            if (v5.tag === "Just") {
              return $Maybe(
                "Just",
                unsafeUnionWith(ordInlineAccessor.compare, $$const, v5._1, $0)
              );
            }
            if (v5.tag === "Nothing") {
              return $Maybe("Just", $0);
            }
            fail();
          })($EvalRef(
            "EvalExtern",
            $Qualified($Maybe("Just", env.currentModule), v._2)
          ))(env.directives);
        }
        if (v4.tag === "Nothing") {
          return env.directives;
        }
        fail();
      })()
    },
    value: $Tuple(v._2, $Tuple(v2._1._1.deps, v2._2))
  };
};
var toBackendTopLevelBindingGroup = (env) => (v) => {
  if (v.tag === "Rec") {
    const $0 = mapAccumL2(toTopLevelBackendBinding(arrayMap((v1) => $Qualified(
      $Maybe("Just", env.currentModule),
      v1._2
    ))(v._1)))(env)(v._1);
    return { ...$0, value: { recursive: true, bindings: $0.value } };
  }
  if (v.tag === "NonRec") {
    const $0 = mapAccumL2(toTopLevelBackendBinding([]))(env)([v._1]);
    return { ...$0, value: { recursive: false, bindings: $0.value } };
  }
  fail();
};
var toBackendTopLevelBindingGroups = (binds) => (env) => {
  const result = mapAccumL2(toBackendTopLevelBindingGroup)(env)(binds);
  return {
    ...result,
    value: arrayMap((as) => ({
      recursive: (() => {
        if (0 < as.length) {
          return as[0].recursive;
        }
        fail();
      })(),
      bindings: arrayBind(as)((v1) => v1.bindings)
    }))(groupBy((x) => (y) => !x.recursive && !y.recursive)(result.value))
  };
};
var toBackendModule = (v) => (env) => {
  const localExports = fromFoldable32(v.exports);
  const isBindingUsed = (deps) => (v1) => {
    const res = member1(v1._1)(localExports) || member($Qualified($Maybe("Just", v.name), v1._1))(deps);
    return res;
  };
  const directives = parseDirectiveHeader(v.name)(v.comments);
  const dataTypes = fromFoldable42(arrayMap((group2) => $Tuple(
    (() => {
      if (0 < group2.length) {
        return group2[0]._1;
      }
      fail();
    })(),
    {
      constructors: fromFoldable5(mapWithIndexArray((tag) => (v1) => $Tuple(v1._2._1, { fields: v1._2._2, tag }))(group2)),
      size: maximum2(arrayMap((x) => x._2._2.length)(group2))
    }
  ))(groupAllBy((x) => (y) => ordString.compare(x._1)(y._1))(arrayBind(v.dataDecls)((decl) => arrayBind(decl.constructors)((ctor) => [
    $Tuple(decl.name, $Tuple(ctor.name, mapWithIndexArray((i) => (v1) => "value" + showIntImpl(i))(ctor.fields)))
  ])))));
  const moduleBindings = toBackendTopLevelBindingGroups(v.decls)({
    ...env,
    dataTypes,
    directives: (() => {
      const go = (z$p, m$p) => {
        if (m$p.tag === "Leaf") {
          return z$p;
        }
        if (m$p.tag === "Node") {
          return go(
            (() => {
              const $0 = m$p._4;
              return alter3((v2) => {
                if (v2.tag === "Nothing") {
                  return $Maybe("Just", $0);
                }
                if (v2.tag === "Just") {
                  return $Maybe("Just", v2._1);
                }
                fail();
              })(m$p._3)(go(z$p, m$p._5));
            })(),
            m$p._6
          );
        }
        fail();
      };
      return go(
        unsafeUnionWith(ordEvalRef.compare, $$const, directives.locals, env.directives),
        directives.exports
      );
    })(),
    moduleImplementations: Leaf
  });
  const usedBindings = mapAccumR2((deps) => (group2) => {
    if (group2.recursive) {
      if (anyImpl(isBindingUsed(deps), group2.bindings)) {
        return {
          accum: unsafeUnionWith(ordQualified3.compare, $$const, foldMap52((x) => x._2._1)(group2.bindings), deps),
          value: { ...group2, bindings: mapMaybe((x) => x)(arrayMap((x) => $Maybe("Just", $Tuple(x._1, x._2._2)))(group2.bindings)) }
        };
      }
      return { accum: deps, value: { ...group2, bindings: mapMaybe((x) => x)([]) } };
    }
    return {
      accum: mapAccumR2((deps$p) => (v2) => {
        if (isBindingUsed(deps$p)(v2)) {
          return {
            accum: unsafeUnionWith(ordQualified3.compare, $$const, v2._2._1, deps$p),
            value: $Maybe("Just", $Tuple(v2._1, v2._2._2))
          };
        }
        return { accum: deps$p, value: Nothing };
      })(deps)(group2.bindings).accum,
      value: {
        ...group2,
        bindings: mapMaybe((x) => x)(mapAccumR2((deps$p) => (v2) => {
          if (isBindingUsed(deps$p)(v2)) {
            return {
              accum: unsafeUnionWith(ordQualified3.compare, $$const, v2._2._1, deps$p),
              value: $Maybe("Just", $Tuple(v2._1, v2._2._2))
            };
          }
          return { accum: deps$p, value: Nothing };
        })(deps)(group2.bindings).value)
      }
    };
  })(Leaf)(moduleBindings.value);
  return $Tuple(
    moduleBindings.accum.optimizationSteps,
    {
      name: v.name,
      comments: v.comments,
      dataDecls: v.dataDecls,
      classDecls: v.classDecls,
      imports: mapMaybe2(ordString)((qi) => {
        if (qi._1.tag === "Just") {
          if (qi._1._1 !== v.name && qi._1._1 !== "Prim") {
            return $Maybe("Just", qi._1._1);
          }
          return Nothing;
        }
        if (qi._1.tag === "Nothing") {
          return Nothing;
        }
        fail();
      })(usedBindings.accum),
      dataTypes: (() => {
        const $0 = any(isBindingUsed(usedBindings.accum));
        return filterWithKey(ordString)((v$1) => (x) => $0(toUnfoldable12(x.constructors)))(dataTypes);
      })(),
      bindings: usedBindings.value,
      exports: localExports,
      reExports: fromFoldable6(v.reExports),
      implementations: moduleBindings.accum.moduleImplementations,
      directives: filterWithKey(ordEvalRef)((k) => (v1) => k.tag === "EvalExtern" && k._1._1.tag === "Just" && k._1._1._1 === v.name)(moduleBindings.accum.directives),
      foreign: v.foreign
    }
  );
};

// output-es/PureScript.Backend.Optimizer.Builder/index.js
var buildModules = (dictMonad) => {
  const Bind1 = dictMonad.Bind1();
  const $0 = dictMonad.Applicative0();
  const $$void = Bind1.Apply0().Functor0().map((v) => {
  });
  return (options) => (coreFnModules) => {
    const go = (go$a0$copy) => (go$a1$copy) => {
      let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
      while (go$c) {
        const b = go$a0, v = go$a1;
        if (v.tag === "Nil") {
          go$c = false;
          go$r = b;
          continue;
        }
        if (v.tag === "Cons") {
          go$a0 = b + 1 | 0;
          go$a1 = v._2;
          continue;
        }
        fail();
      }
      return go$r;
    };
    const moduleCount = go(0)(coreFnModules);
    return $$void(foldM2(dictMonad)((v) => (coreFnModule) => {
      const $1 = v.directives;
      const $2 = v.implementations;
      const $3 = v.moduleIndex;
      const buildEnv = { implementations: $2, moduleCount, moduleIndex: $3 };
      return Bind1.bind(options.onPrepareModule(buildEnv)(coreFnModule))((v1) => {
        const $4 = v1.name;
        return Bind1.bind(options.onSkipModule(buildEnv)(v1))((mbCachedMod) => {
          if (mbCachedMod.tag === "Just") {
            return $0.pure({
              directives: (() => {
                const go$1 = (m$p, z$p) => {
                  if (m$p.tag === "Leaf") {
                    return z$p;
                  }
                  if (m$p.tag === "Node") {
                    return go$1(m$p._5, insert(ordEvalRef)(m$p._3)(m$p._4)(go$1(m$p._6, z$p)));
                  }
                  fail();
                };
                return go$1(mbCachedMod._1.directives, $1);
              })(),
              implementations: (() => {
                const go$1 = (m$p, z$p) => {
                  if (m$p.tag === "Leaf") {
                    return z$p;
                  }
                  if (m$p.tag === "Node") {
                    return go$1(m$p._5, insert(ordQualified(ordString))(m$p._3)(m$p._4)(go$1(m$p._6, z$p)));
                  }
                  fail();
                };
                return go$1(mbCachedMod._1.implementations, $2);
              })(),
              moduleIndex: $3 + 1 | 0
            });
          }
          if (mbCachedMod.tag === "Nothing") {
            const v2 = toBackendModule(v1)({
              analyzeCustom: options.analyzeCustom,
              currentModule: $4,
              currentLevel: 0,
              toLevel: Leaf,
              implementations: $2,
              moduleImplementations: Leaf,
              directives: $1,
              dataTypes: Leaf,
              foreignSemantics: options.foreignSemantics,
              rewriteLimit: 1e4,
              traceIdents: options.traceIdents,
              optimizationSteps: []
            });
            const $5 = v2._2;
            const go$1 = (m$p, z$p) => {
              if (m$p.tag === "Leaf") {
                return z$p;
              }
              if (m$p.tag === "Node") {
                return go$1(m$p._5, insert(ordQualified(ordString))(m$p._3)(m$p._4)(go$1(m$p._6, z$p)));
              }
              fail();
            };
            const newImplementations = go$1($5.implementations, $2);
            return Bind1.bind(options.onCodegenModule({ ...buildEnv, implementations: newImplementations })(v1)($5)(v2._1))(() => $0.pure({
              directives: (() => {
                const go$2 = (m$p, z$p) => {
                  if (m$p.tag === "Leaf") {
                    return z$p;
                  }
                  if (m$p.tag === "Node") {
                    return go$2(m$p._5, insert(ordEvalRef)(m$p._3)(m$p._4)(go$2(m$p._6, z$p)));
                  }
                  fail();
                };
                return go$2($5.directives, $1);
              })(),
              implementations: newImplementations,
              moduleIndex: $3 + 1 | 0
            }));
          }
          fail();
        });
      });
    })({ directives: options.directives, implementations: Leaf, moduleIndex: 0 })(coreFnModules));
  };
};

// output-es/PureScript.Backend.Optimizer.FfiSupport/foreign.js
import fs from "fs";
import path from "path";
var cachedScanDirs = null;
function getScanDirs(mbFfiDir, extraSpagoDirs) {
  if (cachedScanDirs !== null) return cachedScanDirs;
  const rootDir = process.cwd();
  const scanDirs = [];
  const spagoDirs = [
    path.join(rootDir, ".spago"),
    path.join(rootDir, "spago.d")
  ];
  for (const d of extraSpagoDirs) {
    spagoDirs.push(path.join(rootDir, d));
  }
  for (const spagoDir of spagoDirs) {
    if (fs.existsSync(spagoDir) && fs.statSync(spagoDir).isDirectory()) {
      const packages = fs.readdirSync(spagoDir);
      for (const pkg of packages) {
        const pkgDir = path.join(spagoDir, pkg);
        if (fs.statSync(pkgDir).isDirectory()) {
          let hasVersion = false;
          const subdirs = fs.readdirSync(pkgDir);
          for (const subdir of subdirs) {
            const versionDir = path.join(pkgDir, subdir);
            if (subdir.startsWith("v") && fs.statSync(versionDir).isDirectory()) {
              scanDirs.push(versionDir);
              hasVersion = true;
            }
          }
          if (!hasVersion) {
            scanDirs.push(pkgDir);
          }
        }
      }
    }
  }
  if (mbFfiDir) {
    scanDirs.push(path.join(rootDir, mbFfiDir));
  }
  scanDirs.push(rootDir);
  cachedScanDirs = scanDirs;
  return scanDirs;
}
var ffiFileIndexes = {};
function buildFfiFileIndex(scanDirs, extension) {
  if (ffiFileIndexes[extension]) return;
  const index = /* @__PURE__ */ new Set();
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const res = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(res);
      } else if (entry.name.endsWith(extension)) {
        index.add(res);
      }
    }
  }
  for (const d of scanDirs) {
    walk(d);
  }
  ffiFileIndexes[extension] = index;
}
var findFfiFileImpl = function(extension) {
  return function(extraSpagoDirs) {
    return function(mbFfiDir) {
      return function(modNameStr) {
        return function(mbModulePath) {
          return function() {
            if (mbModulePath) {
              const ffiPath = mbModulePath.replace(/\.purs$/, extension);
              if (fs.existsSync(ffiPath)) {
                return ffiPath;
              }
            }
            const scanDirs = getScanDirs(mbFfiDir, extraSpagoDirs);
            buildFfiFileIndex(scanDirs, extension);
            const index = ffiFileIndexes[extension];
            for (const dir of scanDirs) {
              const searchPaths = [
                path.join(dir, "src", ...modNameStr.split(".")) + extension,
                path.join(dir, "src", modNameStr + extension),
                path.join(dir, modNameStr + extension)
              ];
              for (const p of searchPaths) {
                if (index.has(p)) {
                  return p;
                }
              }
            }
            return null;
          };
        };
      };
    };
  };
};

// output-es/PureScript.Backend.Optimizer.FfiSupport/index.js
var findFfiFile = (extension) => (extraSpagoDirs) => (mbFfiDir) => (modName) => (mbModulePath) => {
  const $0 = findFfiFileImpl(extension)(extraSpagoDirs)((() => {
    if (mbFfiDir.tag === "Nothing") {
      return nullImpl;
    }
    if (mbFfiDir.tag === "Just") {
      return notNull(mbFfiDir._1);
    }
    fail();
  })())(modName)((() => {
    if (mbModulePath.tag === "Nothing") {
      return nullImpl;
    }
    if (mbModulePath.tag === "Just") {
      return notNull(mbModulePath._1);
    }
    fail();
  })());
  return () => {
    const path2 = $0();
    return nullable(path2, Nothing, Just);
  };
};

// output-es/PureScript.Backend.Optimizer.Semantics.Foreign/index.js
var fromFoldable7 = /* @__PURE__ */ foldrArray(Cons)(Nil);
var record_builder_copyRecord = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Builder"), "copyRecord"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1) {
      if (v2[0]._1[0].tag === "NeutLit") {
        if (v2[0]._1[0]._1.tag === "LitRecord") {
          return $Maybe("Just", v2[0]._1[0]);
        }
        return Nothing;
      }
      if (v2[0]._1[0].tag === "NeutUpdate") {
        return $Maybe("Just", v2[0]._1[0]);
      }
    }
    return Nothing;
  }
);
var record_builder_unsafeDelete = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Builder"), "unsafeDelete"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 2 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString" && v2[0]._1[1].tag === "NeutLit" && v2[0]._1[1]._1.tag === "LitRecord") {
      const $0 = v2[0]._1[0]._1._1;
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal("LitRecord", filterImpl((x) => $0 !== x._1, v2[0]._1[1]._1._1))
        )
      );
    }
    return Nothing;
  }
);
var record_builder_unsafeInsert = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Builder"), "unsafeInsert"),
  (v) => (v1) => (v2) => {
    const $0 = () => {
      if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 3 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString") {
        const $02 = v2[0]._1[0]._1._1;
        if (v2[0]._1[2].tag === "SemRef" && v2[0]._1[2]._1.tag === "EvalExtern" && v2[0]._1[2]._1._1._1.tag === "Just" && v2[0]._1[2]._1._1._1._1 === "Record.Builder" && v2[0]._1[2]._1._1._2 === "copyRecord" && v2[0]._1[2]._2.length === 1 && v2[0]._1[2]._2[0].tag === "ExternApp" && v2[0]._1[2]._2[0]._1.length === 1) {
          return $Maybe(
            "Just",
            evalUpdate(v2[0]._1[2]._2[0]._1[0])([$Prop($02, v2[0]._1[1])])
          );
        }
      }
      return Nothing;
    };
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 3 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString") {
      if (v2[0]._1[2].tag === "NeutLit") {
        if (v2[0]._1[2]._1.tag === "LitRecord") {
          return $Maybe(
            "Just",
            $BackendSemantics(
              "NeutLit",
              $Literal(
                "LitRecord",
                snoc(v2[0]._1[2]._1._1)($Prop(v2[0]._1[0]._1._1, v2[0]._1[1]))
              )
            )
          );
        }
        return $0();
      }
      if (v2[0]._1[2].tag === "NeutUpdate") {
        return $Maybe(
          "Just",
          evalUpdate(v2[0]._1[2])([$Prop(v2[0]._1[0]._1._1, v2[0]._1[1])])
        );
      }
    }
    return $0();
  }
);
var record_builder_unsafeModify = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Builder"), "unsafeModify"),
  (env) => (v) => (v1) => {
    const $0 = () => {
      if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 3 && v1[0]._1[0].tag === "NeutLit" && v1[0]._1[0]._1.tag === "LitString") {
        const $02 = v1[0]._1[0]._1._1;
        if (v1[0]._1[2].tag === "SemRef" && v1[0]._1[2]._1.tag === "EvalExtern" && v1[0]._1[2]._1._1._1.tag === "Just" && v1[0]._1[2]._1._1._1._1 === "Record.Builder" && v1[0]._1[2]._1._1._2 === "copyRecord" && v1[0]._1[2]._2.length === 1 && v1[0]._1[2]._2[0].tag === "ExternApp" && v1[0]._1[2]._2[0]._1.length === 1) {
          const $1 = v1[0]._1[2]._2[0]._1[0];
          return $Maybe(
            "Just",
            makeLet(Nothing)($1)((r$p) => evalUpdate($1)([
              $Prop(
                $02,
                evalApp(env)(v1[0]._1[1])([
                  evalAccessor(env)(r$p)($BackendAccessor("GetProp", $02))
                ])
              )
            ]))
          );
        }
      }
      return Nothing;
    };
    if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 3 && v1[0]._1[0].tag === "NeutLit" && v1[0]._1[0]._1.tag === "LitString") {
      if (v1[0]._1[2].tag === "NeutLit") {
        if (v1[0]._1[2]._1.tag === "LitRecord") {
          const $1 = v1[0]._1[1];
          const $2 = v1[0]._1[0]._1._1;
          return $Maybe(
            "Just",
            $BackendSemantics(
              "NeutLit",
              $Literal(
                "LitRecord",
                arrayMap((v2) => {
                  if ($2 === v2._1) {
                    return $Prop(v2._1, evalApp(env)($1)([v2._2]));
                  }
                  return $Prop(v2._1, v2._2);
                })(v1[0]._1[2]._1._1)
              )
            )
          );
        }
        return $0();
      }
      if (v1[0]._1[2].tag === "NeutUpdate" && v1[0]._1[2]._1.tag === "NeutLocal") {
        const $1 = v1[0]._1[0]._1._1;
        return $Maybe(
          "Just",
          evalUpdate(v1[0]._1[2])([
            $Prop(
              $1,
              evalApp(env)(v1[0]._1[1])([
                evalAccessor(env)(v1[0]._1[2]._1)($BackendAccessor("GetProp", $1))
              ])
            )
          ])
        );
      }
    }
    return $0();
  }
);
var record_builder_unsafeRename = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Builder"), "unsafeRename"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 3 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString" && v2[0]._1[1].tag === "NeutLit" && v2[0]._1[1]._1.tag === "LitString" && v2[0]._1[2].tag === "NeutLit" && v2[0]._1[2]._1.tag === "LitRecord") {
      const $0 = v2[0]._1[0]._1._1;
      const $1 = v2[0]._1[1]._1._1;
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal(
            "LitRecord",
            arrayMap((v3) => {
              if ($0 === v3._1) {
                return $Prop($1, v3._2);
              }
              return $Prop(v3._1, v3._2);
            })(v2[0]._1[2]._1._1)
          )
        )
      );
    }
    return Nothing;
  }
);
var record_unsafe_union_unsafeUnionFn = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Unsafe.Union"), "unsafeUnionFn"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternUncurriedApp" && v2[0]._1.length === 2 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitRecord" && v2[0]._1[1].tag === "NeutLit" && v2[0]._1[1]._1.tag === "LitRecord") {
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal(
            "LitRecord",
            arrayMap(head)(groupAllBy((x) => (y) => ordString.compare(x._1)(y._1))([
              ...v2[0]._1[0]._1._1,
              ...v2[0]._1[1]._1._1
            ]))
          )
        )
      );
    }
    return Nothing;
  }
);
var record_unsafe_unsafeDelete = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Unsafe"), "unsafeDelete"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 2 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString" && v2[0]._1[1].tag === "NeutLit" && v2[0]._1[1]._1.tag === "LitRecord") {
      const $0 = v2[0]._1[0]._1._1;
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal("LitRecord", filterImpl((x) => $0 !== x._1, v2[0]._1[1]._1._1))
        )
      );
    }
    return Nothing;
  }
);
var record_unsafe_unsafeGet = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Unsafe"), "unsafeGet"),
  (env) => (v) => (v1) => {
    if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1 && v1[0]._1[0].tag === "NeutLit" && v1[0]._1[0]._1.tag === "LitString") {
      const $0 = v1[0]._1[0]._1._1;
      return $Maybe(
        "Just",
        $BackendSemantics(
          "SemLam",
          Nothing,
          (r) => evalAccessor(env)(r)($BackendAccessor("GetProp", $0))
        )
      );
    }
    return Nothing;
  }
);
var record_unsafe_unsafeHas = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Unsafe"), "unsafeHas"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 2 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString" && v2[0]._1[1].tag === "NeutLit" && v2[0]._1[1]._1.tag === "LitRecord") {
      const $0 = v2[0]._1[0]._1._1;
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal("LitBoolean", anyImpl((x) => $0 === x._1, v2[0]._1[1]._1._1))
        )
      );
    }
    return Nothing;
  }
);
var record_unsafe_unsafeSet = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Record.Unsafe"), "unsafeSet"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 3 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString") {
      return $Maybe(
        "Just",
        evalUpdate(v2[0]._1[2])([$Prop(v2[0]._1[0]._1._1, v2[0]._1[1])])
      );
    }
    return Nothing;
  }
);
var runEffectFn = (mod) => (name2) => (n) => {
  const goRunEffectFn = (env) => (acc) => (head2) => (v) => {
    if (v.tag === "Nil") {
      return evalUncurriedEffectApp(env)(head2)(acc);
    }
    if (v.tag === "Cons") {
      const $0 = v._2;
      return makeLet(Nothing)(v._1)((nextArg) => goRunEffectFn(env)(snoc(acc)(nextArg))(head2)($0));
    }
    fail();
  };
  return $Tuple(
    $Qualified($Maybe("Just", mod), name2 + showIntImpl(n)),
    (env) => (v) => (v1) => {
      if (v1.length === 1 && v1[0].tag === "ExternApp") {
        const $0 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), v1[0]._1);
        if ($0.tag === "Just" && $0._1.tail.length === n) {
          return $Maybe("Just", goRunEffectFn(env)([])($0._1.head)(fromFoldable7($0._1.tail)));
        }
      }
      return Nothing;
    }
  );
};
var unsafe_coerce_unsafeCoerce = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Unsafe.Coerce"), "unsafeCoerce"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1) {
      return $Maybe("Just", v2[0]._1[0]);
    }
    return Nothing;
  }
);
var primUnaryOperator = (op) => (env) => (v) => (v1) => {
  if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
    return $Maybe("Just", evalPrimOp(env)($BackendOperator("Op1", op, v1[0]._1[0])));
  }
  return Nothing;
};
var primBinaryOperator = (op) => (env) => (v) => (v1) => {
  if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
    return $Maybe(
      "Just",
      makeLet(Nothing)(v1[0]._1[0])((a$p) => $BackendSemantics(
        "SemLam",
        Nothing,
        (b$p) => evalPrimOp(env)($BackendOperator("Op2", op, a$p, b$p))
      ))
    );
  }
  return Nothing;
};
var partial_unsafe_unsafePartial = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Partial.Unsafe"), "_unsafePartial"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1 && v2[0]._1[0].tag === "SemLam") {
      return $Maybe(
        "Just",
        v2[0]._1[0]._2($BackendSemantics("NeutLit", $Literal("LitRecord", [])))
      );
    }
    return Nothing;
  }
);
var mkEffectFn = (mod) => (name2) => (n) => $Tuple(
  $Qualified($Maybe("Just", mod), name2 + showIntImpl(n)),
  (env) => (v) => (v1) => {
    if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
      return $Maybe(
        "Just",
        $BackendSemantics("SemMkEffectFn", evalMkFn(env)(n)(v1[0]._1[0]))
      );
    }
    return Nothing;
  }
);
var primOrdImplOperator = (op) => (env) => (v) => (v1) => {
  if (v1.length === 2 && v1[0].tag === "ExternApp" && v1[0]._1.length === 5 && v1[1].tag === "ExternPrimOp" && v1[1]._1.tag === "OpIsTag") {
    if (v1[1]._1._1._1.tag === "Just" && "Data.Ordering" === v1[1]._1._1._1._1 && "LT" === v1[1]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpLt),
          v1[0]._1[3],
          v1[0]._1[4]
        ))
      );
    }
    if (v1[1]._1._1._1.tag === "Just" && "Data.Ordering" === v1[1]._1._1._1._1 && "GT" === v1[1]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpGt),
          v1[0]._1[3],
          v1[0]._1[4]
        ))
      );
    }
    if (v1[1]._1._1._1.tag === "Just" && "Data.Ordering" === v1[1]._1._1._1._1 && "EQ" === v1[1]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpEq),
          v1[0]._1[3],
          v1[0]._1[4]
        ))
      );
    }
  }
  return Nothing;
};
var primOrdOperator = (op) => (env) => (v) => (v1) => {
  if (v1.length === 3 && v1[0].tag === "ExternAccessor" && v1[0]._1.tag === "GetProp" && v1[0]._1._1 === "compare" && v1[1].tag === "ExternApp" && v1[1]._1.length === 2 && v1[2].tag === "ExternPrimOp" && v1[2]._1.tag === "OpIsTag") {
    if (v1[2]._1._1._1.tag === "Just" && "Data.Ordering" === v1[2]._1._1._1._1 && "LT" === v1[2]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpLt),
          v1[1]._1[0],
          v1[1]._1[1]
        ))
      );
    }
    if (v1[2]._1._1._1.tag === "Just" && "Data.Ordering" === v1[2]._1._1._1._1 && "GT" === v1[2]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpGt),
          v1[1]._1[0],
          v1[1]._1[1]
        ))
      );
    }
    if (v1[2]._1._1._1.tag === "Just" && "Data.Ordering" === v1[2]._1._1._1._1 && "EQ" === v1[2]._1._1._2) {
      return $Maybe(
        "Just",
        evalPrimOp(env)($BackendOperator(
          "Op2",
          op(OpEq),
          v1[1]._1[0],
          v1[1]._1[1]
        ))
      );
    }
  }
  return Nothing;
};
var effectUnsafePerform = (v) => (v1) => (v2) => {
  if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1 && v2[0]._1[0].tag === "SemEffectPure") {
    return $Maybe("Just", v2[0]._1[0]._1);
  }
  return Nothing;
};
var effectRefWrite = (v) => (v1) => (v2) => {
  if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 2) {
    const $0 = v2[0]._1[1];
    return $Maybe(
      "Just",
      makeLet(Nothing)(v2[0]._1[0])((val$p) => makeLet(Nothing)($0)((ref$p) => $BackendSemantics(
        "NeutPrimEffect",
        $BackendEffect("EffectRefWrite", ref$p, val$p)
      )))
    );
  }
  return Nothing;
};
var effectRefRead = (v) => (v1) => (v2) => {
  if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1) {
    return $Maybe(
      "Just",
      makeLet(Nothing)(v2[0]._1[0])((val$p) => $BackendSemantics(
        "NeutPrimEffect",
        $BackendEffect("EffectRefRead", val$p)
      ))
    );
  }
  return Nothing;
};
var effectRefNew = (v) => (v1) => (v2) => {
  if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1) {
    return $Maybe(
      "Just",
      makeLet(Nothing)(v2[0]._1[0])((val$p) => $BackendSemantics(
        "NeutPrimEffect",
        $BackendEffect("EffectRefNew", val$p)
      ))
    );
  }
  return Nothing;
};
var effectRefModify = (env) => (v) => (v1) => {
  if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 2) {
    const $0 = v1[0]._1[1];
    return $Maybe(
      "Just",
      makeLet(Nothing)(v1[0]._1[0])((fn$p) => makeLet(Nothing)($0)((ref$p) => makeEffectBind(Nothing)($BackendSemantics(
        "NeutPrimEffect",
        $BackendEffect("EffectRefRead", ref$p)
      ))((val) => $BackendSemantics(
        "NeutPrimEffect",
        $BackendEffect("EffectRefWrite", ref$p, evalApp(env)(fn$p)([val]))
      ))))
    );
  }
  return Nothing;
};
var effectPure = (v) => (v1) => (v2) => {
  if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1) {
    return $Maybe("Just", makeLet(Nothing)(v2[0]._1[0])(SemEffectPure));
  }
  return Nothing;
};
var effectMap = (env) => (v) => (v1) => {
  if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
    return $Maybe(
      "Just",
      makeLet(Nothing)(v1[0]._1[0])((fn$p) => $BackendSemantics(
        "SemLam",
        Nothing,
        (val) => makeEffectBind(Nothing)(val)((nextVal) => $BackendSemantics(
          "SemEffectPure",
          evalApp(env)(fn$p)([nextVal])
        ))
      ))
    );
  }
  return Nothing;
};
var effectBind = (env) => (v) => (v1) => {
  if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 2) {
    if (v1[0]._1[1].tag === "SemLam") {
      const $02 = v1[0]._1[1]._1;
      const $1 = v1[0]._1[1]._2;
      return $Maybe(
        "Just",
        makeLet(Nothing)(v1[0]._1[0])((nextEff) => makeEffectBind($02)(nextEff)($1))
      );
    }
    const $0 = v1[0]._1[1];
    return $Maybe(
      "Just",
      makeLet(Nothing)(v1[0]._1[0])((nextEff) => makeLet(Nothing)($0)((nextK) => makeEffectBind(Nothing)(nextEff)((a) => evalApp(env)(nextK)([
        a
      ]))))
    );
  }
  return Nothing;
};
var data_string_codePoints_toCodePointArray = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Data.String.CodePoints"), "toCodePointArray"),
  (v) => (v1) => (v2) => {
    if (v2.length === 1 && v2[0].tag === "ExternApp" && v2[0]._1.length === 1 && v2[0]._1[0].tag === "NeutLit" && v2[0]._1[0]._1.tag === "LitString") {
      return $Maybe(
        "Just",
        $BackendSemantics(
          "NeutLit",
          $Literal(
            "LitArray",
            arrayMap((x) => $BackendSemantics("NeutLit", $Literal("LitInt", x)))(toCodePointArray(v2[0]._1[0]._1._1))
          )
        )
      );
    }
    return Nothing;
  }
);
var data_semigroup_concatArray = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Data.Semigroup"), "concatArray"),
  (env) => (qual) => (v) => {
    if (v.length === 1 && v[0].tag === "ExternApp" && v[0]._1.length === 2) {
      if (v[0]._1[0].tag === "NeutLit" && v[0]._1[0]._1.tag === "LitArray" && v[0]._1[1].tag === "NeutLit" && v[0]._1[1]._1.tag === "LitArray") {
        return $Maybe(
          "Just",
          $BackendSemantics(
            "NeutLit",
            $Literal("LitArray", [...v[0]._1[0]._1._1, ...v[0]._1[1]._1._1])
          )
        );
      }
      return $Maybe("Just", evalAssocOp(env)($Either("Left", qual))(v[0]._1[0])(v[0]._1[1]));
    }
    return Nothing;
  }
);
var data_function_uncurried_runFn = (n) => {
  const goRunFn = (env) => (n$p) => (head2) => (tail) => {
    if (n$p <= 0) {
      return evalUncurriedApp(env)(head2)(tail);
    }
    return $BackendSemantics("SemLam", Nothing, (val) => goRunFn(env)(n$p - 1 | 0)(head2)(snoc(tail)(val)));
  };
  return $Tuple(
    $Qualified($Maybe("Just", "Data.Function.Uncurried"), "runFn" + showIntImpl(n)),
    (env) => (v) => (v1) => {
      if (v1.length === 1 && v1[0].tag === "ExternApp") {
        const $0 = unconsImpl((v$1) => Nothing, (x) => (xs) => $Maybe("Just", { head: x, tail: xs }), v1[0]._1);
        if ($0.tag === "Just") {
          return $Maybe("Just", goRunFn(env)(n - $0._1.tail.length | 0)($0._1.head)($0._1.tail));
        }
      }
      return Nothing;
    }
  );
};
var data_function_uncurried_mkFn = (n) => $Tuple(
  $Qualified($Maybe("Just", "Data.Function.Uncurried"), "mkFn" + showIntImpl(n)),
  (env) => (v) => (v1) => {
    if (v1.length === 1 && v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
      return $Maybe(
        "Just",
        $BackendSemantics("SemMkFn", evalMkFn(env)(n)(v1[0]._1[0]))
      );
    }
    return Nothing;
  }
);
var data_array_unsafeIndexImpl = /* @__PURE__ */ $Tuple(
  /* @__PURE__ */ $Qualified(/* @__PURE__ */ $Maybe("Just", "Data.Array"), "unsafeIndexImpl"),
  (env) => (v) => (v1) => {
    if (v1.length === 1) {
      if (v1[0].tag === "ExternUncurriedApp") {
        if (v1[0]._1.length === 2) {
          const $0 = v1[0]._1[1];
          return $Maybe(
            "Just",
            makeLet(Nothing)(v1[0]._1[0])((a$p) => makeLet(Nothing)($0)((b$p) => evalPrimOp(env)($BackendOperator(
              "Op2",
              OpArrayIndex,
              a$p,
              b$p
            ))))
          );
        }
        return Nothing;
      }
      if (v1[0].tag === "ExternApp" && v1[0]._1.length === 1) {
        return $Maybe(
          "Just",
          makeLet(Nothing)(v1[0]._1[0])((a$p) => $BackendSemantics(
            "SemLam",
            Nothing,
            (b$p) => evalPrimOp(env)($BackendOperator(
              "Op2",
              OpArrayIndex,
              a$p,
              b$p
            ))
          ))
        );
      }
    }
    return Nothing;
  }
);
var coreForeignSemantics = /* @__PURE__ */ (() => {
  const oneToTen = rangeImpl(1, 10);
  return fromFoldable(ordQualified(ordString))(foldableArray)([
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "bind_"), effectBind),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "map_"), effectMap),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "modify"), effectRefModify),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "new"), effectRefNew),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "pure_"), effectPure),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "read"), effectRefRead),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "run"), effectUnsafePerform),
    $Tuple($Qualified($Maybe("Just", "Control.Monad.ST.Internal"), "write"), effectRefWrite),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Array"), "length"),
      primUnaryOperator(OpArrayLength)
    ),
    data_array_unsafeIndexImpl,
    $Tuple(
      $Qualified($Maybe("Just", "Data.Eq"), "eqBooleanImpl"),
      primBinaryOperator($BackendOperator2("OpBooleanOrd", OpEq))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Eq"), "eqCharImpl"),
      primBinaryOperator($BackendOperator2("OpCharOrd", OpEq))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Eq"), "eqIntImpl"),
      primBinaryOperator($BackendOperator2("OpIntOrd", OpEq))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Eq"), "eqNumberImpl"),
      primBinaryOperator($BackendOperator2("OpNumberOrd", OpEq))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Eq"), "eqStringImpl"),
      primBinaryOperator($BackendOperator2("OpStringOrd", OpEq))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.EuclideanRing"), "intDiv"),
      primBinaryOperator($BackendOperator2("OpIntNum", OpDivide))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.EuclideanRing"), "numDiv"),
      primBinaryOperator($BackendOperator2("OpNumberNum", OpDivide))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.HeytingAlgebra"), "boolConj"),
      primBinaryOperator(OpBooleanAnd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.HeytingAlgebra"), "boolDisj"),
      primBinaryOperator(OpBooleanOr)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.HeytingAlgebra"), "boolNot"),
      primUnaryOperator(OpBooleanNot)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "and"),
      primBinaryOperator(OpIntBitAnd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "complement"),
      primUnaryOperator(OpIntBitNot)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "or"),
      primBinaryOperator(OpIntBitOr)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "shl"),
      primBinaryOperator(OpIntBitShiftLeft)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "shr"),
      primBinaryOperator(OpIntBitShiftRight)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "xor"),
      primBinaryOperator(OpIntBitXor)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Int.Bits"), "zshr"),
      primBinaryOperator(OpIntBitZeroFillShiftRight)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordBoolean"),
      primOrdOperator(OpBooleanOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordChar"),
      primOrdOperator(OpCharOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordInt"),
      primOrdOperator(OpIntOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordIntImpl"),
      primOrdImplOperator(OpIntOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordNumber"),
      primOrdOperator(OpNumberOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ord"), "ordString"),
      primOrdOperator(OpStringOrd)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ring"), "intSub"),
      primBinaryOperator($BackendOperator2("OpIntNum", OpSubtract))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Ring"), "numSub"),
      primBinaryOperator($BackendOperator2("OpNumberNum", OpSubtract))
    ),
    data_semigroup_concatArray,
    $Tuple(
      $Qualified($Maybe("Just", "Data.Semigroup"), "concatString"),
      primBinaryOperator(OpStringAppend)
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Semiring"), "intAdd"),
      primBinaryOperator($BackendOperator2("OpIntNum", OpAdd))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Semiring"), "intMul"),
      primBinaryOperator($BackendOperator2("OpIntNum", OpMultiply))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Semiring"), "numAdd"),
      primBinaryOperator($BackendOperator2("OpNumberNum", OpAdd))
    ),
    $Tuple(
      $Qualified($Maybe("Just", "Data.Semiring"), "numMul"),
      primBinaryOperator($BackendOperator2("OpNumberNum", OpMultiply))
    ),
    data_string_codePoints_toCodePointArray,
    $Tuple($Qualified($Maybe("Just", "Effect"), "bindE"), effectBind),
    $Tuple($Qualified($Maybe("Just", "Effect"), "pureE"), effectPure),
    $Tuple($Qualified($Maybe("Just", "Effect.Unsafe"), "unsafePerformEffect"), effectUnsafePerform),
    partial_unsafe_unsafePartial,
    record_builder_copyRecord,
    record_builder_unsafeDelete,
    record_builder_unsafeInsert,
    record_builder_unsafeModify,
    record_builder_unsafeRename,
    record_unsafe_union_unsafeUnionFn,
    record_unsafe_unsafeDelete,
    record_unsafe_unsafeGet,
    record_unsafe_unsafeHas,
    record_unsafe_unsafeSet,
    unsafe_coerce_unsafeCoerce,
    ...arrayMap(data_function_uncurried_mkFn)(oneToTen),
    ...arrayMap(data_function_uncurried_runFn)(oneToTen),
    ...arrayMap(mkEffectFn("Effect.Uncurried")("mkEffectFn"))(oneToTen),
    ...arrayMap(runEffectFn("Effect.Uncurried")("runEffectFn"))(oneToTen),
    ...arrayMap(mkEffectFn("Control.Monad.ST.Uncurried")("mkSTFn"))(oneToTen),
    ...arrayMap(runEffectFn("Control.Monad.ST.Uncurried")("runSTFn"))(oneToTen)
  ]);
})();

// output-es/Purust.ASTCollector/index.js
var collectRecordShapesType = (v) => {
  if (v.tag === "Record") {
    if (v._1.tag === "Row") {
      return insert(ordString)(joinWith(",")(sortBy(ordString.compare)(arrayMap((v1) => v1._1)(v._1._1))))()(foldlArray((acc) => (v1) => unsafeUnionWith(
        ordString.compare,
        $$const,
        acc,
        collectRecordShapesType(v1._2)
      ))(Leaf)(v._1._1));
    }
    return Leaf;
  }
  if (v.tag === "ADT") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesType(v1)))(Leaf)(v._3);
  }
  if (v.tag === "TypeApp") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      collectRecordShapesType(v._1),
      foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesType(v1)))(Leaf)(v._2)
    );
  }
  if (v.tag === "Func") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      collectRecordShapesType(v._2),
      foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesType(v1)))(Leaf)(v._1)
    );
  }
  if (v.tag === "Array") {
    return collectRecordShapesType(v._1);
  }
  return Leaf;
};
var collectRecordShapesLiteral = (f) => (v) => {
  if (v.tag === "LitArray") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, f(v1)))(Leaf)(v._1);
  }
  if (v.tag === "LitRecord") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, f(v1._2)))(Leaf)(v._1);
  }
  return Leaf;
};
var collectRecordShapesBinder = (v) => {
  if (v.tag === "BinderNull") {
    return collectRecordShapesType((() => {
      if (v._1.type.tag === "Nothing") {
        return Any;
      }
      if (v._1.type.tag === "Just") {
        return v._1.type._1;
      }
      fail();
    })());
  }
  if (v.tag === "BinderVar") {
    return collectRecordShapesType((() => {
      if (v._1.type.tag === "Nothing") {
        return Any;
      }
      if (v._1.type.tag === "Just") {
        return v._1.type._1;
      }
      fail();
    })());
  }
  if (v.tag === "BinderNamed") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      collectRecordShapesType((() => {
        if (v._1.type.tag === "Nothing") {
          return Any;
        }
        if (v._1.type.tag === "Just") {
          return v._1.type._1;
        }
        fail();
      })()),
      collectRecordShapesBinder(v._3)
    );
  }
  if (v.tag === "BinderLit") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      collectRecordShapesType((() => {
        if (v._1.type.tag === "Nothing") {
          return Any;
        }
        if (v._1.type.tag === "Just") {
          return v._1.type._1;
        }
        fail();
      })()),
      collectRecordShapesLiteral(collectRecordShapesBinder)(v._2)
    );
  }
  if (v.tag === "BinderConstructor") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      collectRecordShapesType((() => {
        if (v._1.type.tag === "Nothing") {
          return Any;
        }
        if (v._1.type.tag === "Just") {
          return v._1.type._1;
        }
        fail();
      })()),
      foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesBinder(b)))(Leaf)(v._4)
    );
  }
  fail();
};
var collectRecordShapesExpr = (expr) => unsafeUnionWith(
  ordString.compare,
  $$const,
  (() => {
    if (expr.tag === "ExprVar") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprLit") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprConstructor") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprAccessor") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprUpdate") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprAbs") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprApp") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprCase") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    if (expr.tag === "ExprLet") {
      return collectRecordShapesType((() => {
        if (expr._1.type.tag === "Nothing") {
          return Any;
        }
        if (expr._1.type.tag === "Just") {
          return expr._1.type._1;
        }
        fail();
      })());
    }
    fail();
  })(),
  (() => {
    if (expr.tag === "ExprVar") {
      return Leaf;
    }
    if (expr.tag === "ExprLit") {
      return collectRecordShapesLiteral(collectRecordShapesExpr)(expr._2);
    }
    if (expr.tag === "ExprConstructor") {
      return Leaf;
    }
    if (expr.tag === "ExprAccessor") {
      return collectRecordShapesExpr(expr._2);
    }
    if (expr.tag === "ExprUpdate") {
      return unsafeUnionWith(
        ordString.compare,
        $$const,
        collectRecordShapesExpr(expr._2),
        foldlArray((acc) => (v) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesExpr(v._2)))(Leaf)(expr._3)
      );
    }
    if (expr.tag === "ExprAbs") {
      return collectRecordShapesExpr(expr._3);
    }
    if (expr.tag === "ExprApp") {
      return unsafeUnionWith(ordString.compare, $$const, collectRecordShapesExpr(expr._2), collectRecordShapesExpr(expr._3));
    }
    if (expr.tag === "ExprCase") {
      return unsafeUnionWith(
        ordString.compare,
        $$const,
        foldlArray((acc) => (e) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesExpr(e)))(Leaf)(expr._2),
        foldlArray((acc) => (alt) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesCaseAlt(alt)))(Leaf)(expr._3)
      );
    }
    if (expr.tag === "ExprLet") {
      return unsafeUnionWith(
        ordString.compare,
        $$const,
        foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesBind(b)))(Leaf)(expr._2),
        collectRecordShapesExpr(expr._3)
      );
    }
    fail();
  })()
);
var collectRecordShapesCaseGuard = (v) => {
  if (v.tag === "Unconditional") {
    return collectRecordShapesExpr(v._1);
  }
  if (v.tag === "Guarded") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(
      ordString.compare,
      $$const,
      acc,
      unsafeUnionWith(ordString.compare, $$const, collectRecordShapesExpr(v1._1), collectRecordShapesExpr(v1._2))
    ))(Leaf)(v._1);
  }
  fail();
};
var collectRecordShapesCaseAlt = (v) => unsafeUnionWith(
  ordString.compare,
  $$const,
  foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesBinder(b)))(Leaf)(v._1),
  collectRecordShapesCaseGuard(v._2)
);
var collectRecordShapesBind = (v) => {
  if (v.tag === "NonRec") {
    return collectRecordShapesExpr(v._1._3);
  }
  if (v.tag === "Rec") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectRecordShapesExpr(v1._3)))(Leaf)(v._1);
  }
  fail();
};
var collectRecordShapesModule = (v) => foldlArray((acc) => (b) => unsafeUnionWith(
  ordString.compare,
  $$const,
  acc,
  collectRecordShapesBind(b)
))(Leaf)(v.decls);
var collectModulesLiteral = (f) => (v) => {
  if (v.tag === "LitArray") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, f(v1)))(Leaf)(v._1);
  }
  if (v.tag === "LitRecord") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, f(v1._2)))(Leaf)(v._1);
  }
  return Leaf;
};
var collectModulesBinder = (v) => {
  if (v.tag === "BinderNull") {
    return Leaf;
  }
  if (v.tag === "BinderVar") {
    return Leaf;
  }
  if (v.tag === "BinderNamed") {
    return collectModulesBinder(v._3);
  }
  if (v.tag === "BinderLit") {
    return collectModulesLiteral(collectModulesBinder)(v._2);
  }
  if (v.tag === "BinderConstructor") {
    if (v._2._1.tag === "Just") {
      return unsafeUnionWith(
        ordString.compare,
        $$const,
        $$$Map("Node", 1, 1, v._2._1._1, void 0, Leaf, Leaf),
        foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesBinder(b)))(Leaf)(v._4)
      );
    }
    return foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesBinder(b)))(Leaf)(v._4);
  }
  fail();
};
var collectModulesExpr = (v) => {
  if (v.tag === "ExprVar") {
    if (v._2._1.tag === "Just") {
      return $$$Map("Node", 1, 1, v._2._1._1, void 0, Leaf, Leaf);
    }
    return Leaf;
  }
  if (v.tag === "ExprLit") {
    return collectModulesLiteral(collectModulesExpr)(v._2);
  }
  if (v.tag === "ExprConstructor") {
    return Leaf;
  }
  if (v.tag === "ExprAccessor") {
    return insert(ordString)("Record.Unsafe")()(collectModulesExpr(v._2));
  }
  if (v.tag === "ExprUpdate") {
    return insert(ordString)("Record.Unsafe")()(unsafeUnionWith(
      ordString.compare,
      $$const,
      collectModulesExpr(v._2),
      foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesExpr(v1._2)))(Leaf)(v._3)
    ));
  }
  if (v.tag === "ExprAbs") {
    return collectModulesExpr(v._3);
  }
  if (v.tag === "ExprApp") {
    return unsafeUnionWith(ordString.compare, $$const, collectModulesExpr(v._2), collectModulesExpr(v._3));
  }
  if (v.tag === "ExprCase") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      foldlArray((acc) => (e) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesExpr(e)))(Leaf)(v._2),
      foldlArray((acc) => (alt) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesCaseAlt(alt)))(Leaf)(v._3)
    );
  }
  if (v.tag === "ExprLet") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesBind(b)))(Leaf)(v._2),
      collectModulesExpr(v._3)
    );
  }
  fail();
};
var collectModulesCaseGuard = (v) => {
  if (v.tag === "Unconditional") {
    return collectModulesExpr(v._1);
  }
  if (v.tag === "Guarded") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(
      ordString.compare,
      $$const,
      acc,
      unsafeUnionWith(ordString.compare, $$const, collectModulesExpr(v1._1), collectModulesExpr(v1._2))
    ))(Leaf)(v._1);
  }
  fail();
};
var collectModulesCaseAlt = (v) => unsafeUnionWith(
  ordString.compare,
  $$const,
  foldlArray((acc) => (b) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesBinder(b)))(Leaf)(v._1),
  collectModulesCaseGuard(v._2)
);
var collectModulesBind = (v) => {
  if (v.tag === "NonRec") {
    return collectModulesExpr(v._1._3);
  }
  if (v.tag === "Rec") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, collectModulesExpr(v1._3)))(Leaf)(v._1);
  }
  fail();
};
var collectModulesModule = (v) => foldlArray((acc) => (b) => unsafeUnionWith(
  ordString.compare,
  $$const,
  acc,
  collectModulesBind(b)
))(Leaf)(v.decls);

// output-es/Debug/foreign.js
var req = typeof module === "undefined" ? void 0 : module.require;
var util = (function() {
  try {
    return req === void 0 ? void 0 : req("util");
  } catch (e) {
    return void 0;
  }
})();
function _trace(x, k) {
  if (util !== void 0) {
    console.log(util.inspect(x, { depth: null, colors: true }));
  } else {
    console.log(x);
  }
  return k({});
}
var now2 = (function() {
  var perf;
  if (typeof performance !== "undefined") {
    perf = performance;
  } else if (req) {
    try {
      perf = req("perf_hooks").performance;
    } catch (e) {
    }
  }
  return (function() {
    return (perf || Date).now();
  });
})();

// output-es/Purust.CodeGen/index.js
var lookup5 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var union = (m1) => (m2) => unsafeUnionWith(ordString.compare, $$const, m1, m2);
var fromFoldable12 = /* @__PURE__ */ foldlArray((m) => (a) => insert(ordString)(a)()(m))(Leaf);
var member2 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = false;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = true;
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var foldMap7 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidString))();
var member12 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = false;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = true;
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var fromFoldable33 = /* @__PURE__ */ fromFoldable(ordString)(foldableArray);
var foldMap13 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidString))();
var unwrapType = (v) => {
  if (v.tag === "ForAll") {
    return unwrapType(v._2);
  }
  if (v.tag === "TypeApp") {
    return unwrapType(v._1);
  }
  if (v.tag === "ConstrainedType") {
    const csArgs = arrayMap((v12) => $ExprType(
      "ADT",
      (() => {
        const $0 = v12._1.length - 1 | 0;
        if ($0 >= 0 && $0 < v12._1.length) {
          return v12._1[$0];
        }
        return "";
      })(),
      v12._1,
      v12._2
    ))(v._1);
    const v1 = unwrapType(v._2);
    if (v1.tag === "Func") {
      return $ExprType("Func", [...csArgs, ...v1._1], v1._2);
    }
    return $ExprType("Func", csArgs, v1);
  }
  return v;
};
var sanitizeIdent = (s) => {
  const s4 = replaceAll(".")("_dot_")(replaceAll("-")("_minus_")(replaceAll("$")("_dollar_")(replaceAll("'")("_prime")(s))));
  if (s4 === "type") {
    return "type_kw";
  }
  if (s4 === "fn") {
    return "fn_kw";
  }
  if (s4 === "break") {
    return "break_kw";
  }
  if (s4 === "mod") {
    return "mod_kw";
  }
  if (s4 === "as") {
    return "as_kw";
  }
  if (s4 === "gen") {
    return "gen_kw";
  }
  if (s4 === "use") {
    return "use_kw";
  }
  if (s4 === "pub") {
    return "pub_kw";
  }
  if (s4 === "ref") {
    return "ref_kw";
  }
  if (s4 === "mut") {
    return "mut_kw";
  }
  if (s4 === "move") {
    return "move_kw";
  }
  if (s4 === "let") {
    return "let_kw";
  }
  if (s4 === "if") {
    return "if_kw";
  }
  if (s4 === "loop") {
    return "loop_kw";
  }
  return s4;
};
var printType = (v) => {
  if (v.tag === "Func") {
    return "Func";
  }
  if (v.tag === "ForAll") {
    return "ForAll(" + printType(v._2) + ")";
  }
  if (v.tag === "ConstrainedType") {
    return "ConstrainedType(" + printType(v._2) + ")";
  }
  if (v.tag === "TypeApp") {
    return "TypeApp(" + printType(v._1) + ", [...])";
  }
  if (v.tag === "TypeVar") {
    return "TypeVar";
  }
  if (v.tag === "Int") {
    return "Int";
  }
  if (v.tag === "Boolean") {
    return "Boolean";
  }
  if (v.tag === "Any") {
    return "Any";
  }
  return "Other";
};
var printAST = (v) => {
  if (v.tag === "App") {
    return "App(" + printAST(v._1) + ")";
  }
  if (v.tag === "Lit") {
    return "Lit";
  }
  if (v.tag === "Var") {
    return "Var(...)";
  }
  if (v.tag === "Let") {
    return "Let(...)";
  }
  if (v.tag === "Local") {
    return "Local(...)";
  }
  if (v.tag === "Abs") {
    return "Abs(..., " + printAST(v._2) + ")";
  }
  if (v.tag === "Typed") {
    return "Typed(" + printAST(v._2) + ")";
  }
  if (v.tag === "EffectBind") {
    return "EffectBind";
  }
  if (v.tag === "EffectPure") {
    return "EffectPure";
  }
  if (v.tag === "Update") {
    return "Update";
  }
  if (v.tag === "Accessor") {
    return "Accessor(" + printAST(v._1) + ")";
  }
  if (v.tag === "UncurriedEffectApp") {
    return "UncurriedEffectApp(" + printAST(v._1) + ")";
  }
  if (v.tag === "LetRec") {
    return "LetRec(..., " + printAST(v._3) + ")";
  }
  if (v.tag === "Branch") {
    return "Branch(...)";
  }
  if (v.tag === "PrimOp") {
    return "PrimOp(...)";
  }
  if (v.tag === "UncurriedApp") {
    return "UncurriedApp(" + printAST(v._1) + ")";
  }
  if (v.tag === "CtorSaturated") {
    return "CtorSaturated(...)";
  }
  if (v.tag === "UncurriedAbs") {
    return "UncurriedAbs(..., " + printAST(v._2) + ")";
  }
  if (v.tag === "UncurriedEffectAbs") {
    return "UncurriedEffectAbs(..., " + printAST(v._2) + ")";
  }
  if (v.tag === "CtorDef") {
    return "CtorDef";
  }
  if (v.tag === "EffectDefer") {
    return "EffectDefer(" + printAST(v._1) + ")";
  }
  if (v.tag === "PrimEffect") {
    return "PrimEffect(...)";
  }
  if (v.tag === "PrimUndefined") {
    return "PrimUndefined";
  }
  if (v.tag === "Fail") {
    return "Fail(" + v._1 + ")";
  }
  fail();
};
var inferTypeExpr = (currentMod) => (aritiesMap) => (bound) => (v) => {
  if (v.tag === "App") {
    const stripTyped = (stripTyped$a0$copy) => {
      let stripTyped$a0 = stripTyped$a0$copy, stripTyped$c = true, stripTyped$r;
      while (stripTyped$c) {
        const v12 = stripTyped$a0;
        if (v12.tag === "Typed") {
          stripTyped$a0 = v12._2;
          continue;
        }
        stripTyped$c = false;
        stripTyped$r = v12;
      }
      return stripTyped$r;
    };
    const v1 = stripTyped(v._1);
    if (v1.tag === "Var" && v1._1._2 === "not") {
      return $$Boolean;
    }
    const v2 = unwrapType(inferTypeExpr(currentMod)(aritiesMap)(bound)(v._1));
    if (v2.tag === "Func") {
      const providedCount = v._2.length;
      if (v2._1.length > providedCount) {
        return $ExprType("Func", providedCount < 1 ? v2._1 : sliceImpl(providedCount, v2._1.length, v2._1), v2._2);
      }
      return v2._2;
    }
    return Any;
  }
  if (v.tag === "UncurriedApp") {
    const v1 = unwrapType(inferTypeExpr(currentMod)(aritiesMap)(bound)(v._1));
    if (v1.tag === "Func") {
      return v1._2;
    }
    return Any;
  }
  if (v.tag === "UncurriedEffectApp") {
    const v1 = unwrapType(inferTypeExpr(currentMod)(aritiesMap)(bound)(v._1));
    if (v1.tag === "Func") {
      return v1._2;
    }
    return Any;
  }
  if (v.tag === "Abs") {
    return $ExprType("Func", [Any], Any);
  }
  if (v.tag === "UncurriedAbs") {
    return $ExprType(
      "Func",
      arrayMap((v1) => Any)(v._1),
      Any
    );
  }
  if (v.tag === "UncurriedEffectAbs") {
    return $ExprType(
      "Func",
      arrayMap((v1) => Any)(v._1),
      Any
    );
  }
  if (v.tag === "LetRec") {
    return inferTypeExpr(currentMod)(aritiesMap)(bound)(v._3);
  }
  if (v.tag === "EffectBind") {
    return inferTypeExpr(currentMod)(aritiesMap)(bound)(v._4);
  }
  if (v.tag === "EffectPure") {
    return inferTypeExpr(currentMod)(aritiesMap)(bound)(v._1);
  }
  if (v.tag === "EffectDefer") {
    return inferTypeExpr(currentMod)(aritiesMap)(bound)(v._1);
  }
  if (v.tag === "Branch") {
    const defTy = inferTypeExpr(currentMod)(aritiesMap)(bound)(v._2);
    if (defTy.tag === "Any") {
      return inferTypeExpr(currentMod)(aritiesMap)(bound)((() => {
        if (0 < v._1.length) {
          return v._1[0]._2;
        }
        fail();
      })());
    }
    return defTy;
  }
  if (v.tag === "Typed") {
    const innerTy = inferTypeExpr(currentMod)(aritiesMap)(bound)(v._2);
    const v1 = unwrapType(innerTy);
    const v2 = unwrapType(v._1);
    if (v2.tag === "Any") {
      return innerTy;
    }
    if (v1.tag === "Any") {
      return v._1;
    }
    if (v2.tag === "Func") {
      if (v1.tag === "Boolean") {
        return innerTy;
      }
      if (v1.tag === "Int") {
        return innerTy;
      }
      if (v1.tag === "Number") {
        return innerTy;
      }
      if (v1.tag === "String") {
        return innerTy;
      }
      if (v1.tag === "Char") {
        return innerTy;
      }
      if (v1.tag === "ADT") {
        return innerTy;
      }
    }
    return v._1;
  }
  if (v.tag === "CtorSaturated") {
    const modStr = (() => {
      if (v._1._1.tag === "Just") {
        return v._1._1._1;
      }
      if (v._1._1.tag === "Nothing") {
        return currentMod;
      }
      fail();
    })();
    return $ExprType("ADT", modStr, [modStr, v._3], []);
  }
  if (v.tag === "CtorDef") {
    const $0 = lookup5(currentMod + "_" + sanitizeIdent(v._3))(aritiesMap);
    if ($0.tag === "Nothing") {
      return Any;
    }
    if ($0.tag === "Just") {
      return $0._1;
    }
    fail();
  }
  if (v.tag === "Var") {
    const sName = sanitizeIdent(v._1._2);
    const v1 = lookup5(sName)(bound);
    if (v1.tag === "Just") {
      return v1._1;
    }
    if (v1.tag === "Nothing") {
      const v2 = lookup5((() => {
        if (v._1._1.tag === "Just") {
          return replaceAll(".")("_")(v._1._1._1) + "_" + sName;
        }
        if (v._1._1.tag === "Nothing") {
          return replaceAll(".")("_")(currentMod) + "_" + sName;
        }
        fail();
      })())(aritiesMap);
      if (v2.tag === "Just") {
        return v2._1;
      }
      if (v2.tag === "Nothing") {
        return Any;
      }
    }
    fail();
  }
  if (v.tag === "Local") {
    const v1 = lookup5((() => {
      if (v._1.tag === "Just") {
        return sanitizeIdent(v._1._1);
      }
      if (v._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v._2);
      }
      fail();
    })())(bound);
    if (v1.tag === "Just") {
      return v1._1;
    }
    if (v1.tag === "Nothing") {
      return Any;
    }
    fail();
  }
  if (v.tag === "Let") {
    if (v._1.tag === "Just") {
      return inferTypeExpr(currentMod)(aritiesMap)(insert(ordString)(sanitizeIdent(v._1._1))(inferTypeExpr(currentMod)(aritiesMap)(bound)(v._3))(bound))(v._4);
    }
    if (v._1.tag === "Nothing") {
      return inferTypeExpr(currentMod)(aritiesMap)(bound)(v._4);
    }
    return Any;
  }
  if (v.tag === "PrimOp") {
    if (v._1.tag === "Op1") {
      if (v._1._1.tag === "OpBooleanNot") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpIntBitNot") {
        return Int;
      }
      if (v._1._1.tag === "OpIntNegate") {
        return Int;
      }
      if (v._1._1.tag === "OpNumberNegate") {
        return $$Number;
      }
      if (v._1._1.tag === "OpArrayLength") {
        return Int;
      }
      if (v._1._1.tag === "OpIsTag") {
        return $$Boolean;
      }
      return Any;
    }
    if (v._1.tag === "Op2") {
      if (v._1._1.tag === "OpIntNum") {
        return Int;
      }
      if (v._1._1.tag === "OpNumberNum") {
        return $$Number;
      }
      if (v._1._1.tag === "OpBooleanAnd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpBooleanOr") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpBooleanOrd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpIntOrd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpNumberOrd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpStringOrd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpCharOrd") {
        return $$Boolean;
      }
      if (v._1._1.tag === "OpStringAppend") {
        return $$String;
      }
    }
    return Any;
  }
  if (v.tag === "Lit") {
    if (v._1.tag === "LitInt") {
      return Int;
    }
    if (v._1.tag === "LitNumber") {
      return $$Number;
    }
    if (v._1.tag === "LitString") {
      return $$String;
    }
    if (v._1.tag === "LitChar") {
      return Char;
    }
    if (v._1.tag === "LitBoolean") {
      return $$Boolean;
    }
  }
  return Any;
};
var globalConsumed = { value: Leaf };
var globalCaptured = { value: Leaf };
var getTyPrefix = (modNameStr) => (v) => {
  if (v._1.tag === "Just") {
    return replaceAll(".")("_")(v._1._1) + "_";
  }
  if (v._1.tag === "Nothing") {
    return replaceAll(".")("_")(modNameStr) + "_";
  }
  fail();
};
var getArity = (v) => {
  if (v.tag === "ForAll") {
    return getArity(v._2);
  }
  if (v.tag === "ConstrainedType") {
    return v._1.length + getArity(v._2) | 0;
  }
  if (v.tag === "Func") {
    return v._1.length + getArity(v._2) | 0;
  }
  return 0;
};
var freeVariables = (v) => {
  if (v.tag === "Var") {
    return $$$Map(
      "Node",
      1,
      1,
      (() => {
        if (v._1._1.tag === "Just") {
          return replaceAll(".")("_")(v._1._1._1) + "_";
        }
        if (v._1._1.tag === "Nothing") {
          return "";
        }
        fail();
      })() + sanitizeIdent(v._1._2),
      void 0,
      Leaf,
      Leaf
    );
  }
  if (v.tag === "Local") {
    return $$$Map(
      "Node",
      1,
      1,
      (() => {
        if (v._1.tag === "Just") {
          return sanitizeIdent(v._1._1);
        }
        if (v._1.tag === "Nothing") {
          return "lvl_" + showIntImpl(v._2);
        }
        fail();
      })(),
      void 0,
      Leaf,
      Leaf
    );
  }
  if (v.tag === "App") {
    return foldlArray((acc) => (a) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(a)))(freeVariables(v._1))(v._2);
  }
  if (v.tag === "Let") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      freeVariables(v._3),
      $$delete(ordString)((() => {
        if (v._1.tag === "Just") {
          return sanitizeIdent(v._1._1);
        }
        if (v._1.tag === "Nothing") {
          return "lvl_" + showIntImpl(v._2);
        }
        fail();
      })())(freeVariables(v._4))
    );
  }
  if (v.tag === "Typed") {
    return freeVariables(v._2);
  }
  if (v.tag === "Update") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v1._2)))(freeVariables(v._1))(v._2);
  }
  if (v.tag === "Branch") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      foldlArray((acc) => (v1) => unsafeUnionWith(
        ordString.compare,
        $$const,
        acc,
        unsafeUnionWith(ordString.compare, $$const, freeVariables(v1._1), freeVariables(v1._2))
      ))(Leaf)(v._1),
      freeVariables(v._2)
    );
  }
  if (v.tag === "PrimOp") {
    if (v._1.tag === "Op1") {
      return freeVariables(v._1._2);
    }
    if (v._1.tag === "Op2") {
      return unsafeUnionWith(ordString.compare, $$const, freeVariables(v._1._2), freeVariables(v._1._3));
    }
    return Leaf;
  }
  if (v.tag === "Accessor") {
    return freeVariables(v._1);
  }
  if (v.tag === "EffectBind") {
    return unsafeUnionWith(
      ordString.compare,
      $$const,
      freeVariables(v._3),
      $$delete(ordString)((() => {
        if (v._1.tag === "Just") {
          return sanitizeIdent(v._1._1);
        }
        if (v._1.tag === "Nothing") {
          return "lvl_" + showIntImpl(v._2);
        }
        fail();
      })())(freeVariables(v._4))
    );
  }
  if (v.tag === "EffectPure") {
    return freeVariables(v._1);
  }
  if (v.tag === "LetRec") {
    return unsafeDifference(
      ordString.compare,
      unsafeUnionWith(
        ordString.compare,
        $$const,
        foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v1._2)))(Leaf)(v._2),
        freeVariables(v._3)
      ),
      foldlArray((acc) => (v1) => insert(ordString)(sanitizeIdent(v1._1))()(acc))(Leaf)(v._2)
    );
  }
  if (v.tag === "Abs") {
    return unsafeDifference(
      ordString.compare,
      freeVariables(v._2),
      foldlArray((acc) => (v1) => {
        if (v1._1.tag === "Just") {
          return insert(ordString)(sanitizeIdent(v1._1._1))()(acc);
        }
        if (v1._1.tag === "Nothing") {
          return insert(ordString)("lvl_" + showIntImpl(v1._2))()(acc);
        }
        fail();
      })(Leaf)(v._1)
    );
  }
  if (v.tag === "UncurriedAbs") {
    return unsafeDifference(
      ordString.compare,
      freeVariables(v._2),
      foldlArray((acc) => (v1) => {
        if (v1._1.tag === "Just") {
          return insert(ordString)(sanitizeIdent(v1._1._1))()(acc);
        }
        if (v1._1.tag === "Nothing") {
          return insert(ordString)("lvl_" + showIntImpl(v1._2))()(acc);
        }
        fail();
      })(Leaf)(v._1)
    );
  }
  if (v.tag === "UncurriedEffectAbs") {
    return unsafeDifference(
      ordString.compare,
      freeVariables(v._2),
      foldlArray((acc) => (v1) => {
        if (v1._1.tag === "Just") {
          return insert(ordString)(sanitizeIdent(v1._1._1))()(acc);
        }
        if (v1._1.tag === "Nothing") {
          return insert(ordString)("lvl_" + showIntImpl(v1._2))()(acc);
        }
        fail();
      })(Leaf)(v._1)
    );
  }
  if (v.tag === "UncurriedApp") {
    return foldlArray((acc) => (a) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(a)))(freeVariables(v._1))(v._2);
  }
  if (v.tag === "UncurriedEffectApp") {
    return foldlArray((acc) => (a) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(a)))(freeVariables(v._1))(v._2);
  }
  if (v.tag === "Fail") {
    return Leaf;
  }
  if (v.tag === "EffectDefer") {
    return freeVariables(v._1);
  }
  if (v.tag === "Lit") {
    if (v._1.tag === "LitArray") {
      return foldlArray((acc) => (a) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(a)))(Leaf)(v._1._1);
    }
    if (v._1.tag === "LitRecord") {
      return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v1._2)))(Leaf)(v._1._1);
    }
    return Leaf;
  }
  if (v.tag === "CtorSaturated") {
    return foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v1._2)))(Leaf)(v._5);
  }
  return Leaf;
};
var inferTypeExprGlobal = (currentMod) => (aritiesMap) => (globalClassFields) => (bound) => (v) => {
  if (v.tag === "Accessor") {
    if (v._2.tag === "GetProp") {
      const $0 = unwrapType(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1));
      if ($0.tag === "ADT") {
        const v2 = lookup5((() => {
          const $1 = $0._2.length - 1 | 0;
          return joinWith("_")((() => {
            const $2 = $0._2.length - 1 | 0;
            if ($2 < 1) {
              return [];
            }
            return sliceImpl(0, $2, $0._2);
          })()) + "_" + ($1 >= 0 && $1 < $0._2.length ? $0._2[$1] : "");
        })())(globalClassFields);
        if (v2.tag === "Just") {
          const v3 = find((v4) => v4._1 === sanitizeIdent(v._2._1))(v2._1);
          if (v3.tag === "Just") {
            return v3._1._2;
          }
          if (v3.tag === "Nothing") {
            return Any;
          }
          fail();
        }
        if (v2.tag === "Nothing") {
          return Any;
        }
        fail();
      }
      return Any;
    }
    if (v._2.tag === "GetCtorField") {
      const ctorFqn = (() => {
        if (v._2._1._1.tag === "Just") {
          return replaceAll(".")("_")(v._2._1._1._1) + "_";
        }
        if (v._2._1._1.tag === "Nothing") {
          return currentMod + "_";
        }
        fail();
      })() + sanitizeIdent(v._2._4);
      const v1 = lookup5(ctorFqn)(aritiesMap);
      if (v1.tag === "Just") {
        const v$1 = unwrapType(v1._1);
        const args = v$1.tag === "Func" ? v$1._1 : [];
        if (v._2._6 >= 0 && v._2._6 < args.length) {
          return args[v._2._6];
        }
        return _trace(
          "Warning: fieldIdx " + showIntImpl(v._2._6) + " out of bounds for " + ctorFqn + " (args len: " + showIntImpl(args.length) + ")",
          (v3) => Any
        );
      }
      if (v1.tag === "Nothing") {
        return _trace("Warning: ctorFqn not found in aritiesMap: " + ctorFqn, (v2) => Any);
      }
      fail();
    }
  }
  return inferTypeExpr(currentMod)(aritiesMap)(bound)(v);
};
var extractAbsParams = (v) => (v1) => {
  if (v === 0) {
    return $Maybe("Just", $Tuple([], v1));
  }
  if (v1.tag === "Typed") {
    return extractAbsParams(v)(v1._2);
  }
  if (v1.tag === "Abs") {
    const pNames = arrayMap((v2) => {
      if (v2._1.tag === "Just") {
        return sanitizeIdent(v2._1._1);
      }
      if (v2._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v2._2);
      }
      fail();
    })(v1._1);
    const len = pNames.length;
    if (v >= len) {
      const v2 = extractAbsParams(v - len | 0)(v1._2);
      if (v2.tag === "Just") {
        return $Maybe("Just", $Tuple([...pNames, ...v2._1._1], v2._1._2));
      }
      if (v2.tag === "Nothing") {
        return Nothing;
      }
      fail();
    }
    return Nothing;
  }
  if (v1.tag === "Let") {
    const v2 = extractAbsParams(v)(v1._4);
    if (v2.tag === "Just") {
      return $Maybe("Just", $Tuple(v2._1._1, $BackendSyntax("Let", v1._1, v1._2, v1._3, v2._1._2)));
    }
    if (v2.tag === "Nothing") {
      return Nothing;
    }
    fail();
  }
  return Nothing;
};
var dedupArgs = (arr) => foldlArray((acc) => (item) => {
  const count = lookup5(item)(acc.counts);
  if (count.tag === "Nothing") {
    return { result: snoc(acc.result)(item), counts: insert(ordString)(item)(1)(acc.counts) };
  }
  if (count.tag === "Just") {
    return {
      result: snoc(acc.result)(item + "_" + showIntImpl(count._1)),
      counts: insert(ordString)(item)(count._1 + 1 | 0)(acc.counts)
    };
  }
  fail();
})({ result: [], counts: Leaf })(arr).result;
var codegenPrelude = (fields) => {
  const shapes = fromFoldableImpl(foldableSet.foldr, fields);
  const validUniqueFields = filterImpl(
    (f) => !member2(f)(fromFoldable12(["unwrap", "clone", "as_ref", "tag", "vals", "call"])) && f !== "",
    fromFoldableImpl(foldableSet.foldr, fromFoldable12(arrayBind(shapes)((shape) => split(",")(shape))))
  );
  const validShapes = filterImpl((shape) => shape !== "", shapes);
  return "#![allow(warnings)]\n\nuse perceus_ptr::PerceusPtr;\n\n#[derive(Clone)]\npub enum Void {}\n\n#[derive(Clone)]\npub enum Value {\n    Int(i64),\n    Number(f64),\n    Bool(bool),\n    String(String),\n    Char(char),\n    Array(std::rc::Rc<Vec<UnknownType>>),\n" + foldMap7((arity) => "    Func" + showIntImpl(arity) + "(Func" + showIntImpl(arity) + "<" + joinWith(", ")(replicateImpl(
    arity + 1 | 0,
    "UnknownType"
  )) + ">),\n")(rangeImpl(1, 10)) + "    Class(std::rc::Rc<dyn std::any::Any>),\n    Thunk(perceus_ptr::PerceusPtr<Thunk>),\n    Record_a(perceus_ptr::PerceusPtr<Record_a>),\n" + foldMap7((shape) => {
    const structName = "Record_" + joinWith("_")(arrayMap(sanitizeIdent)(sortBy(ordString.compare)(split(",")(shape))));
    return "    " + structName + "(perceus_ptr::PerceusPtr<" + structName + ">),\n";
  })(validShapes) + '}\n\nimpl Value {\n    pub fn unwrap_int(&self) -> i64 {\n        if let Value::Int(v) = self { *v } else { panic!("Expected Int"); }\n    }\n    pub fn unwrap_number(&self) -> f64 {\n        if let Value::Number(v) = self { *v } else { panic!("Expected Number"); }\n    }\n    pub fn unwrap_bool(&self) -> bool {\n        if let Value::Bool(v) = self { *v } else { panic!("Expected Bool"); }\n    }\n    pub fn unwrap_string(&self) -> String {\n        if let Value::String(v) = self { v.clone() } else { panic!("Expected String"); }\n    }\n    pub fn unwrap_char(&self) -> char {\n        if let Value::Char(v) = self { *v } else { panic!("Expected Char"); }\n    }\n    pub fn unwrap_array(&self) -> std::rc::Rc<Vec<UnknownType>> {\n        if let Value::Array(v) = self { v.clone() } else { panic!("Expected Array"); }\n    }\n' + foldMap7((arity) => "    pub fn unwrap_func" + showIntImpl(arity) + "(&self) -> Func" + showIntImpl(arity) + "<" + joinWith(", ")(replicateImpl(
    arity + 1 | 0,
    "UnknownType"
  )) + "> {\n" + (arity === 1 ? "        if let Value::Func1(v) = self { v.clone() } else if let Value::Thunk(v) = self { v.call.clone().unwrap() } else if let Value::Record_a(v) = self { v.call.clone().unwrap() } " + joinWith(" ")(arrayMap((a) => "else if let Value::Func" + showIntImpl(a) + "(v) = self { let f = v.clone(); Func1::Shared(std::rc::Rc::new(move |a0: UnknownType| -> UnknownType { crate::Value::Func" + showIntImpl(a - 1 | 0) + "(Func" + showIntImpl(a - 1 | 0) + "::Shared(std::rc::Rc::new({ let f2 = f.clone(); move |" + joinWith(", ")(arrayMap((i) => "mut a" + showIntImpl(i) + ": UnknownType")(rangeImpl(
    1,
    a - 1 | 0
  ))) + "| -> UnknownType { f2(a0.clone(), " + joinWith(", ")(arrayMap((i) => "a" + showIntImpl(i))(rangeImpl(
    1,
    a - 1 | 0
  ))) + ") } }))) })) }")(rangeImpl(2, 10))) + ' else { panic!("Expected Func1"); }\n' : "        if let Value::Func" + showIntImpl(arity) + "(v) = self { v.clone() } else if let Value::Func1(v) = self { let f = v.clone(); Func" + showIntImpl(arity) + "::Shared(std::rc::Rc::new(move |" + joinWith(", ")(mapWithIndexArray((i) => (v) => "mut a" + showIntImpl(i) + ": UnknownType")(replicateImpl(
    arity,
    void 0
  ))) + "| -> UnknownType { " + foldlArray((acc) => (i) => acc + ".unwrap_func1()(a" + showIntImpl(i) + ")")("f(a0)")(rangeImpl(
    1,
    arity - 1 | 0
  )) + ' })) } else { panic!("Expected Func' + showIntImpl(arity) + ' or Func1 (curried) - got something else"); }\n') + "    }\n")(rangeImpl(1, 10)) + `    pub fn unwrap_class<T: 'static>(&self) -> &T {
        if let Value::Class(v) = self { v.downcast_ref::<T>().unwrap() } else { panic!("Expected Class"); }
    }
    pub fn drop_explicit(self) {
    }
    pub fn get_tag(&self) -> &'static str {
        if let Value::Record_a(r) = self { r.tag } else { panic!("Expected Record_a for tag"); }
    }
` + foldMap7((f) => {
    const sf = sanitizeIdent(f);
    return "    pub fn get_" + sf + "(&self) -> UnknownType {\n        match self {\n" + foldMap7((shape) => {
      const structName = "Record_" + joinWith("_")(arrayMap(sanitizeIdent)(sortBy(ordString.compare)(split(",")(shape))));
      if (elem(eqString)(f)(split(",")(shape))) {
        return "            Value::" + structName + "(r) => r." + sf + ".clone().unwrap(),\n";
      }
      return "";
    })(validShapes) + "            Value::Record_a(r) => r." + sf + '.clone().unwrap(),\n            _ => panic!("Expected record with field ' + sf + '"),\n        }\n    }\n';
  })(validUniqueFields) + foldMap7((f) => {
    const sf = sanitizeIdent(f);
    return "    pub fn set_" + sf + "(&mut self, val: UnknownType) {\n        match self {\n" + foldMap7((shape) => {
      const structName = "Record_" + joinWith("_")(arrayMap(sanitizeIdent)(sortBy(ordString.compare)(split(",")(shape))));
      if (elem(eqString)(f)(split(",")(shape))) {
        return "            Value::" + structName + "(r) => {\n                let mut mut_r = perceus_ptr::PerceusPtr::make_mut(r);\n                mut_r." + sf + " = Some(val);\n            },\n";
      }
      return "";
    })(validShapes) + "            Value::Record_a(r) => {\n                let mut mut_r = perceus_ptr::PerceusPtr::make_mut(r);\n                mut_r." + sf + ' = Some(val);\n            },\n            _ => panic!("Expected record with field ' + sf + '"),\n        }\n    }\n';
  })(validUniqueFields) + "}\n\npub type UnknownType = Value;\n\npub fn mk_int(val: i64) -> UnknownType { Value::Int(val) }\npub fn mk_bool(val: bool) -> UnknownType { Value::Bool(val) }\npub fn mk_number(val: f64) -> UnknownType { Value::Number(val) }\npub fn mk_string(val: &str) -> UnknownType { Value::String(val.to_string()) }\npub fn mk_char(val: char) -> UnknownType { Value::Char(val) }\npub fn mk_array(val: Vec<UnknownType>) -> UnknownType { Value::Array(std::rc::Rc::new(val)) }\n\n#[derive(Clone, Default)]\npub struct Thunk {\n    pub call: Option<Func1<UnknownType, UnknownType>>,\n}\n\n#[derive(Clone, Default)]\npub struct Record_a {\n    pub tag: &'static str,\n    pub vals: Option<std::rc::Rc<Vec<UnknownType>>>,\n    pub call: Option<Func1<UnknownType, UnknownType>>,\n" + foldMap7((field) => "    pub " + sanitizeIdent(field) + ": Option<UnknownType>,\n")(validUniqueFields) + "}\n\n" + foldMap7((shape) => "#[derive(Clone, Default)]\npub struct Record_" + joinWith("_")(arrayMap(sanitizeIdent)(sortBy(ordString.compare)(split(",")(shape)))) + " {\n" + foldMap7((f) => "    pub " + sanitizeIdent(f) + ": Option<UnknownType>,\n")(filterImpl(
    (f) => f !== "",
    split(",")(shape)
  )) + "}\n\n")(validShapes) + "\n\n" + foldMap7((arity) => {
    const typeParamsList = arrayMap((i) => "T" + showIntImpl(i))(rangeImpl(1, arity));
    const typeParamsWithRet = joinWith(", ")(typeParamsList) + ", R";
    const args = joinWith(", ")(typeParamsList);
    return "#[derive(Clone)]\npub enum Func" + showIntImpl(arity) + "<" + typeParamsWithRet + "> {\n    Static(fn(" + args + ") -> R),\n    Shared(std::rc::Rc<dyn Fn(" + args + ") -> R>),\n}\n\nimpl<" + joinWith(", ")(arrayMap((p) => p + ": 'static")([
      ...typeParamsList,
      "R"
    ])) + "> std::ops::Deref for Func" + showIntImpl(arity) + "<" + typeParamsWithRet + "> {\n    type Target = dyn Fn(" + args + ") -> R;\n    #[inline(always)]\n    fn deref(&self) -> &Self::Target {\n        match self {\n            Func" + showIntImpl(arity) + "::Static(f) => f,\n            Func" + showIntImpl(arity) + "::Shared(rc) => rc.as_ref(),\n        }\n    }\n}\n\n";
  })(rangeImpl(1, 10));
};
var codegenExprType = (currentMod) => (isRet) => (ty) => {
  const v = unwrapType(ty);
  if (v.tag === "Int") {
    return "i64";
  }
  if (v.tag === "Boolean") {
    return "bool";
  }
  if (v.tag === "Number") {
    return "f64";
  }
  if (v.tag === "String") {
    return "String";
  }
  if (v.tag === "Char") {
    return "char";
  }
  if (v.tag === "ADT") {
    const modName = replaceAll(".")("_")(joinWith("_")((() => {
      const $02 = v._2.length - 1 | 0;
      if ($02 < 1) {
        return [];
      }
      return sliceImpl(0, $02, v._2);
    })()));
    const $0 = v._2.length - 1 | 0;
    const $1 = $0 >= 0 && $0 < v._2.length ? $Maybe("Just", v._2[$0]) : Nothing;
    const actualClassName = (() => {
      if ($1.tag === "Nothing") {
        return v._1;
      }
      if ($1.tag === "Just") {
        return $1._1;
      }
      fail();
    })();
    if (actualClassName === "Void") {
      return "purust_core::Void";
    }
    if ((() => {
      const $2 = indexOf2("Prim_")(modName);
      return modName === "Prim" || (() => {
        const $3 = indexOf2("Prim")(modName);
        return ($2.tag === "Nothing" ? false : $2.tag === "Just" && $2._1 === 0) || ($3.tag === "Nothing" ? false : $3.tag === "Just" && $3._1 === 0);
      })();
    })()) {
      return "crate::UnknownType";
    }
    if (modName === "Effect" || modName === "Effect_Exception" || modName === "Effect_Console" || modName === "Effect_Ref" || modName === "Effect_Uncurried" || modName === "Control_Monad_ST_Internal" || modName === "Foreign" || (() => {
      const $2 = indexOf2("Effect_Aff")(modName);
      return modName === "Data_Array_ST" || ($2.tag === "Nothing" ? false : $2.tag === "Just" && $2._1 === 0);
    })()) {
      return "crate::UnknownType";
    }
    if ((() => {
      const $2 = indexOf2("Fn")(actualClassName);
      return (modName === "Data_Function_Uncurried" || modName === "Control_Monad_ST_Uncurried") && (() => {
        const $3 = indexOf2("STFn")(actualClassName);
        return ($2.tag === "Nothing" ? false : $2.tag === "Just" && $2._1 === 0) || ($3.tag === "Nothing" ? false : $3.tag === "Just" && $3._1 === 0);
      })();
    })()) {
      return "crate::UnknownType";
    }
    if (modName === currentMod) {
      return "std::rc::Rc<crate::" + sanitizeIdent(actualClassName) + ">";
    }
    return "std::rc::Rc<Purs_" + modName + "::" + sanitizeIdent(actualClassName) + ">";
  }
  if (v.tag === "Func") {
    const arity = v._1.length;
    const typeArgs = joinWith(", ")([...arrayMap(codegenExprType(currentMod)(false))(v._1), codegenExprType(currentMod)(true)(v._2)]);
    if (arity > 0 && arity <= 10) {
      return "purust_core::Func" + showIntImpl(arity) + "<" + typeArgs + ">";
    }
  }
  return "crate::UnknownType";
};
var boxUnbox = (currentMod) => (expected) => (actual) => (code) => {
  const expStr = codegenExprType(currentMod)(true)(expected);
  const actStr = codegenExprType(currentMod)(true)(actual);
  if ((() => {
    const $0 = indexOf2("unimplemented!()")(code);
    const $1 = indexOf2("/* Typed ")(code);
    return ($0.tag === "Nothing" ? false : $0.tag === "Just" && $0._1 === 0) || ($1.tag === "Nothing" ? false : $1.tag === "Just" && $1._1 === 0) && contains("unimplemented!()")(code) && !contains("\n")(code);
  })()) {
    return code;
  }
  if (drop(length2(take2(toCodePointArray(code).length - 15 | 0)(code)))(code) === "continue;\n    }") {
    return code;
  }
  if (expStr === actStr) {
    return code;
  }
  const v1 = unwrapType(actual);
  const v2 = unwrapType(expected);
  if (v2.tag === "Func") {
    if (v1.tag === "Func") {
      const expArity = v2._1.length;
      const actArity = v1._1.length;
      if (expArity === actArity && expArity > 0 && expArity <= 10) {
        return "purust_core::Func" + showIntImpl(expArity) + "::Shared(std::rc::Rc::new({ let _f = (" + code + ").clone(); move |" + joinWith(", ")(mapWithIndexArray((i) => (ty) => "mut _a" + showIntImpl(i) + ": " + ty)(arrayMap(codegenExprType(currentMod)(false))(v2._1))) + "| -> " + codegenExprType(currentMod)(true)(v2._2) + " { " + boxUnbox(currentMod)(v2._2)(v1._2)("_f(" + joinWith(", ")(mapWithIndexArray((i) => (v32) => boxUnbox(currentMod)(v32._2)(v32._1)("_a" + showIntImpl(i)))(zipWithImpl(
          Tuple,
          v2._1,
          v1._1
        ))) + ")") + " } }))";
      }
      if (actArity > expArity && expArity > 0 && actArity <= 10) {
        const remainingActArgs = expArity < 1 ? v1._1 : sliceImpl(expArity, v1._1.length, v1._1);
        return "purust_core::Func" + showIntImpl(expArity) + "::Shared(std::rc::Rc::new({ let _f = (" + code + ").clone(); move |" + joinWith(", ")(mapWithIndexArray((i) => (ty) => "mut _a" + showIntImpl(i) + ": " + ty)(arrayMap(codegenExprType(currentMod)(false))(v2._1))) + "| -> " + codegenExprType(currentMod)(true)(v2._2) + " { " + boxUnbox(currentMod)(v2._2)($ExprType(
          "Func",
          remainingActArgs,
          v1._2
        ))("purust_core::Func" + showIntImpl(remainingActArgs.length) + "::Shared(std::rc::Rc::new({ let _f2 = _f.clone(); " + joinWith(" ")(mapWithIndexArray((i) => (v32) => "let mut _a" + showIntImpl(i) + " = _a" + showIntImpl(i) + ".clone();")(v2._1)) + " move |" + joinWith(", ")(mapWithIndexArray((i) => (ty) => "mut _a" + showIntImpl(expArity + i | 0) + ": " + ty)(arrayMap(codegenExprType(currentMod)(false))(remainingActArgs))) + "| -> " + codegenExprType(currentMod)(true)(v1._2) + " { _f2(" + joinWith(", ")(mapWithIndexArray((i) => (actTy) => boxUnbox(currentMod)(actTy)((() => {
          const $0 = [...v2._1, ...remainingActArgs];
          if (i >= 0 && i < $0.length) {
            return $0[i];
          }
          return Any;
        })())("_a" + showIntImpl(i) + ".clone()"))(v1._1)) + ") } }))") + " } }))";
      }
      const buildCall = (buildCall$a0$copy) => (buildCall$a1$copy) => (buildCall$a2$copy) => {
        let buildCall$a0 = buildCall$a0$copy, buildCall$a1 = buildCall$a1$copy, buildCall$a2 = buildCall$a2$copy, buildCall$c = true, buildCall$r;
        while (buildCall$c) {
          const idx = buildCall$a0, currentTy = buildCall$a1, accCode = buildCall$a2;
          if (idx >= expArity) {
            buildCall$c = false;
            buildCall$r = $Tuple(currentTy, accCode);
            continue;
          }
          const v32 = unwrapType(currentTy);
          if (v32.tag === "Func") {
            const $0 = v32._1;
            const stepArity = $0.length;
            buildCall$a0 = idx + stepArity | 0;
            buildCall$a1 = v32._2;
            buildCall$a2 = "(" + accCode + ")(" + joinWith(", ")(mapWithIndexArray((i) => (paramTy) => boxUnbox(currentMod)(i >= 0 && i < $0.length ? $0[i] : Any)(paramTy)("_a" + showIntImpl(idx + i | 0) + ".clone()"))(sliceImpl(
              idx,
              idx + stepArity | 0,
              v2._1
            ))) + ")";
            continue;
          }
          buildCall$a0 = idx + 1 | 0;
          buildCall$a1 = Any;
          buildCall$a2 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(currentMod)(Any)(idx >= 0 && idx < v2._1.length ? v2._1[idx] : Any)("_a" + showIntImpl(idx) + ".clone()") + ")";
        }
        return buildCall$r;
      };
      const v3 = buildCall(0)($ExprType("Func", v1._1, v1._2))("_f");
      return "purust_core::Func" + showIntImpl(expArity) + "::Shared(std::rc::Rc::new({ let _f = (" + code + ").clone(); move |" + joinWith(", ")(mapWithIndexArray((i) => (ty) => "mut _a" + showIntImpl(i) + ": " + ty)(arrayMap(codegenExprType(currentMod)(false))(v2._1))) + "| -> " + codegenExprType(currentMod)(true)(v2._2) + " { " + boxUnbox(currentMod)(v2._2)(v3._1)(v3._2) + " } }))";
    }
    const arity = v2._1.length;
    if ((actStr === "crate::UnknownType" || actStr === "crate::Value") && arity > 0 && arity <= 10) {
      return "purust_core::Func" + showIntImpl(arity) + "::Shared(std::rc::Rc::new({ let _f = (" + code + ").unwrap_func" + showIntImpl(arity) + "(); move |" + joinWith(", ")(mapWithIndexArray((i) => (ty) => "mut _a" + showIntImpl(i) + ": " + ty)(arrayMap(codegenExprType(currentMod)(false))(v2._1))) + "| -> " + codegenExprType(currentMod)(true)(v2._2) + " { " + boxUnbox(currentMod)(v2._2)(Any)("_f(" + joinWith(", ")(mapWithIndexArray((i) => (expTy) => boxUnbox(currentMod)(Any)(expTy)("_a" + showIntImpl(i)))(v2._1)) + ")") + " } }))";
    }
    return code;
  }
  if (v1.tag === "Func") {
    const arity = v1._1.length;
    if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && arity > 0 && arity <= 10) {
      return "crate::Value::Func" + showIntImpl(arity) + "(purust_core::Func" + showIntImpl(arity) + "::Shared(std::rc::Rc::new({ let _f = (" + code + ").clone(); move |" + joinWith(", ")(mapWithIndexArray((i) => (v3) => "mut _a" + showIntImpl(i) + ": crate::UnknownType")(v1._1)) + "| -> crate::UnknownType { " + boxUnbox(currentMod)(Any)(v1._2)("_f(" + joinWith(", ")(mapWithIndexArray((i) => (actTy) => boxUnbox(currentMod)(actTy)(Any)("_a" + showIntImpl(i)))(v1._1)) + ")") + " } })))";
    }
    return code;
  }
  const isExpADT = unwrapType(expected).tag === "ADT";
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && unwrapType(actual).tag === "ADT") {
    return "crate::Value::Class(std::rc::Rc::new(" + code + "))";
  }
  if ((actStr === "crate::UnknownType" || actStr === "crate::Value") && isExpADT) {
    return "(" + code + ").unwrap_class::<" + expStr + ">().clone()";
  }
  if (expStr === "i64" && (actStr === "crate::UnknownType" || actStr === "crate::Value")) {
    return "(" + code + ").unwrap_int()";
  }
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && actStr === "i64") {
    return "crate::mk_int(" + code + ")";
  }
  if (expStr === "bool" && (actStr === "crate::UnknownType" || actStr === "crate::Value")) {
    return "(" + code + ").unwrap_bool()";
  }
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && actStr === "bool") {
    return "crate::mk_bool(" + code + ")";
  }
  if (expStr === "f64" && (actStr === "crate::UnknownType" || actStr === "crate::Value")) {
    return "(" + code + ").unwrap_number()";
  }
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && actStr === "f64") {
    return "crate::mk_number(" + code + ")";
  }
  if (expStr === "char" && (actStr === "crate::UnknownType" || actStr === "crate::Value")) {
    return "(" + code + ").unwrap_char()";
  }
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && actStr === "char") {
    return "crate::mk_char(" + code + ")";
  }
  if (expStr === "String" && (actStr === "crate::UnknownType" || actStr === "crate::Value")) {
    return "(" + code + ").unwrap_string()";
  }
  if ((expStr === "crate::UnknownType" || expStr === "crate::Value") && actStr === "String") {
    return "crate::mk_string(&(" + code + "))";
  }
  return code;
};
var genApp = (modNameStr) => (allZeroArity) => (allMacroBindings) => (mbLoop) => (aritiesMap) => (globalClassFields) => (bound) => (alive) => (appTy) => (fn) => (argsArray) => {
  const m = argsArray.length;
  const getInner = (getInner$a0$copy) => {
    let getInner$a0 = getInner$a0$copy, getInner$c = true, getInner$r;
    while (getInner$c) {
      const v2 = getInner$a0;
      if (v2.tag === "Typed") {
        getInner$a0 = v2._2;
        continue;
      }
      getInner$c = false;
      getInner$r = v2;
    }
    return getInner$r;
  };
  const argsFree = arrayMap(freeVariables)(argsArray);
  const argsCodeArray = mapWithIndexArray((i) => (arg) => codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
    ordString.compare,
    $$const,
    alive,
    foldlArray(union)(Leaf)((() => {
      const $0 = i + 1 | 0;
      if ($0 < 1) {
        return argsFree;
      }
      return sliceImpl($0, argsFree.length, argsFree);
    })())
  ))(false)(arg))(argsArray);
  const buildCall = (buildCall$a0$copy) => (buildCall$a1$copy) => (buildCall$a2$copy) => {
    let buildCall$a0 = buildCall$a0$copy, buildCall$a1 = buildCall$a1$copy, buildCall$a2 = buildCall$a2$copy, buildCall$c = true, buildCall$r;
    while (buildCall$c) {
      const accTy = buildCall$a0, accCode = buildCall$a1, idx = buildCall$a2;
      if (idx >= argsCodeArray.length) {
        buildCall$c = false;
        buildCall$r = $Tuple(accTy, accCode);
        continue;
      }
      const v2 = unwrapType(accTy);
      if (v2.tag === "Func") {
        const arity = v2._1.length;
        if (arity > 0 && arity <= 10) {
          const availableArgsCount = argsCodeArray.length - idx | 0;
          if (availableArgsCount >= arity) {
            const passedArgsTys2 = sliceImpl(idx, idx + arity | 0, argsArray);
            buildCall$a0 = v2._2;
            buildCall$a1 = "(" + accCode + ")(" + joinWith(", ")(mapWithIndexArray((i) => (argCode) => boxUnbox(modNameStr)(i >= 0 && i < v2._1.length ? v2._1[i] : Any)(inferTypeExpr(modNameStr)(aritiesMap)(bound)(i >= 0 && i < passedArgsTys2.length ? passedArgsTys2[i] : $BackendSyntax("Var", $Qualified(Nothing, ""))))(argCode))(sliceImpl(
              idx,
              idx + arity | 0,
              argsCodeArray
            ))) + ")";
            buildCall$a2 = idx + arity | 0;
            continue;
          }
          const passedArgsTys = sliceImpl(idx, argsCodeArray.length, argsArray);
          const passedArgs = sliceImpl(idx, argsCodeArray.length, argsCodeArray);
          const missingEtasTypes = availableArgsCount < 1 ? v2._1 : sliceImpl(availableArgsCount, v2._1.length, v2._1);
          const missingCount = arity - availableArgsCount | 0;
          const evalArgs = mapWithIndexArray((i) => (v12) => "eval_arg_" + showIntImpl(i))(passedArgs);
          const etaArgs = mapWithIndexArray((i) => (v12) => "eta_" + showIntImpl(i))(replicateImpl(missingCount, void 0));
          buildCall$c = false;
          buildCall$r = $Tuple(
            $ExprType("Func", missingEtasTypes, v2._2),
            "{\n        let mut _fn_eval = (" + accCode + ");\n" + joinWith("")(mapWithIndexArray((i) => (boxedArg) => "        let mut eval_arg_" + showIntImpl(i) + " = " + boxedArg + ";\n")(mapWithIndexArray((i) => (argCode) => boxUnbox(modNameStr)(i >= 0 && i < v2._1.length ? v2._1[i] : Any)(inferTypeExpr(modNameStr)(aritiesMap)(bound)(i >= 0 && i < passedArgsTys.length ? passedArgsTys[i] : $BackendSyntax("Var", $Qualified(Nothing, ""))))(argCode))(passedArgs))) + "    purust_core::Func" + showIntImpl(missingCount) + "::Shared(std::rc::Rc::new(move |" + joinWith(", ")(mapWithIndexArray((i) => (eta) => "mut " + eta + ": " + codegenExprType(modNameStr)(false)(i >= 0 && i < missingEtasTypes.length ? missingEtasTypes[i] : Any))(etaArgs)) + "| -> " + codegenExprType(modNameStr)(true)(v2._2) + " {\n    let mut _fn_ptr = _fn_eval.clone();\n" + joinWith("")(arrayMap((arg) => "    let mut " + arg + " = " + arg + ".clone();\n")(evalArgs)) + "    _fn_ptr(" + joinWith(", ")([
              ...evalArgs,
              ...mapWithIndexArray((i) => (eta) => eta + ".clone()")(etaArgs)
            ]) + ")\n}))\n}"
          );
          continue;
        }
      }
      buildCall$a0 = Any;
      buildCall$a1 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(modNameStr)(Any)(inferTypeExpr(modNameStr)(aritiesMap)(bound)(idx >= 0 && idx < argsArray.length ? argsArray[idx] : $BackendSyntax("Var", $Qualified(Nothing, ""))))(idx >= 0 && idx < argsCodeArray.length ? argsCodeArray[idx] : "") + ")";
      buildCall$a2 = idx + 1 | 0;
    }
    return buildCall$r;
  };
  const fnCode = codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
    ordString.compare,
    $$const,
    alive,
    foldlArray(union)(Leaf)(argsFree)
  ))(false)(fn);
  const v = getInner(fn);
  const mbFnName = (() => {
    if (v.tag === "Var") {
      return $Maybe("Just", sanitizeIdent(v._1._2));
    }
    if (v.tag === "Local" && v._1.tag === "Just") {
      return $Maybe("Just", sanitizeIdent(v._1._1));
    }
    return Nothing;
  })();
  if (mbLoop.tag === "Just" && mbFnName.tag === "Just" && (mbFnName._1 === mbLoop._1.name || replaceAll(".")("_")(modNameStr) + "_" + mbFnName._1 === mbLoop._1.name) && m === mbLoop._1.params.length) {
    if (mbLoop.tag === "Just") {
      return "{\n" + joinWith("")(mapWithIndexArray((i) => (argCode) => "        let _tco_temp_" + showIntImpl(i) + " = " + argCode + ";\n")(argsCodeArray)) + joinWith("")(mapWithIndexArray((i) => (pName) => "        " + sanitizeIdent(pName) + " = _tco_temp_" + showIntImpl(i) + ";\n")(mbLoop._1.params)) + "        continue;\n    }";
    }
    return "";
  }
  const v$1 = getInner(fn);
  if (v$1.tag === "Var") {
    const sName = sanitizeIdent(v$1._1._2);
    if (member12(sName)(bound)) {
      const v12 = buildCall(inferTypeExprGlobal(modNameStr)(aritiesMap)(globalClassFields)(bound)(fn))(fnCode)(0);
      return boxUnbox(modNameStr)(appTy)(v12._1)(v12._2);
    }
    const fullName = (() => {
      if (v$1._1._1.tag === "Just") {
        return replaceAll(".")("_")(v$1._1._1._1) + "_" + sName;
      }
      if (v$1._1._1.tag === "Nothing") {
        return replaceAll(".")("_")(modNameStr) + "_" + sName;
      }
      fail();
    })();
    if (fullName === "Data_Eq_eqInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() == (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() == ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_bool(().init_int.unwrap() == (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_bool(().init_int.unwrap() == ().init_int.unwrap())";
    }
    if (fullName === "Data_Semiring_addInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() + (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() + ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_int(().init_int.unwrap() + (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_int(().init_int.unwrap() + ().init_int.unwrap())";
    }
    if (fullName === "Data_Ring_subInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() - (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() - ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_int(().init_int.unwrap() - (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_int(().init_int.unwrap() - ().init_int.unwrap())";
    }
    if (fullName === "Data_Semiring_mulInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() * (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_int((" + argsCodeArray[0] + ").init_int.unwrap() * ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_int(().init_int.unwrap() * (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_int(().init_int.unwrap() * ().init_int.unwrap())";
    }
    if (fullName === "Data_Ord_lessThanInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() < (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() < ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_bool(().init_int.unwrap() < (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_bool(().init_int.unwrap() < ().init_int.unwrap())";
    }
    if (fullName === "Data_Ord_greaterThanInt" && m === 2) {
      if (0 < argsCodeArray.length) {
        if (1 < argsCodeArray.length) {
          return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() > (" + argsCodeArray[1] + ").init_int.unwrap())";
        }
        return "purust_core::mk_bool((" + argsCodeArray[0] + ").init_int.unwrap() > ().init_int.unwrap())";
      }
      if (1 < argsCodeArray.length) {
        return "purust_core::mk_bool(().init_int.unwrap() > (" + argsCodeArray[1] + ").init_int.unwrap())";
      }
      return "purust_core::mk_bool(().init_int.unwrap() > ().init_int.unwrap())";
    }
    if (mbLoop.tag === "Just" && fullName === mbLoop._1.name && m === mbLoop._1.params.length) {
      if (mbLoop.tag === "Just") {
        return "{\n" + joinWith("")(mapWithIndexArray((i) => (argCode) => "        let _tco_temp_" + showIntImpl(i) + " = " + argCode + ";\n")(argsCodeArray)) + joinWith("")(mapWithIndexArray((i) => (pName) => "        " + sanitizeIdent(pName) + " = _tco_temp_" + showIntImpl(i) + ";\n")(mbLoop._1.params)) + "        continue;\n    }";
      }
      return "";
    }
    if (member12(fullName === "main" ? "main" : fullName)(aritiesMap)) {
      const v$2 = lookup5(fullName === "main" ? "main" : fullName)(aritiesMap);
      const n = (() => {
        if (v$2.tag === "Just") {
          return getArity(v$2._1);
        }
        if (v$2.tag === "Nothing") {
          return 0;
        }
        fail();
      })();
      const $0 = lookup5(fullName === "main" ? "main" : fullName)(aritiesMap);
      const fnTy = (() => {
        if ($0.tag === "Nothing") {
          return Any;
        }
        if ($0.tag === "Just") {
          return $0._1;
        }
        fail();
      })();
      const v$3 = unwrapType(fnTy);
      const expectedArgTys = v$3.tag === "Func" ? v$3._1 : [];
      const boxedArgs = mapWithIndexArray((i) => (argCode) => boxUnbox(modNameStr)(i >= 0 && i < expectedArgTys.length ? expectedArgTys[i] : Any)(inferTypeExpr(modNameStr)(aritiesMap)(bound)(i >= 0 && i < argsArray.length ? argsArray[i] : $BackendSyntax("Var", $Qualified(Nothing, ""))))(argCode))(argsCodeArray);
      if (n > 0) {
        if (m === n) {
          return fullName + "(" + joinWith(", ")(boxedArgs) + ")";
        }
        if (m < n) {
          const v$4 = unwrapType(fnTy);
          const retTy = v$4.tag === "Func" ? v$4._2 : v$4;
          const missingCount = n - m | 0;
          const v$5 = unwrapType(fnTy);
          const $1 = v$5.tag === "Func" ? v$5._1 : [];
          const missingEtasTypes = m < 1 ? $1 : sliceImpl(m, $1.length, $1);
          const evalArgs = mapWithIndexArray((i) => (v23) => "eval_arg_" + showIntImpl(i))(argsCodeArray);
          const etaArgs = mapWithIndexArray((i) => (v23) => "eta_" + showIntImpl(i))(replicateImpl(missingCount, void 0));
          return boxUnbox(modNameStr)(appTy)($ExprType("Func", missingEtasTypes, retTy))("{\n" + joinWith("")(mapWithIndexArray((i) => (boxedArg) => "        let mut eval_arg_" + showIntImpl(i) + " = " + boxedArg + ";\n")(boxedArgs)) + "    purust_core::Func" + showIntImpl(missingCount) + "::Shared(std::rc::Rc::new(move |" + joinWith(", ")(mapWithIndexArray((i) => (eta) => "mut " + eta + ": " + codegenExprType(modNameStr)(false)(i >= 0 && i < missingEtasTypes.length ? missingEtasTypes[i] : Any))(etaArgs)) + "| -> " + codegenExprType(modNameStr)(true)(retTy) + " {\n" + joinWith("")(arrayMap((arg) => "    let mut " + arg + " = " + arg + ".clone();\n")(evalArgs)) + "    " + fullName + "(" + joinWith(", ")([
            ...evalArgs,
            ...mapWithIndexArray((i) => (eta) => eta + ".clone()")(etaArgs)
          ]) + ")\n}))\n}");
        }
        const v22 = buildCall(inferTypeExpr(modNameStr)(aritiesMap)(bound)(foldlArray((acc) => (v23) => $BackendSyntax(
          "App",
          acc,
          [$BackendSyntax("Var", $Qualified(Nothing, ""))]
        ))(fn)(n < 1 ? [] : sliceImpl(0, n, argsArray))))(fullName + "(" + joinWith(", ")(n < 1 ? [] : sliceImpl(0, n, boxedArgs)) + ")")(n);
        return boxUnbox(modNameStr)(appTy)(v22._1)(v22._2);
      }
      const v2 = buildCall(inferTypeExprGlobal(modNameStr)(aritiesMap)(globalClassFields)(bound)(fn))(fnCode)(0);
      return boxUnbox(modNameStr)(appTy)(v2._1)(v2._2);
    }
  }
  const v1 = buildCall(inferTypeExprGlobal(modNameStr)(aritiesMap)(globalClassFields)(bound)(fn))(fnCode)(0);
  return boxUnbox(modNameStr)(appTy)(v1._1)(v1._2);
};
var genAbs = (currentMod) => (allZeroArity) => (allMacroBindings) => (mbLoop) => (aritiesMap) => (globalClassFields) => (bound) => (alive) => (paramsArr) => (fnTy) => (body) => {
  const v = unwrapType(fnTy);
  const expectedRetTy = v.tag === "Func" ? v._2 : v;
  const v$1 = unwrapType(fnTy);
  const expectedArgTys = v$1.tag === "Func" ? v$1._1 : [];
  const newBound = foldrArray((v$2) => {
    const $0 = v$2._1;
    const $1 = v$2._2;
    return (b) => {
      if ($0 >= 0 && $0 < expectedArgTys.length) {
        const pTy = expectedArgTys[$0];
        if ($1 === "_") {
          return b;
        }
        return insert(ordString)(sanitizeIdent($1))(pTy)(b);
      }
      if ($1 === "_") {
        return b;
      }
      return insert(ordString)(sanitizeIdent($1))(Any)(b);
    };
  })(bound)(mapWithIndexArray(Tuple)(paramsArr));
  const capturedVars = unsafeDifference(ordString.compare, freeVariables(body), fromFoldable12(paramsArr));
  const arity = paramsArr.length;
  if (arity > 0 && arity <= 10 && arity === expectedArgTys.length) {
    const toCloneOutside2 = filterImpl(
      (v$2) => !member12(v$2)(aritiesMap) && !member2(v$2)(allZeroArity),
      fromFoldableImpl(foldableSet.foldr, unsafeIntersectionWith(ordString.compare, $$const, capturedVars, alive))
    );
    const remainingArgs = arity < 1 ? expectedArgTys : sliceImpl(arity, expectedArgTys.length, expectedArgTys);
    const outsideClonesCode2 = joinWith("")(arrayMap((v$2) => "    let mut " + sanitizeIdent(v$2) + " = " + sanitizeIdent(v$2) + ".clone();\n")(toCloneOutside2));
    const letBindingsAndDrops = foldrArray((v$2) => (st) => {
      if (v$2._2 === "_") {
        return { code: st.code + "    drop(_a" + showIntImpl(v$2._1) + ");\n", bound: st.bound };
      }
      if (member2(v$2._2)(st.bound)) {
        return { code: st.code + "    drop(_a" + showIntImpl(v$2._1) + ");\n", bound: st.bound };
      }
      const newBound1 = insert(ordString)(v$2._2)()(st.bound);
      if (member2(v$2._2)(freeVariables(body))) {
        return { code: "    let mut " + sanitizeIdent(v$2._2) + " = _a" + showIntImpl(v$2._1) + ";\n" + st.code, bound: newBound1 };
      }
      return { code: st.code + "    drop(_a" + showIntImpl(v$2._1) + ");\n", bound: newBound1 };
    })({ code: "", bound: Leaf })(mapWithIndexArray(Tuple)(paramsArr)).code;
    const innermostExpectedRetTy = remainingArgs.length > 0 ? $ExprType("Func", remainingArgs, expectedRetTy) : expectedRetTy;
    const retTyStr = codegenExprType(currentMod)(true)(innermostExpectedRetTy);
    const boxedBody = boxUnbox(currentMod)(innermostExpectedRetTy)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(newBound)(body))((() => {
      const oldCaptured = globalCaptured.value;
      const $0 = globalCaptured.value;
      globalCaptured.value = unsafeUnionWith(ordString.compare, $$const, capturedVars, $0);
      globalCaptured.value = oldCaptured;
      return codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(newBound)(capturedVars)(false)(body);
    })());
    const argsCode = joinWith(", ")(mapWithIndexArray((i) => (p) => "mut _a" + showIntImpl(i) + ": " + codegenExprType(currentMod)(false)(i >= 0 && i < expectedArgTys.length ? expectedArgTys[i] : Any))(paramsArr));
    const closureCode = filterKeys(ordString)((v$2) => !member12(v$2)(aritiesMap) && !member2(v$2)(allZeroArity))(capturedVars).tag === "Leaf" ? "purust_core::Func" + showIntImpl(arity) + "::Static(|" + argsCode + "| -> " + retTyStr + " {\n" + letBindingsAndDrops + "    " + boxedBody + "\n} as fn(" + joinWith(", ")(arrayMap((v$2) => codegenExprType(currentMod)(false)(v$2._1 >= 0 && v$2._1 < expectedArgTys.length ? expectedArgTys[v$2._1] : Any))(mapWithIndexArray(Tuple)(paramsArr))) + ") -> " + retTyStr + ")" : "purust_core::Func" + showIntImpl(arity) + "::Shared(std::rc::Rc::new(move |" + argsCode + "| -> " + retTyStr + " {\n" + letBindingsAndDrops + "    " + boxedBody + "\n}))";
    if (toCloneOutside2.length > 0) {
      return "{\n" + outsideClonesCode2 + "    " + closureCode + "\n}";
    }
    return closureCode;
  }
  const finalState = foldrArray((v$2) => {
    const $0 = v$2._1;
    const $1 = v$2._2;
    return (st) => {
      const $2 = $0 + 1 | 0;
      const remainingArgTys = $2 < 1 ? expectedArgTys : sliceImpl($2, expectedArgTys.length, expectedArgTys);
      const retTyStr = codegenExprType(currentMod)(true)(remainingArgTys.length > 0 ? $ExprType("Func", remainingArgTys, expectedRetTy) : expectedRetTy);
      const $3 = $0 >= 0 && $0 < expectedArgTys.length ? $Maybe("Just", expectedArgTys[$0]) : Nothing;
      const pTy = (() => {
        if ($3.tag === "Nothing") {
          return Any;
        }
        if ($3.tag === "Just") {
          return $3._1;
        }
        fail();
      })();
      const pCode = "mut _a0: " + codegenExprType(currentMod)(false)(pTy);
      const pIsUsed = member2($1)(st.freeVars);
      const thisClosureCaptures = $$delete(ordString)($1)(st.freeVars);
      const letBindingAndDrop = (() => {
        if ($1 === "_") {
          return "    drop(_a0);\n";
        }
        if (pIsUsed) {
          return "    let mut " + sanitizeIdent($1) + " = _a0;\n";
        }
        return "    drop(_a0);\n";
      })();
      const clonesCode = joinWith("")(arrayMap((v1) => "    let mut " + sanitizeIdent(v1) + " = " + sanitizeIdent(v1) + ".clone();\n")(filterImpl(
        (v1) => !member12(v1)(aritiesMap) && !member2(v1)(allZeroArity),
        fromFoldableImpl(foldableSet.foldr, thisClosureCaptures)
      )));
      return {
        freeVars: thisClosureCaptures,
        isInnermost: false,
        code: filterKeys(ordString)((v1) => !member12(v1)(aritiesMap) && !member2(v1)(allZeroArity))(thisClosureCaptures).tag === "Leaf" ? "purust_core::Func1::Static(|" + pCode + "| -> " + retTyStr + " {\n" + clonesCode + letBindingAndDrop + "    " + st.code + "\n} as fn(" + codegenExprType(currentMod)(false)(pTy) + ") -> " + retTyStr + ")" : "purust_core::Func1::Shared(std::rc::Rc::new(move |" + pCode + "| -> " + retTyStr + " {\n" + clonesCode + letBindingAndDrop + "    " + st.code + "\n}))"
      };
    };
  })({
    freeVars: freeVariables(body),
    isInnermost: true,
    code: (() => {
      const $0 = paramsArr.length;
      const remainingArgs = $0 < 1 ? expectedArgTys : sliceImpl($0, expectedArgTys.length, expectedArgTys);
      return boxUnbox(currentMod)(remainingArgs.length > 0 ? $ExprType("Func", remainingArgs, expectedRetTy) : expectedRetTy)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(newBound)(body))((() => {
        const oldCaptured = globalCaptured.value;
        const $1 = globalCaptured.value;
        globalCaptured.value = unsafeUnionWith(ordString.compare, $$const, capturedVars, $1);
        globalCaptured.value = oldCaptured;
        return codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(newBound)(capturedVars)(false)(body);
      })());
    })()
  })(mapWithIndexArray(Tuple)(paramsArr));
  const toCloneOutside = filterImpl(
    (v$2) => !member12(v$2)(aritiesMap) && !member2(v$2)(allZeroArity),
    fromFoldableImpl(
      foldableSet.foldr,
      unsafeIntersectionWith(ordString.compare, $$const, finalState.freeVars, alive)
    )
  );
  const outsideClonesCode = joinWith("")(arrayMap((v$2) => "let mut " + sanitizeIdent(v$2) + " = " + sanitizeIdent(v$2) + ".clone();\n    ")(toCloneOutside));
  if (toCloneOutside.length > 0) {
    return "{\n    " + outsideClonesCode + finalState.code + "\n}";
  }
  return finalState.code;
};
var codegenExpr_ = (currentMod) => (allZeroArity) => (allMacroBindings) => (mbLoop) => (aritiesMap) => (globalClassFields) => (bound) => (alive) => (inEffectBlock) => (v) => {
  const isEffectNode = (v1) => {
    if (v1.tag === "EffectBind") {
      return true;
    }
    if (v1.tag === "EffectPure") {
      return true;
    }
    if (v1.tag === "PrimEffect") {
      return true;
    }
    if (v1.tag === "UncurriedEffectApp") {
      return true;
    }
    if (v1.tag === "Let") {
      return isEffectNode(v1._4);
    }
    if (v1.tag === "LetRec") {
      return isEffectNode(v1._3);
    }
    if (v1.tag === "Typed") {
      return isEffectNode(v1._2);
    }
    return v1.tag === "EffectDefer" && isEffectNode(v1._1);
  };
  if (isEffectNode(v) && !inEffectBlock) {
    const freeVars = freeVariables(v);
    const insideClonesCode = "// FREEVARS: " + joinWith(", ")(fromFoldableImpl(foldableSet.foldr, freeVars)) + "\n" + joinWith("")(arrayMap((v1) => "    let mut " + sanitizeIdent(v1) + " = " + sanitizeIdent(v1) + ".clone();\n")(filterImpl(
      (v1) => !member12(v1)(aritiesMap) && !member2(v1)(allZeroArity),
      fromFoldableImpl(foldableSet.foldr, freeVars)
    )));
    const toCloneOutside = filterImpl(
      (v1) => !member12(v1)(aritiesMap) && !member2(v1)(allZeroArity),
      fromFoldableImpl(foldableSet.foldr, unsafeIntersectionWith(ordString.compare, $$const, freeVars, alive))
    );
    const outsideClonesCode = joinWith("")(arrayMap((v1) => "let mut " + sanitizeIdent(v1) + " = " + sanitizeIdent(v1) + ".clone();\n    ")(toCloneOutside));
    const bodyCode = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(freeVars)(true)(v);
    if (toCloneOutside.length > 0) {
      return "{\n    " + outsideClonesCode + "crate::Value::Func1(purust_core::Func1::Shared(std::rc::Rc::new(move |mut _u: crate::UnknownType| -> crate::UnknownType {\n" + insideClonesCode + "        " + bodyCode + "\n    })))\n}";
    }
    return "{\n    crate::Value::Func1(purust_core::Func1::Shared(std::rc::Rc::new(move |mut _u: crate::UnknownType| -> crate::UnknownType {\n" + insideClonesCode + "        " + bodyCode + "\n    })))\n}";
  }
  if (v.tag === "Typed") {
    const stripTyped = (stripTyped$a0$copy) => {
      let stripTyped$a0 = stripTyped$a0$copy, stripTyped$c = true, stripTyped$r;
      while (stripTyped$c) {
        const v1 = stripTyped$a0;
        if (v1.tag === "Typed") {
          stripTyped$a0 = v1._2;
          continue;
        }
        stripTyped$c = false;
        stripTyped$r = v1;
      }
      return stripTyped$r;
    };
    const inner = stripTyped(v._2);
    if (inner.tag === "Abs") {
      const v$1 = unwrapType(v._1);
      const argTys = v$1.tag === "Func" ? v$1._1 : [];
      const v2 = extractAbsParams(argTys.length)(v._2);
      if (v2.tag === "Just") {
        return "/* Typed Abs */" + boxUnbox(currentMod)(v._1)((() => {
          const v$2 = unwrapType(v._1);
          const retTy = v$2.tag === "Func" ? v$2._2 : v$2;
          const $0 = v2._1._1.length;
          const remainingArgTys = $0 < 1 ? argTys : sliceImpl($0, argTys.length, argTys);
          return $ExprType(
            "Func",
            mapWithIndexArray((i) => (v2$1) => {
              if (i >= 0 && i < argTys.length) {
                return argTys[i];
              }
              return Any;
            })(v2._1._1),
            remainingArgTys.length > 0 ? $ExprType("Func", remainingArgTys, retTy) : retTy
          );
        })())(genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(v2._1._1)(v._1)(v2._1._2));
      }
      if (v2.tag === "Nothing") {
        return "/* Typed Abs */" + boxUnbox(currentMod)(v._1)((() => {
          const v$2 = unwrapType(v._1);
          const retTy = v$2.tag === "Func" ? v$2._2 : v$2;
          const $0 = arrayMap((v3) => {
            if (v3._1.tag === "Just") {
              return sanitizeIdent(v3._1._1);
            }
            if (v3._1.tag === "Nothing") {
              return "lvl_" + showIntImpl(v3._2);
            }
            fail();
          })(inner._1).length;
          const remainingArgTys = $0 < 1 ? argTys : sliceImpl($0, argTys.length, argTys);
          return $ExprType(
            "Func",
            mapWithIndexArray((i) => (v2$1) => {
              if (i >= 0 && i < argTys.length) {
                return argTys[i];
              }
              return Any;
            })(arrayMap((v3) => {
              if (v3._1.tag === "Just") {
                return sanitizeIdent(v3._1._1);
              }
              if (v3._1.tag === "Nothing") {
                return "lvl_" + showIntImpl(v3._2);
              }
              fail();
            })(inner._1)),
            remainingArgTys.length > 0 ? $ExprType("Func", remainingArgTys, retTy) : retTy
          );
        })())(genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(arrayMap((v3) => {
          if (v3._1.tag === "Just") {
            return sanitizeIdent(v3._1._1);
          }
          if (v3._1.tag === "Nothing") {
            return "lvl_" + showIntImpl(v3._2);
          }
          fail();
        })(inner._1))(v._1)(inner._2));
      }
      fail();
    }
    if (inner.tag === "UncurriedAbs") {
      const paramsArr = arrayMap((v1) => {
        if (v1._1.tag === "Just") {
          return sanitizeIdent(v1._1._1);
        }
        if (v1._1.tag === "Nothing") {
          return "lvl_" + showIntImpl(v1._2);
        }
        fail();
      })(inner._1);
      return "/* Typed UncurriedAbs */" + boxUnbox(currentMod)(v._1)((() => {
        const v$1 = unwrapType(v._1);
        const retTy = v$1.tag === "Func" ? v$1._2 : v$1;
        const v$2 = unwrapType(v._1);
        const argTys = v$2.tag === "Func" ? v$2._1 : [];
        const $0 = paramsArr.length;
        const remainingArgTys = $0 < 1 ? argTys : sliceImpl($0, argTys.length, argTys);
        return $ExprType(
          "Func",
          mapWithIndexArray((i) => (v1) => {
            if (i >= 0 && i < argTys.length) {
              return argTys[i];
            }
            return Any;
          })(paramsArr),
          remainingArgTys.length > 0 ? $ExprType("Func", remainingArgTys, retTy) : retTy
        );
      })())(genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(paramsArr)(v._1)(inner._2));
    }
    if (inner.tag === "UncurriedEffectAbs") {
      const paramsArr = arrayMap((v1) => {
        if (v1._1.tag === "Just") {
          return sanitizeIdent(v1._1._1);
        }
        if (v1._1.tag === "Nothing") {
          return "lvl_" + showIntImpl(v1._2);
        }
        fail();
      })(inner._1);
      return "/* Typed UncurriedEffectAbs */" + boxUnbox(currentMod)(v._1)((() => {
        const v$1 = unwrapType(v._1);
        const retTy = v$1.tag === "Func" ? v$1._2 : v$1;
        const v$2 = unwrapType(v._1);
        const argTys = v$2.tag === "Func" ? v$2._1 : [];
        const $0 = paramsArr.length;
        const remainingArgTys = $0 < 1 ? argTys : sliceImpl($0, argTys.length, argTys);
        return $ExprType(
          "Func",
          mapWithIndexArray((i) => (v1) => {
            if (i >= 0 && i < argTys.length) {
              return argTys[i];
            }
            return Any;
          })(paramsArr),
          remainingArgTys.length > 0 ? $ExprType("Func", remainingArgTys, retTy) : retTy
        );
      })())(genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(paramsArr)(v._1)(inner._2));
    }
    if (inner.tag === "Lit" && inner._1.tag === "LitRecord") {
      const v1 = unwrapType(v._1);
      if (v1.tag === "ADT" && v1._2.length >= 2) {
        const propsArr = fromFoldableImpl(foldrArray, inner._1._1);
        const modName = joinWith("_")((() => {
          const $0 = v1._2.length - 1 | 0;
          if ($0 < 1) {
            return [];
          }
          return sliceImpl(0, $0, v1._2);
        })());
        const className = sanitizeIdent((() => {
          const $0 = v1._2.length - 1 | 0;
          if ($0 >= 0 && $0 < v1._2.length) {
            return v1._2[$0];
          }
          return "Unknown";
        })());
        return (modName === currentMod ? "std::rc::Rc::new(crate::" + className + " { " : "std::rc::Rc::new(Purs_" + modName + "::" + className + " { ") + joinWith(", ")(mapWithIndexArray((i) => (v2) => {
          const $0 = v2._1;
          const valTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v2._2);
          const $1 = unwrapType(v._1);
          const expectedTy = (() => {
            if ($1.tag === "ADT") {
              const mbDecl = lookup5((() => {
                const $2 = $1._2.length - 1 | 0;
                return joinWith("_")((() => {
                  const $3 = $1._2.length - 1 | 0;
                  if ($3 < 1) {
                    return [];
                  }
                  return sliceImpl(0, $3, $1._2);
                })()) + "_" + ($2 >= 0 && $2 < $1._2.length ? $1._2[$2] : "");
              })())(globalClassFields);
              if (mbDecl.tag === "Just") {
                const v5 = find((v6) => v6._1 === sanitizeIdent($0))(mbDecl._1);
                if (v5.tag === "Just") {
                  return v5._1._2;
                }
                if (v5.tag === "Nothing") {
                  return valTy;
                }
                fail();
              }
              if (mbDecl.tag === "Nothing") {
                return valTy;
              }
              fail();
            }
            return valTy;
          })();
          const valCode = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
            ordString.compare,
            $$const,
            alive,
            foldlArray((acc) => (v3) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v3._2)))(Leaf)((() => {
              const $2 = i + 1 | 0;
              if ($2 < 1) {
                return propsArr;
              }
              return sliceImpl($2, propsArr.length, propsArr);
            })())
          ))(false)(v2._2);
          return _trace(
            "LITRECORD expStr=" + codegenExprType(currentMod)(true)(expectedTy) + ", actStr=" + codegenExprType(currentMod)(true)(valTy) + " for " + $0,
            (v3) => sanitizeIdent($0) + ": " + boxUnbox(currentMod)(expectedTy)(valTy)(valCode)
          );
        })(propsArr)) + " })";
      }
      const innerTy2 = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(inner);
      return "/* Typed " + codegenExprType(currentMod)(true)(v._1) + " <- " + codegenExprType(currentMod)(true)(innerTy2) + " : " + printAST(inner) + " */" + boxUnbox(currentMod)(v._1)(innerTy2)(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inEffectBlock)(inner));
    }
    const innerTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(inner);
    return "/* Typed " + codegenExprType(currentMod)(true)(v._1) + " <- " + codegenExprType(currentMod)(true)(innerTy) + " : " + printAST(inner) + " */" + boxUnbox(currentMod)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)($BackendSyntax(
      "Typed",
      v._1,
      inner
    )))(innerTy)(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inEffectBlock)(inner));
  }
  if (v.tag === "App") {
    return genApp(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)($BackendSyntax(
      "App",
      v._1,
      v._2
    )))(v._1)(v._2);
  }
  if (v.tag === "UncurriedApp") {
    return genApp(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)($BackendSyntax(
      "UncurriedApp",
      v._1,
      v._2
    )))(v._1)(v._2);
  }
  if (v.tag === "UncurriedEffectApp") {
    const $0 = v._2;
    const $1 = v._1;
    const $2 = () => genApp(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)($BackendSyntax(
      "UncurriedEffectApp",
      $1,
      $0
    )))($1)($0);
    if ($1.tag === "Typed") {
      if ($1._2.tag === "Accessor") {
        if ($1._2._2.tag === "GetProp" && $1._2._2._1 === "logRecord") {
          if (0 < $0.length) {
            return 'println!("{}", ' + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)($0[0]) + ".a);";
          }
          return "// Unsupported UncurriedEffectApp without args\n";
        }
        return $2();
      }
      if ($1._2.tag === "Var" && $1._2._1._2 === "logRecord") {
        if (0 < $0.length) {
          return 'println!("{}", ' + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)($0[0]) + ".a);";
        }
        return "// Unsupported UncurriedEffectApp without args\n";
      }
      return $2();
    }
    if ($1.tag === "Accessor") {
      if ($1._2.tag === "GetProp" && $1._2._1 === "logRecord") {
        if (0 < $0.length) {
          return 'println!("{}", ' + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)($0[0]) + ".a);";
        }
        return "// Unsupported UncurriedEffectApp without args\n";
      }
      return $2();
    }
    if ($1.tag === "Var" && $1._1._2 === "logRecord") {
      if (0 < $0.length) {
        return 'println!("{}", ' + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)($0[0]) + ".a);";
      }
      return "// Unsupported UncurriedEffectApp without args\n";
    }
    return $2();
  }
  if (v.tag === "Update") {
    const $0 = v._2;
    return "{\n    let mut _base = " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      foldlArray((acc) => (v1) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v1._2)))(Leaf)($0)
    ))(false)(v._1) + ";\n    " + joinWith("\n    ")(mapWithIndexArray((i) => (v1) => "_base.set_" + sanitizeIdent(v1._1) + "(" + boxUnbox(currentMod)(Any)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v1._2))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      foldlArray((acc) => (v3) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v3._2)))(Leaf)((() => {
        const $1 = i + 1 | 0;
        if ($1 < 1) {
          return $0;
        }
        return sliceImpl($1, $0.length, $0);
      })())
    ))(false)(v1._2)) + ");")($0)) + "\n    _base\n}";
  }
  if (v.tag === "Branch") {
    const $0 = v._1;
    const $1 = v._2;
    return joinWith(" else ")(mapWithIndexArray((i) => (v1) => "if " + boxUnbox(currentMod)($$Boolean)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v1._1))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      unsafeUnionWith(
        ordString.compare,
        $$const,
        freeVariables(v1._2),
        foldlArray((acc) => (v2) => unsafeUnionWith(
          ordString.compare,
          $$const,
          acc,
          unsafeUnionWith(ordString.compare, $$const, freeVariables(v2._1), freeVariables(v2._2))
        ))(freeVariables($1))((() => {
          const $2 = i + 1 | 0;
          if ($2 < 1) {
            return $0;
          }
          return sliceImpl($2, $0.length, $0);
        })())
      )
    ))(false)(v1._1)) + " {\n        " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v1._2) + "\n    }")($0)) + " else {\n        " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(false)($1) + "\n    }";
  }
  if (v.tag === "PrimOp") {
    if (v._1.tag === "Op1") {
      const aTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1._2);
      const aStrRaw = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v._1._2);
      if (v._1._1.tag === "OpBooleanNot") {
        return "!(" + boxUnbox(currentMod)($$Boolean)(aTy)(aStrRaw) + " /* aTy: " + codegenExprType(currentMod)(true)(aTy) + ", a is " + printAST(v._1._2) + ", fn ty is " + (() => {
          if (v._1._2.tag === "App") {
            const v1 = lookup5("lvl_3")(bound);
            const v1$1 = lookup5("lvl_3")(aritiesMap);
            return printType(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1._2._1)) + ", lvl_3 in bound: " + (() => {
              if (v1.tag === "Just") {
                return printType(v1._1);
              }
              if (v1.tag === "Nothing") {
                return "none";
              }
              fail();
            })() + ", lvl_3 in arities: " + (() => {
              if (v1$1.tag === "Just") {
                return printType(v1$1._1);
              }
              if (v1$1.tag === "Nothing") {
                return "none";
              }
              fail();
            })();
          }
          return "not app";
        })() + " */)";
      }
      if (v._1._1.tag === "OpIntBitNot") {
        return "!(" + boxUnbox(currentMod)(Int)(aTy)(aStrRaw) + ")";
      }
      if (v._1._1.tag === "OpIntNegate") {
        return "-(" + boxUnbox(currentMod)(Int)(aTy)(aStrRaw) + ")";
      }
      if (v._1._1.tag === "OpNumberNegate") {
        return "-(" + boxUnbox(currentMod)($$Number)(aTy)(aStrRaw) + ")";
      }
      if (v._1._1.tag === "OpArrayLength") {
        return "((" + boxUnbox(currentMod)(Any)(aTy)(aStrRaw) + ").unwrap_array().len() as i64)";
      }
      if (v._1._1.tag === "OpIsTag") {
        const v1 = unwrapType(aTy);
        if (v1.tag === "ADT") {
          const modName = replaceAll(".")("_")(joinWith("_")((() => {
            const $02 = v1._2.length - 1 | 0;
            if ($02 < 1) {
              return [];
            }
            return sliceImpl(0, $02, v1._2);
          })()));
          const cName = sanitizeIdent(v._1._1._1._2);
          const prefixedKey = modName + "_" + cName;
          const lookupRes = lookup5(prefixedKey)(aritiesMap);
          const $0 = v1._2.length - 1 | 0;
          if ($0 >= 0 && $0 < v1._2.length) {
            const actualClassName = v1._2[$0];
            return "/* OpIsTag Debug: " + prefixedKey + " -> " + (() => {
              if (lookupRes.tag === "Just") {
                return printType(lookupRes._1);
              }
              if (lookupRes.tag === "Nothing") {
                return "Nothing";
              }
              fail();
            })() + " */ matches!((" + boxUnbox(currentMod)($ExprType("ADT", v1._1, v1._2, []))(aTy)(aStrRaw) + ").as_ref(), " + (modName === currentMod ? "crate::" + sanitizeIdent(actualClassName) : "Purs_" + modName + "::" + sanitizeIdent(actualClassName)) + "::" + cName + (lookupRes.tag === "Just" && unwrapType(lookupRes._1).tag === "Func" ? "(..)" : "") + ")";
          }
          return "/* OpIsTag Debug: " + prefixedKey + " -> " + (() => {
            if (lookupRes.tag === "Just") {
              return printType(lookupRes._1);
            }
            if (lookupRes.tag === "Nothing") {
              return "Nothing";
            }
            fail();
          })() + " */ matches!((" + boxUnbox(currentMod)($ExprType("ADT", v1._1, v1._2, []))(aTy)(aStrRaw) + ").as_ref(), " + (modName === currentMod ? "crate::" + sanitizeIdent(v1._1) : "Purs_" + modName + "::" + sanitizeIdent(v1._1)) + "::" + cName + (lookupRes.tag === "Just" && unwrapType(lookupRes._1).tag === "Func" ? "(..)" : "") + ")";
        }
        return "(" + boxUnbox(currentMod)(Any)(aTy)(aStrRaw) + '.get_tag() == "' + v._1._1._1._2 + '")';
      }
      return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op1 */";
    }
    if (v._1.tag === "Op2") {
      const bTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1._3);
      const bStrRaw = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v._1._3);
      const bStrStr = boxUnbox(currentMod)($$String)(bTy)(bStrRaw);
      const bStrNum = boxUnbox(currentMod)($$Number)(bTy)(bStrRaw);
      const bStrInt = boxUnbox(currentMod)(Int)(bTy)(bStrRaw);
      const bStrBool = boxUnbox(currentMod)($$Boolean)(bTy)(bStrRaw);
      const aTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1._2);
      const aStrRaw = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
        ordString.compare,
        $$const,
        alive,
        freeVariables(v._1._3)
      ))(false)(v._1._2);
      const aStrStr = boxUnbox(currentMod)($$String)(aTy)(aStrRaw);
      const aStrNum = boxUnbox(currentMod)($$Number)(aTy)(aStrRaw);
      const aStrInt = boxUnbox(currentMod)(Int)(aTy)(aStrRaw);
      const aStrBool = boxUnbox(currentMod)($$Boolean)(aTy)(aStrRaw);
      if (v._1._1.tag === "OpIntNum") {
        if (v._1._1._1 === "OpAdd") {
          return "(" + aStrInt + " + " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpSubtract") {
          return "(" + aStrInt + " - " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpMultiply") {
          return "(" + aStrInt + " * " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpDivide") {
          return "(" + aStrInt + " / " + bStrInt + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpIntBitAnd") {
        return "(" + aStrInt + " & " + bStrInt + ")";
      }
      if (v._1._1.tag === "OpIntBitOr") {
        return "(" + aStrInt + " | " + bStrInt + ")";
      }
      if (v._1._1.tag === "OpIntBitXor") {
        return "(" + aStrInt + " ^ " + bStrInt + ")";
      }
      if (v._1._1.tag === "OpIntBitShiftLeft") {
        return "(" + aStrInt + " << " + bStrInt + ")";
      }
      if (v._1._1.tag === "OpIntBitShiftRight") {
        return "(" + aStrInt + " >> " + bStrInt + ")";
      }
      if (v._1._1.tag === "OpIntBitZeroFillShiftRight") {
        return "((" + aStrInt + " as u64 >> " + bStrInt + " as u64) as i64)";
      }
      if (v._1._1.tag === "OpIntOrd") {
        if (v._1._1._1 === "OpEq") {
          return "(" + aStrInt + " == " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpNotEq") {
          return "(" + aStrInt + " != " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpGt") {
          return "(" + aStrInt + " > " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpGte") {
          return "(" + aStrInt + " >= " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpLt") {
          return "(" + aStrInt + " < " + bStrInt + ")";
        }
        if (v._1._1._1 === "OpLte") {
          return "(" + aStrInt + " <= " + bStrInt + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpNumberOrd") {
        if (v._1._1._1 === "OpEq") {
          return "(" + aStrNum + " == " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpNotEq") {
          return "(" + aStrNum + " != " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpGt") {
          return "(" + aStrNum + " > " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpGte") {
          return "(" + aStrNum + " >= " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpLt") {
          return "(" + aStrNum + " < " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpLte") {
          return "(" + aStrNum + " <= " + bStrNum + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpStringOrd") {
        if (v._1._1._1 === "OpEq") {
          return "(" + aStrStr + " == " + bStrStr + ")";
        }
        if (v._1._1._1 === "OpNotEq") {
          return "(" + aStrStr + " != " + bStrStr + ")";
        }
        if (v._1._1._1 === "OpGt") {
          return "(" + aStrStr + " > " + bStrStr + ")";
        }
        if (v._1._1._1 === "OpGte") {
          return "(" + aStrStr + " >= " + bStrStr + ")";
        }
        if (v._1._1._1 === "OpLt") {
          return "(" + aStrStr + " < " + bStrStr + ")";
        }
        if (v._1._1._1 === "OpLte") {
          return "(" + aStrStr + " <= " + bStrStr + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpCharOrd") {
        if (v._1._1._1 === "OpEq") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " == " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        if (v._1._1._1 === "OpNotEq") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " != " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        if (v._1._1._1 === "OpGt") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " > " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        if (v._1._1._1 === "OpGte") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " >= " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        if (v._1._1._1 === "OpLt") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " < " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        if (v._1._1._1 === "OpLte") {
          return "(" + boxUnbox(currentMod)(Char)(aTy)(aStrRaw) + " <= " + boxUnbox(currentMod)(Char)(bTy)(bStrRaw) + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpBooleanOrd") {
        if (v._1._1._1 === "OpEq") {
          return "(" + aStrBool + " == " + bStrBool + ")";
        }
        if (v._1._1._1 === "OpNotEq") {
          return "(" + aStrBool + " != " + bStrBool + ")";
        }
        if (v._1._1._1 === "OpGt") {
          return "(" + aStrBool + " > " + bStrBool + ")";
        }
        if (v._1._1._1 === "OpGte") {
          return "(" + aStrBool + " >= " + bStrBool + ")";
        }
        if (v._1._1._1 === "OpLt") {
          return "(" + aStrBool + " < " + bStrBool + ")";
        }
        if (v._1._1._1 === "OpLte") {
          return "(" + aStrBool + " <= " + bStrBool + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpBooleanAnd") {
        return "(" + aStrBool + " && " + bStrBool + ")";
      }
      if (v._1._1.tag === "OpBooleanOr") {
        return "(" + aStrBool + " || " + bStrBool + ")";
      }
      if (v._1._1.tag === "OpArrayIndex") {
        return "(" + boxUnbox(currentMod)(Any)(aTy)(aStrRaw) + ").unwrap_array()[(" + bStrInt + ") as usize].clone()";
      }
      if (v._1._1.tag === "OpNumberNum") {
        if (v._1._1._1 === "OpAdd") {
          return "(" + aStrNum + " + " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpSubtract") {
          return "(" + aStrNum + " - " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpMultiply") {
          return "(" + aStrNum + " * " + bStrNum + ")";
        }
        if (v._1._1._1 === "OpDivide") {
          return "(" + aStrNum + " / " + bStrNum + ")";
        }
        return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
      }
      if (v._1._1.tag === "OpStringAppend") {
        return 'format!("{}{}", ' + aStrStr + ", " + bStrStr + ")";
      }
      return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */";
    }
    return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Expr: " + printAST(v) + " */";
  }
  if (v.tag === "Accessor") {
    if (v._2.tag === "GetProp") {
      const baseTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1);
      const baseStr = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v._1);
      return boxUnbox(currentMod)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v))(unwrapType(baseTy).tag === "ADT" ? inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v) : Any)(unwrapType(baseTy).tag === "ADT" ? "(" + baseStr + ")." + sanitizeIdent(v._2._1) + ".clone()" : "(" + baseStr + ").get_" + sanitizeIdent(v._2._1) + "()");
    }
    if (v._2.tag === "GetCtorField") {
      const $0 = v._2._6;
      const modName = (() => {
        if (v._2._1._1.tag === "Just") {
          return replaceAll(".")("_")(v._2._1._1._1);
        }
        if (v._2._1._1.tag === "Nothing") {
          return currentMod;
        }
        fail();
      })();
      return (modName === currentMod ? "{ if let crate::" + sanitizeIdent(v._2._3) + "::" : "{ if let Purs_" + modName + "::" + sanitizeIdent(v._2._3) + "::") + sanitizeIdent(v._2._4) + "(" + joinWith(", ")(arrayMap((i) => {
        if (i === $0) {
          return "ref f";
        }
        return "_";
      })(rangeImpl(0, $0))) + ($0 >= 0 ? ", .." : "") + ") = (" + boxUnbox(currentMod)($ExprType(
        "ADT",
        v._2._3,
        [modName, v._2._3],
        []
      ))(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._1))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v._1)) + ").as_ref() { f.clone() } else { unreachable!() } }";
    }
    return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Expr: " + printAST(v) + " */";
  }
  if (v.tag === "Var") {
    const sName = sanitizeIdent(v._1._2);
    const v2 = lookup5(sName)(bound);
    if (v2.tag === "Just") {
      const varCode = unwrapType(v2._1).tag === "Func" ? sName : sName + "()";
      if (member2(sName)(alive)) {
        return varCode + ".clone()";
      }
      return varCode;
    }
    if (v2.tag === "Nothing") {
      const fullName = (() => {
        if (v._1._1.tag === "Just") {
          return replaceAll(".")("_")(v._1._1._1) + "_";
        }
        if (v._1._1.tag === "Nothing") {
          return replaceAll(".")("_")(currentMod) + "_";
        }
        fail();
      })() + sanitizeIdent(v._1._2);
      const v3 = lookup5(fullName === "main" ? "main" : fullName)(aritiesMap);
      const expectedArgsLength = (() => {
        if (v3.tag === "Just") {
          return getArity(v3._1);
        }
        if (v3.tag === "Nothing") {
          return 0;
        }
        fail();
      })();
      const varCode = expectedArgsLength === 0 ? fullName + "()" : "purust_core::Func" + showIntImpl(expectedArgsLength) + "::Static(" + fullName + ")";
      if (member2(fullName)(alive)) {
        return varCode + ".clone()";
      }
      return varCode;
    }
    fail();
  }
  if (v.tag === "Let") {
    const name2 = (() => {
      if (v._1.tag === "Just") {
        return sanitizeIdent(v._1._1);
      }
      if (v._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v._2);
      }
      fail();
    })();
    const bodyVars = freeVariables(v._4);
    return "{\n    let mut " + name2 + " = " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      bodyVars
    ))(false)(v._3) + ";\n" + (member2(name2)(bodyVars) ? "" : "    drop(" + name2 + ");\n") + "    " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop.tag === "Just" && mbLoop._1.name === name2 ? Nothing : mbLoop)(aritiesMap)(globalClassFields)(insert(ordString)(name2)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._3))(bound))(alive)(inEffectBlock)(v._4) + "\n}";
  }
  if (v.tag === "EffectBind") {
    const stripEffectDefer = (v12) => {
      if (v12.tag === "EffectDefer") {
        return stripEffectDefer(v12._1);
      }
      if (v12.tag === "Abs") {
        return stripEffectDefer(v12._2);
      }
      if (v12.tag === "UncurriedEffectAbs") {
        return stripEffectDefer(v12._2);
      }
      if (v12.tag === "Let") {
        return $BackendSyntax("Let", v12._1, v12._2, v12._3, stripEffectDefer(v12._4));
      }
      if (v12.tag === "LetRec") {
        return $BackendSyntax("LetRec", v12._1, v12._2, stripEffectDefer(v12._3));
      }
      if (v12.tag === "Typed") {
        return $BackendSyntax("Typed", v12._1, stripEffectDefer(v12._2));
      }
      return v12;
    };
    const realVal = stripEffectDefer(v._3);
    const name2 = (() => {
      if (v._1.tag === "Just") {
        return sanitizeIdent(v._1._1);
      }
      if (v._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v._2);
      }
      fail();
    })();
    const isUncurriedApp = (v12) => {
      if (v12.tag === "UncurriedEffectApp") {
        return true;
      }
      if (v12.tag === "PrimEffect") {
        return true;
      }
      if (v12.tag === "EffectBind") {
        return true;
      }
      if (v12.tag === "Let") {
        return isUncurriedApp(v12._4);
      }
      if (v12.tag === "LetRec") {
        return isUncurriedApp(v12._3);
      }
      return v12.tag === "Typed" && isUncurriedApp(v12._2);
    };
    const v1 = unwrapType(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v._3));
    const boundTy = v1.tag === "ADT" && v1._3.length === 1 ? v1._3[0] : Any;
    const rawBodyCode = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop.tag === "Just" && mbLoop._1.name === name2 ? Nothing : mbLoop)(aritiesMap)(globalClassFields)(insert(ordString)(name2)(boundTy)(bound))(alive)(inEffectBlock)(v._4);
    const rawValCode = codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
      ordString.compare,
      $$const,
      alive,
      freeVariables(v._4)
    ))(true)(realVal);
    return "{\n    let mut " + name2 + " = " + boxUnbox(currentMod)(boundTy)(Any)(isUncurriedApp(realVal) ? rawValCode : "{\n        let _val_eval = " + rawValCode + ";\n        if let crate::Value::Func1(purust_core::Func1::Shared(f)) = &_val_eval {\n            f(crate::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() })))\n        } else if let crate::Value::Record_a(r) = &_val_eval {\n            if r.call.is_some() {\n                r.call.clone().unwrap()(crate::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() })))\n            } else {\n                _val_eval\n            }\n        } else {\n            _val_eval\n        }\n    }") + ";\n" + (member2(name2)(freeVariables(v._4)) ? "" : "    drop(" + name2 + ");\n") + "    " + (isEffectNode(v._4) ? rawBodyCode : "{\n        let _val_eval = " + rawBodyCode + ";\n        if let crate::Value::Func1(purust_core::Func1::Shared(f)) = &_val_eval {\n            f(crate::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() })))\n        } else if let crate::Value::Record_a(r) = &_val_eval {\n            if r.call.is_some() {\n                r.call.clone().unwrap()(crate::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() })))\n            } else {\n                _val_eval\n            }\n        } else {\n            _val_eval\n        }\n    }") + "\n}";
  }
  if (v.tag === "EffectPure") {
    return codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(alive)(false)(v._1);
  }
  if (v.tag === "Local") {
    const name2 = (() => {
      if (v._1.tag === "Just") {
        return sanitizeIdent(v._1._1);
      }
      if (v._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v._2);
      }
      fail();
    })();
    if (member2(name2)(alive)) {
      return name2 + ".clone()";
    }
    return name2;
  }
  if (v.tag === "Lit") {
    if (v._1.tag === "LitInt") {
      return showIntImpl(v._1._1);
    }
    if (v._1.tag === "LitNumber") {
      return showNumberImpl(v._1._1);
    }
    if (v._1.tag === "LitString") {
      return 'String::from(r#"' + v._1._1 + '"#)';
    }
    if (v._1.tag === "LitChar") {
      return showCharImpl(v._1._1);
    }
    if (v._1.tag === "LitBoolean") {
      if (v._1._1) {
        return "true";
      }
      return "false";
    }
    if (v._1.tag === "LitArray") {
      const $0 = v._1._1;
      return "crate::mk_array(vec![" + joinWith(", ")(mapWithIndexArray((i) => (a) => codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
        ordString.compare,
        $$const,
        alive,
        foldlArray(union)(Leaf)(arrayMap(freeVariables)((() => {
          const $1 = i + 1 | 0;
          if ($1 < 1) {
            return $0;
          }
          return sliceImpl($1, $0.length, $0);
        })()))
      ))(false)(a))($0)) + "])";
    }
    if (v._1.tag === "LitRecord") {
      const $0 = v._1._1;
      const shape = joinWith("_")(arrayMap(sanitizeIdent)(sortBy(ordString.compare)(arrayMap((v1) => v1._1)($0))));
      const structName = shape === "" ? "Record_a" : "Record_" + shape;
      return "crate::Value::" + structName + "(perceus_ptr::PerceusPtr::new(" + structName + " { " + joinWith(", ")(mapWithIndexArray((i) => (v1) => sanitizeIdent(v1._1) + ": Some(" + boxUnbox(currentMod)(Any)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v1._2))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
        ordString.compare,
        $$const,
        alive,
        foldlArray(union)(Leaf)(arrayMap((v3) => freeVariables(v3._2))((() => {
          const $1 = i + 1 | 0;
          if ($1 < 1) {
            return $0;
          }
          return sliceImpl($1, $0.length, $0);
        })()))
      ))(false)(v1._2)) + ")")($0)) + ($0.length > 0 ? ", " : "") + "..Default::default() }))";
    }
    fail();
  }
  if (v.tag === "Abs") {
    return genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(arrayMap((v1) => {
      if (v1._1.tag === "Just") {
        return sanitizeIdent(v1._1._1);
      }
      if (v1._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v1._2);
      }
      fail();
    })(v._1))(Any)(v._2);
  }
  if (v.tag === "UncurriedAbs") {
    return genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(arrayMap((v1) => {
      if (v1._1.tag === "Just") {
        return sanitizeIdent(v1._1._1);
      }
      if (v1._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v1._2);
      }
      fail();
    })(v._1))(Any)(v._2);
  }
  if (v.tag === "UncurriedEffectAbs") {
    return genAbs(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(arrayMap((v1) => {
      if (v1._1.tag === "Just") {
        return sanitizeIdent(v1._1._1);
      }
      if (v1._1.tag === "Nothing") {
        return "lvl_" + showIntImpl(v1._2);
      }
      fail();
    })(v._1))(Any)(v._2);
  }
  if (v.tag === "PrimUndefined") {
    return "crate::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() }))";
  }
  if (v.tag === "CtorSaturated") {
    const v1 = lookup5(getTyPrefix(currentMod)($Qualified(v._1._1, v._3)) + sanitizeIdent(v._3))(globalClassFields);
    if (v1.tag === "Just") {
      const $0 = v1._1;
      return (() => {
        if (v._1._1.tag === "Just") {
          const mnStr = replaceAll(".")("_")(v._1._1._1);
          if (mnStr === currentMod) {
            return "std::rc::Rc::new(crate::" + sanitizeIdent(v._3) + " { ";
          }
          return "std::rc::Rc::new(Purs_" + mnStr + "::" + sanitizeIdent(v._3) + " { ";
        }
        if (v._1._1.tag === "Nothing") {
          return "std::rc::Rc::new(crate::" + sanitizeIdent(v._3) + " { ";
        }
        fail();
      })() + joinWith(", ")(mapWithIndexArray((i) => (v2) => {
        const $1 = "field" + showIntImpl(i);
        if (i >= 0 && i < $0.length) {
          const v3 = $0[i];
          return sanitizeIdent(v3._1) + ": " + boxUnbox(currentMod)(v3._2)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v2._2))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
            ordString.compare,
            $$const,
            alive,
            foldlArray(union)(Leaf)(arrayMap((v4) => freeVariables(v4._2))((() => {
              const $2 = i + 1 | 0;
              if ($2 < 1) {
                return v._5;
              }
              return sliceImpl($2, v._5.length, v._5);
            })()))
          ))(false)(v2._2));
        }
        return sanitizeIdent($1) + ": " + boxUnbox(currentMod)(Any)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v2._2))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
          ordString.compare,
          $$const,
          alive,
          foldlArray(union)(Leaf)(arrayMap((v4) => freeVariables(v4._2))((() => {
            const $2 = i + 1 | 0;
            if ($2 < 1) {
              return v._5;
            }
            return sliceImpl($2, v._5.length, v._5);
          })()))
        ))(false)(v2._2));
      })(v._5)) + " })";
    }
    if (v1.tag === "Nothing") {
      return (() => {
        if (v._1._1.tag === "Just") {
          const mnStr = replaceAll(".")("_")(v._1._1._1);
          if (mnStr === currentMod) {
            return "std::rc::Rc::new(crate::";
          }
          return "std::rc::Rc::new(Purs_" + mnStr + "::";
        }
        if (v._1._1.tag === "Nothing") {
          return "std::rc::Rc::new(crate::";
        }
        fail();
      })() + sanitizeIdent(v._3) + "::" + sanitizeIdent(v._4) + (v._5.length === 0 ? "" : "(" + joinWith(", ")(mapWithIndexArray((i) => (v2) => boxUnbox(currentMod)((() => {
        const v3 = lookup5((() => {
          if (v._1._1.tag === "Just") {
            return replaceAll(".")("_")(v._1._1._1) + "_" + v._4;
          }
          if (v._1._1.tag === "Nothing") {
            return replaceAll(".")("_")(currentMod) + "_" + v._4;
          }
          fail();
        })())(aritiesMap);
        if (v3.tag === "Just") {
          const v$1 = unwrapType(v3._1);
          const $0 = v$1.tag === "Func" ? v$1._1 : [];
          if (i >= 0 && i < $0.length) {
            return $0[i];
          }
          return Any;
        }
        if (v3.tag === "Nothing") {
          return Any;
        }
        fail();
      })())(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v2._2))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(unsafeUnionWith(
        ordString.compare,
        $$const,
        alive,
        foldlArray(union)(Leaf)(arrayMap((v3) => freeVariables(v3._2))((() => {
          const $0 = i + 1 | 0;
          if ($0 < 1) {
            return v._5;
          }
          return sliceImpl($0, v._5.length, v._5);
        })()))
      ))(false)(v2._2)))(v._5)) + ")") + ")";
    }
    fail();
  }
  if (v.tag === "CtorDef") {
    const rustCtor = "crate::" + sanitizeIdent(v._2) + "::" + sanitizeIdent(v._3);
    const len = v._4.length;
    const $0 = lookup5(currentMod + "_" + sanitizeIdent(v._3))(aritiesMap);
    const ctorTy = (() => {
      if ($0.tag === "Nothing") {
        return Any;
      }
      if ($0.tag === "Just") {
        return $0._1;
      }
      fail();
    })();
    const retTyStr = codegenExprType(currentMod)(true)((() => {
      const v$12 = unwrapType(ctorTy);
      if (v$12.tag === "Func") {
        return v$12._2;
      }
      return v$12;
    })());
    const v$1 = unwrapType(ctorTy);
    const argTys = v$1.tag === "Func" ? v$1._1 : [];
    const argNames = mapWithIndexArray((i) => (v1) => "a" + showIntImpl(i))(v._4);
    const argsCode = joinWith(", ")(mapWithIndexArray((i) => (a) => "mut " + a + ": " + codegenExprType(currentMod)(false)(i >= 0 && i < argTys.length ? argTys[i] : Any))(argNames));
    const innerCall = "std::rc::Rc::new(" + rustCtor + "(" + joinWith(", ")(arrayMap((a) => a + ".clone()")(argNames)) + "))";
    if (len === 0) {
      return "std::rc::Rc::new(" + rustCtor + ")";
    }
    if (len <= 10) {
      return "purust_core::Func" + showIntImpl(len) + "::Shared(std::rc::Rc::new(move |" + argsCode + "| -> " + retTyStr + " { " + innerCall + " }))";
    }
    return "/* ERROR: Ctor with > 10 fields */ std::rc::Rc::new(" + rustCtor + ")";
  }
  if (v.tag === "LetRec") {
    const $0 = v._2;
    const $1 = v._3;
    return "{\n    " + joinWith("\n    ")(arrayMap((v1) => "let mut " + sanitizeIdent(v1._1) + " = crate::Value::Thunk(perceus_ptr::PerceusPtr::new(crate::Thunk { ..Default::default() }));")($0)) + "\n    " + joinWith("\n    ")(mapWithIndexArray((i) => (v1) => {
      const valTy = inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(bound)(v1._2);
      const v$1 = unwrapType(valTy);
      const retType = v$1.tag === "Func" ? v$1._2 : v$1;
      const clonesCode = joinWith("\n        ")(arrayMap((v2) => "let mut " + sanitizeIdent(v2._1) + " = " + sanitizeIdent(v2._1) + ".clone();")($0));
      const v$2 = unwrapType(valTy);
      const allArgTypes = v$2.tag === "Func" ? v$2._1 : [];
      const extracted = extractAbsParams(allArgTypes.length)(v1._2);
      const aliveForVal = unsafeUnionWith(
        ordString.compare,
        $$const,
        alive,
        unsafeUnionWith(
          ordString.compare,
          $$const,
          foldlArray((acc) => (v2) => insert(ordString)(sanitizeIdent(v2._1))()(acc))(Leaf)($0),
          unsafeUnionWith(
            ordString.compare,
            $$const,
            freeVariables($1),
            foldlArray((acc) => (v2) => unsafeUnionWith(ordString.compare, $$const, acc, freeVariables(v2._2)))(Leaf)((() => {
              const $2 = i + 1 | 0;
              if ($2 < 1) {
                return $0;
              }
              return sliceImpl($2, $0.length, $0);
            })())
          )
        )
      );
      if (member2(sanitizeIdent(v1._1))(freeVariables(v1._2)) && (() => {
        if (extracted.tag === "Just") {
          return true;
        }
        if (extracted.tag === "Nothing") {
          return false;
        }
        fail();
      })() && allArgTypes.length > 0) {
        const innerExpr = (() => {
          if (extracted.tag === "Just") {
            return extracted._1._2;
          }
          if (extracted.tag === "Nothing") {
            return v1._2;
          }
          fail();
        })();
        const fnName = sanitizeIdent(v1._1) + "_impl";
        const dedupedParams = dedupArgs((() => {
          if (extracted.tag === "Just") {
            return extracted._1._1;
          }
          if (extracted.tag === "Nothing") {
            return [];
          }
          fail();
        })());
        const paramPairs = zipWithImpl(Tuple, dedupedParams, allArgTypes);
        const innerBound = foldlArray((b) => (v2) => insert(ordString)(sanitizeIdent(v2._1))(v2._2)(b))(bound)(paramPairs);
        const capturedArr = filterImpl(
          (v2) => !member12(v2)(aritiesMap) && !member2(v2)(allZeroArity),
          fromFoldableImpl(
            foldableSet.foldr,
            unsafeDifference(ordString.compare, freeVariables(v1._2), fromFoldable12(dedupedParams))
          )
        );
        const arity = paramPairs.length;
        return "let val_" + sanitizeIdent(v1._1) + " = {\n        " + clonesCode + "\n        " + joinWith("\n        ")(arrayMap((c) => "let mut " + sanitizeIdent(c) + " = " + sanitizeIdent(c) + ".clone();")(capturedArr)) + "\n        fn " + fnName + "(" + joinWith(", ")([
          ...arrayMap((c) => "mut " + sanitizeIdent(c) + ": " + codegenExprType(currentMod)(false)((() => {
            const $2 = lookup5(c)(bound);
            if ($2.tag === "Nothing") {
              return Any;
            }
            if ($2.tag === "Just") {
              return $2._1;
            }
            fail();
          })()))(capturedArr),
          ...arrayMap((v2) => "mut " + sanitizeIdent(v2._1) + ": " + codegenExprType(currentMod)(false)(v2._2))(paramPairs)
        ]) + ") -> " + codegenExprType(currentMod)(true)(retType) + " {\n        loop {\n            break " + boxUnbox(currentMod)(retType)(inferTypeExprGlobal(currentMod)(aritiesMap)(globalClassFields)(innerBound)(innerExpr))(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)($Maybe(
          "Just",
          { name: sanitizeIdent(v1._1), params: dedupedParams }
        ))(aritiesMap)(globalClassFields)(innerBound)(freeVariables(innerExpr))(false)(innerExpr)) + ";\n        }\n    }\n        " + boxUnbox(currentMod)(Any)(valTy)(arity > 0 && arity <= 10 ? "purust_core::Func" + showIntImpl(arity) + "::Shared(std::rc::Rc::new(move |" + joinWith(", ")(arrayMap((v2) => "mut " + sanitizeIdent(v2._1) + ": " + codegenExprType(currentMod)(false)(v2._2))(paramPairs)) + "| -> " + codegenExprType(currentMod)(true)(retType) + " {\n        " + joinWith("\n        ")(arrayMap((c) => "let mut " + sanitizeIdent(c) + " = " + sanitizeIdent(c) + ".clone();")(capturedArr)) + "\n        " + fnName + "(" + joinWith(", ")([
          ...arrayMap(sanitizeIdent)(capturedArr),
          ...arrayMap(sanitizeIdent)(dedupedParams)
        ]) + ")\n    }))" : 'unimplemented!("LetRec arity > 10")') + "\n    };";
      }
      return "let val_" + sanitizeIdent(v1._1) + " = {\n        " + clonesCode + "\n        " + boxUnbox(currentMod)(Any)(valTy)(codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(bound)(aliveForVal)(false)(v1._2)) + "\n    };";
    })($0)) + "\n    " + joinWith("\n    ")(arrayMap((v1) => "if let crate::Value::Thunk(ref mut thunk) = " + sanitizeIdent(v1._1) + " {\n    let mut mut_thunk = unsafe { perceus_ptr::PerceusPtr::force_mut(thunk) };\n    mut_thunk.call = Some((val_" + sanitizeIdent(v1._1) + ").unwrap_func1());\n} else { unreachable!() }")($0)) + "\n    " + codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop.tag === "Just" && anyImpl(
      (v1) => sanitizeIdent(v1._1) === mbLoop._1.name,
      $0
    ) ? Nothing : mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inEffectBlock)($1) + "\n}";
  }
  if (v.tag === "EffectDefer") {
    return codegenExpr_(currentMod)(allZeroArity)(allMacroBindings)(mbLoop)(aritiesMap)(globalClassFields)(bound)(alive)(inEffectBlock)(v._1);
  }
  if (v.tag === "Fail") {
    return "unimplemented!() /* Unsupported Expr: Fail */";
  }
  return "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Expr: " + printAST(v) + " */";
};
var codegenBindingGroup = (modName) => (modNameStr) => (allZeroArity) => (allMacroBindings) => (aritiesMap) => (globalClassFields) => (group2) => {
  globalConsumed.value = Leaf;
  if (group2.bindings.length === 0) {
    return { code: "", arities: aritiesMap };
  }
  const isSelfRecursive = group2.recursive && group2.bindings.length === 1;
  const mergedArities = unsafeUnionWith(
    ordString.compare,
    $$const,
    aritiesMap,
    fromFoldable33(arrayMap((v) => {
      const rawIdentName = sanitizeIdent(v._1);
      return $Tuple(rawIdentName === "main" ? "main" : modNameStr + "_" + rawIdentName, inferTypeExpr(modNameStr)(aritiesMap)(Leaf)(v._2));
    })(group2.bindings))
  );
  return {
    code: foldMap13((v) => {
      const rawIdentName = sanitizeIdent(replaceAll(".")("_")(v._1));
      const innerExpr = v._2.tag === "Typed" ? v._2._2 : v._2;
      const identName = rawIdentName === "main" ? "main" : modNameStr + "_" + rawIdentName;
      const $0 = lookup5(identName)(mergedArities);
      const inferredType = (() => {
        if ($0.tag === "Nothing") {
          return Any;
        }
        if ($0.tag === "Just") {
          return $0._1;
        }
        fail();
      })();
      const v$1 = unwrapType(inferredType);
      const allArgTypes = v$1.tag === "Func" ? v$1._1 : [];
      if (allArgTypes.length > 0) {
        const v$2 = unwrapType(inferredType);
        const retType = v$2.tag === "Func" ? v$2._2 : v$2;
        const extracted = extractAbsParams(allArgTypes.length)(innerExpr);
        const deduped = dedupArgs((() => {
          if (extracted.tag === "Just") {
            return extracted._1._1;
          }
          if (extracted.tag === "Nothing") {
            return mapWithIndexArray((i) => (v2) => "a" + showIntImpl(i))(allArgTypes);
          }
          fail();
        })());
        const mbLoop = isSelfRecursive ? $Maybe("Just", { name: identName, params: deduped }) : Nothing;
        const paramPairs = zipWithImpl(Tuple, deduped, allArgTypes);
        const bound = fromFoldable33(arrayMap((v2) => $Tuple(v2._1 === "_" ? "_" : sanitizeIdent(v2._1), v2._2))(paramPairs));
        return "pub fn " + identName + "(" + joinWith(", ")(arrayMap((v2) => {
          const p = sanitizeIdent(v2._1);
          return (p === "_" ? "" + p + ": " : "mut " + p + ": ") + codegenExprType(modNameStr)(true)(v2._2);
        })(paramPairs)) + ")" + (codegenExprType(modNameStr)(true)(retType) === "" ? "" : " -> " + codegenExprType(modNameStr)(true)(retType)) + " {\n    // AST: " + printAST(v._2) + "\n" + (() => {
          if (isSelfRecursive) {
            if (extracted.tag === "Just") {
              return "    loop {\n        break " + boxUnbox(modNameStr)(retType)(inferTypeExpr(modNameStr)(mergedArities)(bound)(extracted._1._2))(codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(mbLoop)(mergedArities)(globalClassFields)(bound)(Leaf)(false)(extracted._1._2)) + ";\n    }";
            }
            if (extracted.tag === "Nothing") {
              const shapeTypeToAST = (v22) => (v3) => {
                if (v3.tag === "Typed") {
                  return v3._1;
                }
                if (v3.tag === "Abs") {
                  const v$3 = unwrapType(v22);
                  const retTy = v$3.tag === "Func" ? v$3._2 : v$3;
                  const v$4 = unwrapType(v22);
                  const expectedArgs = v$4.tag === "Func" ? v$4._1 : [];
                  const arity = v3._1.length;
                  const restArgs = arity < 1 ? expectedArgs : sliceImpl(arity, expectedArgs.length, expectedArgs);
                  return $ExprType(
                    "Func",
                    arity < 1 ? [] : sliceImpl(0, arity, expectedArgs),
                    shapeTypeToAST(restArgs.length > 0 ? $ExprType("Func", restArgs, retTy) : retTy)(v3._2)
                  );
                }
                if (v3.tag === "UncurriedAbs") {
                  const v$3 = unwrapType(v22);
                  const retTy = v$3.tag === "Func" ? v$3._2 : v$3;
                  const v$4 = unwrapType(v22);
                  const expectedArgs = v$4.tag === "Func" ? v$4._1 : [];
                  const arity = v3._1.length;
                  const restArgs = arity < 1 ? expectedArgs : sliceImpl(arity, expectedArgs.length, expectedArgs);
                  return $ExprType(
                    "Func",
                    arity < 1 ? [] : sliceImpl(0, arity, expectedArgs),
                    shapeTypeToAST(restArgs.length > 0 ? $ExprType("Func", restArgs, retTy) : retTy)(v3._2)
                  );
                }
                return v22;
              };
              const argsCodeAndType = mapWithIndexArray((i) => (p) => $Tuple(
                i >= 0 && i < allArgTypes.length ? allArgTypes[i] : Any,
                sanitizeIdent(p) + ".clone()"
              ))(deduped);
              const buildCallBindingGroup = (buildCallBindingGroup$a0$copy) => (buildCallBindingGroup$a1$copy) => (buildCallBindingGroup$a2$copy) => {
                let buildCallBindingGroup$a0 = buildCallBindingGroup$a0$copy;
                let buildCallBindingGroup$a1 = buildCallBindingGroup$a1$copy;
                let buildCallBindingGroup$a2 = buildCallBindingGroup$a2$copy;
                let buildCallBindingGroup$c = true;
                let buildCallBindingGroup$r;
                while (buildCallBindingGroup$c) {
                  const accTy = buildCallBindingGroup$a0, accCode = buildCallBindingGroup$a1, idx = buildCallBindingGroup$a2;
                  if (idx >= argsCodeAndType.length) {
                    buildCallBindingGroup$c = false;
                    buildCallBindingGroup$r = $Tuple(accTy, accCode);
                    continue;
                  }
                  const v22 = unwrapType(accTy);
                  if (v22.tag === "Func") {
                    const arity = v22._1.length;
                    if (arity > 0 && arity <= 10 && (argsCodeAndType.length - idx | 0) >= arity) {
                      buildCallBindingGroup$a0 = v22._2;
                      buildCallBindingGroup$a1 = "(" + accCode + ")(" + joinWith(", ")(mapWithIndexArray((i) => (v3) => boxUnbox(modNameStr)(i >= 0 && i < v22._1.length ? v22._1[i] : Any)(v3._1)(v3._2))(sliceImpl(idx, idx + arity | 0, argsCodeAndType))) + ")";
                      buildCallBindingGroup$a2 = idx + arity | 0;
                      continue;
                    }
                  }
                  if (idx >= 0 && idx < argsCodeAndType.length) {
                    const v3 = argsCodeAndType[idx];
                    buildCallBindingGroup$a0 = Any;
                    buildCallBindingGroup$a1 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(modNameStr)(Any)(v3._1)(v3._2) + ")";
                    buildCallBindingGroup$a2 = idx + 1 | 0;
                    continue;
                  }
                  buildCallBindingGroup$a0 = Any;
                  buildCallBindingGroup$a1 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(modNameStr)(Any)(Any)("") + ")";
                  buildCallBindingGroup$a2 = idx + 1 | 0;
                }
                return buildCallBindingGroup$r;
              };
              const v2 = buildCallBindingGroup(shapeTypeToAST(inferredType)(innerExpr))(codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(Nothing)(mergedArities)(globalClassFields)(bound)(Leaf)(false)(innerExpr))(0);
              return "    loop {\n        break " + boxUnbox(modNameStr)(retType)(v2._1)(v2._2) + ";\n    }";
            }
            fail();
          }
          if (extracted.tag === "Just") {
            return boxUnbox(modNameStr)(retType)(inferTypeExpr(modNameStr)(mergedArities)(bound)(extracted._1._2))(codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(mbLoop)(mergedArities)(globalClassFields)(bound)(Leaf)(false)(extracted._1._2));
          }
          if (extracted.tag === "Nothing") {
            const shapeTypeToAST = (v22) => (v3) => {
              if (v3.tag === "Typed") {
                return v3._1;
              }
              if (v3.tag === "Abs") {
                const v$3 = unwrapType(v22);
                const retTy = v$3.tag === "Func" ? v$3._2 : v$3;
                const v$4 = unwrapType(v22);
                const expectedArgs = v$4.tag === "Func" ? v$4._1 : [];
                const arity = v3._1.length;
                const restArgs = arity < 1 ? expectedArgs : sliceImpl(arity, expectedArgs.length, expectedArgs);
                return $ExprType(
                  "Func",
                  arity < 1 ? [] : sliceImpl(0, arity, expectedArgs),
                  shapeTypeToAST(restArgs.length > 0 ? $ExprType("Func", restArgs, retTy) : retTy)(v3._2)
                );
              }
              if (v3.tag === "UncurriedAbs") {
                const v$3 = unwrapType(v22);
                const retTy = v$3.tag === "Func" ? v$3._2 : v$3;
                const v$4 = unwrapType(v22);
                const expectedArgs = v$4.tag === "Func" ? v$4._1 : [];
                const arity = v3._1.length;
                const restArgs = arity < 1 ? expectedArgs : sliceImpl(arity, expectedArgs.length, expectedArgs);
                return $ExprType(
                  "Func",
                  arity < 1 ? [] : sliceImpl(0, arity, expectedArgs),
                  shapeTypeToAST(restArgs.length > 0 ? $ExprType("Func", restArgs, retTy) : retTy)(v3._2)
                );
              }
              return v22;
            };
            const argsCodeAndType = mapWithIndexArray((i) => (p) => $Tuple(
              i >= 0 && i < allArgTypes.length ? allArgTypes[i] : Any,
              sanitizeIdent(p) + ".clone()"
            ))(deduped);
            const buildCallBindingGroup = (buildCallBindingGroup$a0$copy) => (buildCallBindingGroup$a1$copy) => (buildCallBindingGroup$a2$copy) => {
              let buildCallBindingGroup$a0 = buildCallBindingGroup$a0$copy;
              let buildCallBindingGroup$a1 = buildCallBindingGroup$a1$copy;
              let buildCallBindingGroup$a2 = buildCallBindingGroup$a2$copy;
              let buildCallBindingGroup$c = true;
              let buildCallBindingGroup$r;
              while (buildCallBindingGroup$c) {
                const accTy = buildCallBindingGroup$a0, accCode = buildCallBindingGroup$a1, idx = buildCallBindingGroup$a2;
                if (idx >= argsCodeAndType.length) {
                  buildCallBindingGroup$c = false;
                  buildCallBindingGroup$r = $Tuple(accTy, accCode);
                  continue;
                }
                const v22 = unwrapType(accTy);
                if (v22.tag === "Func") {
                  const arity = v22._1.length;
                  if (arity > 0 && arity <= 10 && (argsCodeAndType.length - idx | 0) >= arity) {
                    buildCallBindingGroup$a0 = v22._2;
                    buildCallBindingGroup$a1 = "(" + accCode + ")(" + joinWith(", ")(mapWithIndexArray((i) => (v3) => boxUnbox(modNameStr)(i >= 0 && i < v22._1.length ? v22._1[i] : Any)(v3._1)(v3._2))(sliceImpl(idx, idx + arity | 0, argsCodeAndType))) + ")";
                    buildCallBindingGroup$a2 = idx + arity | 0;
                    continue;
                  }
                }
                if (idx >= 0 && idx < argsCodeAndType.length) {
                  const v3 = argsCodeAndType[idx];
                  buildCallBindingGroup$a0 = Any;
                  buildCallBindingGroup$a1 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(modNameStr)(Any)(v3._1)(v3._2) + ")";
                  buildCallBindingGroup$a2 = idx + 1 | 0;
                  continue;
                }
                buildCallBindingGroup$a0 = Any;
                buildCallBindingGroup$a1 = "(" + accCode + ").unwrap_func1()(" + boxUnbox(modNameStr)(Any)(Any)("") + ")";
                buildCallBindingGroup$a2 = idx + 1 | 0;
              }
              return buildCallBindingGroup$r;
            };
            const v2 = buildCallBindingGroup(shapeTypeToAST(inferredType)(innerExpr))(codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(Nothing)(mergedArities)(globalClassFields)(bound)(Leaf)(false)(innerExpr))(0);
            return boxUnbox(modNameStr)(retType)(v2._1)(v2._2);
          }
          fail();
        })() + "\n}\n\n";
      }
      if (innerExpr.tag === "Abs") {
        const deduped = dedupArgs(arrayMap((v2) => {
          if (v2._1.tag === "Just") {
            return v2._1._1;
          }
          return "_";
        })(innerExpr.tag === "Abs" ? innerExpr._1 : _crashWith("impossible")));
        const v$2 = unwrapType(inferredType);
        const argTys = v$2.tag === "Func" ? v$2._1 : [];
        return "pub fn " + identName + "(" + joinWith(", ")(mapWithIndexArray((i) => (pName) => {
          const p = sanitizeIdent(pName);
          return (p === "_" ? "" + p + ": " : "mut " + p + ": ") + codegenExprType(modNameStr)(false)(i >= 0 && i < argTys.length ? argTys[i] : Any);
        })(deduped)) + ")" + (codegenExprType(modNameStr)(true)((() => {
          const v$3 = unwrapType(inferredType);
          if (v$3.tag === "Func") {
            return v$3._2;
          }
          return v$3;
        })()) === "" ? "" : " -> " + codegenExprType(modNameStr)(true)((() => {
          const v$3 = unwrapType(inferredType);
          if (v$3.tag === "Func") {
            return v$3._2;
          }
          return v$3;
        })())) + " {\n    // AST: " + printAST(v._2) + "\n" + (isSelfRecursive ? "    loop {\n        break " + genAbs(modNameStr)(allZeroArity)(allMacroBindings)(isSelfRecursive ? $Maybe("Just", { name: identName, params: deduped }) : Nothing)(aritiesMap)(globalClassFields)(Leaf)(Leaf)(deduped)(inferredType)(innerExpr.tag === "Abs" ? innerExpr._2 : _crashWith("impossible")) + ";\n    }" : genAbs(modNameStr)(allZeroArity)(allMacroBindings)(isSelfRecursive ? $Maybe("Just", { name: identName, params: deduped }) : Nothing)(aritiesMap)(globalClassFields)(Leaf)(Leaf)(deduped)(inferredType)(innerExpr.tag === "Abs" ? innerExpr._2 : _crashWith("impossible"))) + "\n}\n\n";
      }
      return "pub fn " + identName + "()" + (codegenExprType(modNameStr)(true)(inferredType) === "" ? "" : " -> " + codegenExprType(modNameStr)(true)(inferredType)) + " {\n    // AST: " + printAST(v._2) + "\n" + codegenExpr_(modNameStr)(allZeroArity)(allMacroBindings)(Nothing)(aritiesMap)(globalClassFields)(Leaf)(Leaf)(false)(v._2) + "\n}\n\n";
    })(group2.bindings),
    arities: mergedArities
  };
};
var codegenModule = (globalAritiesMap) => (globalClassFields) => (v) => (backendMod) => {
  const modNameStr = replaceAll(".")("_")(backendMod.name);
  return "// Code generated by purust for module " + modNameStr + "\n\n" + joinWith("\n")(arrayMap((decl) => "#[derive(Clone)]\npub enum " + sanitizeIdent(decl.name) + " {\n" + joinWith(",\n")(arrayMap((ctor) => {
    const fields = arrayMap((fieldTy) => codegenExprType(modNameStr)(false)(fieldTy))(ctor.fields);
    return "    " + sanitizeIdent(ctor.name) + (fields.length > 0 ? "(" + joinWith(", ")(fields) + ")" : "");
  })(decl.constructors)) + "\n}\n")(v.dataDecls)) + "\n" + joinWith("\n")(arrayMap((v1) => "#[derive(Clone)]\npub struct " + sanitizeIdent(v1.name) + " {\n" + joinWith(",\n")(concat([
    mapWithIndexArray((i) => (v2) => {
      const $0 = v2._1.length - 1 | 0;
      return ($0 >= 0 && $0 < v2._1.length ? "    pub " + v2._1[$0] : "    pub Super") + showIntImpl(i) + ": crate::UnknownType";
    })(v1.superclasses),
    arrayMap((v2) => "    pub " + sanitizeIdent(v2._1) + ": " + codegenExprType(modNameStr)(false)(v2._2))(v1.methods)
  ])) + "\n}\n")(v.classDecls)) + "\n" + foldlArray((acc) => (group2) => {
    const res = codegenBindingGroup(v.name)(modNameStr)(Leaf)(Leaf)(acc.arities)(globalClassFields)(group2);
    return { code: acc.code + res.code, arities: res.arities };
  })({ code: "", arities: globalAritiesMap })(backendMod.bindings).code;
};

// output-es/Main/index.js
var toUnfoldable3 = /* @__PURE__ */ (() => {
  const $0 = unfoldableArray.unfoldr(stepUnfoldr);
  return (x) => $0($MapIter("IterNode", x, IterLeaf));
})();
var buildModules2 = /* @__PURE__ */ buildModules(monadAff);
var member3 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = false;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = true;
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var show2 = (v) => {
  if (v.tag === "Just") {
    return "(Just " + showStringImpl(v._1) + ")";
  }
  if (v.tag === "Nothing") {
    return "Nothing";
  }
  fail();
};
var foldMap8 = /* @__PURE__ */ (() => foldableArray.foldMap(monoidString))();
var toUnfoldable13 = /* @__PURE__ */ (() => {
  const $0 = unfoldableArray.unfoldr((xs) => {
    if (xs.tag === "Nil") {
      return Nothing;
    }
    if (xs.tag === "Cons") {
      return $Maybe("Just", $Tuple(xs._1, xs._2));
    }
    fail();
  });
  return (x) => $0((() => {
    const go = (m$p, z$p) => {
      if (m$p.tag === "Leaf") {
        return z$p;
      }
      if (m$p.tag === "Node") {
        return go(m$p._5, $List("Cons", m$p._3, go(m$p._6, z$p)));
      }
      fail();
    };
    return go(x, Nil);
  })());
})();
var fromFoldable8 = /* @__PURE__ */ foldlArray((m) => (a) => insert(ordString)(a)()(m))(Leaf);
var lookup6 = (k) => {
  const go = (go$a0$copy) => {
    let go$a0 = go$a0$copy, go$c = true, go$r;
    while (go$c) {
      const v = go$a0;
      if (v.tag === "Leaf") {
        go$c = false;
        go$r = Nothing;
        continue;
      }
      if (v.tag === "Node") {
        const v1 = ordString.compare(k)(v._3);
        if (v1 === "LT") {
          go$a0 = v._5;
          continue;
        }
        if (v1 === "GT") {
          go$a0 = v._6;
          continue;
        }
        if (v1 === "EQ") {
          go$c = false;
          go$r = $Maybe("Just", v._4);
          continue;
        }
      }
      fail();
    }
    return go$r;
  };
  return go;
};
var main = /* @__PURE__ */ (() => {
  const $0 = _makeFiber(
    ffiUtil,
    _bind(_liftEffect(argv))((args) => {
      const v = findIndexImpl(Just, Nothing, (v1) => v1 === "--main", args);
      const mainModule = (() => {
        if (v.tag === "Just") {
          const $02 = v._1 + 1 | 0;
          if ($02 >= 0 && $02 < args.length) {
            return args[$02];
          }
          return "Main";
        }
        if (v.tag === "Nothing") {
          return "Main";
        }
        fail();
      })();
      return _bind(_liftEffect(log2("Generating Rust code for " + mainModule)))(() => _bind(coreFnModulesFromOutput((() => {
        const v$1 = findIndexImpl(Just, Nothing, (v1) => v1 === "--source", args);
        if (v$1.tag === "Just") {
          const $02 = v$1._1 + 1 | 0;
          if ($02 >= 0 && $02 < args.length) {
            return args[$02];
          }
          return "output";
        }
        if (v$1.tag === "Nothing") {
          return "output";
        }
        fail();
      })()))((finalModules) => {
        const go = (go$a0$copy) => (go$a1$copy) => {
          let go$a0 = go$a0$copy, go$a1 = go$a1$copy, go$c = true, go$r;
          while (go$c) {
            const b = go$a0, v$1 = go$a1;
            if (v$1.tag === "Nil") {
              go$c = false;
              go$r = b;
              continue;
            }
            if (v$1.tag === "Cons") {
              go$a0 = (() => {
                const $02 = v$1._1;
                const modPrefix = replaceAll(".")("_")($02.name) + "_";
                return foldlArray((a) => (decl) => foldlArray((a2) => (ctor) => {
                  const retTy = $ExprType("ADT", decl.name, snoc(split(".")($02.name))(decl.name), []);
                  return insert(ordString)(modPrefix + sanitizeIdent(ctor.name))(ctor.fields.length > 0 ? $ExprType("Func", ctor.fields, retTy) : retTy)(a2);
                })(a)(decl.constructors))(foldlArray((a) => (v1) => {
                  if (v1._2.tag === "Just") {
                    return insert(ordString)(modPrefix + sanitizeIdent(v1._1))(v1._2._1)(a);
                  }
                  if (v1._2.tag === "Nothing") {
                    return a;
                  }
                  fail();
                })(foldlArray((a) => (v1) => {
                  if (v1.tag === "NonRec") {
                    const tyMb = (() => {
                      if (v1._1._1.type.tag === "Just") {
                        return $Maybe("Just", v1._1._1.type._1);
                      }
                      if (v1._1._1.type.tag === "Nothing") {
                        if (v1._1._3.tag === "ExprVar") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprLit") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprAbs") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprApp") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprLet") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprCase") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprConstructor") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprAccessor") {
                          return v1._1._3._1.type;
                        }
                        if (v1._1._3.tag === "ExprUpdate") {
                          return v1._1._3._1.type;
                        }
                      }
                      fail();
                    })();
                    if (tyMb.tag === "Just") {
                      return insert(ordString)(modPrefix + sanitizeIdent(v1._1._2))(tyMb._1)(a);
                    }
                    if (tyMb.tag === "Nothing") {
                      return a;
                    }
                    fail();
                  }
                  if (v1.tag === "Rec") {
                    return foldlArray((a$p) => (v2) => {
                      const tyMb = (() => {
                        if (v2._1.type.tag === "Just") {
                          return $Maybe("Just", v2._1.type._1);
                        }
                        if (v2._1.type.tag === "Nothing") {
                          if (v2._3.tag === "ExprVar") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprLit") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprAbs") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprApp") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprLet") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprCase") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprConstructor") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprAccessor") {
                            return v2._3._1.type;
                          }
                          if (v2._3.tag === "ExprUpdate") {
                            return v2._3._1.type;
                          }
                        }
                        fail();
                      })();
                      if (tyMb.tag === "Just") {
                        return insert(ordString)(modPrefix + sanitizeIdent(v2._2))(tyMb._1)(a$p);
                      }
                      if (tyMb.tag === "Nothing") {
                        return a$p;
                      }
                      fail();
                    })(a)(v1._1);
                  }
                  fail();
                })(b)($02.decls))(toUnfoldable3($02.foreign)))($02.dataDecls);
              })();
              go$a1 = v$1._2;
              continue;
            }
            fail();
          }
          return go$r;
        };
        const globalArities = go(Leaf)(finalModules);
        const go$1 = (go$1$a0$copy) => (go$1$a1$copy) => {
          let go$1$a0 = go$1$a0$copy, go$1$a1 = go$1$a1$copy, go$1$c = true, go$1$r;
          while (go$1$c) {
            const b = go$1$a0, v$1 = go$1$a1;
            if (v$1.tag === "Nil") {
              go$1$c = false;
              go$1$r = b;
              continue;
            }
            if (v$1.tag === "Cons") {
              go$1$a0 = (() => {
                const modPrefix = replaceAll(".")("_")(v$1._1.name) + "_";
                return foldlArray((a) => (classDecl) => insert(ordString)(modPrefix + sanitizeIdent(classDecl.name))(concat([
                  mapWithIndexArray((i) => (v1) => $Tuple(
                    (() => {
                      const $02 = v1._1.length - 1 | 0;
                      if ($02 >= 0 && $02 < v1._1.length) {
                        return v1._1[$02] + showIntImpl(i);
                      }
                      return "Super" + showIntImpl(i);
                    })(),
                    Any
                  ))(classDecl.superclasses),
                  arrayMap((v1) => $Tuple(sanitizeIdent(v1._1), v1._2))(classDecl.methods)
                ]))(a))(b)(v$1._1.classDecls);
              })();
              go$1$a1 = v$1._2;
              continue;
            }
            fail();
          }
          return go$1$r;
        };
        const globalClassFields = go$1(Leaf)(finalModules);
        return _bind(loadDirectives)((directives) => _bind(_liftEffect(() => ({ value: Leaf })))((modulesRef) => _bind(buildModules2({
          directives,
          analyzeCustom: (v$1) => (v1) => Nothing,
          foreignSemantics: coreForeignSemantics,
          traceIdents: Leaf,
          onPrepareModule: (v$1) => (v1) => _pure(v1),
          onSkipModule: (v$1) => (v1) => _pure(Nothing),
          onCodegenModule: (v$1) => (v1) => (backendMod) => (v2) => {
            const modNameStr = backendMod.name;
            const rsFile = codegenModule(globalArities)(globalClassFields)(v1)(backendMod);
            return _liftEffect((() => {
              const foreignArr = v1.foreign;
              const modName = replaceAll(".")("_")(v1.name);
              const modPrefix = modName + "_";
              const $02 = findFfiFile(".rs")([])($Maybe("Just", "../"))(modNameStr)($Maybe("Just", v1.path));
              return () => {
                const ffiPathMb = $02();
                const getArity2 = (v3) => {
                  if (v3.tag === "ForAll") {
                    return getArity2(v3._2);
                  }
                  if (v3.tag === "ConstrainedType") {
                    return getArity2(v3._2);
                  }
                  if (v3.tag === "Func") {
                    return v3._1.length + getArity2(v3._2) | 0;
                  }
                  return 0;
                };
                const genFallback = (name2, ty) => {
                  if (!member3(modPrefix + sanitizeIdent(name2))(Leaf)) {
                    const retTyStr = codegenExprType(modName)(true)((() => {
                      const v$2 = unwrapType(ty);
                      if (v$2.tag === "Func") {
                        return v$2._2;
                      }
                      return v$2;
                    })());
                    return "pub fn " + modPrefix + sanitizeIdent(name2) + "(" + joinWith(", ")(mapWithIndexArray((i) => (argTy) => "mut a" + showIntImpl(i) + ": " + codegenExprType(modName)(true)(argTy))((() => {
                      const v$2 = unwrapType(ty);
                      if (v$2.tag === "Func") {
                        return v$2._1;
                      }
                      return [];
                    })())) + ") -> " + retTyStr + " { " + (() => {
                      if (retTyStr === "i64") {
                        return "0";
                      }
                      if (retTyStr === "f64") {
                        return "0.0";
                      }
                      if (retTyStr === "bool") {
                        return "false";
                      }
                      if (retTyStr === "char") {
                        return "'\\0'";
                      }
                      if (retTyStr === "String") {
                        return "String::new()";
                      }
                      return "unimplemented!()";
                    })() + " }\n";
                  }
                  return "";
                };
                log2("Found FFI for " + modNameStr + " at: " + show2(ffiPathMb))();
                const ffiContent = (() => {
                  if (ffiPathMb.tag === "Just") {
                    const content = readTextFile(UTF8)(ffiPathMb._1)();
                    return content + "\n\n" + foldMap8((tup) => {
                      if (tup._2.tag === "Just") {
                        if (contains("fn " + modPrefix + sanitizeIdent(tup._1))(content)) {
                          return "";
                        }
                        return genFallback(tup._1, tup._2._1);
                      }
                      if (tup._2.tag === "Nothing") {
                        return "";
                      }
                      fail();
                    })(toUnfoldable3(foreignArr));
                  }
                  if (ffiPathMb.tag === "Nothing") {
                    return foldMap8((tup) => {
                      if (tup._2.tag === "Just") {
                        return genFallback(tup._1, tup._2._1);
                      }
                      if (tup._2.tag === "Nothing") {
                        return "";
                      }
                      fail();
                    })(toUnfoldable3(foreignArr));
                  }
                  fail();
                })();
                const coreImports = nubBy(ordString.compare)(mapMaybe((n) => {
                  const nStr = replaceAll(".")("_")(n);
                  if ((() => {
                    const $12 = indexOf2("Prim.")(n);
                    return n === "Prim" || ($12.tag === "Nothing" ? false : $12.tag === "Just" && $12._1 === 0) || nStr === modName;
                  })()) {
                    return Nothing;
                  }
                  return $Maybe("Just", nStr);
                })(concat([
                  toUnfoldable13(collectModulesModule(v1)),
                  mapMaybe((part) => {
                    const v4 = indexOf2("::")(part);
                    if (v4.tag === "Just") {
                      const mod = take2(v4._1)(part);
                      if (toCodePointArray(mod).length > 0 && toCodePointArray(mod).length < 100 && allImpl(
                        (c) => c >= "A" && c <= "Z" || c >= "a" && c <= "z" || c >= "0" && c <= "9" || c === "_",
                        toCharArray(mod)
                      )) {
                        return $Maybe("Just", mod);
                      }
                      return Nothing;
                    }
                    if (v4.tag === "Nothing") {
                      return Nothing;
                    }
                    fail();
                  })((() => {
                    const $12 = split("Purs_")(rsFile);
                    return sliceImpl(1, $12.length, $12);
                  })())
                ])));
                const $1 = modulesRef.value;
                modulesRef.value = insert(ordString)(modName)({
                  code: "#![allow(warnings)]\nuse perceus_ptr::PerceusPtr;\nuse purust_core::*;\n" + joinWith("\n")(arrayMap((i) => "use Purs_" + i + "::*;")(coreImports)) + "\n\n" + rsFile + "\n\n" + ffiContent + "\n\n",
                  imports: coreImports
                })($1);
              };
            })());
          }
        })(finalModules))(() => _liftEffect((() => {
          const v$1 = findIndexImpl(Just, Nothing, (v1) => v1 === "--out", args);
          const outDir = (() => {
            if (v$1.tag === "Just") {
              const $03 = v$1._1 + 1 | 0;
              if ($03 >= 0 && $03 < args.length) {
                return args[$03];
              }
              return "output/purust_output";
            }
            if (v$1.tag === "Nothing") {
              return "output/purust_output";
            }
            fail();
          })();
          const $02 = outDir + "/src";
          return () => {
            const srcExists = existsSync($02);
            const $1 = mkdir(outDir);
            if (!srcExists) {
              $1();
              mkdir(outDir + "/src")();
            }
            const allModules = modulesRef.value;
            let tcRef = Leaf;
            foldlArray((eff) => (v$2) => {
              const $22 = insert(ordString)(v$2._1)(fromFoldable8(v$2._2.imports));
              return () => {
                eff();
                const $3 = tcRef;
                tcRef = $22($3);
              };
            })(() => {
            })(toUnfoldable3(allModules))();
            const loop = () => {
              let changed = false;
              const currMap = tcRef;
              foldlArray((eff) => (v$2) => {
                const newImps = foldlArray((acc) => (i) => {
                  const v1 = lookup6(i)(currMap);
                  if (v1.tag === "Just") {
                    return unsafeUnionWith(ordString.compare, $$const, acc, v1._1);
                  }
                  if (v1.tag === "Nothing") {
                    return acc;
                  }
                  fail();
                })(v$2._2)(toUnfoldable13(v$2._2));
                const $22 = (() => {
                  if (newImps.tag === "Leaf") {
                    return 0;
                  }
                  if (newImps.tag === "Node") {
                    return newImps._2;
                  }
                  fail();
                })() > (() => {
                  if (v$2._2.tag === "Leaf") {
                    return 0;
                  }
                  if (v$2._2.tag === "Node") {
                    return v$2._2._2;
                  }
                  fail();
                })() ? (() => {
                  changed = true;
                  const $23 = tcRef;
                  tcRef = insert(ordString)(v$2._1)(newImps)($23);
                }) : () => {
                };
                return () => {
                  eff();
                  return $22();
                };
              })(() => {
              })(toUnfoldable3(currMap))();
              const isChanged = changed;
              if (isChanged) {
                return loop();
              }
            };
            loop();
            const finalTcMap = tcRef;
            const mainModuleSanitized = replaceAll(".")("_")(mainModule);
            writeTextFile(UTF8)(outDir + "/Cargo.toml")('[workspace]\nmembers = [\n  "purust_core", ' + joinWith(", ")(arrayMap((v$2) => '"Purs_' + v$2._1 + '"')(toUnfoldable3(allModules))) + '\n]\n\n[package]\nname = "purust_output"\nversion = "0.1.0"\nedition = "2021"\n\n[profile.release]\ndebug = true\nopt-level = 1\n\n[dependencies]\nmimalloc = "0.1.32"\nPurs_' + mainModuleSanitized + ' = { path = "Purs_' + mainModuleSanitized + '" }\npurust_core = { path = "purust_core" }\nperceus_ptr = { path = "/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr" }\n')();
            writeTextFile(UTF8)(outDir + "/src/main.rs")("#[global_allocator]\nstatic GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;\n\nfn main() {\n    let mut _effect = Purs_" + mainModuleSanitized + "::main();\n    (_effect.unwrap_func1())(purust_core::Value::Record_a(perceus_ptr::PerceusPtr::new(purust_core::Record_a { ..Default::default() })));\n}\n")();
            const coreDir = outDir + "/purust_core";
            const coreExists = existsSync(coreDir);
            const $2 = mkdir(coreDir);
            if (!coreExists) {
              $2();
              mkdir(coreDir + "/src")();
            }
            writeTextFile(UTF8)(coreDir + "/Cargo.toml")('[package]\nname = "purust_core"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nperceus_ptr = { path = "/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr" }\nfancy-regex = "0.13"\n')();
            writeTextFile(UTF8)(coreDir + "/src/lib.rs")(codegenPrelude((() => {
              const go$2 = (go$2$a0$copy) => (go$2$a1$copy) => {
                let go$2$a0 = go$2$a0$copy, go$2$a1 = go$2$a1$copy, go$2$c = true, go$2$r;
                while (go$2$c) {
                  const b = go$2$a0, v$2 = go$2$a1;
                  if (v$2.tag === "Nil") {
                    go$2$c = false;
                    go$2$r = b;
                    continue;
                  }
                  if (v$2.tag === "Cons") {
                    go$2$a0 = unsafeUnionWith(ordString.compare, $$const, b, collectRecordShapesModule(v$2._1));
                    go$2$a1 = v$2._2;
                    continue;
                  }
                  fail();
                }
                return go$2$r;
              };
              return go$2(Leaf)(finalModules);
            })()))();
            foldlArray((eff) => (v$2) => {
              const $3 = v$2._1;
              const $4 = v$2._2.code;
              const modDir = outDir + "/Purs_" + $3;
              return () => {
                eff();
                const modExists = existsSync(modDir);
                const $5 = mkdir(modDir);
                if (!modExists) {
                  $5();
                  mkdir(modDir + "/src")();
                }
                writeTextFile(UTF8)(modDir + "/Cargo.toml")('[package]\nname = "Purs_' + $3 + '"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\npurust_core = { path = "../purust_core" }\nperceus_ptr = { path = "/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr" }\nfancy-regex = "0.13"\n' + joinWith("\n")(arrayMap((i) => "Purs_" + i + ' = { path = "../Purs_' + i + '" }')((() => {
                  const $6 = lookup6($3)(finalTcMap);
                  if ($6.tag === "Just") {
                    return toUnfoldable13($6._1);
                  }
                  return [];
                })())))();
                return writeTextFile(UTF8)(modDir + "/src/lib.rs")(replace("use purust_core::*;\n")("use purust_core::*;\n" + joinWith("\n")(arrayMap((i) => "use Purs_" + i + "::*;")((() => {
                  const $6 = lookup6($3)(finalTcMap);
                  if ($6.tag === "Just") {
                    return toUnfoldable13($6._1);
                  }
                  return [];
                })())) + "\n")($4))();
              };
            })(() => {
            })(toUnfoldable3(allModules))();
            return log2("Successfully generated Rust code.")();
          };
        })()))));
      }));
    })
  );
  return () => {
    const fiber = $0();
    fiber.run();
  };
})();

// <stdin>
main();

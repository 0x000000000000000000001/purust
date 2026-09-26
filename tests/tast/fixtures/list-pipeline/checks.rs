use Purs_ListPipeline::List;
use Purs_ListPipelineConsumer::*;

fn sum_evens_reference(n: i64) -> i64 {
    (1..=n).filter(|x| x % 2 == 0).sum()
}


fn to_vec(list: std::rc::Rc<List>) -> Vec<i64> {
    let mut out = Vec::new();
    let mut current = list;
    loop {
        let next = match current.as_ref() {
            List::Nil => break,
            List::Cons(head, tail) => {
                out.push(head.clone().unwrap_int());
                tail.clone()
            }
        };
        current = next;
    }
    out
}

fn main() {
    for n in [-7_i64, 0, 1, 2, 3, 4, 10, 61, 900] {
        assert_eq!(ListPipelineConsumer_runEvens(n), sum_evens_reference(n), "sumEvens({n})");
    }

    // A captured (non-literal) lower bound keeps the same contract.
    for start in [-3_i64, 0, 1, 3, 8] {
        for n in [-2_i64, 0, 2, 7, 40] {
            let expected: i64 = (start..=n).filter(|x| x % 2 == 0).sum();
            assert_eq!(ListPipelineConsumer_runEvensFrom(start, n), expected, "sumEvensFrom({start}, {n})");
        }
    }

    // Multiplication is the other recognized associative operation.
    for n in [0_i64, 1, 2, 4, 5, 12] {
        let expected: i64 = (1..=n).filter(|x| x % 2 == 0).product();
        assert_eq!(ListPipelineConsumer_runProduct(n), expected, "productEvens({n})");
    }

    // Near misses keep the materialized path and must stay correct too.
    for n in [0_i64, 1, 6, 900] {
        let expected: i64 = (1..=n).sum();
        assert_eq!(ListPipelineConsumer_runAll(n), expected, "sumAll({n})");
    }
    for n in [0_i64, 1, 6, 11] {
        let expected = (1..=n).filter(|x| x % 2 == 0).fold(0_i64, |acc, x| acc - x);
        assert_eq!(ListPipelineConsumer_runDiff(n), expected, "diffEvens({n})");
    }


    // filter + reverse fusion: the result keeps its element order and only
    // the retained elements are materialized.
    for n in [0_i64, 1, 2, 5, 12, 61, 500] {
        let expected: Vec<i64> = (1..=n).filter(|x| x % 2 == 1).collect();
        assert_eq!(to_vec(ListPipelineConsumer_runFilteredOdds(n)), expected, "filteredOdds({n})");
    }

    // A non-tail local worker calls its Rust `fn` directly, without an
    // allocated bridge closure per element.
    let input: Vec<i64> = (1..=7).collect();
    let mut list = std::rc::Rc::new(List::Nil);
    for value in input.iter().rev() {
        list = std::rc::Rc::new(List::Cons(purust_core::mk_int(*value), list));
    }
    let doubled: Vec<i64> = input.iter().map(|x| x * 2).collect();
    assert_eq!(to_vec(ListPipelineConsumer_runMapDouble(list)), doubled, "mapDouble");

    println!("list pipeline checks passed");
}

use Purs_ListPipelineConsumer::*;

fn sum_evens_reference(n: i64) -> i64 {
    (1..=n).filter(|x| x % 2 == 0).sum()
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

    println!("list pipeline checks passed");
}

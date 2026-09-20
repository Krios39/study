pub fn collatz_conjecture(n: i32) -> Vec<i32> {
    let mut v = vec![n];
    let mut next_step = n;

    while next_step != 1 {
        if next_step % 2 == 0 {
            next_step /= 2;
        } else {
            next_step = 3 * next_step + 1;
        }
        v.push(next_step);
    }

    return v;
}
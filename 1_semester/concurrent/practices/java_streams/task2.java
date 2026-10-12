import java.util.stream.IntStream;

class Divisors {

    static int countDivisors(int n) {
        int count = 0;
        for (int i = 1; (long) i * i <= n; i++) {
            if (n % i == 0) {
                count += (i == n / i) ? 1 : 2;
            }
        }
        return count;
    }

    static int maxDivisorsSequential(int from, int to) {
        int max = 0;
        for (int n = from; n <= to; n++) {
            max = Math.max(max, countDivisors(n));
        }
        return max;
    }

    static int maxDivisorsParallel(int from, int to) {
        return IntStream.rangeClosed(from, to)
                .parallel()
                .map(Divisors::countDivisors)
                .max()
                .orElse(0);
    }

    public static void main(String[] args) {
        System.out.println("divisors of 8: " + countDivisors(8));
        System.out.println("divisors of 9: " + countDivisors(9));

        int[] limits = {1_000, 100_000, 10_000_000};
        for (int limit : limits) {
            long t0 = System.nanoTime();
            int seq = maxDivisorsSequential(1, limit);
            long seqMs = (System.nanoTime() - t0) / 1_000_000;

            t0 = System.nanoTime();
            int par = maxDivisorsParallel(1, limit);
            long parMs = (System.nanoTime() - t0) / 1_000_000;

            System.out.printf("1..%d: max divisors seq=%d (%d ms), parallel=%d (%d ms), speedup=%.2f%n",
                    limit, seq, seqMs, par, parMs, (double) seqMs / Math.max(parMs, 1));
        }
    }
}

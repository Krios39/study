import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.RecursiveTask;

public class task2 {

    public static int countProperDivisors(int n) {
        if (n <= 1) return 0;
        int count = 1;
        for (int i = 2; (long) i * i <= n; i++) {
            if (n % i == 0) {
                count += (i * i == n) ? 1 : 2;
            }
        }
        return count;
    }

    static class Result {
        final int number;
        final int divisors;

        Result(int number, int divisors) {
            this.number = number;
            this.divisors = divisors;
        }
    }

    static Result sequential(int from, int to) {
        int bestNumber = -1;
        int maxDivisors = -1;
        for (int i = from; i <= to; i++) {
            int c = countProperDivisors(i);
            if (c > maxDivisors) {
                maxDivisors = c;
                bestNumber = i;
            }
        }
        return new Result(bestNumber, maxDivisors);
    }

    static class DivisorTask extends RecursiveTask<Result> {
        private final int from;
        private final int to;
        private final int threshold;

        DivisorTask(int from, int to, int threshold) {
            this.from = from;
            this.to = to;
            this.threshold = threshold;
        }

        @Override
        protected Result compute() {
            if (to - from + 1 <= threshold) {
                return sequential(from, to);
            }

            int mid = from + (to - from) / 2;
            DivisorTask left = new DivisorTask(from, mid, threshold);
            DivisorTask right = new DivisorTask(mid + 1, to, threshold);

            left.fork();
            Result rightRes = right.compute();
            Result leftRes = left.join();

            return rightRes.divisors > leftRes.divisors ? rightRes : leftRes;
        }
    }

    static void runSequential(int end) {
        long t = System.currentTimeMillis();
        Result r = sequential(1, end);
        long ms = System.currentTimeMillis() - t;
        System.out.printf("Sequential 1..%,d | %6d ms | number %d (%d divisors)%n",
                end, ms, r.number, r.divisors);
    }

    static void runForkJoin(int end, int threshold, ForkJoinPool pool) {
        long t = System.currentTimeMillis();
        Result r = pool.invoke(new DivisorTask(1, end, threshold));
        long ms = System.currentTimeMillis() - t;
        System.out.printf("ForkJoin   threshold=%,10d | %6d ms | number %d (%d divisors)%n",
                threshold, ms, r.number, r.divisors);
    }

    public static void main(String[] args) {
        int[] ranges = {1_000, 100_000, 10_000_000};

        System.out.println("=== Sequential ===");
        for (int end : ranges) {
            runSequential(end);
        }

        System.out.println("\n=== Fork/Join, range 1..10,000,000 ===");
        System.out.println("Cores: " + Runtime.getRuntime().availableProcessors());
        ForkJoinPool pool = new ForkJoinPool();

        int[] thresholds = {10_000_000, 1_000_000, 100_000, 10_000, 1_000, 100, 10};
        for (int th : thresholds) {
            runForkJoin(10_000_000, th, pool);
        }
        pool.shutdown();
    }
}

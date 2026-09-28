import java.util.ArrayList;
import java.util.List;

public class ConcurrentDivisorFinder {

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

    static class RangeWorker extends Thread {
        private final int from;
        private final int to;
        private int maxDivisors = -1;
        private int bestNumber = -1;

        public RangeWorker(int from, int to) {
            this.from = from;
            this.to = to;
        }

        @Override
        public void run() {
            for (int i = from; i <= to; i++) {
                int c = countProperDivisors(i);
                if (c > maxDivisors) {
                    maxDivisors = c;
                    bestNumber = i;
                }
            }
        }

        public int getMaxDivisors() {
            return maxDivisors;
        }

        public int getBestNumber() {
            return bestNumber;
        }
    }

    public static void runBenchmark(int start, int end, int numChunks) throws InterruptedException {
        long startTime = System.currentTimeMillis();

        RangeWorker[] workers = new RangeWorker[numChunks];
        int totalNumbers = end - start + 1;
        int chunkSize = (int) Math.ceil((double) totalNumbers / numChunks);

        for (int i = 0; i < numChunks; i++) {
            int rangeStart = start + i * chunkSize;
            int rangeEnd = Math.min(end, rangeStart + chunkSize - 1);

            workers[i] = new RangeWorker(rangeStart, rangeEnd);
            workers[i].start();
        }

        int globalMax = -1;
        int bestNumber = -1;

        for (int i = 0; i < numChunks; i++) {
            workers[i].join();
            if (workers[i].getMaxDivisors() > globalMax) {
                globalMax = workers[i].getMaxDivisors();
                bestNumber = workers[i].getBestNumber();
            }
        }

        long elapsedMs = System.currentTimeMillis() - startTime;
        System.out.printf("Chunks: %3d | Time: %6d ms (%.2f s) | Max: %d (%d divisors)%n",
                numChunks, elapsedMs, elapsedMs / 1000.0, bestNumber, globalMax);
    }

    public static void main(String[] args) throws InterruptedException {
        int start = 1;
        int end = 10_000_000;

        System.out.println("Available CPU cores: " + Runtime.getRuntime().availableProcessors());
        System.out.println("Benchmarking range [1, 10,000,000] with contiguous chunks:\n");

        int[] chunkCounts = {1, 2, 4, 8, 16, 32, 64, 128};
        for (int chunks : chunkCounts) {
            runBenchmark(start, end, chunks);
        }
    }
}

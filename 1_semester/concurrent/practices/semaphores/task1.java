import java.util.concurrent.*;

public class COVIDShop {

    static class Shop {
        private final Semaphore places;

        Shop(int capacity) {
            this.places = new Semaphore(capacity, true);
        }

        void enter(int id) throws InterruptedException {
            System.out.println("Visitor " + id + " is waiting at the door");
            places.acquire();
            System.out.println("Visitor " + id + " ENTERED. Visitors inside: "
                    + (5 - places.availablePermits()));
        }

        void leave(int id) {
            places.release();
            System.out.println("Visitor " + id + " LEFT. Visitors inside: "
                    + (5 - places.availablePermits()));
        }
    }

    static class Visitor implements Runnable {
        private final int id;
        private final Shop shop;

        Visitor(int id, Shop shop) {
            this.id = id;
            this.shop = shop;
        }

        @Override
        public void run() {
            try {
                Thread.sleep(ThreadLocalRandom.current().nextInt(0, 5001));
                shop.enter(id);
                try {
                    Thread.sleep(ThreadLocalRandom.current().nextInt(10_000, 15_001));
                } finally {
                    shop.leave(id);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    public static void main(String[] args) throws InterruptedException {
        Shop shop = new Shop(5);
        ExecutorService executor = Executors.newFixedThreadPool(15);

        for (int i = 1; i <= 20; i++) {
            executor.submit(new Visitor(i, shop));
        }

        executor.shutdown();
        executor.awaitTermination(1, TimeUnit.MINUTES);
        System.out.println("Shop closed.");
    }
}

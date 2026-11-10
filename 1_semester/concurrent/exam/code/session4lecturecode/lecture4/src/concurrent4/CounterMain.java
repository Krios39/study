package concurrent4;

public class CounterMain{
	
    private static final int NUM_THREADS = 4;
    public static final int NUM_INCREMENTS = 10000;

    public static void main(String[] args) throws InterruptedException {
        Thread[] threads = new Thread[NUM_THREADS];
        CounterThread[] cthreads = new CounterThread[NUM_THREADS];
        Counter counter = new Counter();
        
        for (int i=0; i<NUM_THREADS; ++i) {
        	cthreads[i] = new CounterThread(counter);
            threads[i] = new Thread(cthreads[i]);
            threads[i].start();
        }
        
        for (int i=0; i<NUM_THREADS; ++i) {
            threads[i].join();
        }
        cthreads[1].getValue();
        System.out.println("total count = " + counter.getCount() + " vs. expected = " + (NUM_THREADS * NUM_INCREMENTS));
    }

}

class CounterThread implements Runnable {
    private Counter counter;

    public CounterThread(Counter counter) {
        this.counter = counter;
    }

    @Override
    public void run() {
        for (int i=0; i<CounterMain.NUM_INCREMENTS; ++i) {
            counter.incrementCount();
        }
    }

    public int getValue() {
    	return counter.getCount();
    }
}

class Counter {

    private int count = 0;

    public int getCount() {
        return count ;
    }
    public synchronized void incrementCount() {
    	int newvar=count+1;
    	count=newvar;
    }
}
package concurrent5;

import java.util.Date;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class ExecutorAndRunnable implements Runnable {
    @Override
    public void run() {
        try {
			Thread.sleep(1000);
		} catch (InterruptedException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
        //return the thread name executing this callable task
        System.out.println(Thread.currentThread().getName());
    }
    
    public static void main(String args[]) throws InterruptedException, ExecutionException{
        ExecutorService executor = Executors.newFixedThreadPool(10);
        ExecutorAndRunnable runnable = new ExecutorAndRunnable();
        executor.submit(runnable);
        System.out.println(new Date());
        executor.shutdown();
    }
}
package concurrent5;

import java.util.Date;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public class ExecutorAndCallable implements Callable<String> {
    @Override
    public String call() throws Exception {
        Thread.sleep(1000);
        //return the thread name executing this callable task
        return Thread.currentThread().getName();
    }
    
    public static void main(String args[]) throws InterruptedException, ExecutionException{
        ExecutorService executor = Executors.newFixedThreadPool(10);
        Callable<String> callable = new ExecutorAndCallable();
        Future<String> future = executor.submit(callable);
        System.out.println(new Date()+ "::"+future.get());
        executor.shutdown();
    }
}

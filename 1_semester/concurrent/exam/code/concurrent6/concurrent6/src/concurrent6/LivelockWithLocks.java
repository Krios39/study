package concurrent6;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class LivelockWithLocks {

    private Lock lock1 = new ReentrantLock(true);
    private Lock lock2 = new ReentrantLock(true);

    public static void main(String[] args) {
        LivelockWithLocks livelock = new LivelockWithLocks();
        new Thread(livelock::operation1, "T1").start();
        new Thread(livelock::operation2, "T2").start();
    }

    public void operation1() {
        while (true) {
            try {
				lock1.tryLock(50, TimeUnit.MILLISECONDS);
			} catch (InterruptedException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
            System.out.println("lock1 acquired, trying to acquire lock2.");
            try {
				Thread.sleep(50);
			} catch (InterruptedException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}

            if (lock2.tryLock()) {
            	System.out.println("lock2 acquired.");
            } else {
            	System.out.println("cannot acquire lock2, releasing lock1.");
                lock1.unlock();
                continue;
            }

            System.out.println("executing first operation.");
            break;
        }
        lock2.unlock();
        lock1.unlock();
    }

    public void operation2() {
        while (true) {
            try {
				lock2.tryLock(50, TimeUnit.MILLISECONDS);
			} catch (InterruptedException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
            System.out.println("lock2 acquired, trying to acquire lock1.");
            try {
				Thread.sleep(50);
			} catch (InterruptedException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}

            if (lock1.tryLock()) {
            	System.out.println("lock1 acquired.");
            } else {
            	System.out.println("cannot acquire lock1, releasing lock2.");
                lock2.unlock();
                continue;
            }

            System.out.println("executing second operation.");
            break;
        }
        lock1.unlock();
        lock2.unlock();
    }

    // helper methods

}
package concurrent6;

public class Deadlock{
	public static void main(String[] args){
		final String r1 = "deadlock";
		final String r2 = "example";

		Thread t1 = new Thread() {
			public void run(){
				synchronized(r2){
					System.out.println("Thread 1: Locked r2");
					try{ Thread.sleep(100);} catch(InterruptedException e) {}
					synchronized(r1){
						System.out.println("Thread 1: Locked r1");
					}
				}
			}
		};
		Thread t2 = new Thread() {
			public void run(){
				synchronized(r1){
					System.out.println("Thread 2: Locked r1");
					try{ Thread.sleep(100);} catch(InterruptedException e) {}
					synchronized(r2){
						System.out.println("Thread 2: Locked r2");
					}
				}
			}
		};

		t1.start();
		t2.start();
	}
}
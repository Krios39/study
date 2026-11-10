package concurrent4;

public class Thread1 {
	//demonstrates the main thread
	public static void main(String[] args) throws InterruptedException {
		Thread.sleep(1000);
		System.out.println(Thread.currentThread().getName());
	}
}

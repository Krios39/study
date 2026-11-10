package concurrent4;

//demonstrates runnable
public class Thread4{
	public static void main(String[] args) throws InterruptedException {
		Thread t=new Thread(new MyThread3());
		t.start();
		t.join();
		System.out.println("joined");
	}
}

class MyThread3 implements Runnable {
	@Override
	public void run() {
		System.out.println("thread in run");
		try {
			Thread.sleep(1000);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}
}

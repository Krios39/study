package concurrent4;

//demonstrates non-determinism
public class Thread3{
	public static void main(String[] args) throws InterruptedException {
		Thread t=new MyThread2();
		t.start();
		System.out.println("main 1");
		Thread.sleep(100);
		System.out.println("main 2");
		Thread.sleep(100);
		System.out.println("main 3");
		Thread.sleep(100);
		System.out.println("main 4");
	}
}

class MyThread2 extends Thread {
	@Override
	public void run() {
		try {
			System.out.println("thread in run 1");
			Thread.sleep(100);
			System.out.println("thread in run 2");
			Thread.sleep(100);
			System.out.println("thread in run 3");
			Thread.sleep(100);
			System.out.println("thread in run 4");
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}
}

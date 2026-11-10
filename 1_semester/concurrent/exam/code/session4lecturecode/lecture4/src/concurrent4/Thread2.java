package concurrent4;

//demonstrates start/join
public class Thread2{
	public static void main(String[] args) throws InterruptedException {
		Thread t=new MyThread();
		t.start();
		t.join();
		System.out.println("joined");
	}
}

class MyThread extends Thread {
	@Override
	public void run() {
		int x=5;
		System.out.println("thread in run");
		try {
			Thread.sleep(1000);
		} catch (InterruptedException e) {
			e.printStackTrace();
		}
	}
}

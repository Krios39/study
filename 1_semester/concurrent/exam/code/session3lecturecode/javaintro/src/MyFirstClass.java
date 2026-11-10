
public class MyFirstClass {

	public static void main(String[] args) {
		int a=0;
		float b=6;
		boolean c=true;
		char d='d';
		int a2=d;
		int[] f=new int[5];
		a=f[2]+6;
		c=c && d>5;
		String s="ghgfhgfhd";
		if(b>4) {
			int h=6;
			System.out.println("b greater than 4");
			System.out.println("b greater than 4");
		}
		for(int i=1;i<7;i++) {
			System.out.println(i);
		}
		while(a<7) {
			a++;
		}
		System.out.println("Hello world! "+a+" "+a);
		Car car1=new Car();
		Car car2=new Car();
		Car car3=null;
		if(a>0) {
			car3=car1;
		}
		car3.accelarate(6);
		car1.accelarate(4);
		Pushbike bike1=new Pushbike();
		bike1.setPowered(true);
		Vehicle x=new Car();
		a=Math.abs(-6);
		System.out.println(car1.getSpeed()+"  "+car2.getSpeed());
	}
	
}

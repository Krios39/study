
public class Car extends Vehicle{
	
	private int speed=0;
	private int numberOfSeats=5;
	private String manufacturer="Opel";
	
	
	public int getNumberOfSeats() {
		return numberOfSeats;
	}
	
	public int accelarate(int accelaration) {
		if(accelaration<200) {
			speed=speed+accelaration;
		}
		return speed;
	}
	
	public int getSpeed() {
		return speed;
	}

	public boolean isPowered() {
		return true;
	}
	
	public void crash(Vehicle x) {
		
	}

}

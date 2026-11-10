package concurrent6;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;

public class Streams {
	public static void main(String[] args) {
		List<Person> roster=new ArrayList<>();
		double average = roster.parallelStream().filter(p -> p.getGender() == Person.Sex.MALE)
			    .mapToInt(Person::getAge).average().getAsDouble();
		long empCount = roster.stream().filter(e -> e.getSalary() > 200000).count();
		long empCount2 = roster.stream().peek(System.out::println).filter(e -> e.getSalary() > 200000).count();
		boolean matchedResult = roster.stream().map(p->p.getName()).allMatch((s) -> s.startsWith("A"));
		boolean matchedResult2 = roster.stream().noneMatch((p) -> p.getName().startsWith("A"));
		IntStream values = IntStream.of(1,2,3,4); 
		IntStream newValues = values.flatMap((v) -> Arrays.asList(v *v, v*v*v, v+1).stream().mapToInt(Integer::intValue)); 
	}

}

class Person {
	public static enum Sex {MALE, FEMALE, DIVERSE}
	 
    private String name;
    private int age;
    private String nationality;
    private Sex gender;
    private int salary;
 
    public Person(String name, int age, String nationality, Sex gender, int salary) {
        this.name = name;
        this.age = age;
        this.nationality = nationality;
        this.salary=salary;
        this.gender=gender;
    }
 
    public Person(String name, int age) {
        this(name, age, "", Sex.DIVERSE, 0);
    }
 
    public String getName() {
        return name;
    }
    
    public int getSalary() {
    	return salary;
    }
    
    public Sex getGender() {
    	return gender;
    }
 
    public int getAge() {
        return age;
    }
 
  public String getNationality() {
    return nationality;
  }
}
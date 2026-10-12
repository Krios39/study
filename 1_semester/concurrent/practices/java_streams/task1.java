import java.util.Comparator;
import java.util.List;
import java.util.stream.IntStream;

class PersonStreams {

    public static void main(String[] args) {
        List<String> names = List.of("william", "jones", "aaron", "bob", "frank", "gillian");
        int lettersSum = names.stream()
                .filter(name -> name.length() > 4)
                .mapToInt(String::length)
                .sum();
        System.out.println("Sum of letters of names longer than 4: " + lettersSum);

        int n = 20;
        int evenSum = IntStream.rangeClosed(1, n)
                .filter(i -> i % 2 == 0)
                .sum();
        System.out.println("Sum of even numbers from 2 to " + n + ": " + evenSum);

        List<Person> persons = List.of(
                new Person("Alice", 30, "US"),
                new Person("Boris", 45, "RU"),
                new Person("Chen", 28, "CN"),
                new Person("Dieter", 52, "DE"));

        int maxAge = persons.stream()
                .mapToInt(Person::getAge)
                .max()
                .orElseThrow();
        System.out.println("Age of the oldest person: " + maxAge);

        String oldestName = persons.stream()
                .max(Comparator.comparingInt(Person::getAge))
                .map(Person::getName)
                .orElseThrow();
        System.out.println("Name of the oldest person: " + oldestName);
    }
}


class Person {

    private String name;
    private int age;
    private String nationality;

    public Person(String name, int age, String nationality) {
        this.name = name;
        this.age = age;
        this.nationality = nationality;
    }

    public Person(String name, int age) {
        this(name, age, "");
    }

    public String getName() {
        return name;
    }

    public int getAge() {
        return age;
    }

  public String getNationality() {
    return nationality;
  }
}

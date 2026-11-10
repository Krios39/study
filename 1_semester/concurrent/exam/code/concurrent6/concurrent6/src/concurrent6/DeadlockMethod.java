package concurrent6;

//from https://stackoverflow.com/questions/6260038/deadlocks-and-synchronized-methods
class A
{
  synchronized void methodA(B b)
  {
    b.last();
  }

  synchronized void last()
  {
    System.out.println("Inside A.last()");
  }
}

class B
{
  synchronized void methodB(A a)
  {
    a.last();
  }

  synchronized void last()
  {
    System.out.println("Inside B.last()");
  }
}

public class DeadlockMethod implements Runnable 
{
  A a = new A(); 
  B b = new B();

  // Constructor
  public DeadlockMethod()
  {
    Thread t = new Thread(this); 
    t.start();
    a.methodA(b);
  }

  public void run()
  {
    b.methodB(a);
  }

  public static void main(String args[] )
  {
    new DeadlockMethod();
  }
}

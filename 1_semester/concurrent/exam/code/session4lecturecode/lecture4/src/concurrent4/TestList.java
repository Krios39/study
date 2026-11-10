package concurrent4;

import java.util.ArrayList;
import java.util.List;
import java.util.Vector;

public class TestList {
    static final List<Integer> list = new ArrayList<Integer>();
    public static void main(String[] args) {
        new Thread(new Runnable() {
            public void run() {
                for (int i = 1; i <= 100; i++) {
                    list.add(Integer.valueOf(i));
                }
                System.out.println("List size at thread 0 : " + list.size());
            }
        }).start();
        new Thread(new Runnable() {
            public void run() {
                for (int i = 101; i <= 200; i++) {
                    list.add(Integer.valueOf(i));
                }
                System.out.println("List size at thread 1 : " + list.size());
            }
        }).start();
    }
}
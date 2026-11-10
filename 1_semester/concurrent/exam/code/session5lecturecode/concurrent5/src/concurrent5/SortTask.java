package concurrent5;

import java.util.Arrays;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.RecursiveAction;

//from https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/RecursiveAction.html
public class SortTask extends RecursiveAction {
	   final long[] array; final int lo, hi;
	   SortTask(long[] array, int lo, int hi) {
	     this.array = array; this.lo = lo; this.hi = hi;
	   }
	   SortTask(long[] array) { this(array, 0, array.length); }
	   protected void compute() {
	     if (hi - lo < THRESHOLD)
	       sortSequentially(lo, hi);
	     else {
	       int mid = (lo + hi) >>> 1;
	       invokeAll(new SortTask(array, lo, mid),
	                 new SortTask(array, mid, hi));
	       merge(lo, mid, hi);
	     }
	   }
	   // implementation details follow:
	   static final int THRESHOLD = 1000;
	   void sortSequentially(int lo, int hi) {
	     Arrays.sort(array, lo, hi);
	   }
	   void merge(int lo, int mid, int hi) {
	     long[] buf = Arrays.copyOfRange(array, lo, mid);
	     for (int i = 0, j = lo, k = mid; i < buf.length; j++)
	       array[j] = (k == hi || buf[i] < array[k]) ?
	         buf[i++] : array[k++];
	   }
	   
	   public static void main(String[] args) {
		   //not a good example - why?
		   long[] tosort={5,1,9,4,56,32,2};
		   RecursiveAction action = new SortTask(tosort);
		   ForkJoinPool commonPool = ForkJoinPool.commonPool();
		   commonPool.execute(action);
		   action.join();
		   System.out.println(Arrays.toString(tosort));
	   }
	   
}
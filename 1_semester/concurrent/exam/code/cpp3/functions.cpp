#include <iostream>   
#include <cstdlib>  
#include <string>  
using namespace std;

void change(int* y){
    *y=6;
}

void swap(int &x, int &y) {
   int temp;
   temp = x; /* save the value at address x */
   x = y;    /* put y into x */
   y = temp; /* put x into y */
  
   return;
}

int main () { 
    int* x=new int;
    *x=5;
    change(x);
    cout << *x << "\n";
	
	int a=6;
	int b=7;
	swap(a,b);
	cout << a<< b << endl;
}
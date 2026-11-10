#include <iostream>       /* As before */
#include <cstdlib>        /* C library (for converting numbers)*/
#include <cstring>        /* strcmp function*/
#include "functions.h"    /* Our function */
using namespace std;

long minimum (long a, long b) { 
    a=6;
    if (a > b) 
        return b; 
    else 
        return a; 
} 

int main(int argc, char *argv[]) {
 
 if (argc != 4) {         /* Check if there are enough parameters */
   cerr << "Error: Wrong number of command line parameters!" << endl;
   return EXIT_FAILURE;
 }
 
 long a = atol (argv[1]); /* Convert text to number */
 long b = atol (argv[2]);
 if(a==b ){
   cout << "a equals b" << endl;
 }else{
  cout << "a unequls b" << endl;
 }
 if (strcmp (argv[3], "minimum") == 0)
   cout << "min (" << a << ", " << b << ") = " << minimum (a, b) << endl;
 return EXIT_SUCCESS;
}
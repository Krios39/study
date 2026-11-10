
#include <iostream>   
#include <cstdlib>  
#include <string>  
using namespace std;


template <typename T>
T getMin (T a, T b) {
      return ((a < b) ? a : b );
}
 
int main () {         
    int mini=getMin(5,3);
    cout << "min int " << mini << "\r\n";
    string a="a";
    string b="b";
    string mins=getMin(a,b);
    cout << "min string " << mins << "\r\n";
    return EXIT_SUCCESS;
}
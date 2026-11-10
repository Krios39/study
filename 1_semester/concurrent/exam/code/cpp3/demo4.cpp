
#include <iostream>   
#include <cstdlib>    
#include <vector>
#include <stack>
using namespace std;  
 
int main () { 
    vector<float> polynoomiKordajad;    // vektor of floats
    polynoomiKordajad.push_back (1.7);  // add some floats
    polynoomiKordajad.push_back (4.6);
    polynoomiKordajad.push_back (-5.1); // push_back adds them to the end
    
    for (float kordaja : polynoomiKordajad) {  // loop over container (C++11)
        cout << kordaja << "\n";                       // do something with the element
    }
    
    auto it = polynoomiKordajad.begin ();     // type of the iterator is auto
    while (it != polynoomiKordajad.end ()) {  // while not at the end
        float kordaja = *it;   // read float at the current position
        cout << kordaja << "\n";                    // do soemthnin
        it++;                  // move on
    }
}
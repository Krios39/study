
#include <iostream>   
#include <cstdlib>    
#include <vector>
#include <stack>
using namespace std;  
 
int main () { 
    vector<string> laused;     // define a vector of strings
    std::string la = "Aias sadas saia.";
    laused.push_back (la);               // store laat end of vector
    std::string rida = laused[0];        // retrieve vector’s first element
    cout << rida << "\n";
    std::stack<int> arvudepinu;          // define stack of ints
    int a = 7;
    arvudepinu.push(a);                  // push integer to stack
    int b = arvudepinu.top ();           // compiler knows the type
    cout << b << "\n";
}
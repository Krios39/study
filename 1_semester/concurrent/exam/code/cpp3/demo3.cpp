
template <class T>          // T represents the class parameter
class Line {                // we define a line
public:
     T p1;                  // attribute of type T
     T p2;                  // another attribute of type T
     Line () = default;     // default constructor
     Line (T np1, T np2)    // a parametrized constructor
           : p1 (np1)
           , p2 (np2)
     {}
     float length () {      // calculating length
 
           return p1.distanceFrom (p2); // distanceFrom must exist in T
     }
};
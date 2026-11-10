
#include <iostream>   
#include <cstdlib>    
using namespace std;  

class Rectangle {
	private:
		int x;
		
		int privatemethod(){
			return x;
		}
	
  public:
    int width, height;

  int surface(){
    return width*height;
  }
};



int main () {
    Rectangle rect1;       
    rect1.width=5;
    rect1.height=6;
    int surface1=rect1.surface();
    Rectangle rect2;
    rect2.width=3;
    rect2.height=4;
    int surface2=rect2.surface();
	Rectangle* rect3=new Rectangle();
	rect3->width=3;
	int* pointertoint=&rect1.width;
    cout << "surface 1 " << surface1 << ", surface 2 " << surface2 << ", value of pointertoint " << *pointertoint << "\r\n";
	delete rect3;
	rect3=new Rectangle();
	int* p2=new int;
    return EXIT_SUCCESS;
}
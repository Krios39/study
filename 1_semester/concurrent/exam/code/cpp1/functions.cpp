/*  See funktsioon tagastab kahe sisendi miinimumi
CPP failis on funktsiooni keha. */ 
#include "functions.h"  /* Kui funktsioon kasutab teist, peab teise */ 
			/* deklaratsioon sellele eelnema. */ 
long minimum (long a, long b) { 
    if (a > b) 
        return b; 
    else 
        return a; 
} 

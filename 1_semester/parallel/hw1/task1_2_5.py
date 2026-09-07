# file: leastsquares.py
# 2D point cloud fitting with a line
# run with: $ python leastsquares.py
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.lines as mlines
from time import perf_counter

def newline(p1, p2, color):
    ax = plt.gca()
    xmin, xmax = ax.get_xbound()

    if(p2[0] == p1[0]):
        xmin = xmax = p1[0]
        ymin, ymax = ax.get_ybound()
    else:
        ymax = p1[1]+(p2[1]-p1[1])/(p2[0]-p1[0])*(xmax-p1[0])
        ymin = p1[1]+(p2[1]-p1[1])/(p2[0]-p1[0])*(xmin-p1[0])

    l = mlines.Line2D([xmin,xmax], [ymin,ymax],color=color)
    ax.add_line(l)
    return l

n= 123;
x = np.linspace(0.0, 1.0, n)
y_line = -2*x + 3

y = y_line + np.random.normal(0, 0.55, n)
t_start = perf_counter()
A = np.array([x, np.ones(n)])
A = A.transpose()
result = np.linalg.lstsq(A, y, rcond=None)
t_elapsed = perf_counter() - t_start
print(f"Elapsed time: {t_elapsed:.6f} seconds")
print ('result=',result)
a, b = result[0]
p=[(x[i],y[i]) for i in range(len(x))]
p0 = (0,a*0 + b); p1 = (1,a*1 + b)

plt.figure(1)
plt.xlabel('x')
plt.ylabel('y')
plt.title('Blue - original line; red - fitted line: ')
plt.legend(['Legend'])
plt.plot(x, y, 'r.')
newline(p0,p1,'red')
newline((0,3),(1,1),'blue')
plt.tight_layout()
plt.savefig("1_2_5_result.png", dpi=150)

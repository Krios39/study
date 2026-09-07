import matplotlib
matplotlib.use('Agg')
import numpy as np
import matplotlib.pyplot as plt
from time import perf_counter

def newsurface(a, b, c, color, alpha=0.5):
    ax = plt.gca()
    x_surf = np.linspace(0, 1, 20)
    y_surf = np.linspace(0, 1, 20)
    x_surf, y_surf = np.meshgrid(x_surf, y_surf)
    z_surf = a*x_surf + b*y_surf + c
    return ax.plot_surface(x_surf, y_surf, z_surf, color=color, alpha=alpha)

n = 123;
x = np.random.uniform(0.0, 1.0, n)
y = np.random.uniform(0.0, 1.0, n)
z_plane = -2*x + 3*y + 1

z = z_plane + np.random.normal(0, 0.55, n)
t_start = perf_counter()
A = np.array([x, y, np.ones(n)])
A = A.transpose()
result = np.linalg.lstsq(A, z, rcond=None)
t_elapsed = perf_counter() - t_start
print(f"Elapsed time: {t_elapsed:.6f} seconds")
print ('result=',result)
a, b, c = result[0]

fig = plt.figure(1)
ax = fig.add_subplot(111, projection='3d')
ax.set_xlabel('x')
ax.set_ylabel('y')
ax.set_zlabel('z')
plt.title('Blue - original plane; red - fitted plane')

ax.plot(x, y, z, 'r.')
newsurface(a, b, c, 'red', alpha=0.4)
newsurface(-2, 3, 1, 'blue', alpha=0.2)

plt.tight_layout()
plt.savefig("1_bonus_result.png", dpi=150)

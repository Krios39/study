type Colour = [number, number, number];

const WIDTH = 22;
const HEIGHT = 36;
const HOTTEST = 15;
const TUBE = { left: 8, right: 13, top: 10, bottom: 31 };
const FIRE: Colour[] = [[70, 8, 4], [200, 40, 10], [250, 140, 20], [255, 220, 90], [255, 255, 220]];
const ICE: Colour[] = [[18, 36, 90], [36, 100, 200], [110, 190, 240], [190, 232, 252], [240, 250, 255]];
const LIQUID: [Colour, Colour] = [[220, 38, 38], [59, 130, 246]];
const GLASS: [Colour, Colour] = [[58, 40, 40], [150, 190, 220]];

export class Flame {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly cells = new Uint8Array(WIDTH * HEIGHT);
  private readonly body = new Uint8Array(WIDTH * HEIGHT);
  private readonly frost = new Float32Array(WIDTH * HEIGHT);
  private readonly interval: number;
  private waited = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fire";
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.context = this.canvas.getContext("2d")!;
    this.image = this.context.createImageData(WIDTH, HEIGHT);
    this.interval = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.5 : 1 / 14;
    for (let index = 0; index < this.frost.length; index++) this.frost[index] = 0.5 * Math.random() + 0.5 * (1 - Math.floor(index / WIDTH) / (HEIGHT - 1));
    for (let y = TUBE.top; y <= TUBE.bottom; y++) {
      for (let x = TUBE.left; x <= TUBE.right; x++) {
        const corner = (x === TUBE.left || x === TUBE.right) && (y === TUBE.top || y === TUBE.bottom);
        if (corner) continue;
        const edge = x === TUBE.left || x === TUBE.right || y === TUBE.top || y === TUBE.bottom;
        const rounded = (x === TUBE.left + 1 || x === TUBE.right - 1) && (y === TUBE.top + 1 || y === TUBE.bottom - 1);
        this.body[y * WIDTH + x] = edge || rounded ? 1 : 2;
      }
    }
  }

  step(seconds: number, heat: number) {
    this.waited += seconds;
    if (this.waited < this.interval) return;
    this.waited = 0;
    this.spread(heat);
    this.paint(heat);
  }

  private spread(heat: number) {
    const { cells, body, frost } = this;
    const strength = Math.round(HOTTEST * (0.7 + 0.3 * heat));
    const cold = 1 - heat;
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const index = y * WIDTH + x;
        if (body[index] > 0) {
          cells[index] = strength;
        } else if (y === HEIGHT - 1) {
          cells[index] = x >= TUBE.left - 3 && x <= TUBE.right + 3 ? Math.max(0, strength - 3 - Math.floor(Math.random() * 3)) : 0;
        } else if (frost[index] >= cold) {
          const below = Math.max(0, Math.min(WIDTH - 1, x + Math.floor(Math.random() * 3) - 1));
          cells[index] = Math.max(0, cells[(y + 1) * WIDTH + below] - Math.floor(Math.random() * 3));
        }
      }
    }
  }

  private paint(heat: number) {
    const { cells, body, frost } = this;
    const { data } = this.image;
    const cold = 1 - heat;
    const level = TUBE.bottom - 1 - Math.round((TUBE.bottom - TUBE.top - 2) * heat);
    for (let index = 0; index < cells.length; index++) {
      const y = Math.floor(index / WIDTH);
      let colour: Colour | undefined;
      const frozen = frost[index] < cold;
      if (body[index] === 1) colour = GLASS[frozen ? 1 : 0];
      else if (body[index] === 2) colour = y >= level ? LIQUID[frozen ? 1 : 0] : undefined;
      else if (cells[index] > 0) colour = Flame.shade(frozen ? ICE : FIRE, cells[index]);
      data[index * 4] = colour ? colour[0] : 128;
      data[index * 4 + 1] = colour ? colour[1] : 128;
      data[index * 4 + 2] = colour ? colour[2] : 128;
      data[index * 4 + 3] = colour ? 255 : body[index] === 2 ? 40 : 0;
    }
    this.context.putImageData(this.image, 0, 0);
  }

  private static shade(palette: Colour[], value: number): Colour {
    const at = ((value - 1) / (HOTTEST - 1)) * (palette.length - 1);
    const low = Math.floor(at);
    return Flame.mix(palette[low], palette[Math.min(palette.length - 1, low + 1)], at - low);
  }

  private static mix(from: Colour, to: Colour, share: number): Colour {
    return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share, from[2] + (to[2] - from[2]) * share];
  }
}

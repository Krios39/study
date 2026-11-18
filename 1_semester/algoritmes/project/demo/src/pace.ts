export class Pace {
  static readonly SLOWEST = 0.5;
  static readonly FASTEST = 2_000_000;

  auto = true;
  private manual = 4;
  private elapsed = 0;
  private initial = 1;
  private growth = 0;

  static at(position: number): number {
    return Pace.SLOWEST * Math.pow(Pace.FASTEST / Pace.SLOWEST, position);
  }

  get rate(): number {
    return this.auto ? Math.min(Pace.FASTEST, this.initial * Math.exp(this.growth * this.elapsed)) : this.manual;
  }

  get position(): number {
    return Math.log(this.rate / Pace.SLOWEST) / Math.log(Pace.FASTEST / Pace.SLOWEST);
  }

  plan(steps: number, seconds: number, initial: number) {
    this.elapsed = 0;
    this.initial = initial;
    this.growth = 0;
    if (initial * seconds >= steps) return;
    let low = 0;
    let high = 5;
    for (let i = 0; i < 60; i++) {
      const middle = (low + high) / 2;
      if ((initial * (Math.exp(middle * seconds) - 1)) / middle < steps) low = middle;
      else high = middle;
    }
    this.growth = high;
  }

  spend(seconds: number) {
    if (this.auto) this.elapsed += seconds;
  }

  choose(rate: number) {
    this.auto = false;
    this.manual = rate;
  }
}

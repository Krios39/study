export class Format {
  static count(value: number): string {
    return Math.round(value).toLocaleString("en-US");
  }

  static signed(value: number): string {
    return `${value < 0 ? "−" : "+"}${Format.count(Math.abs(value))}`;
  }

  static percent(share: number): string {
    if (share >= 0.995) return "100%";
    if (share < 0.0005) return "almost 0%";
    return share < 0.1 ? `${(share * 100).toFixed(1)}%` : `${Math.round(share * 100)}%`;
  }

  static rate(perSecond: number): string {
    if (perSecond < 10) return `${perSecond.toFixed(1)} steps/s`;
    if (perSecond < 1000) return `${Math.round(perSecond)} steps/s`;
    if (perSecond < 1_000_000) return `${Math.round(perSecond / 1000)}k steps/s`;
    return `${(perSecond / 1_000_000).toFixed(1)}M steps/s`;
  }
}

import { Lang } from "./text.ts";

export class Format {
  static count(value: number): string {
    return Lang.number(value);
  }

  static signed(value: number): string {
    return `${value < 0 ? "−" : "+"}${Format.count(Math.abs(value))}`;
  }

  static percent(share: number): string {
    if (share >= 0.995) return "100%";
    if (share < 0.0005) return Lang.t("percent.almostZero");
    return share < 0.1 ? `${(share * 100).toFixed(1)}%` : `${Math.round(share * 100)}%`;
  }

  static rate(perSecond: number): string {
    if (perSecond < 10) return Lang.t("rate.plain", { value: perSecond.toFixed(1) });
    if (perSecond < 1000) return Lang.t("rate.plain", { value: String(Math.round(perSecond)) });
    if (perSecond < 1_000_000) return Lang.t("rate.thousand", { value: String(Math.round(perSecond / 1000)) });
    return Lang.t("rate.million", { value: (perSecond / 1_000_000).toFixed(1) });
  }
}

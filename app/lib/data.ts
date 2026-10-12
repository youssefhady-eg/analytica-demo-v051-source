import adsetsJson from "@/data/adsets.json";
import adsJson from "@/data/ads.json";
import dailyJson from "@/data/daily_adset.json";
import funnelJson from "@/data/funnel.json";
import gapsJson from "@/data/gaps.json";
import metaJson from "@/data/meta.json";
import type { DemoData, GapLibrary } from "./types";

/** Static sample dataset ("Cairo Thread"). The default DemoData; the uploader
 *  swaps in merchant-CSV data with the same shape at runtime. */
export const sampleData: DemoData = {
  source: "sample",
  brand: metaJson.brand,
  assumptions: metaJson.assumptions,
  adsets: adsetsJson as DemoData["adsets"],
  ads: adsJson as DemoData["ads"],
  daily: dailyJson as DemoData["daily"],
  funnel: funnelJson as DemoData["funnel"],
  gaps: gapsJson as GapLibrary,
  hasAds: true,
  hasDaily: true,
  hasFunnel: true,
  hasAdLinkage: true,
};

// Back-compat re-exports for the pre-refactor frame code (being migrated).
export const { adsets, ads, brand, assumptions } = {
  adsets: sampleData.adsets,
  ads: sampleData.ads,
  brand: sampleData.brand,
  assumptions: sampleData.assumptions,
};
export const dailyAdset = sampleData.daily;
export const funnel = sampleData.funnel;
export const AOV = sampleData.brand.aov_egp;

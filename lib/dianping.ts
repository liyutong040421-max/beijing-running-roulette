// 大众点评 has no public API. We use deeplinks:
//  - Mobile: dianping://search?keyword=店名 — opens the app's search page
//  - Desktop / app not installed: https://www.dianping.com/search/keyword/{cityId}/0_{encodedKeyword}
// Beijing's 大众点评 cityId is 2.

const BEIJING_CITY_ID = 2;

export function dianpingDeeplink(name: string): string {
  return `dianping://search?keyword=${encodeURIComponent(name)}`;
}

export function dianpingWebUrl(name: string, cityId = BEIJING_CITY_ID): string {
  return `https://www.dianping.com/search/keyword/${cityId}/0_${encodeURIComponent(name)}`;
}

// Cuisine + locality search, e.g. dianpingCuisineUrl("拉面", "三里屯/白家庄")
// → keyword "三里屯 拉面" so dianping returns area-localized results.
export function dianpingCuisineUrl(cuisine: string, area: string): string {
  const locality = area.split(/[\/／]/)[0]?.trim() || area;
  return dianpingWebUrl(`${locality} ${cuisine}`.trim());
}

export type SchoolBrand = {
  logo: string;
  color: string;
  colorHex: string;
};

const BRANDS: { keywords: string[]; brand: SchoolBrand }[] = [
  {
    keywords: ["قناديل", "الشرق"],
    brand: { logo: "/schools/qanadeel.png", color: "bg-pink-600", colorHex: "#b8347a" },
  },
  {
    keywords: ["أجيال", "المعالي"],
    brand: { logo: "/schools/agial.png", color: "bg-amber-700", colorHex: "#9c6f1f" },
  },
  {
    keywords: ["الضاحية", "بنين"],
    brand: { logo: "/schools/aldahia-boys.png", color: "bg-red-600", colorHex: "#c4302b" },
  },
  {
    keywords: ["الضاحية", "بنات"],
    brand: { logo: "/schools/aldahia-girls.png", color: "bg-blue-700", colorHex: "#1e4d8c" },
  },
  {
    keywords: ["الضاحية"],
    brand: { logo: "/schools/aldahia-girls.png", color: "bg-blue-700", colorHex: "#1e4d8c" },
  },
];

export function getSchoolBrand(schoolName: string | null | undefined): SchoolBrand | null {
  if (!schoolName) return null;
  for (const { keywords, brand } of BRANDS) {
    if (keywords.every((k) => schoolName.includes(k)) || keywords.some((k) => schoolName.includes(k))) {
      return brand;
    }
  }
  return null;
}

export function getSchoolLogo(schoolName: string | null | undefined, logoUrl?: string | null): string | null {
  if (logoUrl) return logoUrl;
  return getSchoolBrand(schoolName)?.logo ?? null;
}

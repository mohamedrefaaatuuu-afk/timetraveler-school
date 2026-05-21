export type SchoolBrand = {
  logo: string;
  color: string;
  colorHex: string;
};

const BRANDS: { keywords: string[]; mode: "every" | "some"; brand: SchoolBrand }[] = [
  {
    keywords: ["قناديل"],
    mode: "some",
    brand: { logo: "/schools/qanadeel.png", color: "bg-violet-700", colorHex: "#6d28d9" },
  },
  {
    keywords: ["أجيال"],
    mode: "some",
    brand: { logo: "/schools/agial.png", color: "bg-amber-700", colorHex: "#9c6f1f" },
  },
  {
    keywords: ["الضاحية", "بنين"],
    mode: "every",
    brand: { logo: "/schools/aldahia-boys.png", color: "bg-red-600", colorHex: "#c4302b" },
  },
  {
    keywords: ["الضاحية", "بنات"],
    mode: "every",
    brand: { logo: "/schools/aldahia-girls.png", color: "bg-blue-700", colorHex: "#1e4d8c" },
  },
  {
    keywords: ["الضاحية"],
    mode: "some",
    brand: { logo: "/schools/aldahia-girls.png", color: "bg-blue-700", colorHex: "#1e4d8c" },
  },
];

export function getSchoolBrand(schoolName: string | null | undefined): SchoolBrand | null {
  if (!schoolName) return null;
  for (const { keywords, mode, brand } of BRANDS) {
    const match = mode === "every"
      ? keywords.every((k) => schoolName.includes(k))
      : keywords.some((k) => schoolName.includes(k));
    if (match) return brand;
  }
  return null;
}

export function getSchoolLogo(schoolName: string | null | undefined, logoUrl?: string | null): string | null {
  if (logoUrl) return logoUrl;
  return getSchoolBrand(schoolName)?.logo ?? null;
}

export const BRAND_COLORS = {
  // Primary brand colors
  black: "#000000",
  pink: "#FF37A1",
  yellow: "#E1FF62",
  
  // Gradient colors (for backgrounds)
  primary: "#FF37A1",
  secondary: "#E1FF62",
  
  // Text colors
  textPrimary: "#000000",
  textSecondary: "rgba(0, 0, 0, 0.7)",
  textLight: "#ffffff",
  
  // Background elements
  trackLine: "rgba(255, 55, 161, 0.15)",
  
  // Additional colors
  dark: "#000000",
  light: "#ffffff",
} as const;

export type BrandColors = typeof BRAND_COLORS;

// Brand Typography
export const BRAND_FONTS = {
  primary: "baga, sans-serif", // Semibold - for titles/headlines
  secondary: "le-havre-rounded, sans-serif", // Light - for subtitles/body
  tertiary: "Pollen, sans-serif", // For accents/special emphasis
} as const;

export type BrandFonts = typeof BRAND_FONTS;

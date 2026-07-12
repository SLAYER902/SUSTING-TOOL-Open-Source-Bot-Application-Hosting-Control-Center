const fallbackLogo = "/fallback/sulayer-mark.svg";
const fallbackBackground = "/fallback/city-grid.svg";

export const branding = {
  productName: process.env.NEXT_PUBLIC_APP_NAME || "SULAYER CLOUD",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "https://res.cloudinary.com/dfpnxn7ma/image/upload/v1783845723/45f861e1-0d24-4757-bfc2-7dbb75290d1b_vjqul8.png",
  loginBackgroundUrl: process.env.NEXT_PUBLIC_LOGIN_BACKGROUND_URL || "https://wallpaperaccess.com/full/23490670.gif",
  dashboardBackgroundUrl: process.env.NEXT_PUBLIC_DASHBOARD_BACKGROUND_URL || "https://i.imgur.com/bMq9APc.gif",
  fallbackLogo,
  fallbackBackground,
  version: "v0.1.0"
} as const;

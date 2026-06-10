import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
          "/scan",
          "/login",
          "/signup",
          "/enroll/", // anciennes URLs par token — jamais dans l'index
        ],
      },
    ],
    sitemap: "https://halocard.ch/sitemap.xml",
    host: "https://halocard.ch",
  };
}

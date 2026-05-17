export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "NEON",
  url: "https://neoncollective.ch",
  /** Nav items with translation keys (labels come from dictionary). */
  navItems: [
    {
      key: "home",
      href: "/",
    },
    // Engage hidden from nav temporarily — page remains at /engage
    {
      key: "events",
      href: "/events",
    },
    {
      key: "donate",
      href: "/donate",
    },
    {
      key: "manifesto",
      href: "/manifesto",
    },
  ],
  navMenuItems: [],
  links: {
    instagram: "https://www.instagram.com/neoncollective.ch/",
    statutes:
      "https://drive.google.com/uc?export=download&id=1y8fKbgmIRkfN1GI5aC4IT_RuIgeJV9pP",
  },
};

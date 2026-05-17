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
    {
      key: "manifesto",
      href: "/manifesto",
    },
    {
      key: "engage",
      href: "/engage",
    },
    {
      key: "donate",
      href: "/donate",
    },
  ],
  navMenuItems: [],
  links: {
    instagram: "https://www.instagram.com/neoncollective.ch/",
    membership:
      "https://tickets.neoncollective.ch/account/login?next=/membership-2025",
    tickets: "https://tickets.neoncollective.ch/",
    statutes:
      "https://drive.google.com/uc?export=download&id=1y8fKbgmIRkfN1GI5aC4IT_RuIgeJV9pP",
  },
};

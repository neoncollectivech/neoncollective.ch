import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  de: {
    meta: { title: "NEON" },
    blocks: [
      {
        component: "hero",
        animated: true,
        subtitle: "Neue Elektronische Organisation für Nachtkultur",
        fullHeight: true,
      },
      {
        component: "interventionFeed",
        entries: [
          {
            status: "live",
            codename: "KERN-REKRUTIERUNG",
            objective:
              "Formierung der Primärzelle. Suche nach visuellen Architekten, Sound-Ingenieuren und Kulturkuratoren für den strukturellen Ausbau der Organisation.",
            location: "ZÜRICH / HYBRID",
            cta: {
              label: "MITWIRKEN",
              href: "/engage",
            },
          },

          {
            status: "incubation",
            codename: "OPERATION VOID",
            objective:
              "Strategische Erschliessung von industriellem Leerstand. Rückführung einer 400 m² Kfz-Werkstatt in eine 48-stündige temporäre Klangzone.",
            location: "ALTSTETTEN / INDUSTRIE",
          },

          {
            status: "archived",
            codename: "RECODIERUNG DES SIGNALS",
            objective:
              "Vollständiger Umbau der digitalen Infrastruktur. Transformation von passiver Präsenz zu einem aktiven, verschlüsselten Kultur-Hub.",
            location: "GLOBAL / DIGITAL",
          },
        ],
      },
      {
        component: "neonQuote",
        lines: [
          '"Mauern können weichen, doch {{das Dancefloor ist eine Haltung}}, kein Raum."',
        ],
      },
      {
        component: "internalLink",
        label: "Zum Manifesto",
        href: "/manifesto",
      },
    ],
  },
  en: {
    meta: { title: "NEON" },
    blocks: [
      {
        component: "hero",
        animated: true,
        subtitle: "New Electronic Organisation for Nightculture",
        fullHeight: true,
      },
      {
        component: "interventionFeed",
        entries: [
          {
            status: "live",
            codename: "CORE RECRUITMENT",
            objective:
              "Assembling the primary cell. Seeking visual architects, sound engineers, and cultural curators to manage the organization's expansion.",
            location: "ZÜRICH / HYBRID",
            cta: {
              label: "ENGAGE",
              href: "/engage",
            },
          },

          {
            status: "incubation",
            codename: "OPERATION VOID",
            objective:
              "Strategic mapping of industrial waste-space. Reclaiming a 400sqm car workshop for a 48-hour temporary sonic zone.",
            location: "ALTSTETTEN / INDUSTRIAL",
          },

          {
            status: "archived",
            codename: "RECODING THE SIGNAL",
            objective:
              "Total overhaul of the digital infrastructure. Transitioned from passive presence to an active, encrypted cultural hub.",
            location: "GLOBAL / DIGITAL",
          },
        ],
      },
      {
        component: "neonQuote",
        lines: [
          '"The walls may be closing in, but the {{dancefloor is an idea}}, not a location."',
        ],
      },
      {
        component: "internalLink",
        label: "Read the Manifesto",
        href: "/manifesto",
      },
    ],
  },
};

export default content;

import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  en: {
    meta: {
      title: "Engage",
      description:
        "Sustaining electronic culture amidst evolving challenges and paradigms requires active redefinition over passive consumption.",
    },
    blocks: [
      {
        component: "section",
        title: "ENGAGE",
        subtitle: "ARCHITECT THE EVOLUTION",
        body: "We are assembling a collective of artists, strategic thinkers, technical experts, and organizers who recognize that subculture requires focused attention and constant innovation. This is the mandate of the Prosumer. By contributing your expertise, you help us redefine cultural formats—ensuring that the core values of the dancefloor are preserved and accessible despite shifting social habits and urban limitations. We operate as a sophisticated force, securing cultural sovereignty through innovative design and socially grounded standards.",
        cta: {
          label: "JOIN",
          href: "https://tickets.neoncollective.ch/account/login?next=/membership-2025",
        },
      },
      {
        component: "neonQuote",
        lines: ["Apply your innovation to {{cultural stewardship}}."],
      },
    ],
  },
  de: {
    meta: {
      title: "Mitwirken",
      description:
        "Die Bewahrung der elektronischen Kultur inmitten sich wandelnder Herausforderungen und Paradigmen erfordert aktive Neudefinition statt passiven Konsums.",
    },
    blocks: [
      {
        component: "section",
        title: "MITWIRKEN",
        subtitle: "GESTALTE DEN WANDEL",
        body: "Wir versammeln ein Kollektiv aus Künstlern, strategischen Köpfen, technischen Experten und Organisatoren, die erkennen, dass Subkultur gezielte Aufmerksamkeit und ständige Innovation benötigt. Dies ist das Mandat des Prosumenten. Durch deine Expertise helfen wir dabei, kulturelle Formate neu zu definieren – um sicherzustellen, dass die Kernwerte der Tanzfläche trotz veränderter sozialer Gewohnheiten und urbaner Einschränkungen erhalten und zugänglich bleiben. Wir agieren als qualifizierte Kraft, die kulturelle Souveränität durch innovatives Design und gesellschaftlich fundierte Standards sichert.",
        cta: {
          label: "MITWIRKEN",
          href: "https://tickets.neoncollective.ch/account/login?next=/membership-2025",
        },
      },
      {
        component: "neonQuote",
        lines: ["Nutze deine Innovationskraft für die {{Kulturpflege}}."],
      },
    ],
  },
  it: {
    meta: {
      title: "Partecipa",
      description:
        "Sostenere la cultura elettronica tra sfide e paradigmi in evoluzione richiede una ridefinizione attiva, non un consumo passivo.",
    },
    blocks: [
      {
        component: "section",
        title: "PARTECIPA",
        subtitle: "PROGETTA L'EVOLUZIONE",
        body: "Stiamo radunando un collettivo di artisti, pensatori strategici, esperti tecnici e organizzatori che sanno che la subcultura ha bisogno di attenzione mirata e innovazione continua. È il mandato del prosumer. Mettendo a disposizione le tue competenze, ci aiuti a ridefinire i formati culturali — così che i valori fondamentali della pista restino vivi e accessibili nonostante abitudini sociali e limiti urbani che cambiano. Operiamo come una forza strutturata, che tutela la sovranità culturale con un design innovativo e standardi radicati nella società.",
        cta: {
          label: "UNISCITI",
          href: "https://tickets.neoncollective.ch/account/login?next=/membership-2025",
        },
      },
      {
        component: "neonQuote",
        lines: ["Impegna la tua innovazione nella {{cura della cultura}}."],
      },
    ],
  },
};

export default content;

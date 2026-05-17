import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  en: {
    meta: {
      title: "Donate",
      description:
        "Your contribution fuels the evolution of electronic culture — securing spaces, sound, and community for the city.",
    },
    blocks: [
      {
        component: "section",
        title: "DONATE",
        subtitle: "Support The Movement",
        body: "Financial autonomy is the foundation for the evolution of the electronic scene. For those who share this vision but operate from the periphery, a donation (starting at CHF 35.—) provides the capital necessary to activate new spatial and temporal models. These resources are utilized to secure the locations and technology required for gatherings that prioritize social depth and acoustic quality, ensuring our culture remains a functional, respected, and vital fixture of the city.",
      },
      { component: "donationPicker" },
      { component: "spacer", size: "lg" },
      { component: "neonLine", width: "w-12" },
      { component: "spacer", size: "md" },
      { component: "manageDonation" },
    ],
  },
  de: {
    meta: {
      title: "Spenden",
      description:
        "Dein Beitrag treibt die Evolution der elektronischen Kultur voran — für Räume, Sound und Gemeinschaft in der Stadt.",
    },
    blocks: [
      {
        component: "section",
        title: "SPENDEN",
        subtitle: "UNTERSTÜTZE DIE BEWEGUNG.",
        body: "Finanzielle Autonomie ist das Fundament für die Evolution der elektronischen Szene. Für jene, welche diese Vision teilen, aber von der Peripherie aus agieren möchten, schafft eine Spende (ab CHF 35.–) das notwendige Kapital für neue räumliche und zeitliche Modelle. Diese Mittel werden genutzt, um Standorte und Technologien zu sichern, die soziale Tiefe und akustische Qualität in den Vordergrund stellen – damit unsere Kultur ein funktionaler, geachteter und lebensnotwendiger Teil der Stadt bleibt.",
      },
      { component: "donationPicker" },
      { component: "spacer", size: "lg" },
      { component: "neonLine", width: "w-12" },
      { component: "spacer", size: "md" },
      { component: "manageDonation" },
    ],
  },
  it: {
    meta: {
      title: "Dona",
      description:
        "Il tuo contributo alimenta l'evoluzione della cultura elettronica — per spazi, suono e comunità in città.",
    },
    blocks: [
      {
        component: "section",
        title: "DONA",
        subtitle: "SOSTIENI IL MOVIMENTO",
        body: "L'autonomia finanziaria è la base dell'evoluzione della scena elettronica. Per chi condivide questa visione ma resta ai margini, una donazione (da CHF 35.—) fornisce il capitale per attivare nuovi modelli spaziali e temporali. Queste risorse servono a garantire luoghi e tecnologie per incontri che mettono al centro la profondità sociale e la qualità acustica, così che la nostra cultura resti una componente viva, rispettata e indispensabile della città.",
      },
      { component: "donationPicker" },
      { component: "spacer", size: "lg" },
      { component: "neonLine", width: "w-12" },
      { component: "spacer", size: "md" },
      { component: "manageDonation" },
    ],
  },
};

export default content;

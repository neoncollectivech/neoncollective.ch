import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  en: {
    meta: { title: "SIGNAL" },
    blocks: [
      { component: "heading", text: "SIGNAL", level: 1 },
      {
        component: "heading",
        text: "Open the Channel",
        level: 2,
        variant: "semibold",
      },
      {
        component: "markdown",
        content:
          "The conversation does not end on the dancefloor. We are looking for collaborators, not customers. Whether you have an intervention to propose, a space to reclaim, or the physical energy to contribute—reach out.\n\nConnect via [hello@neoncollective.ch](mailto:hello@neoncollective.ch) or find us in the digital underground. The night is built by those who show up.",
      },
    ],
  },
  de: {
    meta: { title: "SIGNAL" },
    blocks: [
      { component: "heading", text: "SIGNAL", level: 1 },
      {
        component: "heading",
        text: "Kanal öffnen",
        level: 2,
        variant: "semibold",
      },
      {
        component: "markdown",
        content:
          "Das Gespräch endet nicht auf dem Dancefloor. Wir suchen Mitstreiter:innen, keine Kundschaft. Ob du eine Intervention planst, Räume zurückerobern willst oder die physische Energie hast, anzupacken – melde dich.\n\nSchreib uns unter [hello@neoncollective.ch](mailto:hello@neoncollective.ch) oder finde uns im digitalen Untergrund. Die Nacht wird von jenen gebaut, die auftauchen.",
      },
    ],
  },
};

export default content;

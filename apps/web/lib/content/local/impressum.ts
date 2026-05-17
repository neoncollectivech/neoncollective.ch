import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  en: {
    meta: { title: "Impressum" },
    blocks: [
      { component: "heading", text: "Impressum", level: 1 },
      {
        component: "markdown",
        content: `**Responsible entity**
NEON - Neue Elektronische Organisation für Nachtkultur
CH-8000 Zürich
Switzerland
Email: hello@neoncollective.ch

**Persons**
Michael DALDINI
Filippo FONTANA
Davide MAGGIPINTO

**Association Name**
NEON - Neue Elektronische Organisation für Nachtkultur
NEON Club

**Official Documents**
[Statutes (German)](https://drive.google.com/uc?export=download&id=1y8fKbgmIRkfN1GI5aC4IT_RuIgeJV9pP)

**Disclaimer**
The author assumes no liability for the correctness, accuracy, timeliness, reliability and completeness of the information.
Liability claims against the author for material or immaterial damage resulting from access to, use or non-use of the published information, from misuse of the connection or from technical malfunctions are excluded.

All offers are non-binding. The author expressly reserves the right to change, add to, or delete parts of the pages or the entire offer without prior notice, or to temporarily or permanently cease publication.

**Disclaimer for content and links**
References and links to third party websites are outside our area of responsibility. It rejected any responsibility for such websites. Access to and use of such websites is at the user's own risk.

**Copyright declaration**
The copyrights and all other rights to content, images, photos or other files on this website belong exclusively to NEON - Neue Elektronische Organisation für Nachtkultur or the specifically named rights holders. The written consent of the copyright holder must be obtained in advance for the reproduction of any elements.

Source: BrainBox Solutions`,
      },
    ],
  },
  de: {
    meta: { title: "Impressum" },
    blocks: [
      { component: "heading", text: "Impressum", level: 1 },
      {
        component: "markdown",
        content: `**Verantwortliche Stelle**
NEON - Neue Elektronische Organisation für Nachtkultur
CH-8000 Zürich
Schweiz
E-Mail: hello@neoncollective.ch

**Personen**
Michael DALDINI
Filippo FONTANA
Davide MAGGIPINTO

**Vereinsname**
NEON - Neue Elektronische Organisation für Nachtkultur
NEON Club

**Offizielle Dokumente**
[Statuten (Deutsch)](https://drive.google.com/uc?export=download&id=1y8fKbgmIRkfN1GI5aC4IT_RuIgeJV9pP)

**Haftungsausschluss**
Der Autor übernimmt keine Gewähr für die Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit der Informationen.
Haftungsansprüche gegen den Autor wegen Schäden materieller oder immaterieller Art, die aus dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch technische Störungen entstanden sind, werden ausgeschlossen.

Alle Angebote sind freibleibend. Der Autor behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne vorgängige Ankündigung zu verändern, zu ergänzen, zu löschen oder die Veröffentlichung zeitweise oder endgültig einzustellen.

**Haftungsausschluss für Inhalte und Links**
Verweise und Links auf Webseiten Dritter liegen ausserhalb unseres Verantwortungsbereichs. Jegliche Verantwortung für solche Webseiten wird abgelehnt. Der Zugriff und die Nutzung solcher Webseiten erfolgen auf eigene Gefahr.

**Urheberrechtserklärung**
Die Urheber- und alle anderen Rechte an Inhalten, Bildern, Fotos oder anderen Dateien auf dieser Website gehören ausschliesslich NEON - Neue Elektronische Organisation für Nachtkultur oder den speziell genannten Rechteinhabern. Für die Reproduktion jeglicher Elemente ist die schriftliche Zustimmung der Urheberrechtsträger im Voraus einzuholen.

Quelle: BrainBox Solutions`,
      },
    ],
  },
};

export default content;

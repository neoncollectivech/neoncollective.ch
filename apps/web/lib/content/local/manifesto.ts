import type { PageContent } from "../types";
import type { Locale } from "@/i18n/config";

const content: Record<Locale, PageContent> = {
  en: {
    meta: {
      title: "Manifesto",
      description: "A Manifesto for the Night",
    },
    blocks: [
      {
        component: "heading",
        text: "A Manifesto for the Night",
        level: 1,
        variant: "mono",
      },
      {
        component: "section",
        number: "I",
        title: "WE OBSERVE",
        subtitle: "The Systemic Erosion",
        intro:
          "Structural and social shifts are narrowing the parameters of our shared spaces.",
        points: [
          {
            title: "The Vanishing Void",
            text: 'We observe the disappearance of "urban vacuums"—the marginal industrial zones that once provided the spatial agency required for cultural experimentation.',
          },
          {
            title: "Regulatory Friction",
            text: "We observe an urban policy that prioritizes sterile silence over the vital, functional rhythm of the city's sonic identity.",
          },
          {
            title: "Temporal Monoculture",
            text: "We observe a rigid adherence to late-night clubbing structures that fails to account for evolving urban lifestyles and the post-pandemic shift toward conscious, daytime, or early-evening engagement.",
          },
          {
            title: "Economic Displacement",
            text: "We observe how real estate pressures convert cultural sanctuaries into high-yield assets, forcing the community to justify its existence through purely financial metrics.",
          },
          {
            title: "The Loss of Continuity",
            text: "We observe how the closing of permanent spaces erodes our collective memory, replacing deep cultural roots with disconnected, transactional events.",
          },
        ],
      },
      {
        component: "section",
        number: "II",
        title: "WE ACKNOWLEDGE",
        subtitle: "The Alchemy of the Collective",
        intro:
          "Electronic music culture is a sociological necessity. We recognize that the ritual of the dancefloor must evolve to remain relevant to shifting urban rhythms.",
        points: [
          {
            title: "The Authentic Melting Pot",
            text: "We acknowledge the dancefloor as a site of social synchronization—where diverse backgrounds align to a single frequency, regardless of the hour.",
          },
          {
            title: "The Conscious Ritual",
            text: "We acknowledge that the value of the electronic experience is not tied to excess. We respect the shift toward health-conscious participation and sustainable social habits.",
          },
          {
            title: "Collective Responsibility",
            text: "We acknowledge that the safety, energy, and depth of our culture are not products to be consumed, but are co-created by every person in the room.",
          },
          {
            title: "Living Sonic Heritage",
            text: "We acknowledge electronic music as an intangible heritage that requires physical practice and high-quality environments to survive.",
          },
          {
            title: "The Value of Presence",
            text: "We celebrate the magic of physical collision in a digital age—creating spaces where human connection is the primary objective.",
          },
        ],
      },
      {
        component: "section",
        number: "III",
        title: "WE STRIVE",
        subtitle: "Strategic Implementation",
        intro:
          "We build professional, resilient infrastructures that operate within the city's reality to secure a future for electronic culture.",
        points: [
          {
            title: "To Redefine the Format",
            text: "We strive to design cultural experiences that respect new constraints; by redefining temporal boundaries and spatial constraints, we ensure social mixing remains accessible and relevant.",
          },
          {
            title: "New Spatial Approaches",
            text: "We strive to find new approaches to activate underutilized spaces, decoupling culture from traditional real estate through agile, professional execution.",
          },
          {
            title: "Sustainable Cultural Models",
            text: "We build community-supported frameworks that prioritize long-term sociological impact over short-term commercial turnover.",
          },
          {
            title: "Inclusive Design",
            text: "We strive to create formats that intentionally bridge social divides, maintaining the dancefloor as a democratic and inclusive communal space.",
          },
          {
            title: "Collective Sovereignty",
            text: "We recruit a force of strategic thinkers and operators to ENGAGE / MITWIRKEN in building an independent, standard-setting cultural ecosystem.",
          },
        ],
      },
      { component: "spacer", size: "lg" },
      {
        component: "neonQuote",
        lines: [
          '"The walls may shift, but the {{dancefloor is an idea}}, not a location."',
        ],
      },
    ],
  },
  de: {
    meta: {
      title: "Manifest",
      description: "Ein Manifest für die Nacht",
    },
    blocks: [
      {
        component: "heading",
        text: "Ein Manifest für die Nacht",
        level: 1,
        variant: "mono",
      },
      {
        component: "section",
        number: "I",
        title: "WIR BEOBACHTEN",
        subtitle: "Die systematische Erosion",
        intro:
          "Strukturelle und gesellschaftliche Veränderungen schränken den Spielraum unserer gemeinsamen Räume ein.",
        points: [
          {
            title: "Das schwindende Vakuum",
            text: "Wir beobachten das Verschwinden \u201Eurbaner Vakuums\u201C \u2013 jener marginalen R\u00E4ume, die den n\u00F6tigen Handlungsspielraum f\u00FCr kulturelle Experimente boten.",
          },
          {
            title: "Regulatorische Reibung",
            text: "Wir beobachten eine Stadtentwicklung, die sterile Stille über den funktionalen, klanglichen Rhythmus der städtischen Identität stellt.",
          },
          {
            title: "Temporale Monokultur",
            text: "Wir beobachten eine starre Fixierung auf nächtliche Clubstrukturen, die moderne Lebensentwürfe und den Trend zu bewussteren Formaten am Tag oder frühen Abend ignoriert.",
          },
          {
            title: "Ökonomische Verdrängung",
            text: "Wir beobachten, wie Immobilienfaktoren kulturelle Zufluchtsorte in Renditeobjekte verwandeln und die Gemeinschaft zwingen, ihren Wert rein finanziell zu rechtfertigen.",
          },
          {
            title: "Verlust der Kontinuität",
            text: "Wir beobachten, wie die Schliessung fester Orte unser kollektives Gedächtnis erodiert und tiefe Verwurzelung durch flüchtige, transaktionale Events ersetzt wird.",
          },
        ],
      },
      {
        component: "section",
        number: "II",
        title: "WIR ANERKENNEN",
        subtitle: "Die Alchemie des Kollektivs",
        intro:
          "Die elektronische Musikkultur ist eine soziologische Notwendigkeit. Wir erkennen an, dass sich das Ritual der Tanzfläche weiterentwickeln muss, um für sich wandelnde urbane Rhythmen relevant zu bleiben.",
        points: [
          {
            title: "Der authentische Schmelztiegel",
            text: "Wir anerkennen die Tanzfläche als Ort sozialer Synchronisation, an dem Menschen unterschiedlicher Herkunft zu einem gemeinsamen Puls finden – unabhängig von der Uhrzeit.",
          },
          {
            title: "Das bewusste Ritual",
            text: "Wir anerkennen, dass der Wert der elektronischen Erfahrung nicht an Exzess gebunden ist. Wir respektieren den Wunsch nach einem gesundheitsbewussten und nachhaltigen Sozialleben.",
          },
          {
            title: "Kollektive Verantwortung",
            text: "Wir anerkennen, dass Sicherheit, Energie und Tiefe unserer Kultur keine Konsumgüter sind, sondern von jedem Einzelnen im Raum mitgestaltet werden.",
          },
          {
            title: "Lebendiges klangliches Erbe",
            text: "Die elektronische Musikkultur ist ein immaterielles Erbe, das physische Praxis und hochwertige Umgebungen braucht, um zu überdauern.",
          },
          {
            title: "Der Wert der Präsenz",
            text: "Wir feiern die Magie der physischen Begegnung im digitalen Zeitalter – wir schaffen Räume, in denen menschliche Verbindung das primäre Ziel ist.",
          },
        ],
      },
      {
        component: "section",
        number: "III",
        title: "WIR STREBEN",
        subtitle: "Strategische Umsetzung",
        intro:
          "Wir bauen professionelle, resiliente Infrastrukturen innerhalb der städtischen Realität, um die Zukunft der elektronischen Kultur zu sichern.",
        points: [
          {
            title: "Formate neu definieren",
            text: "Wir gestalten kulturelle Erlebnisse, welche die neuen Rahmenbedingungen respektieren. Durch die Neudefinition zeitlicher Grenzen und örtlicher Parameter bleibt die soziale Durchmischung zugänglich und relevant.",
          },
          {
            title: "Neue räumliche Ansätze",
            text: "Wir suchen neue Ansätze, um ungenutzte Flächen zu aktivieren und Kultur durch agiles, professionelles Handeln von traditionellen Immobilienzwängen zu entkoppeln.",
          },
          {
            title: "Nachhaltige Kulturmodelle",
            text: "Wir entwickeln gemeinschaftsgetragene Strukturen, die langfristige soziologische Wirkung über kurzfristigen kommerziellen Profit stellen.",
          },
          {
            title: "Inklusives Design",
            text: "Wir schaffen Formate, die bewusst soziale Schichten mischen und die Tanzfläche als demokratischen und inklusiven Gemeinschaftsraum erhalten.",
          },
          {
            title: "Kollektive Souveränität",
            text: "Wir versammeln strategische Denker und Macher, um sich zu ENGAGIEREN / MITWIRKEN und gemeinsam ein unabhängiges Kultur-Ökosystem aufzubauen.",
          },
        ],
      },
      { component: "spacer", size: "lg" },
      {
        component: "neonQuote",
        lines: [
          '"Mauern mögen weichen, doch die {{Tanzfläche ist eine Haltung}}, kein Ort."',
        ],
      },
    ],
  },
  it: {
    meta: {
      title: "Manifesto",
      description: "Un manifesto per la notte",
    },
    blocks: [
      {
        component: "heading",
        text: "Un manifesto per la notte",
        level: 1,
        variant: "mono",
      },
      {
        component: "section",
        number: "I",
        title: "OSSERVIAMO",
        subtitle: "L'erosione sistemica",
        intro:
          "Mutamenti strutturali e sociali stanno restringendo il margine dei nostri spazi condivisi.",
        points: [
          {
            title: "Il vuoto che scompare",
            text: "Osserviamo la scomparsa dei «vuoti urbani»: quelle zone industriali marginali che un tempo offrivano lo spazio d'azione necessario alla sperimentazione culturale.",
          },
          {
            title: "Attrito normativo",
            text: "Osserviamo politiche urbane che mettono al primo posto un silenzio sterile rispetto al ritmo sonoro vitale che definisce l'identità della città.",
          },
          {
            title: "Monocultura temporale",
            text: "Osserviamo un'adesione rigida a modelli da club notturno che non tiene conto di stili di vita urbani in evoluzione e del passaggio, dopo la pandemia, verso formati più consapevoli, diurni o in prima serata.",
          },
          {
            title: "Spostamento economico",
            text: "Osserviamo come le pressioni immobiliari trasformino luoghi di rifugio culturale in asset ad alta resa, costringendo la comunità a giustificare la propria esistenza solo con metriche finanziarie.",
          },
          {
            title: "Perdita di continuità",
            text: "Osserviamo come la chiusura di spazi permanenti eroda la memoria collettiva, sostituendo radici culturali profonde con eventi isolati e transazionali.",
          },
        ],
      },
      {
        component: "section",
        number: "II",
        title: "RICONOSCIAMO",
        subtitle: "L'alchimia del collettivo",
        intro:
          "La cultura della musica elettronica è una necessità sociologica. Riconosciamo che il rituale della pista deve evolversi per restare rilevante di fronte a ritmi urbani che cambiano.",
        points: [
          {
            title: "Il crogiolo autentico",
            text: "Riconosciamo la pista come luogo di sincronizzazione sociale — dove provenienze diverse si allineano a un'unica frequenza, a qualsiasi ora.",
          },
          {
            title: "Il rituale consapevole",
            text: "Riconosciamo che il valore dell'esperienza elettronica non è legato all'eccesso. Rispettiamo il passaggio verso una partecipazione attenta alla salute e abitudini sociali sostenibili.",
          },
          {
            title: "Responsabilità collettiva",
            text: "Riconosciamo che sicurezza, energia e profondità della nostra cultura non sono prodotti da consumare, ma si co-creano con ogni persona nella stanza.",
          },
          {
            title: "Patrimonio sonoro vivente",
            text: "Riconosciamo la musica elettronica come patrimonio immateriale che ha bisogno di pratica fisica e di ambienti di qualità per sopravvivere.",
          },
          {
            title: "Il valore della presenza",
            text: "Celebriamo la magia dell'incontro fisico nell'era digitale — creando spazi in cui la connessione umana è l'obiettivo primario.",
          },
        ],
      },
      {
        component: "section",
        number: "III",
        title: "MIRIAMO A",
        subtitle: "Implementazione strategica",
        intro:
          "Costruiamo infrastrutture professionali e resilienti dentro la realtà urbana, per assicurare un futuro alla cultura elettronica.",
        points: [
          {
            title: "Ridefinire il formato",
            text: "Puntiamo a progettare esperienze culturali che rispettino i nuovi vincoli; ridefinendo confini temporali e vincoli spaziali, manteniamo accessibile e attuale la mescolanza sociale.",
          },
          {
            title: "Nuovi approcci spaziali",
            text: "Puntiamo a trovare modi nuovi di attivare spazi sottoutilizzati, scollegando la cultura dal real estate tradizionale con un'esecuzione agile e professionale.",
          },
          {
            title: "Modelli culturali sostenibili",
            text: "Costruiamo quadri sostenuti dalla comunità che mettono al centro l'impatto sociologico nel lungo periodo, non il turnover commerciale di breve termine.",
          },
          {
            title: "Design inclusivo",
            text: "Puntiamo a creare formati che attraversino volutamente le divisioni sociali, mantenendo la pista come spazio comune democratico e inclusivo.",
          },
          {
            title: "Sovranità collettiva",
            text: "Raduniamo pensatori strategici e operatori per PARTECIPARE / MITWIRKEN nella costruzione di un ecosistema culturale indipendente e capace di fissare standard.",
          },
        ],
      },
      { component: "spacer", size: "lg" },
      {
        component: "neonQuote",
        lines: [
          '"Le pareti possono spostarsi, ma la {{pista da ballo è un\'idea}}, non un luogo."',
        ],
      },
    ],
  },
};

export default content;

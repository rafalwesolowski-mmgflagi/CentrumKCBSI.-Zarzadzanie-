export interface WellbeingPractice {
  key: string;
  title: string;
  description: string;
  cue: string;
}

export interface WellbeingAssessmentQuestion {
  id: string;
  label: string;
  low: string;
  high: string;
}

export const wellbeingPractices: WellbeingPractice[] = [
  {
    key: "gratitude",
    title: "Wdzięczność",
    description: "Codziennie zapisz 3-5 konkretnych rzeczy, które już są dobre. To osłabia adaptację hedonistyczną i kieruje uwagę na realne zasoby.",
    cue: "Wieczorem, po zamknięciu pracy"
  },
  {
    key: "social-connection",
    title: "Połączenia społeczne",
    description: "Zrób jedną intencjonalną rozmowę albo pogłęb kontakt z kimś bliskim. Relacje są jednym z najmocniejszych predyktorów dobrostanu.",
    cue: "Przed obiadem albo po pracy"
  },
  {
    key: "savoring",
    title: "Savoring",
    description: "Zatrzymaj się przy jednej dobrej chwili i zauważ ją świadomie: zmysły, emocje, kontekst, wdzięczność.",
    cue: "Podczas kawy, spaceru albo posiłku"
  },
  {
    key: "time-affluence",
    title: "Bogactwo czasu",
    description: "Zaprojektuj dzień tak, aby odzyskać choć 20 minut swobody. Czas wolny często daje więcej dobrostanu niż kolejny drobny zysk.",
    cue: "Przy planowaniu dnia"
  },
  {
    key: "sleep-movement",
    title: "Sen i ruch",
    description: "Zadbaj o podstawę biologiczną: sen, spacer, lekką aktywność. Dobrostan trudno utrzymać samą motywacją.",
    cue: "Rano lub 90 minut przed snem"
  },
  {
    key: "meditation",
    title: "Uważność",
    description: "Usiądź na kilka minut i obserwuj oddech. Celem nie jest idealny spokój, tylko powrót uwagi.",
    cue: "Po pierwszym bloku pracy"
  }
];

export const wellbeingAssessmentQuestions: WellbeingAssessmentQuestion[] = [
  { id: "agency", label: "Mam poczucie wpływu na najważniejsze sprawy w tym tygodniu.", low: "chaos", high: "wpływ" },
  { id: "energy", label: "Moja energia fizyczna wspiera moje plany.", low: "dług", high: "zasób" },
  { id: "sleep", label: "Sen i regeneracja są wystarczające.", low: "zaniedbane", high: "stabilne" },
  { id: "time", label: "Mam poczucie przestrzeni czasowej, a nie tylko presji.", low: "brak czasu", high: "margines" },
  { id: "relationships", label: "Relacje dają mi wsparcie, kontakt i bezpieczeństwo.", low: "izolacja", high: "połączenie" },
  { id: "gratitude", label: "Zauważam dobre rzeczy, które już istnieją.", low: "niedobór", high: "wdzięczność" },
  { id: "discipline", label: "Wykonuję małe zobowiązania wobec siebie.", low: "dryf", high: "spójność" },
  { id: "self_compassion", label: "Po potknięciu wracam bez samokarania.", low: "wstyd", high: "łagodny powrót" }
];

export const affirmationSeeds = [
  "Buduję kontrolę przez małe, wykonane kroki.",
  "Mogę być zdyscyplinowany i jednocześnie łagodny dla siebie.",
  "Moja wartość nie zależy od jednego wyniku ani jednego dnia.",
  "Wracam do praktyki bez samokarania.",
  "Wybieram działania, które wspierają energię, relacje i spokój.",
  "Stabilność finansowa ma służyć wolności, nie presji.",
  "Dzisiaj wystarczy jeden uczciwy krok do przodu."
];

export const wellbeingCourseNotes = [
  {
    title: "G.I. Joe Fallacy",
    body: "Sama wiedza nie wystarcza. Zmiana dobrostanu wymaga powtarzalnej praktyki, zaprojektowanego środowiska i mierzenia zachowania."
  },
  {
    title: "Miswanting",
    body: "Umysł często przecenia rzeczy, które mają dać szczęście, i nie docenia codziennych źródeł dobrostanu: relacji, snu, ruchu, wdzięczności i czasu."
  },
  {
    title: "Adaptacja hedonistyczna",
    body: "Do dobrych zmian szybko się przyzwyczajamy. Praktyki wdzięczności i savoringu pomagają odzyskać kontakt z tym, co już działa."
  },
  {
    title: "Punkty odniesienia",
    body: "Porównania społeczne zniekształcają ocenę życia. Dziennik pomaga wrócić do własnych wartości, energii i realnego postępu."
  }
];


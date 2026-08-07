type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type SocialPlanAssignment = {
  date?: unknown;
  type?: {
    name?: unknown;
  };
  index?: unknown;
};

type SocialPlanRequest = {
  topic?: unknown;
  brief?: unknown;
  assignments?: unknown;
};

type AnthropicPlanResult =
  | { ok: true; data: unknown; model: string }
  | { ok: false; status: number; detail: string; model: string };

const anthropicUrl = "https://api.anthropic.com/v1/messages";
const defaultAnthropicModel = "claude-sonnet-4-6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing ANTHROPIC_API_KEY in Vercel environment variables" });
    return;
  }

  const body = normalizeRequest(req.body);
  const assignments = body.assignments.slice(0, 40);

  if (!body.topic && !assignments.length) {
    res.status(400).json({ error: "Topic or assignments are required" });
    return;
  }

  const requestedModel = process.env.ANTHROPIC_MODEL?.trim();
  const models = requestedModel && requestedModel !== defaultAnthropicModel
    ? [requestedModel, defaultAnthropicModel]
    : [defaultAnthropicModel];
  const result = await callAnthropicPlan(apiKey, models, body.topic, body.brief, assignments);

  if (result.ok === false) {
    const isModelError = result.status === 404;
    res.status(result.status).json({
      error: isModelError
        ? `Anthropic model not found. Set ANTHROPIC_MODEL=${defaultAnthropicModel} in Vercel.`
        : `Anthropic error ${result.status}`,
      detail: result.detail,
      model: result.model
    });
    return;
  }

  const text = extractText(result.data);
  const parsed = parseJsonObject(text);
  res.status(200).json(normalizePlan(parsed, assignments, body.topic, body.brief));
}

async function callAnthropicPlan(
  apiKey: string,
  models: string[],
  topic: string,
  brief: unknown,
  assignments: Array<{ date: string; type: string; index: number }>
): Promise<AnthropicPlanResult> {
  let lastError = { status: 500, detail: "Unknown Anthropic error", model: models[0] };

  for (const model of models) {
    const response = await fetch(anthropicUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(buildAnthropicPayload(model, topic, brief, assignments))
    });

    if (response.ok) {
      return { ok: true as const, data: await response.json(), model };
    }

    const detail = await response.text();
    lastError = { status: response.status, detail, model };
    if (response.status !== 404) break;
  }

  return { ok: false as const, ...lastError };
}

function buildAnthropicPayload(
  model: string,
  topic: string,
  brief: unknown,
  assignments: Array<{ date: string; type: string; index: number }>
) {
  const pillars = briefPillars(brief);
  const enriched = assignments.map((a) => ({
    ...a,
    narrativeRole: narrativeStageLabel(a.index, assignments.length)
  }));

  return {
    model,
    max_tokens: 7000,
    temperature: 0.65,
    system: `Tworzysz profesjonalne plany social media jako spójną kampanię, nie jako losową listę postów. Każda publikacja musi być unikalna, mieć konkretną rolę strategiczną, wynikać z briefu i prowadzić odbiorcę przez logiczną sekwencję: problem → mit → koszt błędu → nowa rama → edukacja → narzędzie → przykład → obiekcja → CTA/oferta.

NIE UŻYWAJ placeholderów: "Bez tematu", "pomyslu", "Twoja oferta", "odbiorca", "CTA tutaj", "post edukacyjny o X". Jeśli brakuje danych — doprecyzuj logicznie na podstawie briefu.

NIE POWTARZAJ tych samych tematów, hooków, CTA ani formatów. Każda publikacja ma inny kąt, inny hook, inne CTA.

DOBRE hooki wskazują błąd, pokazują ryzyko, obalają mit lub dotykają realnego bólu. ZŁE hooki to: "Poznaj 5 sposobów", "Dowiedz się więcej", "To może Ci pomóc".

STYL: konkretny, ekspercki, naturalny, po polsku z polskimi znakami (ą, ę, ó, ś, ź, ż, ć, ń). Bez motywacyjnych sloganów, bez korpomowy, bez "gwarantowanego wyniku" i "biznesu marzeń".

KONTROLA JAKOŚCI przed zwróceniem planu: sprawdź czy każda publikacja ma inny temat, czy nie ma placeholderów, czy CTA się rotuje, czy są polskie znaki, czy plan ma logiczną sekwencję narracyjną, czy każdy post ma konkretną funkcję.

Zwróć WYŁĄCZNIE poprawny JSON — zero tekstu, zero markdown, zero wyjaśnień poza JSON.`,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          temat_kampanii: topic || "(brak — generuj na bazie briefu i typów treści)",
          brief,
          filary_do_rozdzielenia: pillars,
          zadanie: `Wygeneruj DOKŁADNIE ${assignments.length} unikalnych, różnorodnych publikacji po polsku. Plan ma działać jak kampania z logiczną sekwencją narracyjną — nie jako lista luźnych pomysłów.`,
          sekwencja_narracyjna: [
            "1. Uświadomienie problemu — zaintryguj, pokaż problem z nowej strony",
            "2. Obalenie mitu — rozbij popularne błędne przekonanie",
            "3. Koszt błędnego podejścia — pokaż ryzyko i cenę niedziałania",
            "4. Nowa rama myślenia — zaproponuj inne spojrzenie na temat",
            "5. Edukacja procesu — naucz konkretnego mechanizmu lub kroku",
            "6. Praktyczne narzędzie — szablon, prompt, checklista gotowa do użycia",
            "7. Przykład / case — konkretna historia lub scenariusz z rezultatem",
            "8. Zdjęcie obiekcji — odpowiedz na wewnętrzną blokadę odbiorcy",
            "9. Wzmocnienie zaufania — dowód kompetencji lub kulisy",
            "10. Miękkie CTA — zaproś do rozmowy, DM lub zapisu",
            "11. Oferta lub kolejny krok — konkretna propozycja działania"
          ],
          proporcje_typow_tresci: assignments.length <= 20 ? {
            "Edukacja": "5 publikacji — framework, lista kontrolna, krok po kroku",
            "Problemy": "3 publikacje — konkretny ból, koszt zwlekania, pułapka",
            "Kontrariańskie/Ciekawostki": "3 publikacje — obalenie mitu, zaskakujący insight",
            "Praktyczne narzędzie": "3 publikacje — szablon, prompt, checklista",
            "Case study": "2 publikacje — historia z rezultatem",
            "Obiekcje/Q&A": "1 publikacja — odpowiedź na blokadę",
            "Oferta": "1 publikacja — tylko jeśli cel kampanii to sprzedaż"
          } : {
            "Edukacja": "7 publikacji — framework, lista kontrolna, krok po kroku",
            "Problemy": "5 publikacji — konkretny ból, koszt zwlekania, pułapka",
            "Kontrariańskie/Ciekawostki": "4 publikacje — obalenie mitu, zaskakujący insight",
            "Praktyczne narzędzie": "4 publikacje — szablon, prompt, checklista",
            "Case study": "3 publikacje — historia z rezultatem",
            "Obiekcje/Q&A": "2 publikacje — odpowiedź na blokadę",
            "Oferta": "1–2 publikacje"
          },
          schemat_kampanii: buildCampaignArc(assignments.length),
          publikacje: enriched,
          definicje_typow_tresci: {
            "Ciekawostki": "Zaskakujący insight lub obalenie intuicji — nie oczywisty fakt, lecz przewrót w myśleniu.",
            "Problemy": "Konkretny ból odbiorcy z rozpoznawalną scenką. Koszt zwlekania. Nie ogólnik.",
            "Oferta": "Wartość i transformacja. Konkretny krok do zakupu. Nie ogólny opis kursu czy usługi.",
            "Edukacja": "Jedna praktyczna rzecz krok po kroku. Odbiorca wychodzi z konkretnym narzędziem lub wiedzą.",
            "Case study": "Historia — punkt startu, konkretna zmiana, mierzalny rezultat. Fikcyjna ale realistyczna.",
            "Offtop": "Ludzki kontekst, kulisy, osobista obserwacja. Buduje zaufanie, nie sprzedaje.",
            "Q&A": "Obiekcja lub pytanie odbiorcy + konkretna, zaskakująca odpowiedź.",
            "Inspiracja": "Nowa rama myślenia — nie motywacyjny slogan, lecz zmiana perspektywy."
          },
          przyklady_hookow: {
            dobre: [
              "Nie zakładaj firmy, zanim nie sprawdzisz tej jednej rzeczy.",
              "Brak odpowiedzi z rynku nie zawsze oznacza, że pomysł jest zły.",
              "Pierwszy klient zwykle nie przychodzi z reklamy.",
              "Jeśli nie umiesz opisać oferty w jednym zdaniu, rynek jej nie zrozumie.",
              "20 wiadomości. Tyle wystarczy, żeby wiedzieć, czy rynek tego chce."
            ],
            zle: [
              "Poznaj 5 sposobów na sukces.",
              "Dowiedz się więcej o budowaniu biznesu.",
              "To może Ci pomóc w pracy.",
              "Kilka wskazówek o przedsiębiorczości."
            ]
          },
          cta_warianty: {
            zaangazowanie: ["Napisz w komentarzu, od czego dziś zaczynasz.", "Który z tych błędów dotyczy Ciebie?", "Masz taki pomysł? Opisz go jednym zdaniem."],
            zapis: ["Zapisz, zanim zaczniesz budować stronę.", "Zapisz jako checklistę przed testem pomysłu."],
            dm: ["Napisz 'START', jeśli chcesz prostą ramę walidacji.", "Napisz 'POMYSŁ', jeśli chcesz sprawdzić, od czego zacząć."],
            ofertowe: ["Sprawdź kurs, jeśli chcesz przejść przez ten proces.", "Dołącz, jeśli chcesz przetestować pomysł bezpiecznie."]
          },
          schemat_JSON: {
            items: [
              {
                date: "YYYY-MM-DD z assignment",
                type: "typ z assignment",
                title: "unikalny tytuł, max 70 znaków, konkretny — nie 'Bez tematu'",
                angle: "konkretna rola strategiczna tego posta w kampanii",
                hook: "opening hook, max 120 znaków — zaskakujący, konkretny",
                postIdea: "gotowy szkic posta — kto mówi, co konkretnie, jaka puenta, wystarczający dla copywritera",
                keyPoints: ["punkt 1 — konkretny", "punkt 2 — konkretny", "punkt 3 — konkretny"],
                cta: "krótkie CTA, max 8 słów, inne niż w poprzednich postach",
                format: "post / karuzela / reel / historia / Q&A"
              }
            ]
          }
        })
      }
    ]
  };
}

function briefPillars(brief: unknown): string[] {
  const value = objectValue(brief);
  const raw = typeof value.pillars === "string" ? value.pillars.trim() : "";
  if (raw) return raw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  return ["edukacja", "problem klienta", "walidacja pomysłu", "pierwszy klient", "oferta", "psychologia startu", "AI w pracy"];
}

function narrativeStageLabel(index: number, total: number): string {
  const progress = total <= 1 ? 0 : index / (total - 1);
  if (progress < 0.15) return "Świadomość — zaintryguj, pokaż problem z nieoczekiwanej strony";
  if (progress < 0.30) return "Problem — nazwij konkretny ból i koszt niedziałania";
  if (progress < 0.50) return "Edukacja — ucz jednego praktycznego kroku, buduj autorytet";
  if (progress < 0.65) return "Dowód — case study, przykład, konkretny rezultat";
  if (progress < 0.80) return "Oferta — pokaż wartość i kolejny krok do zakupu";
  if (progress < 0.90) return "Obiekcje — rozwiej wątpliwości, pokonaj opór";
  return "Zamknięcie — wezwanie do działania i podsumowanie kampanii";
}

function buildCampaignArc(count: number): string[] {
  const arc = [
    `Posty 1–${Math.ceil(count * 0.15)}: Świadomość — zaintryguj, pokaż problem z nowej strony`,
    `Posty ${Math.ceil(count * 0.15) + 1}–${Math.ceil(count * 0.30)}: Problem — nazwij ból i koszt zwlekania`,
    `Posty ${Math.ceil(count * 0.30) + 1}–${Math.ceil(count * 0.50)}: Edukacja — ucz krok po kroku, buduj autorytet`,
    `Posty ${Math.ceil(count * 0.50) + 1}–${Math.ceil(count * 0.65)}: Dowód — case study, przykłady, wyniki`,
    `Posty ${Math.ceil(count * 0.65) + 1}–${Math.ceil(count * 0.80)}: Oferta — pokaż rozwiązanie i wartość`,
    `Posty ${Math.ceil(count * 0.80) + 1}–${count}: Obiekcje i zamknięcie — odpowiedz na wątpliwości, wezwij do działania`
  ];
  return arc;
}

function normalizeRequest(value: unknown) {
  const input = value && typeof value === "object" ? value as SocialPlanRequest : {};
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const assignments = Array.isArray(input.assignments) ? input.assignments.map(normalizeAssignment).filter(Boolean) : [];
  return {
    topic,
    brief: input.brief && typeof input.brief === "object" ? input.brief : {},
    assignments
  };
}

function normalizeAssignment(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const assignment = value as SocialPlanAssignment;
  const date = typeof assignment.date === "string" ? assignment.date : "";
  const type = assignment.type && typeof assignment.type === "object" && typeof assignment.type.name === "string"
    ? assignment.type.name
    : "";
  const index = typeof assignment.index === "number" ? assignment.index : 0;
  if (!date || !type) return null;
  return { date, type, index };
}

function extractText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const content = (data as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "")
    .join("\n")
    .trim();
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function normalizePlan(
  parsed: unknown,
  assignments: Array<{ date: string; type: string; index: number }>,
  topic: string,
  brief: unknown
) {
  const rawItems = extractRawItems(parsed);

  const byDate = new Map(rawItems.map((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return [String(value.date || ""), value];
  }));

  return {
    items: assignments.map((assignment, index) => {
      const item = byDate.get(assignment.date) || objectValue(rawItems[index]);
      const fallback = buildFallbackItem(assignment, topic, brief);
      return {
        date: assignment.date,
        type: textValue(item.type, assignment.type),
        title: textValue(item.title ?? item.name ?? item.heading, fallback.title),
        angle: textValue(item.angle ?? item.narrativeAngle ?? item.kat, fallback.angle),
        hook: textValue(item.hook ?? item.opening ?? item.wstep, fallback.hook),
        postIdea: textValue(item.postIdea ?? item.idea ?? item.description ?? item.opis, fallback.postIdea),
        keyPoints: listValue(item.keyPoints ?? item.points ?? item.bullets ?? item.punkty, fallback.keyPoints),
        cta: textValue(item.cta ?? item.callToAction, fallback.cta),
        format: textValue(item.format ?? item.channelFormat, fallback.format)
      };
    })
  };
}

function extractRawItems(parsed: unknown) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const value = parsed as Record<string, unknown>;
  const candidates = [value.items, value.plan, value.publications, value.posts, value.calendar];
  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? list : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : fallback;
}

function listValue(value: unknown, fallback: string[] = []) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean).slice(0, 4)
    : fallback;
}

const educationFallbacks = [
  {
    title: "Jak sprawdzić pomysł zanim wydasz złotówkę",
    hook: "Zanim wydasz pieniądze, jest jedna rozmowa, która powie Ci wszystko.",
    angle: "Praktyczny test hipotezy przez 3 rozmowy z potencjalnym klientem.",
    postIdea: "Pokaż, jak odbiorca może w 48 godzin sprawdzić, czy jego pomysł rozwiązuje realny problem. Jeden krok: napisz do 3 osób z grupy docelowej z pytaniem otwartym.",
    keyPoints: ["Sformułuj hipotezę w jednym zdaniu", "Zadaj 3 konkretne pytania zamiast opisywać pomysł", "Zapisz odpowiedzi i sprawdź, czy pojawia się wzorzec"],
    format: "karuzela edukacyjna"
  },
  {
    title: "Walidacja w 20 wiadomościach — metoda krok po kroku",
    hook: "20 wiadomości. Tyle wystarczy, żeby wiedzieć, czy rynek tego chce.",
    angle: "Framework mini-badania rynku bez narzędzi i budżetu.",
    postIdea: "Naucz odbiorców metody 20 kontaktów: wyślij krótką wiadomość do 20 osób z grupy docelowej. Nie sprzedajesz — pytasz o problem. Mierzysz liczbę odpowiedzi i jakość reakcji.",
    keyPoints: ["Napisz wiadomość z pytaniem, nie z ofertą", "Mierz odpowiedź, nie polubienia", "Po 20 rozmowach masz dane do decyzji"],
    format: "post edukacyjny"
  },
  {
    title: "Pierwszy klient przed pierwszym produktem",
    hook: "Najlepsi przedsiębiorcy sprzedają zanim cokolwiek zbudują.",
    angle: "Jak zdobyć pierwszego płacącego klienta bez gotowego produktu.",
    postIdea: "Pokaż sekwencję: zidentyfikuj problem → opisz rozwiązanie w zdaniu → zaproponuj konkretną pomoc jednej osobie → iteruj na podstawie feedbacku.",
    keyPoints: ["Zdefiniuj problem węziej niż myślisz", "Zaproponuj pomoc ręcznie zanim to zautomatyzujesz", "Jeden płacący klient uczy więcej niż 100 ankiet"],
    format: "karuzela edukacyjna"
  },
  {
    title: "Jak napisać ofertę w jednym zdaniu",
    hook: "Jeśli nie możesz wyjaśnić oferty w jednym zdaniu, klient też jej nie zrozumie.",
    angle: "Szablon zdania ofertowego: dla kogo, jaki problem, jaki rezultat.",
    postIdea: "Pokaż szablon: 'Pomagam [kto] osiągnąć [co] bez [co ich boli]. Daj 3 przykłady mocnych vs słabych zdań ofertowych.",
    keyPoints: ["Zacznij od 'Pomagam [kto]...'", "Rezultat musi być konkretny i mierzalny", "Usuń słowo 'kompleksowo' — to czerwona flaga"],
    format: "post z przykładem"
  }
];

const curiosityFallbacks = [
  {
    title: "\"Super pomysł!\" — to nie jest sygnal zakupu",
    hook: "Wszyscy mówią \"genialny pomysł\". Nikt nie płaci. Dlaczego?",
    angle: "Różnica między komplementem a sygnałem popytu — nieoczywisty insight.",
    postIdea: "Pokaż, że 'super pomysł' to za mało. Realny sygnał popytu to: konkretne pytanie o cenę, prośba o termin, próba zapisu, lub gotowość do rozmowy o detalach.",
    keyPoints: ["Rozróżnij entuzjazm od intencji zakupu", "Podaj 4 konkretne sygnały popytu", "Daj prosty sposób notowania takich sygnałów"],
    format: "post z insightem"
  },
  {
    title: "Dlaczego najlepsze biznesy wyglądają nudno z zewnątrz",
    hook: "Najbardziej dochodowe biznesy rzadko wyglądają sexy na Instagramie.",
    angle: "Insight o tym, że skuteczność i atrakcyjność to często różne rzeczy.",
    postIdea: "Pokaż, że niszowe, niepozorne rozwiązania często mają wyższe marże i mniejszą konkurencję. Odbiorca przecenia trendy, a nie docenia nudy.",
    keyPoints: ["Podaj przykład 'nudnego' biznesu z wysoką marżą", "Wyjaśnij, dlaczego nuda = mniejsza konkurencja", "Zaproponuj ćwiczenie: szukaj problemu, który ludzie niechętnie przyznają"],
    format: "post kontrariański"
  },
  {
    title: "Ciekawostka: rynek mówi \"nie\" w trzech językach",
    hook: "Rynek odrzuca twój pomysł na 3 sposoby. Większość nie rozpoznaje żadnego.",
    angle: "Trzy wzorce odrzucenia, które wyglądają jak zainteresowanie.",
    postIdea: "Naucz rozpoznawać sygnały: brak odpowiedzi, ogólne pytania bez zobowiązania, obiecywanie że 'może kiedyś'. Każdy to forma 'nie', tylko uprzejma.",
    keyPoints: ["Cisza = odrzucenie, nie zastanowienie", "\"Interesujące\" bez pytania o cenę = brak intencji", "Zbyt dużo pytań szczegółowych = brak decyzji"],
    format: "karuzela z przykładami"
  }
];

const problemFallbacks = [
  {
    title: "Budujesz miesiącami to, czego nikt nie chce",
    hook: "Najdroższy etap biznesu zaczyna się wtedy, gdy budujesz coś w ciszy.",
    angle: "Koszt perfekcjonizmu zanim cokolwiek pokażesz rynkowi.",
    postIdea: "Opisz sytuację: miesiące pracy, dopracowane logo, strona gotowa — ale zero rozmów z klientami. Pokaż, że opóźnianie kontaktu z rynkiem to kosztowna pułapka.",
    keyPoints: ["Nazwij pułapkę perfekcjonizmu", "Policz realny koszt 3 miesięcy bez feedbacku", "Daj jedno działanie na dziś zamiast 3 miesięcy pracy"],
    format: "post problemowy"
  },
  {
    title: "Problem z odkładaniem rozmów z klientem",
    hook: "\"Najpierw dopracuję, potem pokażę.\" To zdanie kosztuje miesiące.",
    angle: "Mechanizm psychologiczny odkładania kontaktu z rynkiem — i jak go przerwać.",
    postIdea: "Opisz wewnętrzny dialog osoby, która ciągle odkłada pokazanie produktu. Strach przed odrzuceniem ubiera się w 'potrzebuję jeszcze tylko X'. Zaproponuj jedno małe działanie na dzisiaj.",
    keyPoints: ["Nazwij strach, który stoi za perfekcjonizmem", "Pokaż, że niedoskonały feedback > żaden feedback", "Jeden konkretny krok na dziś"],
    format: "post emocjonalny"
  },
  {
    title: "Dlaczego 'brak czasu' to zazwyczaj coś innego",
    hook: "\"Nie mam czasu na testowanie\" — to rzadko jest problem czasu.",
    angle: "Odkrycie, że wymówka braku czasu maskuje strach przed odrzuceniem.",
    postIdea: "Pokaż, że walidacja zajmuje 2 godziny, nie 2 miesiące. Pytanie do 5 osób przez LinkedIn = 40 minut. Strach przed \"nie\" nie jest problemem czasowym.",
    keyPoints: ["Wymień, co walidacja zajmuje naprawdę", "Pokaż mini-eksperyment na 2 godziny", "Zadaj pytanie: czego się boisz, że usłyszysz?"],
    format: "post prowokacyjny"
  }
];

const offerFallbacks = [
  {
    title: "Oferta, która sprzedaje się sama — jak ją zbudować",
    hook: "Jeśli musisz długo tłumaczyć ofertę, klient już przestał słuchać.",
    angle: "Jak zbudować ofertę, która mówi sama za siebie przez konkretny rezultat.",
    postIdea: "Pokaż 3-elementową strukturę oferty: kto to jest dla kogo, jaki konkretny problem rozwiązuje, jaki efekt klient widzi po tygodniu/miesiącu. Bez buzzwordów.",
    keyPoints: ["Zacznij od problemu, nie od siebie", "Wynik musi być konkretny, nie abstrakcyjny", "Usuń 'kompleksowo', 'holistycznie', 'efektywnie'"],
    format: "post ofertowy"
  },
  {
    title: "Test oferty przed startem — bezpieczna metoda",
    hook: "Nie musisz mieć gotowego produktu, żeby sprawdzić, czy ktoś zapłaci.",
    angle: "Jak przetestować chęć zakupu zanim zainwestujesz czas i pieniądze.",
    postIdea: "Pokaż sekwencję prevalidacji: opisz ofertę słowami → pokaż 5 osobom → zapytaj 'czy to coś dla Ciebie?' → mierz liczbę 'kiedy i ile'.",
    keyPoints: ["Opisz ofertę w 2 zdaniach", "Pokaż 5 osobom z grupy docelowej", "Sygnal zakupu = pytanie o cenę lub termin"],
    format: "post z metodą"
  }
];

const caseFallbacks = [
  {
    title: "Jak Marta zmieniła ogólny pomysł w konkretną ofertę",
    hook: "Każdy mówił 'świetny pomysł'. Nikt nie chciał płacić. Do czasu jednej zmiany.",
    angle: "Mini historia pokazująca, jak zawężenie niszy przekształca pomysł w biznes.",
    postIdea: "Opisz fikcyjny, realistyczny case: Marta miała ogólny kurs dla 'przedsiębiorców'. Po 5 rozmowach zawęziła go do 'kobiet po 40. roku życia wracających na rynek pracy'. Cena wzrosła, lista chętnych też.",
    keyPoints: ["Przed: ogólna oferta, zero zainteresowania", "Zmiana: 5 rozmów i jedno konkretne zawężenie", "Po: jasny klient, wyższa cena, mniej obiekcji"],
    format: "mini case study"
  },
  {
    title: "Od pomysłu do pierwszego klienta w 3 tygodnie",
    hook: "3 tygodnie. Bez strony, bez logo, bez reklam. Tylko rozmowy.",
    angle: "Dowód, że najszybsza droga do klienta to bezpośredni kontakt — nie infrastruktura.",
    postIdea: "Opisz case: Tomek miał pomysł na konsultacje IT. Napisał do 15 znajomych, 3 odpowiedziały, 1 kupiła. Zarabiał zanim zbudował stronę.",
    keyPoints: ["Tydzień 1: lista 15 kontaktów, 15 wiadomości", "Tydzień 2: 3 rozmowy, 1 oferta", "Tydzień 3: płatność, iteracja oferty"],
    format: "post narracyjny"
  }
];

function buildFallbackItem(assignment: { type: string; index: number }, topic: string, brief: unknown) {
  const context = briefContext(brief);
  const subject = shortTopic(topic);
  const cta = context.cta || "Napisz w komentarzu co o tym myślisz.";
  const type = assignment.type.toLowerCase();
  const i = assignment.index;

  if (type.includes("eduk")) {
    const v = educationFallbacks[i % educationFallbacks.length];
    return { ...v, cta };
  }

  if (type.includes("ciekaw")) {
    const v = curiosityFallbacks[i % curiosityFallbacks.length];
    return { ...v, cta };
  }

  if (type.includes("problem")) {
    const v = problemFallbacks[i % problemFallbacks.length];
    return { ...v, cta };
  }

  if (type.includes("ofert")) {
    const v = offerFallbacks[i % offerFallbacks.length];
    return { ...v, cta };
  }

  if (type.includes("case")) {
    const v = caseFallbacks[i % caseFallbacks.length];
    return { ...v, cta };
  }

  if (type.includes("offtop")) {
    const offtopVariants = [
      { title: "Kulisy: dlaczego spokojny start wygrywa", hook: "Nie każdy start musi wyglądać jak wielki launch.", angle: "Ludzki kontekst — mniej presji, więcej danych.", postIdea: `Pokaż osobistą obserwację: testowanie "${subject}" po godzinach daje spokój i dane do decyzji bez palenia mostów.`, keyPoints: ["Pokaż kulisy myślenia", "Nazwij presję szybkiego startu", "Wróć do bezpiecznego testu"], format: "post osobisty" },
      { title: "Co zmieniłem w podejściu do pracy po jednej decyzji", hook: "Jedna decyzja potrafi zmienić cały rytm pracy.", angle: "Osobista historia budująca autentyczność marki.", postIdea: "Podziel się obserwacją lub zmianą nawyku, która poprawiła efektywność — bez sprzedaży, z autentycznością.", keyPoints: ["Konkretna decyzja lub zmiana", "Co się zmieniło w praktyce", "Co z tego wyniosłeś dla siebie"], format: "post refleksyjny" }
    ];
    const v = offtopVariants[i % offtopVariants.length];
    return { ...v, cta };
  }

  return {
    title: `${assignment.type}: konkretna wartość dla odbiorcy`,
    angle: `${narrativeStageLabel(assignment.index, 18)}: praktyczny argument wokół "${subject}".`,
    hook: "Jeden konkretny krok robi więcej niż tydzień planowania.",
    postIdea: `Zbuduj post prowadzący odbiorcę od zainteresowania tematem "${subject}" do jednego małego działania.`,
    keyPoints: ["Nazwij problem", "Pokaż prosty test", "Zakończ jednym pytaniem do odbiorcy"],
    cta,
    format: "post"
  };
}

function shortTopic(topic: string) {
  const clean = topic.replace(/\s+/g, " ").trim();
  if (!clean) return "pomyslu";
  return clean.length > 72 ? `${clean.slice(0, 69).trim()}...` : clean;
}

function briefContext(brief: unknown) {
  const value = objectValue(brief);
  return {
    audience: typeof value.audience === "string" ? value.audience.trim() : "",
    promise: typeof value.promise === "string" ? value.promise.trim() : "",
    cta: typeof value.callToAction === "string" ? value.callToAction.trim() : ""
  };
}

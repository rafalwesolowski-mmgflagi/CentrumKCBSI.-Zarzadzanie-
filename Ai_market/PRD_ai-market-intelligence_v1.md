# PRD: AI Market Intelligence
**Wersja:** 1.0 | **Data:** 2026-07-01 | **Autor (PM):** Michal (CodeSpade)
**Status:** Ready for Development

---

## 1. EXECUTIVE SUMMARY
Narzędzie AI, które na podstawie podanej branży/produktu i regionu automatycznie generuje pełny raport rynkowy (wielkość rynku, konkurencja, ceny, potrzeby klientów, luki rynkowe, propozycje usług, persony, lista 100 potencjalnych klientów) w ~30 minut. Buduje przewagę sprzedażową Michała w CodeSpade, eliminując wielogodzinny ręczny research i kontakt z rynkiem przed podjęciem decyzji biznesowej lub ofertą dla klienta.

---

## 2. PROBLEM STATEMENT

### 2.1 Problem który rozwiązujemy
Michal nie ma dziś sposobu na szybkie, wiarygodne rozeznanie nowej branży/produktu. Manualny research i testy rynku poprzez kontakt z klientami zajmują dużo czasu, spowalniają decyzje biznesowe i proces sprzedażowy CodeSpade.

### 2.2 Obecne rozwiązanie i jego wady
Brak — research robiony ad hoc, ręcznie, bez ustrukturyzowanego procesu. Wolno, niekompletnie, bez twardych danych do rozmowy z klientem.

### 2.3 Metryki sukcesu
- Raport dla jednej branży/regionu gotowy w ≤30 minut
- Każda liczba w raporcie ma przypisane źródło
- Sekcje z niewystarczającymi danymi są jawnie oznaczone (nie zgadywane)
- Raport pozwala oszacować ROI wejścia w daną branżę i zawiera listę 100 potencjalnych klientów

---

## 3. UŻYTKOWNICY

### 3.1 Persona główna
- **Rola:** Michal — właściciel CodeSpade, solo-operator, poziom techniczny 10/10
- **Poziom techniczny:** 10/10
- **Główne potrzeby:** szybka, wiarygodna ocena szans rynkowych przed wejściem w branżę lub ofertą dla klienta
- **Frustracje:** manualny research i testy rynku zajmują zbyt dużo czasu

### 3.2 Role i uprawnienia
| Rola | Może | Nie może |
|------|------|----------|
| Właściciel (Michal) | Generować raporty, ustawiać limity kosztów, eksportować PDF/MD | — (jedyny użytkownik w v1) |

### 3.3 Skala użytkowania
- Start: 1 użytkownik (Michal)
- 12 miesięcy: 1 użytkownik, 20–50 raportów/mc
- Wzorzec użycia: codziennie, przy nowych leadach i projektach

---

## 4. ZAKRES PROJEKTU

### 4.1 IN SCOPE — Wersja 1.0 (wdrażana falami)
**Fala 1 (pierwszy działający kamień milowy):**
- Input: branża/produkt + region (wpisywane ręcznie)
- Pobranie firm z Google Maps/Places
- Analiza stron www konkurencji (SEO, szybkość, CTA, formularze, technologia, SSL)
- Analiza Google Reviews (ocena, liczba opinii)
- Ranking firm + szacowana wielkość rynku i konkurencja
- Ceny konkurencji (tam gdzie dostępne publicznie)
- Lista 100 potencjalnych klientów z oceną szans (score)
- Output: raport PDF + Markdown z cytowanymi źródłami przy każdej liczbie
- Mechanizm "niska pewność / za mało danych" dla sekcji bez wystarczających danych
- Opcjonalny limit kosztu per raport (domyślnie wyłączony)

**Fala 2:**
- Social media (Facebook, LinkedIn), fora branżowe, Trustpilot, YouTube
- Grupowanie problemów i potrzeb klientów z opinii/dyskusji
- Luki rynkowe + propozycje usług
- Persony klientów

**Fala 3:**
- Marketplace'y produktowe (Allegro, Amazon, Temu, AliExpress) — ścieżka dla analizy produktów fizycznych, równoległa do ścieżki usług lokalnych

### 4.2 OUT OF SCOPE — Wersja 2.0+
- Plan wejścia na rynek (rozbudowana sekcja strategiczna)
- Integracje: Google Drive, wysyłka mailem, Slack
- Branding wizualny raportu PDF (dogrywany później)
- Wielu użytkowników / role / dostęp zewnętrzny (klienci CodeSpade jako odbiorcy usługi)

### 4.3 Ograniczenia
- **Zero halucynacji** — twardy wymóg. Każda liczba/insight musi mieć źródło (link/cytat). Brak wystarczających danych → jawna flaga "niska pewność", nigdy uzupełnianie zgadywanymi wartościami.
- Narzędzie nie gwarantuje 100% trafności danych rynkowych — to szacunki oparte na dostępnych publicznie źródłach.
- Scraping/API muszą respektować ToS serwisów źródłowych na tyle, na ile to możliwe przy narzędziu do użytku wewnętrznego.

---

## 5. FUNKCJONALNOŚCI — SPECYFIKACJA

### Feature 1: Zbieranie firm i danych z Google Maps
**Priorytet:** MUST HAVE
**Opis:** Dla podanej branży + regionu pobiera listę firm (nazwa, adres, ocena, liczba opinii, strona www, telefon).

**Flow użytkownika:**
1. Michal wpisuje branżę i region (np. "gabinety stomatologiczne", "Oslo")
2. System pobiera firmy z Google Places API
3. Michal widzi wstępną listę firm z podstawowymi danymi

**Edge cases i błędy:**
- Jeśli region za mały / brak wyników → system informuje o braku danych zamiast zwracać pustą listę bez wyjaśnienia
- Jeśli API zwróci błąd/limit → raport oznacza sekcję jako niedostępną, nie przerywa całego procesu

**Kryteria akceptacji:**
- [ ] Dla testowej branży i regionu system zwraca min. 20 firm (jeśli tyle istnieje)
- [ ] Każdy rekord ma źródło (link do Google Maps)

---

### Feature 2: Analiza stron www konkurencji
**Priorytet:** MUST HAVE
**Opis:** Dla każdej firmy z listy analizuje jej stronę: szybkość (PageSpeed), SEO, obecność formularza/CTA, SSL, technologię (WordPress/Wix/inne), obecność bloga i social media.

**Flow użytkownika:**
1. System automatycznie odwiedza stronę każdej firmy z Feature 1
2. Analizuje wskaźniki techniczne i treściowe
3. Michal widzi ranking firm od najsłabszej do najmocniejszej strony

**Edge cases i błędy:**
- Brak strony www → firma oznaczona jako "brak obecności online" (to też insight)
- Strona niedostępna/timeout → oznaczenie "nie udało się przeanalizować", nie blokuje reszty

**Kryteria akceptacji:**
- [ ] Każda firma ze stroną ma komplet wskaźników lub jawne oznaczenie braków
- [ ] Ranking sortowalny wg "szansy sprzedażowej"

---

### Feature 3: Analiza Google Reviews i sygnałów potrzeb klientów
**Priorytet:** MUST HAVE
**Opis:** Zbiera opinie Google dla firm z branży, grupuje powtarzające się problemy/potrzeby (np. "35% narzeka na czas oczekiwania").

**Flow użytkownika:**
1. System pobiera opinie dla firm z listy
2. Grupuje treści wg powtarzających się tematów/problemów
3. Michal widzi listę najczęstszych problemów z % udziałem i przykładowymi cytatami źródłowymi

**Edge cases i błędy:**
- Za mało opinii w niszy → sekcja oznaczona jako "niska pewność — mała próba"

**Kryteria akceptacji:**
- [ ] Minimum 3 zgrupowane kategorie problemów przy wystarczającej liczbie opinii
- [ ] Każda kategoria ma link do przykładowych źródłowych opinii

---

### Feature 4: Szacowanie wielkości rynku i luk rynkowych
**Priorytet:** MUST HAVE
**Opis:** Na bazie liczby firm, ich cen, ocen i nasycenia rynku szacuje wielkość rynku i identyfikuje luki (np. brak wersji premium, brak usługi X u konkurencji).

**Flow użytkownika:**
1. System agreguje dane z Feature 1–3
2. Generuje szacunek wielkości rynku (z przedziałem ufności, nie pojedynczą liczbą)
3. Wskazuje konkretne luki rynkowe z uzasadnieniem

**Edge cases i błędy:**
- Zbyt mało danych do wiarygodnego oszacowania → system podaje widełki bardzo szerokie i jawnie flaguje niską pewność zamiast fałszywej precyzji

**Kryteria akceptacji:**
- [ ] Szacunek zawsze podany jako przedział, nie pojedyncza liczba
- [ ] Każda luka rynkowa ma uzasadnienie oparte na zebranych danych

---

### Feature 5: Lista 100 potencjalnych klientów + ocena szans
**Priorytet:** MUST HAVE
**Opis:** Dla branż usługowych — lista firm/potencjalnych klientów z Google Maps z oceną szans sprzedażowych (np. "92% szans — brak SSL, stara strona, wysoka ocena Google"). Dla produktów fizycznych — lista segmentów/kanałów sprzedaży zamiast konkretnych firm.

**Flow użytkownika:**
1. System łączy dane z Feature 1–2 (stan strony, obecność online, oceny)
2. Nadaje każdej firmie score szans
3. Michal widzi listę 100 pozycji posortowaną wg score, z uzasadnieniem oceny

**Edge cases i błędy:**
- Mniej niż 100 firm w regionie → system zwraca tyle, ile jest, i jawnie to komunikuje

**Kryteria akceptacji:**
- [ ] Każda pozycja ma numeryczny score i krótkie uzasadnienie
- [ ] Lista sortowalna wg score

---

### Feature 6: Generowanie raportu PDF + Markdown
**Priorytet:** MUST HAVE
**Opis:** Składa wszystkie sekcje w spójny dokument (PDF do wysyłki/prezentacji + MD do dalszej edycji), z cytowanymi źródłami przy każdej liczbie.

**Flow użytkownika:**
1. Po zakończeniu analizy system generuje raport
2. Michal pobiera PDF i/lub MD

**Edge cases i błędy:**
- Sekcja bez wystarczających danych → widoczna w raporcie z etykietą "niska pewność / za mało danych", nie pomijana po cichu

**Kryteria akceptacji:**
- [ ] Raport zawiera wszystkie sekcje z Fali 1 (i kolejnych, gdy gotowe)
- [ ] Każda liczba ma przypis źródła
- [ ] Dostępny zarówno jako PDF jak i MD

---

### Feature 7: Limit kosztów per raport (opcjonalny)
**Priorytet:** SHOULD HAVE
**Opis:** Możliwość ustawienia maksymalnego kosztu (API + AI) na raport. Domyślnie wyłączony.

**Flow użytkownika:**
1. Michal opcjonalnie ustawia limit w ustawieniach
2. Jeśli generowanie raportu zbliża się do limitu → system ostrzega/zatrzymuje się i informuje, która część raportu nie została ukończona

**Edge cases i błędy:**
- Limit ustawiony zbyt nisko → system jasno komunikuje, które sekcje zostały pominięte z powodu limitu

**Kryteria akceptacji:**
- [ ] Limit możliwy do ustawienia i wyłączenia
- [ ] Przy przekroczeniu system nie generuje niekompletnego raportu bez ostrzeżenia

---

## 6. ARCHITEKTURA DANYCH

### 6.1 Przepływ danych
```
[Input: branża + region]
    → [Google Places API — lista firm]
    → [Scraper/analiza stron www — techniczne + treściowe wskaźniki]
    → [Google Reviews API/scraper — opinie]
    → [(Fala 2) Social/fora/Trustpilot/YouTube — sygnały rynkowe]
    → [(Fala 3) Marketplace'y — analiza produktowa]
    → [Agregacja + AI analiza (grupowanie, scoring, szacunki)]
    → [Generator raportu — PDF + MD]
```

### 6.2 Struktura danych (główne encje)
```
Report {
  id: uuid
  branża: string
  region: string
  data_utworzenia: datetime
  status: enum (w trakcie / gotowy / częściowy)
  koszt_calkowity: decimal
  sekcje: Section[]
}

Company {
  id: uuid
  nazwa: string
  adres: string
  ocena_google: float
  liczba_opinii: int
  strona_www: string | null
  wskazniki_techniczne: object // SSL, PageSpeed, CMS, formularz, CTA
  score_szansy: float
  uzasadnienie_score: string
  zrodla: string[] // linki
}

ReviewInsight {
  id: uuid
  kategoria_problemu: string
  procent_udzialu: float
  przykladowe_cytaty: string[]
  zrodla: string[]
}

MarketEstimate {
  id: uuid
  widelki_dolne: decimal
  widelki_gorne: decimal
  poziom_pewnosci: enum (wysoki / średni / niski)
  uzasadnienie: string
}
```

### 6.3 Integracje zewnętrzne
| System | Typ połączenia | Dane | Kierunek |
|--------|---------------|------|----------|
| Google Places API | REST API | firmy, adresy, oceny | ← |
| Google Reviews (API/scraper) | REST API / scraping | opinie | ← |
| PageSpeed Insights API | REST API | szybkość stron | ← |
| Scraper stron www | Scraping | SEO, SSL, CMS, CTA | ← |
| Social media / fora (Fala 2) | Scraping / API | sygnały potrzeb | ← |
| Marketplace'y (Fala 3) | Scraping / API | dane produktowe | ← |
| Model AI (Claude) | REST API | analiza, grupowanie, generowanie raportu | ↔ |

### 6.4 Wymagania RODO / Prywatność
Narzędzie przetwarza dane publicznie dostępne o firmach (nie osobach prywatnych) — nazwy, adresy, oceny, treści opinii. Dostęp do raportów ma wyłącznie Michal. Brak przechowywania danych wrażliwych/osobowych poza publicznie dostępnymi opiniami klientów firm trzecich (te są cytowane jako źródło, nie profilowane).

---

## 7. UI/UX SPECYFIKACJA

### 7.1 Design principles
- Przejrzystość źródeł — każda liczba klikalna do źródła
- Jawność niepewności — brak ukrywania luk w danych
- Szybkość skanowania — raport czytelny "z lotu ptaka" (executive summary na start)
- Prosty branding na start, do dopracowania później

### 7.2 Główne widoki
**Widok 1: Nowy raport (input)**
- Cel: rozpoczęcie generowania raportu
- Kluczowe elementy: pole branża, pole region, opcjonalny limit kosztu
- CTA: "Generuj raport"

**Widok 2: Status generowania**
- Cel: pokazanie postępu (które źródła już przetworzone)
- Kluczowe elementy: progress per sekcja/fala
- CTA: brak — czekanie lub anulowanie

**Widok 3: Raport (podgląd + eksport)**
- Cel: przegląd gotowego raportu przed eksportem
- Kluczowe elementy: sekcje raportu, oznaczenia pewności danych, lista 100 klientów (sortowalna)
- CTA: "Pobierz PDF" / "Pobierz MD"

### 7.3 Referencje wizualne
Do ustalenia później (branding CodeSpade).

### 7.4 Wymagania techniczne UI
- Responsywność: Desktop + Mobile
- Branding: do dogrania później
- Dostępność: brak formalnego wymogu WCAG (użytkownik wewnętrzny)

---

## 8. STACK TECHNICZNY

### 8.1 Rekomendowany stack
| Warstwa | Technologia | Uzasadnienie |
|---------|-------------|--------------|
| Frontend | Next.js 14 | zgodność z istniejącym stackiem CodeSpade |
| Backend | Next.js API routes / Supabase Edge Functions | prostota, jeden ekosystem |
| Baza danych | Supabase (PostgreSQL) | zgodność ze stackiem, łatwe query po raportach |
| Hosting | Vercel | zgodność ze stackiem |
| AI/LLM | Claude (Anthropic API) | analiza tekstu, grupowanie, generowanie raportu, zgodność z wymogiem zero-halucynacji przez wymuszanie cytowań |
| Auth | Brak / proste hasło (jednoosobowy dostęp) | brak potrzeby pełnego systemu ról w v1 |
| Dane zewnętrzne | Google Places API, PageSpeed Insights API, scrapery (Puppeteer/Playwright) | pokrycie źródeł Fali 1–3 |

### 8.2 Narzędzia deweloperskie
- Środowisko vibe coding: Claude Code + Codex
- CI/CD: Vercel (auto-deploy)
- Monitoring: do ustalenia w trakcie budowy (na start: logi Vercel + Supabase)

### 8.3 Wymagania bezpieczeństwa
- Klucze API (Google, Anthropic, inne) przechowywane jako zmienne środowiskowe, nigdy w kodzie
- Brak publicznego dostępu do panelu — jednoosobowe logowanie
- Rate limiting na wywołania płatnych API, żeby uniknąć niekontrolowanych kosztów

---

## 9. PLAN WDROŻENIA

### 9.1 Etapy (propozycja)
**Etap 1 — Prototyp Fali 1 (najszybciej jak się da)**
- [ ] Input branża + region → Google Places API → lista firm
- [ ] Analiza stron www (podstawowe wskaźniki)
- [ ] Google Reviews — zbieranie i grupowanie
- [ ] Podstawowy raport MD z cytowaniami źródeł

**Etap 2 — MVP Fali 1 kompletnej**
- [ ] Szacowanie wielkości rynku i luk
- [ ] Lista 100 potencjalnych klientów ze score
- [ ] Eksport PDF
- [ ] Mechanizm "niska pewność / za mało danych"
- [ ] Opcjonalny limit kosztu

**Etap 3 — Fala 2 (social, fora, Trustpilot, YouTube)**
- [ ] Persony klientów
- [ ] Rozszerzone luki rynkowe

**Etap 4 — Fala 3 (marketplace'y produktowe)**
- [ ] Ścieżka analizy produktów fizycznych (Allegro, Amazon, Temu, AliExpress)

### 9.2 Definicja "Done" dla v1.0
- Michal wpisuje branżę + region i w ≤30 min otrzymuje raport PDF + MD zawierający wszystkie sekcje z Fali 1, z cytowanymi źródłami i jawnie oznaczonymi lukami danych.

### 9.3 Proces odbioru
- Kto akceptuje: Michal
- Jak testujemy: test na min. 3 różnych branżach/regionach (w tym jednej niszowej, żeby sprawdzić zachowanie przy małej ilości danych)

---

## 10. RYZYKA I ZAŁOŻENIA

### 10.1 Kluczowe założenia
- Płatne API (Google Places, ewentualnie SerpAPI/podobne) są akceptowalne kosztowo
- Region wpisywany ręcznie, bez automatycznej detekcji
- W v1 tylko Michal korzysta z narzędzia — brak potrzeby systemu ról/uprawnień

### 10.2 Ryzyka
| Ryzyko | Prawdopodobieństwo | Wpływ | Mitygacja |
|--------|-------------------|-------|-----------|
| Pełny zakres źródeł (Maps + strony + Reviews + social + fora + marketplace'y) opóźni "ASAP" | Wysokie | Wysoki | Wdrożenie falami (Etap 1–4), Fala 1 jako pierwszy użyteczny kamień milowy |
| Scraping social media/forów łamie ToS lub jest niestabilny | Średnie | Średni | W Fali 2 preferować oficjalne API tam, gdzie dostępne; traktować scraping jako uzupełnienie, nie fundament |
| Koszt raportu (API + AI) rośnie z zakresem źródeł | Średnie | Średni | Opcjonalny limit kosztu per raport (Feature 7) |
| Zbyt mało danych w niszowych branżach prowadzi do pustych/słabych raportów | Średnie | Średni | Jawne oznaczanie "niska pewność", widełki zamiast pojedynczych liczb |
| Halucynacje modelu AI przy generowaniu wniosków | Niskie–Średnie | Wysoki | Wymuszanie cytowań przy każdej liczbie/insighcie na poziomie promptu i walidacji wyjścia |

---

## 11. OTWARTE PYTANIA

1. Które płatne API/scrapery konkretnie wybieramy dla Fali 1 (Google Places API vs. SerpAPI vs. inne) — do decyzji na etapie technicznym przez Claude Code/Codex.
2. Format scoringu "szansy sprzedażowej" (Feature 5) — dokładna formuła do dopracowania w trakcie implementacji (np. wagi dla braku SSL, wieku strony, PageSpeed, liczby opinii).
3. Branding raportu PDF — do ustalenia w kolejnym kroku.

---

## 12. CHANGELOG
| Wersja | Data | Zmiana |
|--------|------|--------|
| 1.0 | 2026-07-01 | Wersja inicjalna |

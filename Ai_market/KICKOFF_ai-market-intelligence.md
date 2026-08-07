# KICKOFF: AI Market Intelligence

## Co budujemy
Narzędzie webowe (Next.js), które dla podanej branży/produktu i regionu automatycznie generuje pełny raport rynkowy (PDF + Markdown) dla jednego użytkownika (Michal, CodeSpade) — z zerową tolerancją na halucynacje.

## Użytkownik docelowy
Właściciel CodeSpade — poziom tech: 10/10 — używa: codziennie, 20–50 raportów/mc

## Problem i rozwiązanie
**Problem:** Ręczny research rynku/branży przed decyzją biznesową lub ofertą dla klienta zajmuje dużo czasu i spowalnia sprzedaż.
**Rozwiązanie:** Wpisujesz branżę + region → w ≤30 min dostajesz raport: wielkość rynku, konkurencja, ceny, potrzeby klientów, luki rynkowe, lista 100 potencjalnych klientów z oceną szans. Każda liczba ma źródło. Brak danych = jawna flaga "niska pewność", nigdy zgadywanie.

## Must-have v1 (bez tego produkt nie istnieje) — wdrażane falami

**Fala 1 (buduj najpierw, to pierwszy użyteczny kamień milowy):**
1. Input branża + region → Google Places API → lista firm → flow: user wpisuje "gabinety stomatologiczne, Oslo" → system pobiera firmy z ocenami/adresami → user widzi listę
2. Analiza stron www firm (SSL, PageSpeed, CMS, formularz/CTA, blog) → flow: system odwiedza każdą stronę → ranking firm wg stanu strony
3. Google Reviews → grupowanie problemów klientów (np. "35% narzeka na X") → flow: system pobiera opinie → grupuje tematy → pokazuje % + cytaty źródłowe
4. Szacunek wielkości rynku i luk rynkowych (zawsze jako przedział + poziom pewności, nigdy pojedyncza "pewna" liczba)
5. Lista 100 potencjalnych klientów ze score szans + uzasadnieniem
6. Generator raportu PDF + MD z cytowaniami źródeł przy każdej liczbie i jawnym oznaczeniem sekcji "niska pewność / za mało danych"
7. Opcjonalny limit kosztu per raport (domyślnie wyłączony) — ostrzeżenie/stop przy zbliżaniu się do limitu

**Fala 2 (po Fali 1):** social media, fora, Trustpilot, YouTube → persony klientów, rozszerzone luki rynkowe

**Fala 3 (po Fali 2):** marketplace'y produktowe (Allegro, Amazon, Temu, AliExpress) — osobna ścieżka dla analizy produktów fizycznych

**Nie robimy teraz:** plan wejścia na rynek (rozbudowana strategia), integracje Google Drive/email/Slack, dopracowany branding PDF, wielu użytkowników/role

## Twardy wymóg — ZERO HALUCYNACJI
Każda liczba, procent, insight w raporcie MUSI mieć przypisane źródło (link/cytat). Jeśli danych jest za mało (nisza, mało opinii) — system oznacza sekcję jako "niska pewność / za mało danych" zamiast dogadywać wartości. To wymaganie nadrzędne nad innymi — waliduj to na poziomie promptów do AI i na poziomie struktury danych (pole `zrodla: string[]` obowiązkowe przy każdej wygenerowanej liczbie).

## Sukces v1 wygląda tak
- [ ] Dla testowej branży + regionu system generuje kompletny raport Fali 1 w ≤30 min
- [ ] Każda liczba w raporcie jest klikalna/ma widoczne źródło
- [ ] Test na niszowej branży z małą ilością danych poprawnie pokazuje flagi "niska pewność" zamiast zmyślonych liczb
- [ ] Raport dostępny do pobrania jako PDF i jako MD
- [ ] Lista 100 potencjalnych klientów sortowalna wg score szans

## Stack
Frontend: Next.js 14 | Backend: Next.js API routes / Supabase Edge Functions | DB: Supabase (PostgreSQL) | Hosting: Vercel | Auth: proste logowanie jednoosobowe (brak systemu ról w v1)
AI/LLM: Claude (Anthropic API) — analiza tekstu, grupowanie opinii, generowanie raportu z wymuszonymi cytowaniami
Dane zewnętrzne: Google Places API, PageSpeed Insights API, scrapery stron www (Puppeteer/Playwright); w Fali 2–3 rozszerzenie o social/fora/marketplace'y (płatne API/scrapery akceptowalne budżetowo)
Integracje: brak w v1 (Drive/email → v2) / Dane wrażliwe: nie — tylko dane publiczne o firmach i publiczne opinie

## UI
Prosty, przejrzysty panel: (1) formularz nowego raportu (branża + region + opcjonalny limit kosztu), (2) widok postępu generowania per sekcja, (3) widok gotowego raportu z eksportem PDF/MD i sortowalną listą 100 klientów.
Responsywność: desktop + mobile | Branding: brak na start, dograć później

## Zacznij od
1. Setup projektu Next.js + Supabase + integracja Google Places API — pobieranie i zapisywanie listy firm dla testowej branży/regionu
2. Moduł analizy stron www (PageSpeed + podstawowe wskaźniki SEO/SSL/CMS) dla pobranych firm
3. Moduł Google Reviews + grupowanie problemów przez Claude API, z obowiązkowym polem źródeł przy każdym wygenerowanym insight

📎 Pełne PRD: `PRD_ai-market-intelligence_v1.md` | Deadline: ASAP (Fala 1 jako pierwszy kamień milowy)

# Focus Monitor — Backend Summary

Ten dokument opisuje aktualnie wdrożoną logikę backendu dla monitora skupienia.

## Zakres

Wdrożono backend bez zmian w frontendzie:
- zbieranie zdarzeń skupienia (`locked`, `fading`, `gone`),
- klasyfikator stanu oparty o mysz + aktywne okno,
- agregacja dzienna na podstawie surowych eventów,
- trwały zapis do SQLite,
- API przez IPC do dashboardu i raportów,
- snapshot raportów dziennych (bez duplikowania segmentów).

## Monitorowanie skupienia (v1)

Aktualna wersja monitoringu działa w main process i co 5 sekund pobiera:
- pozycję kursora (delta ruchu myszy),
- aktywne okno systemowe (aplikacja + tytuł okna).

Heurystyka klasyfikacji:
- `gone` — brak aktywności / bardzo niski ruch myszy,
- `fading` — częste przełączenia okien/tytułów,
- `locked` — stabilne okno + kontrolowany ruch myszy.

Uwaga: przełączanie kart w przeglądarce jest obecnie wykrywane po zmianach tytułu aktywnego okna (proxy).

## Model danych

Baza: `focus-monitor.db` (w katalogu `app.getPath('userData')`).

Tabele:
- `focus_events` — surowe eventy wejściowe,
- `daily_reports` — gotowe snapshoty metryk dziennych (timeline/statystyki/delta/topApps).

Indeksy:
- po `ts` w `focus_events`,
- po `day_start_ts` w `daily_reports`.

## Metryki dashboardu

### 1) today ("pasmo uwagi")
- szereg czasowy co 5 minut,
- oś X: czas,
- oś Y: stan (`locked` / `fading` / `gone`).

### 2) delta (dziś vs wczoraj)
- porównanie czasu `locked`:
  - `todayLockedMs`,
  - `yesterdayLockedMs`,
  - `percentChange`.

### 3) topApps
- top 3 aplikacje aktywne podczas stanu `locked` (po czasie trwania).

## IPC kontrakt

### Ingest
- `focus:ingest`
- payload:
  - `state: 'locked' | 'fading' | 'gone'`
  - `appName?: string`
  - `windowTitle?: string`
  - `ts?: number`

### Dashboard
- `reports:today` (request/response)
- `dashboard:update` (push po wygenerowaniu snapshotu)

### Raport (snapshot)
- `reports:generate` (request/response)
- agreguje dane z SQLite dla wskazanego dnia.

## Architektura: daily snapshot

- Dane surowe trafiają do `focus_events`.
- Snapshot dnia (`daily_reports`) jest liczony:
  - ręcznie przez `reports:generate`,
  - automatycznie po północy (domknięcie poprzedniego dnia).
- Dashboard czyta gotowy snapshot dnia (`reports:today`).

## Kluczowe pliki

- `src/main/focus/types.ts` — typy domenowe,
- `src/main/focus/time.ts` — operacje na czasie,
- `src/main/focus/analytics.ts` — budowanie metryk z eventów,
- `src/main/focus/database.ts` — warstwa SQLite,
- `src/main/focus/service.ts` — logika domenowa + IPC,
- `src/main/focus/monitor.ts` — sampler + klasyfikator stanu,
- `src/main/index.ts` — inicjalizacja i lifecycle serwisu,
- `src/preload/index.ts` — API do renderer (`window.api`),
- `src/preload/index.d.ts` — typowanie `window.api`.

## Status

- backend uruchamia się i buduje poprawnie,
- `npm run build` zakończone sukcesem.

## Generowanie danych i testy

Dodane komendy:
- `npm run focus:seed` — generuje przykładowe dane (wczoraj + dziś) do pliku `tmp/focus-monitor.seed.db`,
- `npm run focus:test:classifier` — test heurystyki klasyfikatora (`locked` / `fading` / `gone`),
- `npm run focus:test:smoke` — smoke test agregacji i metryk na zseedowanej bazie,
- `npm run focus:test` — pełna sekwencja: classifier test + seed + smoke.

Pliki pomocnicze:
- `src/main/focus/dev/seed.ts`,
- `src/main/focus/dev/classifier-test.ts`,
- `src/main/focus/dev/smoke-test.ts`.

## Następny krok (opcjonalnie)

Dodać prosty `FocusIngestor` (stub/symulator eventów), aby testować dashboard stream bez gotowego detektora aktywnego okna.

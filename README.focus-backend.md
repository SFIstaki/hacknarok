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

Przykładowy `reports:today` response:

```json
{
  "nowTs": 1776504000000,
  "currentState": "locked",
  "currentAppName": "Visual Studio Code",
  "currentWindowTitle": "presently - analytics.ts",
  "reportStatus": {
    "hasTodaySnapshot": true,
    "latestSnapshotGeneratedAtTs": 1776499205000,
    "latestSnapshotDayStartTs": 1776492000000,
    "latestSnapshotDayEndTs": 1776578400000
  },
  "timeline": [
    { "bucketStart": 1776492000000, "state": "gone" },
    { "bucketStart": 1776492300000, "state": "locked" }
  ],
  "stats": {
    "lockedMs": 14400000,
    "fadingMs": 1800000,
    "goneMs": 3600000,
    "totalMs": 19800000
  },
  "delta": {
    "todayLockedMs": 14400000,
    "yesterdayLockedMs": 12600000,
    "percentChange": 14.2857
  },
  "topApps": [
    { "appName": "Visual Studio Code", "durationMs": 10200000 },
    { "appName": "Terminal", "durationMs": 4200000 }
  ]
}
```

### Raport (snapshot)

- `reports:generate` (request/response)
- agreguje dane z SQLite dla wskazanego dnia.

Przykładowy `reports:generate` request:

```json
{
  "dayStartTs": 1776492000000
}
```

Przykładowy `reports:generate` response:

```json
{
  "generatedAtTs": 1776499205000,
  "dayStartTs": 1776492000000,
  "dayEndTs": 1776578400000,
  "timeline": [
    { "bucketStart": 1776492000000, "state": "gone" },
    { "bucketStart": 1776492300000, "state": "locked" }
  ],
  "stats": {
    "lockedMs": 14400000,
    "fadingMs": 1800000,
    "goneMs": 3600000,
    "totalMs": 19800000
  },
  "yesterdayStats": {
    "lockedMs": 12600000,
    "fadingMs": 2400000,
    "goneMs": 4200000,
    "totalMs": 19200000
  },
  "delta": {
    "todayLockedMs": 14400000,
    "yesterdayLockedMs": 12600000,
    "percentChange": 14.2857
  },
  "topApps": [
    { "appName": "Visual Studio Code", "durationMs": 10200000 },
    { "appName": "Terminal", "durationMs": 4200000 }
  ]
}
```

## Architektura: daily snapshot

- Dane surowe trafiają do `focus_events`.
- Snapshot dnia (`daily_reports`) jest liczony:
  - ręcznie przez `reports:generate`,
  - automatycznie po północy (domknięcie poprzedniego dnia).
- Dashboard czyta gotowy snapshot dnia (`reports:today`).

## Retencja danych

- Eventy i snapshoty starsze niż 60 dni są automatycznie usuwane.
- Cleanup odpala się:
  - przy starcie serwisu,
  - po każdej generacji snapshotu.

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

## Rozdział 3 — Stabilizacja backendu (kontrakt, status snapshotu, retencja)

W tym etapie domknięto 3 kluczowe obszary integracji backendu z dashboardem:

1. Kontrakt IPC + przykładowe payloady

- doprecyzowano kontrakt kanałów `reports:today`, `reports:generate`, `dashboard:update`,
- dodano przykładowe request/response JSON, aby frontend mógł integrować się bez zgadywania formatu danych.

2. Status ostatniej generacji snapshotu

- rozszerzono `ReportsTodayResponse` o pole `reportStatus`, które zawiera:
  - `hasTodaySnapshot`,
  - `latestSnapshotGeneratedAtTs`,
  - `latestSnapshotDayStartTs`,
  - `latestSnapshotDayEndTs`.
- dzięki temu dashboard może jasno pokazać, czy i kiedy raport dzienny został policzony.

3. Retencja danych

- dodano automatyczne usuwanie danych starszych niż 60 dni:
  - `focus_events`,
  - `daily_reports`.
- cleanup uruchamia się przy starcie serwisu oraz po generacji snapshotu.

Walidacja po zmianach:

- `npm run focus:test` ✅
- `npm run build` ✅

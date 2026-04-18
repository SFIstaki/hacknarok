# Focus Monitor — Backend Summary

Ten dokument opisuje aktualnie wdrożoną logikę backendu dla monitora skupienia.

## Zakres

Wdrożono backend bez zmian w frontendzie:
- zbieranie zdarzeń skupienia (`locked`, `fading`, `gone`),
- segmentacja czasu (start/end/duration),
- trwały zapis do SQLite,
- API przez IPC do dashboardu i raportów,
- push live danych do dashboardu (bez realtime query do bazy po stronie renderer).

## Model danych

Baza: `focus-monitor.db` (w katalogu `app.getPath('userData')`).

Tabele:
- `focus_events` — surowe eventy wejściowe,
- `focus_segments` — odcinki czasowe stanu (z aplikacją i tytułem okna).

Indeksy:
- po `ts` w `focus_events`,
- po `start_ts`, `end_ts`, `state` w `focus_segments`.

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
- `dashboard:update` (push event co kilka sekund + przy zmianie stanu)

### Raport (snapshot)
- `reports:generate` (request/response)
- agreguje dane z SQLite dla wskazanego dnia.

## Architektura: stream vs snapshot

### Dashboard = stream
- renderer dostaje gotowe payloady przez push IPC,
- brak zapytań do SQLite w czasie rzeczywistym po stronie renderer.

### Raport = snapshot
- liczony na żądanie (`reports:generate`),
- pełne agregaty zwracane naraz.

## Kluczowe pliki

- `src/main/focus/types.ts` — typy domenowe,
- `src/main/focus/time.ts` — operacje na czasie,
- `src/main/focus/database.ts` — warstwa SQLite,
- `src/main/focus/service.ts` — logika domenowa + IPC,
- `src/main/index.ts` — inicjalizacja i lifecycle serwisu,
- `src/preload/index.ts` — API do renderer (`window.api`),
- `src/preload/index.d.ts` — typowanie `window.api`.

## Status

- backend uruchamia się i buduje poprawnie,
- `npm run build` zakończone sukcesem.

## Następny krok (opcjonalnie)

Dodać prosty `FocusIngestor` (stub/symulator eventów), aby testować dashboard stream bez gotowego detektora aktywnego okna.

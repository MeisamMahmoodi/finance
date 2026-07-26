# Finance & AI Hub — Phase 1

Next.js PWA-Grundgerüst: Dark-Mode-Dashboard (Tacho, Timeline, AI-Feed-Platzhalter), Supabase-Auth (Magic Link), responsives Layout (mobile-first, Desktop 2-Spalten).

## Lokal starten

```bash
npm install
npm run dev
```

Dann `http://localhost:3000` öffnen. `.env.local` ist bereits mit dem Supabase-Projekt `finance-ai-hub` verknüpft.

## Login

Auf `/login` E-Mail eingeben → Magic Link kommt per Mail (Supabase Auth). Jeder Account ist komplett isoliert (eigene Daten, kein Sharing).

## Aktueller Stand

- Dashboard zeigt Demo-Daten, solange keine echten Transaktionen in Supabase liegen.
- Chat-Eingabefeld ist UI-only — Gemini-Anbindung kommt in Phase 3.
- Push-Toggle in den Einstellungen ist Platzhalter — Web Push kommt in Phase 4.
- DB-Schema (`transactions`, `ai_insights`, `connections`) ist in Supabase angelegt, inkl. Row Level Security pro Nutzer.

## Nächste Phasen

1. E-Mail-Parsing (IMAP) → echte Transaktionen
2. AI-Feed + Gemini-Chat-Assistent
3. Web Push Benachrichtigungen
4. Bank-Anbindung (GoCardless)

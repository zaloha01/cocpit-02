# FinanceOS – Architektura aplikace

Tento dokument popisuje, jak je aplikace FinanceOS vnitřně postavená,
aby byla dlouhodobě udržitelná, rozšiřitelná a pochopitelná.

Cílem architektury je:
- žádná magie
- žádná schovaná logika
- jasné oddělení odpovědností

---

## Základní princip
Aplikace je rozdělena do tří hlavních vrstev:

1. Storage – kde jsou data
2. Domain – jak se data počítají
3. UI – co vidí a ovládá uživatel

Každá vrstva má jasnou roli a nesmí dělat práci jiné vrstvy.

---

## 1) Storage (uložiště dat)

Storage je **jediný zdroj pravdy**.

- uchovává celý stav aplikace (AppState)
- podporuje automatické ukládání
- umožňuje export/import JSON zálohy
- je připravené na cloud v budoucnu

UI nikdy nesmí:
- číst přímo ze storage
- zapisovat přímo do storage

---

## 2) Domain (logika a výpočty)

Domain je „mozek aplikace“.

Obsahuje:
- výpočet MÁM ZAPLATIT / ZAPLACENO / ZBÝVÁ
- výpočet pohyblivých výdajů
- výpočet deficitu (kolik musí Karel vydělat)
- pravidla rozpočítání
- pravidla dluhů
- pravidla cílů

Domain:
- neví nic o UI
- neví nic o HTML
- pracuje jen s daty

---

## 3) UI (uživatelské rozhraní)

UI:
- zobrazuje data
- sbírá vstupy od uživatele
- posílá akce do AppState

UI:
- **nikdy nepočítá**
- **nikdy neukládá**
- **nikdy nevymýšlí logiku**

UI je „hloupé“, Domain je „chytrá“.

---

## AppState (centrální stav)

Celá aplikace pracuje s jedním objektem AppState.

Obsahuje:
- stav peněženky
- trvalé platby (pravidla)
- měsíční instance plateb
- příjmy
- dluhy
- cíle
- kategorie
- nastavení

AppState je verzovaný kvůli budoucím změnám.

---

## Měsíční instance
Trvalé platby jsou **pravidla**.

Pro každý měsíc se z nich vytváří:
- měsíční instance
- stav zaplaceno / nezaplaceno / částečně
- informace kdo zaplatil a jak (já / dar / půjčka)

Změna v dashboardu:
- nikdy nemění trvalé pravidlo
- mění pouze instanci konkrétního měsíce

---

## Budoucí moduly
Architektura je připravená na:
- projekty
- investice
- pasiva / aktiva
- více uživatelů
- přihlášení

Tyto moduly budou:
- samostatné
- napojené na AppState
- bez zásahu do existující logiky

---

## Základní slib architektury
Jakákoliv nová funkce:
- musí jít přidat bez přepisování starých
- nesmí rozbít stávající výpočty
- musí respektovat SPEC.md


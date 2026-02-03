# FinanceOS – Funkční specifikace (v2)

## Základní pravidlo
> Dokud peníze nemám fyzicky u sebe, tak s nimi nepočítám.  
> Všechno „má přijít“ je jen informace.

## Co má aplikace umět
Aplikace musí kdykoliv ukázat pro vybraný měsíc:
- **MÁM ZAPLATIT** = povinný měsíční tlak (trvalé + rozpočítané + dluhové splátky)
- **ZAPLACENO** = co reálně odešlo (včetně vkladů do cílů, darů, půjček)
- **ZBÝVÁ ZAPLATIT** = co ještě není uzavřené (tlak)
- **pohyblivé výdaje** dopočítané z reality (bez wallet detailu)
- **Karel deficit** = kolik ještě musí vydělat, aby měsíc vyšel

## Moduly
### 1) Dashboard (Přehled)
- Výběr měsíce, režim měsíc/týden, scope filtr (jen pro rozpad), stav peněženky (jedno číslo).
- Tabulka položek pouze pro tento měsíc:
  - dueAmount, paidAmount, remaining, stav, akce (zaplaceno/část/nezaplaceno + kdo zaplatil dar/půjčka).
- Náhled cílů + „celkem našetřeno“.
- Panel očekávaných položek (jisté/nejisté) jen informativně.

### 2) Trvalé platby (katalog pravidel)
- Přidávání a úpravy pravidel (perioda, částka, scope, kategorie).
- Uživatel zadává částku kladně (je to výdaj).
- Rozpočítání je rozhodnutí uživatele: když ho zapnu, vzniká povinná měsíční část.
- Simulace: jen nanečisto (úspora měsíc/3 měsíce/rok), bez „použít změny“.

### 3) Příjmy
- Karin průměr (ručně) + skutečnost po měsících (override).
- Karel skutečnost po měsících.
- Ostatní příjmy (jednorázové, již přijaté).
- Příjem z půjčených zdrojů (když platí někdo jiný jako půjčku).

### 4) Cíle (spořák)
- Vklady/výběry, nikdy pod 0.
- Dashboard cíle neřídí, jen rychlé „Přispět“.

### 5) Dluhy (samostatná záložka)
- Dlužím já / dluží mně.
- Dluh bez plánu = jen evidence (nevytváří měsíční tlak).
- Dluh s plánem = splátky se objeví jako povinné položky.
- Dar = pouze evidence (žádný dluh).
- Manuální přidání dluhu je povinné.

### 6) Očekávané položky
- „Má přijít“ jisté/nejisté.
- Nejisté se nepočítá do reality, jen indikace.
- Samostatná stránka + panel v dashboardu.

## Kategorie
- pevné hlavní kategorie + flexibilní podkategorie
- speciální hlavní kategorie: **Firemní peněženka – pohyblivé**
- třídění ve všech seznamech

## Import/Export
- Autosave je základ, export je záloha.
- Export = jeden JSON celý stav.
- Import = merge/replace + preview.

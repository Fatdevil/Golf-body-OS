# Telefontest – checklista

Första testet av Golf Body OS på en riktig Android-telefon. Tar cirka 15 minuter.
Syftet är att se om mätningarna fungerar på riktigt – inte att få bra poäng.

## Före start

1. **Bygg om appen** från senaste `main` (den innehåller native-kod som inte följer med en JavaScript-omladdning):
   `npx expo run:android` med telefonen ansluten via USB.
2. Ha telefonstativ eller något att luta telefonen mot, i midjehöjd, ca 2–3 m bort.
3. Bra ljus, enfärgad bakgrund, åtsittande kläder. Hela kroppen ska synas – från huvud till fötter.

## 1. Utseende (1 min)

- [ ] Rubriken "GOLF BODY OS" ligger **under** statusraden (klockan/batteriet).
- [ ] Flikraden (Hem / Testa / Historik) ligger **ovanför** Androids navigeringsknappar.
- [ ] ⚙ DV-1A → rubriken ligger direkt under statusraden, utan stort tomrum.

## 2. Native-modulen (1 min)

- [ ] ⚙ DV-1A → **RUN DV-1A VALIDATION**. Notera om grinden blir PASS eller FAIL.
- [ ] Ta en skärmdump av resultatet.

## 3. Kameratillstånd (2 min)

- [ ] Testa → välj Höftfällning. Neka kameran första gången.
- [ ] Skärmen "Kameratillstånd krävs" visas – appen kraschar inte.
- [ ] Tryck på knappen igen och tillåt kameran. Kamerabilden visas.

## 4. Höftfällning (3 min)

- [ ] Ställ dig **från sidan** mot kameran (vänster sida mot telefonen).
- [ ] Gör 3 lugna höftfällningar, håll ca 1 s i botten, res dig helt mellan varje.
- [ ] Räknaren går "REP 1 / 3" → "REP 3 / 3", och du hör röstinstruktionerna.
- [ ] Resultatskärmen visas.
- [ ] **Dela testlogg** → skicka loggen (t.ex. till dig själv per mejl eller klistra in i chatten).
- [ ] Notera: blev det ett värde för höftvinkeln, och verkar det rimligt?

## 5. Rotation (3 min)

- [ ] Testa → Bröstrygg. Ställ dig **med framsidan** mot kameran.
- [ ] Vrid överkroppen lugnt åt vänster, tillbaka, åt höger, tillbaka.
- [ ] Resultatskärmen visas → **Dela testlogg**.

## 6. Full screening (4 min)

- [ ] Starta full screening från Hem. Gör båda testerna i följd.
- [ ] **Dela testlogg** från resultatskärmen.

## 7. Historik och omstart (1 min)

- [ ] Historik visar sessionerna du gjort.
- [ ] Stäng appen helt (svep bort den) och öppna igen → sessionerna finns kvar.
- [ ] Tryck på en session i historiken → resultatet öppnas.

## 8. Avbrott (1 min)

- [ ] Starta ett test och tryck **✕ Avbryt** mitt i → appen går tillbaka utan krasch.
- [ ] Starta ett test, gå till hemskärmen på telefonen, kom tillbaka → notera vad som händer.

## Skicka tillbaka

1. Testloggarna (en per test).
2. Skärmdump av DV-1A.
3. Kort notering per punkt: fungerade / fungerade inte / konstigt (och vad).
4. Om appen kraschade: vad du gjorde precis innan.

Testloggen innehåller inga bilder eller kroppskoordinater – bara antal bilder,
bildfrekvens, vinklar, kvalitetsvärden och felkoder.

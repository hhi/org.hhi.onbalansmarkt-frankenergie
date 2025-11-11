# Sessy-batterijen instellen met Flow Cards

Deze gids legt uit hoe je elke Sessy-batterij uit je Slim Handelen-batterijset aan een eigen flow card koppelt, zodat je gemeten energiewaarden aan de Onbalansmarkt-app kunt doorgeven.

## Overzicht

Elke Sessy-batterij in je batterijset moet worden verbonden met een flow card-actie. Dit stelt het Homey-systeem in staat om het volgende op te sporen en bij te houden:

- **Totale geladen energie** (in kWh)
- **Totale geleverde energie** (in kWh)
- **Actueel batterijpercentage**

Het systeem gebruikt een unieke **batterij-ID** om elke batterij individueel te identificeren en bij te houden.

## Stap 1: Je batterij-ID identificeren

Elke Sessy-batterij heeft een unieke identifier die je gebruikt om deze aan het flow card-systeem te koppelen.

Je kunt **kiezen** voor:

- **De eigen ID van de batterij** - Een unieke identifier toegewezen door Sessy (bijv. `DNTDLQM3`, `DV6THVJP`)
- **Een aangepaste ID** - Een naam naar keuze voor eenvoudiger herkenning (bijv. `Sessy-1`, `Sessy-Keuken`, `Batterij-Hoofd`)

![Sessy-batterij-ID selectie](Sessy%20batterij%20toevoegen%20op%20ID.png)

**Voorbeeld:** In de afbeelding hierboven wordt batterij-ID `DNTDLQM3` ingevuld in de flow card-actie, wat overeenkomt met de Sessy-batterij met de naam "SESSY_DNTDLQM3 #2".

## Stap 2: De Flow Card-actie maken

Voor elke batterij in je batterijset moet je een **"Batterijmetriek ontvangen"** flow card-actie maken die:

1. **De batterij identificeert** via zijn unieke ID
2. **De gemeten waarden doorgeeft** die de batterij rapporteert

### Eén batterij instellen

In je Homey-flow:

1. Maak een nieuwe automatisering of bewerk een bestaande
2. Voeg een action card toe: **"Ontvang metriek voor batterij"** (Frank Energie Batteries-app)
3. Voer de unieke ID van de batterij in
4. Vul de drie meetvelden in:

   - **Energie geladen** (kWh, geleverd) - Totale energie geladen in de batterij
   - **Energie ontladen** (kWh, op) - Totale energie ontladen uit de batterij
   - **Accuniveau** (%) - Actueel laadpercentage van de batterij

![Gemeten energiewaarden](Sessy%20Energie%20geladen%20argument.png)

**Voorbeeld:** De afbeelding toont de beschikbare energiemetingen van een Sessy-batterij:

- `Energie Geladen` (Energy Charged) = 2010,66 kWh
- `Energie Ontladen` (Energy Discharged) = 1678,79 kWh
- `Accuniveau` (Battery Level) = 57%

## Stap 3: Meerdere batterijen instellen

Voor een batterijset met **3 deelnemende batterijen** maak je 3 afzonderlijke flow card-acties, één voor elke batterij:

![Voorbeeld instellingen drie batterijen](Sessy%20batterry%20info.png)

### Voorbeeldconfiguratie

**Batterij 1: DV6THVJP**

- Energie geladen: [waarde van Sessy-batterij #1]
- Energie ontladen: [waarde van Sessy-batterij #1]
- Accuniveau: [percentage van Sessy-batterij #1]

**Batterij 2: DNTDLQM3**

- Energie geladen: [waarde van Sessy-batterij #2]
- Energie ontladen: [waarde van Sessy-batterij #2]
- Accuniveau: [percentage van Sessy-batterij #2]

**Batterij 3: DP5USJQ9**

- Energie geladen: [waarde van Sessy-batterij #3]
- Energie ontladen: [waarde van Sessy-batterij #3]
- Accuniveau: [percentage van Sessy-batterij #3]

Zoals in de voorbeeldafbeelding te zien is, aggregeert de app de meetgegevens van meerdere batterijen om het volgende weer te geven:

- Totale geladen/ontladen energie voor alle batterijen
- Gemiddeld batterijpercentage
- Individuele batterijtracking

## Belangrijke punten

- **Unieke ID's zijn essentieel**: Elke batterij moet een unieke identifier hebben zodat de app kan bijhouden welke batterij welke waarden heeft gerapporteerd
- **Consistentie van batterij-ID**: Zodra je een ID voor een batterij hebt gekozen, gebruik je dezelfde ID elke keer dat je haar meetgegevens rapporteert
- **Gemeten waarden zijn belangrijk**: Gebruik altijd de totale energiewaarden uit je Sessy-batterijscherm, niet de deltawaarden
- **Frequentie**: Update batterijmetriek net zo vaak als je Sessy-systeem updates verstrekt (meestal elke 5-15 minuten)

## Probleemoplossing

### Batterijmetriek verschijnt niet

- Controleer of de batterij-ID correct en consistent is ingevoerd
- Controleer of alle drie meetvelden (geladen, ontladen, percentage) zijn ingevuld
- Zorg ervoor dat de flow card-actie op het juiste moment wordt geactiveerd

### Ziet u dubbele batterijen

- Dit betekent meestal dat dezelfde batterij met verschillende ID's is geregistreerd
- Gebruik consistente ID's voor elke batterij in alle flow cards

### Geaggregeerde waarden zien er verkeerd uit

- Controleer of elke batterij slechts eenmaal wordt meegeteld (geen dubbele ID's)
- Controleer of de gemeten waarden cumulatieve totalen zijn, geen dagelijkse delta's

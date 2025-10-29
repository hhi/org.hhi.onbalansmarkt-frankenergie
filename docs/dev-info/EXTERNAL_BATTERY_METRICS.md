# External Battery Metrics - Gebruikershandleiding

## Overzicht

De Frank Energie Homey app ondersteunt nu het ontvangen en aggregeren van batterij metrieken van externe bronnen zoals Sessy batterijen. Deze functionaliteit is speciaal ontworpen voor batterijsystemen die uit meerdere fysieke batterijen bestaan.

## Architectuur

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sessy 1   │────▶│             │     │             │
│  Batterij   │     │   Homey     │────▶│   Frank     │
└─────────────┘     │   Flows     │     │  Energie    │
┌─────────────┐     │             │     │   App       │
│   Sessy 2   │────▶│  (Action    │     │             │
│  Batterij   │     │   Cards)    │     └─────────────┘
└─────────────┘     │             │            │
┌─────────────┐     │             │            │
│   Sessy 3   │────▶│             │            ▼
│  Batterij   │     └─────────────┘     ┌─────────────┐
└─────────────┘                          │ Aggregatie  │
                                        │   Engine    │
                                        └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │  Trigger    │
                                        │   Card      │
                                        └─────────────┘
```

### Componenten

1. **BatteryMetricsStore**: Service die metrieken opslaat in associatieve arrays
2. **Action Card**: `receive_battery_metrics` - ontvangt individuele batterij data
3. **Trigger Card**: `external_battery_metrics_updated` - wordt getriggerd na aggregatie
4. **Capabilities**: 4 nieuwe capabilities voor geaggregeerde data

## Gebruik met Sessy Batterijen

### Stap 1: Flow aanmaken per batterij

Voor elke Sessy batterij maak je een flow:

```
WHEN: Sessy 1 reports new data (bijvoorbeeld elk kwartier)
THEN: Frank Energie app → Receive battery metrics
      - battery_id: "sessy-1"
      - total_charged_kwh: [Sessy totaal geladen tag]
      - total_discharged_kwh: [Sessy totaal geleverd tag]
      - battery_percentage: [Sessy batterij % tag]
```

**Belangrijk**: Gebruik totale (cumulatieve) waarden! De app berekent automatisch dagelijkse delta's.

### Stap 2: Geaggregeerde data gebruiken

Maak een flow die reageert op de geaggregeerde data:

```
WHEN: External battery metrics updated
AND: [[daily_discharged_kwh]] > 10
THEN: Send notification "Vandaag geleverd: {{daily_discharged_kwh}} kWh!"
```

## Flow Cards

### Action Card: Receive Battery Metrics

**ID**: `receive_battery_metrics`

**Argumenten**:
- `battery_id` (text): Unieke ID van de batterij (bijv. "sessy-1", "sessy-2")
- `total_charged_kwh` (number): Totaal geladen kWh sinds installatie
- `total_discharged_kwh` (number): Totaal geleverd kWh sinds installatie
- `battery_percentage` (range 0-100): Huidig batterij percentage

**Voorbeeld gebruik**:
```
battery_id: "sessy-1"
total_charged_kwh: 1523.45
total_discharged_kwh: 1204.67
battery_percentage: 76
```

### Trigger Card: External Battery Metrics Updated

**ID**: `external_battery_metrics_updated`

**Tokens**:
- `daily_charged_kwh`: Totaal geladen kWh vandaag (alle batterijen)
- `daily_discharged_kwh`: Totaal geleverd kWh vandaag (alle batterijen)
- `average_percentage`: Gemiddeld batterij percentage
- `battery_count`: Aantal batterijen dat data levert

## Capabilities

De app voegt 4 nieuwe capabilities toe aan het Frank Energie Battery device:

1. **external_battery_daily_charged** (kWh)
   - Totaal geladen energie vandaag van alle externe batterijen

2. **external_battery_daily_discharged** (kWh)
   - Totaal geleverde energie vandaag van alle externe batterijen

3. **external_battery_percentage** (%)
   - Gemiddeld batterij percentage van alle externe batterijen

4. **external_battery_count**
   - Aantal externe batterijen dat momenteel data levert

## Technische Details

### Data Opslag

De app gebruikt associatieve arrays om data per batterij op te slaan:

```typescript
{
  current: {
    discharged: { "sessy-1": 1204.67, "sessy-2": 1156.23, "sessy-3": 1089.45 },
    charged: { "sessy-1": 1523.45, "sessy-2": 1478.90, "sessy-3": 1401.23 },
    percentage: { "sessy-1": 76, "sessy-2": 82, "sessy-3": 68 }
  },
  startOfDay: {
    discharged: { "sessy-1": 1195.00, "sessy-2": 1148.00, "sessy-3": 1081.50 },
    charged: { "sessy-1": 1515.00, "sessy-2": 1471.00, "sessy-3": 1394.00 }
  }
}
```

### Dagelijkse Delta Berekening

De app berekent automatisch dagelijkse delta's:

```
Daily Discharged = Current Total - Start of Day Total
```

Voorbeeld voor Sessy 1:
```
Daily Discharged = 1204.67 - 1195.00 = 9.67 kWh
```

### Automatische Reset

Om middernacht (Europe/Amsterdam tijdzone) reset de app automatisch:
1. Kopieert `current` totalen naar `startOfDay`
2. Behoudt `current` totalen voor continuïteit
3. Volgende metingen berekenen delta vanaf nieuwe startOfDay

### Aggregatie

Bij elke nieuwe meting:
1. Store individuele batterij data in associatieve array
2. Bereken daily delta per batterij
3. Som alle daily charged/discharged kWh
4. Bereken gemiddeld percentage
5. Update capabilities
6. Trigger flow card

## Voorbeelden

### Voorbeeld 1: 3x Sessy Batterijen

**Setup**:
- Sessy 1: ID = "sessy-1"
- Sessy 2: ID = "sessy-2"
- Sessy 3: ID = "sessy-3"

**Flows per batterij** (3x dezelfde structuur):
```
WHEN: Sessy 1 → New measurement available
THEN: Frank Energie → Receive battery metrics
      - battery_id: "sessy-1"
      - total_charged_kwh: [Sessy 1 tag: Total charged]
      - total_discharged_kwh: [Sessy 1 tag: Total discharged]
      - battery_percentage: [Sessy 1 tag: Battery %]
```

**Flow voor geaggregeerde data**:
```
WHEN: Frank Energie → External battery metrics updated
AND: daily_discharged_kwh > 15
THEN: Send push notification
      Title: "Goed bezig!"
      Message: "Vandaag al {{daily_discharged_kwh}} kWh geleverd met {{battery_count}} batterijen"
```

### Voorbeeld 2: Monitoring Flow

```
WHEN: Frank Energie → External battery metrics updated
THEN: Advanced Flow → Update dashboard variables
      - var_daily_charged = {{daily_charged_kwh}}
      - var_daily_discharged = {{daily_discharged_kwh}}
      - var_avg_battery = {{average_percentage}}
      - var_battery_count = {{battery_count}}
```

### Voorbeeld 3: Alert bij lage batterij

```
WHEN: Frank Energie → External battery metrics updated
AND: average_percentage < 20
THEN: Send notification
      Title: "Batterij laag"
      Message: "Gemiddelde batterij op {{average_percentage}}%"
```

## Veelgestelde Vragen

### Q: Moet ik dagelijkse of totale waarden gebruiken?

**A**: Gebruik **totale (cumulatieve) waarden**. De app berekent automatisch dagelijkse delta's door het verschil te nemen met de start-of-day waarden.

### Q: Wat gebeurt er om middernacht?

**A**: De app detecteert automatisch een nieuwe dag en kopieert de huidige totalen naar "start of day" waarden. Hierdoor beginnen de dagelijkse delta's weer op 0.

### Q: Kan ik batterijen dynamisch toevoegen/verwijderen?

**A**: Ja! Zodra een nieuwe battery_id wordt gedetecteerd, wordt deze automatisch toegevoegd aan de tracking. De aggregatie past zich automatisch aan.

### Q: Wat als één batterij offline gaat?

**A**: De aggregatie werkt met de batterijen die data leveren. Als een batterij stopt met data leveren, wordt deze niet meer meegenomen in de berekening.

### Q: Hoe reset ik de data?

**A**: De data wordt automatisch dagelijks gereset. Voor een handmatige reset kun je de Homey app herstarten of het device opnieuw paren.

## Troubleshooting

### Data wordt niet geaggregeerd

1. **Controleer battery_id**: Zorg dat elke batterij een unieke ID heeft
2. **Controleer data types**: total_charged/discharged moeten numbers zijn
3. **Check app logs**: Zoek naar "BatteryMetricsStore" berichten

### Daily values kloppen niet

1. **Verify totale waarden**: Zijn het echt cumulatieve totalen?
2. **Check timezone**: App gebruikt Europe/Amsterdam
3. **Wacht tot na middernacht**: Reset gebeurt automatisch

### Trigger card wordt niet getriggerd

1. **Check flow actief**: Is de trigger flow enabled?
2. **Verify conditions**: Zijn de AND-voorwaarden correct?
3. **Test met Any**: Gebruik eerst "ANY" om te testen of trigger werkt

## API Referentie

### BatteryMetric Interface

```typescript
interface BatteryMetric {
  batteryId: string;              // Unieke ID van batterij
  totalChargedKwh: number;        // Cumulatief geladen kWh
  totalDischargedKwh: number;     // Cumulatief geleverd kWh
  batteryPercentage: number;      // Huidig percentage (0-100)
}
```

### ExternalBatteryMetrics Interface

```typescript
interface ExternalBatteryMetrics {
  dailyChargedKwh: number;         // Som van daily charged (alle batterijen)
  dailyDischargedKwh: number;      // Som van daily discharged (alle batterijen)
  averageBatteryPercentage: number; // Gemiddeld percentage
  batteryCount: number;             // Aantal batterijen
  batteries: Array<{
    id: string;
    dailyChargedKwh: number;
    dailyDischargedKwh: number;
    percentage: number;
  }>;
  lastUpdated: number;              // Timestamp laatste update
}
```

## Licentie

Deze functionaliteit is onderdeel van de Frank Energie Homey app en valt onder dezelfde licentie.

---

Voor vragen of problemen, zie de GitHub issues pagina van het project.

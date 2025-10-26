# Sensor Data Overview

Uitgebreide documentatie over alle sensor data (capabilities) die de Frank Energie Homey app presenteert voor elk driver type.

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Smart Battery Driver](#smart-battery-driver-16-sensors)
3. [EV Charger Driver](#ev-charger-driver-6-sensors)
4. [Site Energy Meter Driver](#site-energy-meter-driver-12-sensors)
5. [Smart PV System Driver](#smart-pv-system-driver-7-sensors)
6. [Data Bronnen](#data-bronnen)
7. [Update Frequenties](#update-frequenties)
8. [Praktische Voorbeelden](#praktische-voorbeelden)

---

## Overzicht

De Frank Energie app biedt **41 totaal unieke sensors** verdeeld over 4 driver types:

| Driver | Aantal Sensors | Primaire Focus |
|--------|---------------|----------------|
| **Smart Battery** | 16 | Trading results, battery state, rankings, externe batterijen |
| **EV Charger** | 6 | Laadstatus, bonus, rankings |
| **Site Energy Meter** | 12 | Marktprijzen, verbruik, kosten |
| **Smart PV System** | 7 | PV opwek, status, bonus, rankings |

### Data Update Frequentie

Alle sensors worden bijgewerkt volgens de **poll interval** instelling (configureerbaar per device):
- **15 minuten** (standaard)
- 30 minuten
- 45 minuten
- 60 minuten

**Eerste update**: Direct bij device start (onInit)

---

## Smart Battery Driver (16 sensors)

### Batterij Status Sensors (4)

#### 1. `battery_charging_state`
**Type**: String (Homey standaard capability)
**Waarden**: `charging` | `discharging` | `idle`
**Beschrijving**: Huidige laadstatus van de batterij
**Bron**: Frank Energie GraphQL - `getSmartBattery().lastActiveSession.action`
**Gebruik**: Visualisatie van batterij activiteit in Homey UI

**Voorbeeld**:
```
charging    → Batterij wordt opgeladen
discharging → Batterij ontlaadt (levert stroom)
idle        → Batterij is inactief
```

---

#### 2. `meter_power`
**Type**: Number (Watt)
**Unit**: W
**Range**: -10000 tot +10000 W
**Beschrijving**: Huidig vermogen van de batterij
**Bron**: Frank Energie GraphQL - berekend uit `lastActiveSession`
**Conversie**:
- Positief getal = opladen (bijv. +2500 W)
- Negatief getal = ontladen (bijv. -3200 W)

**Voorbeeld**:
```
+2500 W  → Batterij laadt op met 2.5 kW
-3200 W  → Batterij ontlaadt met 3.2 kW
0 W      → Batterij inactief
```

**Flow Card Gebruik**:
```
IF meter_power > 2000
THEN "Batterij laadt krachtig op"
```

---

#### 3. `frank_energie_battery_charge`
**Type**: Number (Percentage)
**Unit**: %
**Range**: 0 - 100%
**Beschrijving**: Laadpercentage van de batterij
**Bron**: Frank Energie GraphQL - `getSmartBattery().lastActiveSession.charge`
**Update**: Elke poll interval

**Voorbeeld**:
```
76%  → Batterij is voor 76% vol
25%  → Batterij bijna leeg
100% → Batterij volledig opgeladen
```

**Flow Card Gebruik**:
```
IF frank_energie_battery_charge < 20
THEN "Batterij bijna leeg - check handelsresultaten"
```

---

#### 4. `frank_energie_battery_mode`
**Type**: String
**Waarden**:
- `imbalance` - Onbalansmarkt (standaard)
- `imbalance_aggressive` - Onbalansmarkt agressief
- `self_consumption_plus` - Zelfconsumptie+
- `manual` - Handmatig

**Beschrijving**: Huidige trading mode van de batterij
**Bron**: Frank Energie GraphQL - gedetecteerd uit `batterySettings`
**Detectie**: Via `TradingModeDetector.detectTradingMode()`

**Mode Mapping**:
```typescript
{
  batteryMode: 'auto',
  imbalanceTradingStrategy: 'default'
} → 'imbalance'

{
  batteryMode: 'auto',
  imbalanceTradingStrategy: 'aggressive'
} → 'imbalance_aggressive'

{
  batteryMode: 'manual'
} → 'manual'
```

**Flow Card Gebruik**:
```
WHEN frank_energie_battery_mode changes
AND mode is 'imbalance_aggressive'
THEN "Batterij staat nu in agressieve modus"
```

---

### Trading Results Sensors (5)

#### 5. `frank_energie_trading_result`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totaal handelsresultaat vandaag
**Bron**: Frank Energie GraphQL - `BatteryAggregator.getAggregatedResults().periodTradingResult`
**Berekeningsmethode**: Som van alle batterijen op het account

**Voorbeeld**:
```
€0.61   → Positief resultaat van 61 cent vandaag
€-0.23  → Negatief resultaat (kosten) van 23 cent
€5.42   → Zeer goed resultaat van €5.42
```

**Samenstelling**: EPEX + Trading + Imbalance + Frank Slim bonus

**Flow Card Gebruik**:
```
WHEN frank_energie_trading_result > 5
THEN Send notification "Goed resultaat vandaag: €5+"
```

---

#### 6. `frank_energie_frank_slim_bonus`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Frank Slim kortingsbonus vandaag
**Bron**: Frank Energie GraphQL - `periodFrankSlim` uit aggregated results
**Voorwaarde**: Alleen als Frank Slim abonnement actief is

**Voorbeeld**:
```
€0.06  → 6 cent Frank Slim bonus vandaag
€0.00  → Geen Frank Slim bonus (niet actief of geen discount)
€0.12  → 12 cent bonus
```

**Achtergrond**: Frank Slim is een dynamisch contract met extra korting wanneer je stroom afneemt op gunstige momenten.

**Flow Card Gebruik**:
```
WHEN frank_energie_frank_slim_bonus > 0
THEN Log "Frank Slim bonus ontvangen: €{{bonus}}"
```

---

#### 7. `frank_energie_epex_result`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: EPEX handelsresultaat vandaag
**Bron**: Frank Energie GraphQL - `periodEpexResult`

**Uitleg**: EPEX (European Power Exchange) is de day-ahead elektriciteitsmarkt. Dit resultaat toont de winst/verlies door te handelen op basis van EPEX prijzen.

**Voorbeeld**:
```
€0.25  → €0.25 verdiend op EPEX markt
€-0.10 → €0.10 verlies op EPEX trading
€0.00  → Geen EPEX trading vandaag
```

---

#### 8. `frank_energie_trading_result_split`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Trading resultaat component (zonder EPEX/Imbalance)
**Bron**: Frank Energie GraphQL - `periodTradingResult`

**Verschil met totaal resultaat**: Dit is alleen het "pure trading" gedeelte, exclusief EPEX en imbalance componenten.

**Voorbeeld**:
```
€0.30  → €0.30 verdiend door slim handelen
€0.00  → Geen trading winst
```

---

#### 9. `frank_energie_imbalance_result`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Imbalance trading resultaat vandaag
**Bron**: Frank Energie GraphQL - `periodImbalanceResult`

**Uitleg**: Imbalance trading houdt in dat de batterij helpt met het balanceren van het elektriciteitsnet. Dit resultaat toont de opbrengst daarvan.

**Voorbeeld**:
```
€0.30  → €0.30 verdiend aan imbalance trading
€-0.05 → €0.05 kosten
€0.00  → Geen imbalance trading
```

**Totaal resultaat breakdown**:
```
frank_energie_trading_result =
  frank_energie_epex_result (€0.25) +
  frank_energie_trading_result_split (€0.30) +
  frank_energie_imbalance_result (€0.30) +
  frank_energie_frank_slim_bonus (€0.06)
  = €0.91
```

---

### Ranking Sensors (2)

#### 10. `frank_energie_overall_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Range**: 1 - ∞
**Beschrijving**: Overall ranking positie op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API - `GET /api/me`
**Voorwaarde**: Onbalansmarkt API key moet ingesteld zijn

**Voorbeeld**:
```
5    → Je staat op plaats 5 van alle gebruikers
142  → Je staat op plaats 142
1    → Je bent #1! Top performer
null → Geen ranking data (geen API key of geen data)
```

**Flow Card Gebruik**:
```
WHEN frank_energie_overall_rank < 10
THEN "Je staat in de top 10!"
```

---

#### 11. `frank_energie_provider_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Range**: 1 - ∞
**Beschrijving**: Ranking binnen je energieprovider groep
**Bron**: Onbalansmarkt.com REST API - `GET /api/me`
**Voorwaarde**: Onbalansmarkt API key moet ingesteld zijn

**Voorbeeld**:
```
3    → Je staat 3e bij jouw provider (Frank Energie)
25   → Je staat 25e binnen Frank Energie gebruikers
1    → Je bent beste van jouw provider!
null → Geen ranking data
```

**Verschil met overall rank**: Provider rank vergelijkt je alleen met andere Frank Energie klanten, terwijl overall rank je vergelijkt met alle Onbalansmarkt gebruikers (alle providers).

---

### Upload Tracking (1)

#### 12. `frank_energie_last_upload`
**Type**: String (ISO 8601 timestamp)
**Format**: `YYYY-MM-DDTHH:mm:ss.sssZ`
**Beschrijving**: Timestamp van laatste succesvolle upload naar Onbalansmarkt.com
**Update**: Direct na succesvolle upload
**Voorwaarde**: `send_measurements` moet enabled zijn

**Voorbeeld**:
```
"2025-10-26T14:30:00.000Z"  → Upload op 26 okt 2025, 14:30 UTC
"2025-10-26T09:15:00.000Z"  → Upload vanochtend om 09:15
null                        → Nog geen upload gedaan
```

**Homey Weergave**: Homey formatteert dit automatisch naar leesbare tijd:
```
"14:30"
"2 minuten geleden"
"Vandaag om 09:15"
```

**Flow Card Gebruik**:
```
WHEN frank_energie_last_upload changes
THEN "Nieuwe meting verstuurd naar Onbalansmarkt.com"
```

---

### Externe Batterij Sensors (4)

Deze sensors tracken externe batterijen die via flow actions hun data delen.

#### 13. `external_battery_count`
**Type**: Number (Aantal)
**Unit**: - (aantal batterijen)
**Range**: 0 - ∞
**Beschrijving**: Aantal externe batterijen dat metrics deelt
**Bron**: `BatteryMetricsStore` - intern geheugen
**Update**: Bij ontvangst van `receive_battery_metrics` flow action

**Voorbeeld**:
```
2  → 2 externe batterijen delen hun data
0  → Geen externe batterijen
5  → 5 externe batterijen actief
```

**Use Case**: Wanneer je meerdere battery systemen hebt (bijv. Frank Energie + Tesla Powerwall) en hun gecombineerde stats wilt zien.

---

#### 14. `external_battery_percentage`
**Type**: Number (Percentage)
**Unit**: %
**Range**: 0 - 100%
**Beschrijving**: Gemiddelde lading van alle externe batterijen
**Berekening**: `(battery1.charge + battery2.charge + ...) / count`

**Voorbeeld**:
```
Battery A: 80%, Battery B: 60%
→ external_battery_percentage = (80 + 60) / 2 = 70%
```

---

#### 15. `external_battery_daily_charged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal opgeladen energie vandaag (alle externe batterijen)
**Berekening**: Som van alle `chargedToday` values

**Voorbeeld**:
```
Battery A charged: 12.5 kWh, Battery B charged: 8.3 kWh
→ external_battery_daily_charged = 20.8 kWh
```

---

#### 16. `external_battery_daily_discharged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal ontladen energie vandaag (alle externe batterijen)
**Berekening**: Som van alle `dischargedToday` values

**Voorbeeld**:
```
Battery A discharged: 10.2 kWh, Battery B discharged: 7.8 kWh
→ external_battery_daily_discharged = 18.0 kWh
```

**Flow Action Voorbeeld**:
```
Action: Receive Battery Metrics
  batteryId: "tesla-powerwall-1"
  chargedToday: 12.5
  dischargedToday: 10.2
  percentage: 80

→ Updates external_battery_* capabilities
```

---

## EV Charger Driver (6 sensors)

### Laadstatus Sensors (2)

#### 1. `onoff`
**Type**: Boolean (Homey standaard capability)
**Waarden**: `true` | `false`
**Beschrijving**: EV laadpaal aan/uit status
**Bron**: Frank Energie GraphQL - `getSmartCharger().steeringStatus`
**Mapping**:
```
steeringStatus: 'active'   → true (aan)
steeringStatus: 'inactive' → false (uit)
```

**Flow Card Gebruik**:
```
WHEN onoff turns on
THEN "EV laadpaal is gestart"
```

---

#### 2. `meter_power`
**Type**: Number (Watt)
**Unit**: W
**Range**: 0 - 22000 W (typisch)
**Beschrijving**: Huidig laadvermogen van de EV
**Bron**: Frank Energie GraphQL - `getSmartCharger().currentPower`

**Voorbeeld**:
```
7400 W   → Laden met 7.4 kW (1-fase)
11000 W  → Laden met 11 kW (3-fase)
0 W      → Niet aan het laden
```

---

#### 3. `frank_energie_ev_charging_status`
**Type**: String
**Waarden**: `charging` | `idle` | `scheduled` | `completed`
**Beschrijving**: Gedetailleerde laadstatus van de EV
**Bron**: Frank Energie GraphQL - afgeleid van charger data

**Voorbeeld**:
```
charging   → Auto laadt op dit moment
idle       → Laadpaal inactief
scheduled  → Laden gepland voor later (slim laden)
completed  → Laden voltooid
```

---

### Bonus & Rankings (3)

#### 4. `frank_energie_ev_bonus`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: EV laadbonus verdiend vandaag
**Bron**: Frank Energie GraphQL - slim laden bonus

**Voorbeeld**:
```
€0.42  → €0.42 bonus verdiend door slim laden
€0.00  → Geen bonus vandaag
€1.25  → €1.25 bonus (veel smart charging)
```

**Achtergrond**: Frank Energie geeft bonus wanneer je EV laadt op momenten met lage stroomprijzen.

---

#### 5. `frank_energie_overall_rank`
Zie [Battery - Overall Rank](#10-frank_energie_overall_rank)

#### 6. `frank_energie_provider_rank`
Zie [Battery - Provider Rank](#11-frank_energie_provider_rank)

---

## Site Energy Meter Driver (12 sensors)

### Vermogen Sensors (2)

#### 1. `measure_power`
**Type**: Number (Watt)
**Unit**: W
**Range**: -50000 tot +50000 W
**Beschrijving**: Huidig verbruik/productie van je huis
**Bron**: Frank Energie GraphQL - site data
**Conversie**:
- Positief = verbruik (afname van net)
- Negatief = productie (teruglevering aan net)

**Voorbeeld**:
```
+2500 W  → Je gebruikt 2.5 kW
-1500 W  → Je levert 1.5 kW terug (PV productie > verbruik)
0 W      → Verbruik = productie (netto nul)
```

---

#### 2. `meter_power`
**Type**: Number (Watt)
**Unit**: W
**Beschrijving**: Cumulatief vermogen (vaak zelfde als measure_power)
**Bron**: Frank Energie GraphQL

---

### Marktprijs Sensors (5)

#### 3. `frank_energie_current_market_price`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Huidige marktprijs elektriciteit (dit uur)
**Bron**: Frank Energie GraphQL - `marketPrices` voor huidige uur
**Update**: Elk poll interval

**Voorbeeld**:
```
€0.0842/kWh  → Marktprijs is 8.42 cent per kWh
€0.0125/kWh  → Lage prijs (gunstig moment)
€0.2500/kWh  → Hoge prijs (duur moment)
€-0.0100/kWh → Negatieve prijs (je krijgt betaald!)
```

**Berekening**:
```typescript
const currentHour = new Date().getHours();
const currentPrice = prices.electricityPrices.find(p =>
  new Date(p.from).getHours() === currentHour
)?.marketPrice;
```

**Flow Card Gebruik**:
```
WHEN frank_energie_current_market_price < 0.05
THEN Turn on washing machine (goedkope stroom!)
```

---

#### 4. `frank_energie_next_hour_market_price`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Marktprijs voor het volgende uur
**Bron**: Frank Energie GraphQL - `marketPrices` voor volgend uur

**Voorbeeld**:
```
Nu is 14:00, prijs is €0.0842/kWh
→ frank_energie_next_hour_market_price = prijs voor 15:00 uur
```

**Use Case**: Beslissen of je iets nu of volgend uur moet inschakelen.

**Flow Card Gebruik**:
```
IF frank_energie_next_hour_market_price < frank_energie_current_market_price
THEN "Wacht met laden, volgend uur is goedkoper"
```

---

#### 5. `frank_energie_min_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Laagste marktprijs van vandaag (alle uren)
**Bron**: Frank Energie GraphQL - minimum van alle `marketPrices` vandaag

**Berekening**:
```typescript
const minPrice = Math.min(...prices.electricityPrices.map(p => p.marketPrice));
```

**Voorbeeld**:
```
€0.0125/kWh  → Goedkoopste uur vandaag is/was 1.25 cent
€-0.0050/kWh → Negatieve prijs vandaag (beste moment!)
```

**Use Case**: Vergelijken of huidige prijs dicht bij dagminimum ligt.

---

#### 6. `frank_energie_max_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Hoogste marktprijs van vandaag (alle uren)
**Bron**: Frank Energie GraphQL - maximum van alle `marketPrices` vandaag

**Berekening**:
```typescript
const maxPrice = Math.max(...prices.electricityPrices.map(p => p.marketPrice));
```

**Voorbeeld**:
```
€0.2500/kWh  → Duurste uur vandaag is/was 25 cent
€0.1800/kWh  → Piek prijs
```

**Use Case**: Identificeren van piekuren om groot verbruik te vermijden.

---

#### 7. `frank_energie_avg_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Gemiddelde marktprijs van vandaag
**Bron**: Frank Energie GraphQL - `averageElectricityPrices.averageMarketPrice`

**Voorbeeld**:
```
€0.0842/kWh  → Gemiddelde prijs vandaag is 8.42 cent
```

**Use Case**: Referentiepunt voor "is het nu duur of goedkoop?"

**Flow Card Logic**:
```
IF frank_energie_current_market_price < frank_energie_avg_market_price_today
THEN "Prijs is onder gemiddelde (gunstig)"
ELSE "Prijs is boven gemiddelde (minder gunstig)"
```

---

### Verbruik & Kosten Sensors (2)

#### 8. `frank_energie_today_consumption`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal elektriciteitsverbruik vandaag
**Bron**: Frank Energie GraphQL - `usage.electricity.items` voor vandaag

**Berekening**:
```typescript
const today = new Date().toISOString().split('T')[0];
const todayData = usage.electricity.items.find(item =>
  item.from.startsWith(today)
);
const consumption = todayData?.usage || 0;
```

**Voorbeeld**:
```
12.5 kWh  → Je hebt vandaag 12.5 kWh gebruikt
5.2 kWh   → Laag verbruik
25.8 kWh  → Hoog verbruik (veel apparaten aan)
```

**Flow Card Gebruik**:
```
WHEN frank_energie_today_consumption > 20
THEN "Hoog verbruik vandaag: {{consumption}} kWh"
```

---

#### 9. `frank_energie_today_costs`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totale elektriciteitskosten vandaag
**Bron**: Frank Energie GraphQL - `usage.electricity.items` voor vandaag

**Berekening**:
```typescript
const todayCosts = todayData?.costs || 0;
```

**Voorbeeld**:
```
€2.45  → Je hebt vandaag €2.45 aan elektriciteit besteed
€0.50  → Lage kosten
€8.20  → Hoge kosten (veel verbruik of hoge prijzen)
€-1.20 → Negatieve kosten (teruggeleverd meer dan verbruikt)
```

**Relatie met consumption**:
```
Kosten ≈ Verbruik × Gemiddelde Prijs
€2.45 ≈ 12.5 kWh × €0.196/kWh
```

---

### Site Totalen (2)

#### 10. `frank_energie_site_usage`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal site verbruik (cumulatief of periode)
**Bron**: Frank Energie GraphQL - site usage data

---

#### 11. `frank_energie_site_costs`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totale site kosten (cumulatief of periode)
**Bron**: Frank Energie GraphQL - site costs data

---

### Rankings (2)

#### 12. `frank_energie_overall_rank`
Zie [Battery - Overall Rank](#10-frank_energie_overall_rank)

#### 13. `frank_energie_provider_rank`
Zie [Battery - Provider Rank](#11-frank_energie_provider_rank)

---

## Smart PV System Driver (7 sensors)

### PV Productie Sensors (3)

#### 1. `meter_power`
**Type**: Number (Watt)
**Unit**: W
**Range**: -10000 tot 0 W (typisch negatief voor productie)
**Beschrijving**: Huidig PV vermogen
**Bron**: Frank Energie GraphQL (momenteel placeholder)

---

#### 2. `frank_energie_pv_current_power`
**Type**: Number (Vermogen)
**Unit**: kW
**Decimalen**: 2
**Beschrijving**: Huidig PV productievermogen
**Bron**: Frank Energie GraphQL - momenteel **placeholder** (0 kW)
**Status**: ⚠️ Wacht op API uitbreiding voor real-time data

**Voorbeeld** (toekomstig):
```
2.5 kW   → PV produceert 2.5 kW
0.0 kW   → Geen productie ('s nachts)
5.8 kW   → Hoge productie (zonnige dag)
```

**Code**: [drivers/frank-energie-pv/device.ts:112](../drivers/frank-energie-pv/device.ts#L112)
```typescript
// TODO: Current power and today generation are not available in SmartPvSystemSummary API response
const currentPower = 0; // Placeholder until proper query is found
```

---

#### 3. `frank_energie_pv_today_generation`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totale PV productie vandaag
**Bron**: Frank Energie GraphQL - momenteel **placeholder** (0 kWh)
**Status**: ⚠️ Wacht op API uitbreiding voor dagdata

**Voorbeeld** (toekomstig):
```
15.2 kWh  → PV heeft vandaag 15.2 kWh opgewekt
0.0 kWh   → Geen productie vandaag
28.5 kWh  → Zeer goede productiedag
```

---

### PV Status & Bonus (2)

#### 4. `frank_energie_pv_status`
**Type**: String
**Waarden**: `active` | `inactive` | `error` | `offline`
**Beschrijving**: Operationele status van het PV systeem
**Bron**: Frank Energie GraphQL - `getSmartPvSystem().operationalStatus`

**Voorbeeld**:
```
active    → PV systeem werkt normaal
inactive  → PV systeem tijdelijk uit
error     → Fout gedetecteerd
offline   → PV systeem niet bereikbaar
```

**Flow Card Gebruik**:
```
WHEN frank_energie_pv_status becomes 'error'
THEN Send notification "PV systeem heeft een fout"
```

---

#### 5. `frank_energie_pv_bonus`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: PV bonus verdiend (lifetime of periode)
**Bron**: Frank Energie GraphQL - `getSmartPvSystem().totalBonus`

**Voorbeeld**:
```
€142.50  → Totaal €142.50 bonus verdiend
€0.00    → Geen bonus
€5.20    → €5.20 bonus
```

**Achtergrond**: Frank Energie kan bonussen geven voor slimme besturing van PV systemen.

---

### Rankings (2)

#### 6. `frank_energie_overall_rank`
Zie [Battery - Overall Rank](#10-frank_energie_overall_rank)

#### 7. `frank_energie_provider_rank`
Zie [Battery - Provider Rank](#11-frank_energie_provider_rank)

---

## Data Bronnen

### Frank Energie GraphQL API

**Endpoint**: Frank Energie GraphQL
**Authenticatie**: Email + Password
**Data Types**:
- Battery data (`getSmartBatteries`, `getSmartBattery`)
- Trading results (`tradingResults`)
- PV systems (`getSmartPvSystems`, `getSmartPvSystem`)
- EV chargers (`getSmartChargers`, `getSmartCharger`)
- Market prices (`marketPrices`)
- Usage data (`usage`)

**Query Frequentie**: Elke poll interval (15-60 minuten)

**Documentatie**: [GRAPHQL_QUERIES_OVERVIEW.md](GRAPHQL_QUERIES_OVERVIEW.md)

---

### Onbalansmarkt.com REST API

**Endpoints**:
- `POST /api/live` - Upload measurements
- `GET /api/me` - Get user profile + rankings

**Authenticatie**: API Key
**Data Types**:
- Overall ranking (positie tussen alle gebruikers)
- Provider ranking (positie binnen Frank Energie groep)
- Daily results
- Profile information

**Update Frequentie**: Elke poll interval (indien API key ingesteld)

**Voorwaarde**: Onbalansmarkt API key moet geconfigureerd zijn in device settings

---

### Battery Metrics Store (Intern)

**Type**: In-memory storage binnen Homey app
**Data Source**: Flow actions (`receive_battery_metrics`)
**Data Types**:
- External battery count
- External battery charge percentages
- Daily charged/discharged energy

**Use Case**: Integratie met externe batterij systemen (Tesla Powerwall, Sonnen, etc.)

**Cleanup**: Automatisch na 24 uur (stale data removal)

---

## Update Frequenties

### Configureerbare Polling

Alle sensors worden bijgewerkt volgens de **poll interval** setting:

| Interval | Gebruik | Aanbeveling |
|----------|---------|-------------|
| **15 minuten** | Real-time monitoring | Standaard, goed voor actieve monitoring |
| **30 minuten** | Normaal gebruik | Balans tussen data freshness en API calls |
| **45 minuten** | Licht gebruik | Minder belangrijk voor real-time data |
| **60 minuten** | Minimaal gebruik | Batterij besparing, basic tracking |

**Configuratie**: Device Settings → Data Polling Settings → Polling Interval

### Eerste Update

**Timing**: Onmiddellijk bij device start (onInit)
**Reden**: Direct actuele data tonen aan gebruiker

### Update op Events

Sommige sensors worden ook bijgewerkt buiten polling om:

| Event | Sensors Updated |
|-------|-----------------|
| Settings changed | Alle sensors (volledige re-sync) |
| Flow action executed | Specifieke sensor (bijv. external battery metrics) |
| Manual poll (flow action) | Alle sensors |

---

## Praktische Voorbeelden

### Voorbeeld 1: Optimaal Laden van EV

**Doel**: Laad EV wanneer stroomprijs het laagst is

**Sensors Gebruikt**:
- `frank_energie_current_market_price` (Meter)
- `frank_energie_min_market_price_today` (Meter)
- `frank_energie_ev_charging_status` (EV Charger)

**Flow**:
```
WHEN frank_energie_current_market_price equals frank_energie_min_market_price_today
AND frank_energie_ev_charging_status is 'idle'
THEN Start EV charging
```

**Resultaat**: EV laadt op het goedkoopste moment van de dag

---

### Voorbeeld 2: Battery Trading Performance Tracking

**Doel**: Track dagelijkse battery performance en krijg notificatie bij goede resultaten

**Sensors Gebruikt**:
- `frank_energie_trading_result` (Battery)
- `frank_energie_epex_result` (Battery)
- `frank_energie_imbalance_result` (Battery)
- `frank_energie_overall_rank` (Battery)

**Flow**:
```
WHEN frank_energie_trading_result > 5
THEN Send notification
  "Excellent battery result today: €{{result}}
   EPEX: €{{epex}}, Imbalance: €{{imbalance}}
   Rank: #{{rank}}"
```

**Resultaat**: Dagelijkse summary van performance

---

### Voorbeeld 3: Slim Wasmachine Gebruik

**Doel**: Start wasmachine alleen wanneer prijs onder gemiddelde is

**Sensors Gebruikt**:
- `frank_energie_current_market_price` (Meter)
- `frank_energie_avg_market_price_today` (Meter)

**Flow**:
```
WHEN user requests "start washing machine"
AND frank_energie_current_market_price < frank_energie_avg_market_price_today
THEN Turn on washing machine
ELSE Send notification "Wait for cheaper electricity price"
```

**Resultaat**: Automatische cost optimization

---

### Voorbeeld 4: Multi-Battery Dashboard

**Doel**: Combineer Frank Energie batterij met Tesla Powerwall data

**Sensors Gebruikt**:
- `frank_energie_battery_charge` (Battery)
- `frank_energie_trading_result` (Battery)
- `external_battery_count` (Battery)
- `external_battery_percentage` (Battery)
- `external_battery_daily_charged` (Battery)

**Flow Action** (Tesla Powerwall app):
```
Action: Receive Battery Metrics (Frank Energie Battery device)
  batteryId: "tesla-powerwall-1"
  chargedToday: {{tesla_charged}}
  dischargedToday: {{tesla_discharged}}
  percentage: {{tesla_charge}}
```

**Dashboard Cards**:
```
Frank Energie Battery: 76% (€0.61 today)
External Batteries: 2 total, 70% avg
Total Charged Today: 25.3 kWh
Total Discharged Today: 22.1 kWh
```

**Resultaat**: Unified multi-battery monitoring

---

### Voorbeeld 5: Price Alert System

**Doel**: Ontvang notificatie bij extreme prijzen

**Sensors Gebruikt**:
- `frank_energie_current_market_price` (Meter)
- `frank_energie_next_hour_market_price` (Meter)

**Flow 1** (Negative prices):
```
WHEN frank_energie_current_market_price < 0
THEN Send notification
  "NEGATIVE PRICE ALERT!
   You get paid to use electricity: €{{price}}/kWh
   Turn on all devices!"
```

**Flow 2** (High prices):
```
WHEN frank_energie_current_market_price > 0.25
THEN Send notification
  "HIGH PRICE WARNING!
   Current: €{{current}}/kWh
   Reduce usage!"
```

**Resultaat**: Proactieve cost management

---

### Voorbeeld 6: PV Production Monitoring (Toekomst)

**Doel**: Monitor PV productie en status

**Sensors Gebruikt** (zodra API beschikbaar):
- `frank_energie_pv_current_power` (PV)
- `frank_energie_pv_today_generation` (PV)
- `frank_energie_pv_status` (PV)

**Flow** (toekomstig):
```
WHEN frank_energie_pv_current_power < 0.5
AND time is between 11:00 and 15:00
AND frank_energie_pv_status is 'active'
THEN Send notification
  "Low PV production during peak hours - check panels"
```

**Resultaat**: Proactive maintenance alerts

---

## Sensor Capabilities Samenvatting

### Per Driver Type

| Driver | Totaal | Status | Trading | Prijzen | Verbruik | Rankings | Extern |
|--------|--------|--------|---------|---------|----------|----------|--------|
| **Battery** | 16 | 4 | 5 | - | - | 2 | 4 + 1 upload |
| **EV Charger** | 6 | 3 | 1 (bonus) | - | - | 2 | - |
| **Meter** | 12 | 2 | - | 5 | 4 | 2 | - |
| **PV System** | 7 | 3 (+ 2 placeholder) | 1 (bonus) | - | - | 2 | - |

### Unieke vs Gedeelde Capabilities

**Gedeelde capabilities** (meerdere drivers):
- `meter_power` - Battery, EV, Meter, PV
- `frank_energie_overall_rank` - Battery, EV, Meter, PV
- `frank_energie_provider_rank` - Battery, EV, Meter, PV

**Driver-specifieke capabilities**: 32 unieke sensors

---

## Toekomstige Uitbreidingen

### Gepland (wacht op API)

1. **PV Real-time Data**:
   - `frank_energie_pv_current_power` - Momenteel placeholder
   - `frank_energie_pv_today_generation` - Momenteel placeholder
   - **Status**: Wacht op Frank Energie GraphQL uitbreiding

2. **Gas Meter Data**:
   - `frank_energie_current_gas_price`
   - `frank_energie_today_gas_consumption`
   - `frank_energie_today_gas_costs`

3. **Forecasting**:
   - `frank_energie_tomorrow_min_price`
   - `frank_energie_tomorrow_avg_price`
   - `frank_energie_predicted_battery_result`

### Mogelijke Toevoegingen

- Historical data capabilities (week/maand totalen)
- CO₂ besparing tracking
- Seasonal comparison metrics
- Grid balancing contribution metrics

---

## Gerelateerde Documentatie

- [DEVICE_LIFECYCLE.md](DEVICE_LIFECYCLE.md) - Device werking en data flow
- [GRAPHQL_QUERIES_OVERVIEW.md](GRAPHQL_QUERIES_OVERVIEW.md) - Beschikbare GraphQL queries
- [FLOW_CARDS_GUIDE.md](FLOW_CARDS_GUIDE.md) - Flow cards gebruikshandleiding
- [CREDENTIALS_ARCHITECTURE.md](CREDENTIALS_ARCHITECTURE.md) - API authenticatie
- [CLAUDE.md](../CLAUDE.md) - Development guidelines

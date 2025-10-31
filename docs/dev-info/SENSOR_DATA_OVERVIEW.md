# Sensor Data Overview

Uitgebreide documentatie over alle sensor data (capabilities) die de Frank Energie Homey app presenteert voor elk driver type.

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Frank Energie Battery Driver](#frank-energie-battery-driver-14-capabilities)
3. [Frank Energie EV Charger Driver](#frank-energie-ev-charger-driver-5-capabilities)
4. [Frank Energie Energy Meter Driver](#frank-energie-energy-meter-driver-11-capabilities)
5. [Frank Energie PV System Driver](#frank-energie-pv-system-driver-6-capabilities)
6. [Zonneplan Battery Driver](#zonneplan-battery-driver-8-capabilities)
7. [Data Bronnen](#data-bronnen)
8. [Update Frequenties](#update-frequenties)
9. [Praktische Voorbeelden](#praktische-voorbeelden)

---

## Overzicht

De Frank Energie app biedt **44 totaal unieke capabilities** verdeeld over 5 driver types:

| Driver | Aantal Capabilities | Primaire Focus |
|--------|------|----------------|
| **Frank Energie Battery** | 14 | Trading results, rankings, externe batterijen |
| **Frank Energie EV Charger** | 5 | Laadstatus, bonus, rankings |
| **Frank Energie Energy Meter** | 11 | Marktprijzen, verbruik, kosten |
| **Frank Energie PV System** | 6 | PV opwek, status, bonus, rankings |
| **Zonneplan Battery** | 8 | Zonneplan batterij data en earnings |

### Data Update Frequentie

Alle sensors worden bijgewerkt volgens de **poll interval** instelling (configureerbaar per device):
- **15 minuten** (standaard)
- 30 minuten
- 45 minuten
- 60 minuten

**Eerste update**: Direct bij device start (onInit)

---

## Frank Energie Battery Driver (14 capabilities)

### Trading Results (5)

#### 1. `frank_energie_trading_result`
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

#### 2. `frank_energie_frank_slim_bonus`
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

---

#### 3. `frank_energie_epex_result`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: EPEX handelsresultaat vandaag
**Bron**: Frank Energie GraphQL - `periodEpexResult`

**Uitleg**: EPEX (European Power Exchange) is de day-ahead elektriciteitsmarkt.

**Voorbeeld**:
```
€0.25  → €0.25 verdiend op EPEX markt
€-0.10 → €0.10 verlies op EPEX trading
```

---

#### 4. `frank_energie_imbalance_result`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Imbalance trading resultaat vandaag
**Bron**: Frank Energie GraphQL - `periodImbalanceResult`

**Uitleg**: Imbalance trading houdt in dat de batterij helpt met het balanceren van het elektriciteitsnet.

**Voorbeeld**:
```
€0.30  → €0.30 verdiend aan imbalance trading
€-0.05 → €0.05 kosten
```

---

#### 5. `frank_energie_lifetime_total`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totaal verdiend sinds account aanmaak
**Bron**: Frank Energie GraphQL - cumulatief totaal

---

### Settings & Status (4)

#### 6. `frank_energie_battery_mode`
**Type**: String
**Waarden**: `imbalance` | `imbalance_aggressive` | `self_consumption_plus` | `manual` | `day_ahead`
**Beschrijving**: Huidige trading mode van de batterij
**Bron**: Frank Energie GraphQL - gedetecteerd uit `batterySettings`

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

---

#### 7. `frank_energie_last_upload`
**Type**: String (ISO 8601 timestamp)
**Format**: `YYYY-MM-DDTHH:mm:ss.sssZ`
**Beschrijving**: Timestamp van laatste succesvolle upload naar Onbalansmarkt.com
**Update**: Direct na succesvolle upload

---

#### 8. `frank_energie_next_poll_minutes`
**Type**: Number (Minuten)
**Unit**: minuten
**Beschrijving**: Tijd tot volgende data poll
**Bron**: App timer berekening

---

#### 9. `frank_energie_overall_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Range**: 1 - ∞
**Beschrijving**: Overall ranking positie op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API - `GET /api/me`

---

#### 10. `frank_energie_provider_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Range**: 1 - ∞
**Beschrijving**: Ranking binnen Frank Energie groep op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API - `GET /api/me`

---

### Externe Batterij Metrics (4)

Deze capabilities tracken externe batterijen (bijv. Sessy, Tesla Powerwall) die via flow actions hun data delen.

#### 11. `external_battery_count`
**Type**: Number (Aantal)
**Unit**: - (aantal batterijen)
**Beschrijving**: Aantal externe batterijen dat metrics deelt
**Bron**: `BatteryMetricsStore` - intern geheugen

---

#### 12. `external_battery_percentage`
**Type**: Number (Percentage)
**Unit**: %
**Range**: 0 - 100%
**Beschrijving**: Gemiddelde lading van alle externe batterijen
**Berekening**: `(battery1.charge + battery2.charge + ...) / count`

---

#### 13. `external_battery_daily_charged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal opgeladen energie vandaag (alle externe batterijen)

---

#### 14. `external_battery_daily_discharged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal ontladen energie vandaag (alle externe batterijen)

---

## Frank Energie EV Charger Driver (5 capabilities)

#### 1. `onoff`
**Type**: Boolean (Homey standaard capability)
**Waarden**: `true` | `false`
**Beschrijving**: EV laadpaal aan/uit status
**Bron**: Frank Energie GraphQL - `getSmartCharger().steeringStatus`

---

#### 2. `frank_energie_ev_charging_status`
**Type**: String
**Waarden**: `charging` | `idle` | `scheduled` | `completed`
**Beschrijving**: Gedetailleerde laadstatus van de EV
**Bron**: Frank Energie GraphQL - afgeleid van charger data

---

#### 3. `frank_energie_ev_bonus`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: EV laadbonus verdiend vandaag
**Bron**: Frank Energie GraphQL - slim laden bonus

---

#### 4. `frank_energie_overall_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Beschrijving**: Overall ranking op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API

---

#### 5. `frank_energie_provider_rank`
**Type**: Number (Positie)
**Unit**: - (positie nummer)
**Beschrijving**: Ranking binnen Frank Energie groep op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API

---

## Frank Energie Energy Meter Driver (11 capabilities)

### Marktprijs (5)

#### 1. `frank_energie_current_market_price`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Huidige marktprijs elektriciteit (dit uur)
**Bron**: Frank Energie GraphQL - `marketPrices`

---

#### 2. `frank_energie_next_hour_market_price`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Marktprijs voor het volgende uur
**Bron**: Frank Energie GraphQL - `marketPrices`

---

#### 3. `frank_energie_min_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Laagste marktprijs van vandaag
**Bron**: Frank Energie GraphQL

---

#### 4. `frank_energie_max_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Hoogste marktprijs van vandaag
**Bron**: Frank Energie GraphQL

---

#### 5. `frank_energie_avg_market_price_today`
**Type**: Number (Euro per kWh)
**Unit**: €/kWh
**Decimalen**: 4
**Beschrijving**: Gemiddelde marktprijs van vandaag
**Bron**: Frank Energie GraphQL

---

### Verbruik & Kosten (4)

#### 6. `frank_energie_today_consumption`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal elektriciteitsverbruik vandaag
**Bron**: Frank Energie GraphQL

---

#### 7. `frank_energie_today_costs`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totale elektriciteitskosten vandaag
**Bron**: Frank Energie GraphQL

---

#### 8. `frank_energie_site_usage`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totaal site verbruik
**Bron**: Frank Energie GraphQL

---

#### 9. `frank_energie_site_costs`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totale site kosten
**Bron**: Frank Energie GraphQL

---

### Rankings (2)

#### 10. `frank_energie_overall_rank`
**Type**: Number (Positie)
**Beschrijving**: Overall ranking op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API

---

#### 11. `frank_energie_provider_rank`
**Type**: Number (Positie)
**Beschrijving**: Ranking binnen Frank Energie groep
**Bron**: Onbalansmarkt.com REST API

---

## Frank Energie PV System Driver (6 capabilities)

#### 1. `frank_energie_pv_current_power`
**Type**: Number (Vermogen)
**Unit**: kW
**Decimalen**: 2
**Beschrijving**: Huidig PV productievermogen
**Bron**: Frank Energie GraphQL
**Status**: ⚠️ Momenteel placeholder (0 kW) - wacht op API uitbreiding

---

#### 2. `frank_energie_pv_today_generation`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Totale PV productie vandaag
**Bron**: Frank Energie GraphQL
**Status**: ⚠️ Momenteel placeholder (0 kWh) - wacht op API uitbreiding

---

#### 3. `frank_energie_pv_status`
**Type**: String
**Waarden**: `active` | `inactive` | `error` | `offline`
**Beschrijving**: Operationele status van het PV systeem
**Bron**: Frank Energie GraphQL

---

#### 4. `frank_energie_pv_bonus`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: PV bonus verdiend
**Bron**: Frank Energie GraphQL

---

#### 5. `frank_energie_overall_rank`
**Type**: Number (Positie)
**Beschrijving**: Overall ranking op Onbalansmarkt.com
**Bron**: Onbalansmarkt.com REST API

---

#### 6. `frank_energie_provider_rank`
**Type**: Number (Positie)
**Beschrijving**: Ranking binnen Frank Energie groep
**Bron**: Onbalansmarkt.com REST API

---

## Zonneplan Battery Driver (8 capabilities)

Dit is een aparte driver voor Zonneplan batterijen die via Homey flow cards hun data delen. De driver gebruikt **geen API-verbinding** naar Zonneplan - data wordt handmatig via flow actions geïnjecteerd.

#### 1. `measure_battery`
**Type**: Number (Percentage)
**Unit**: %
**Range**: 0 - 100%
**Beschrijving**: Huidig batterij laadpercentage
**Bron**: Flow action input

---

#### 2. `zonneplan_daily_earned`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Dagelijks verdiend bedrag vandaag
**Bron**: Flow action input

---

#### 3. `zonneplan_total_earned`
**Type**: Number (Euro)
**Unit**: €
**Decimalen**: 2
**Beschrijving**: Totaal verdiend sinds tracking gestart
**Bron**: Flow action input (cumulatief)
**Opmerking**: Kan handmatig worden gecorrigeerd via `total_earned_offset` instelling

---

#### 4. `zonneplan_daily_charged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Energie opgeladen vandaag
**Bron**: Flow action input

---

#### 5. `zonneplan_daily_discharged`
**Type**: Number (Energie)
**Unit**: kWh
**Decimalen**: 2
**Beschrijving**: Energie ontladen vandaag
**Bron**: Flow action input

---

#### 6. `zonneplan_cycle_count`
**Type**: Number (Aantal)
**Beschrijving**: Totaal aantal laad-ontlaadcycli
**Bron**: Flow action input

---

#### 7. `zonneplan_load_balancing`
**Type**: Boolean
**Beschrijving**: Dynamische load balancing actief
**Bron**: Flow action input

---

#### 8. `zonneplan_last_update`
**Type**: String (ISO 8601 timestamp)
**Beschrijving**: Tijdstip van laatste data update
**Bron**: Automatisch opgesteld bij ontvangst van flow action

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

### Voorbeeld 1: Goede Battery Results Alert

**Doel**: Ontvang notificatie wanneer batterij goed resultaat haalt

**Capabilities Gebruikt**:
- `frank_energie_trading_result` (Battery)
- `frank_energie_overall_rank` (Battery)

**Flow**:
```
WHEN frank_energie_trading_result > 2
THEN Send notification "Goed resultaat vandaag! €{{result}}"
```

---

### Voorbeeld 2: Slim Wasmachine Gebruik

**Doel**: Start wasmachine wanneer stroomprijs laag is

**Capabilities Gebruikt**:
- `frank_energie_current_market_price` (Meter)
- `frank_energie_avg_market_price_today` (Meter)

**Flow**:
```
WHEN frank_energie_current_market_price < frank_energie_avg_market_price_today
THEN Turn on washing machine
```

---

### Voorbeeld 3: Multi-Battery Monitoring

**Doel**: Combineer Frank Energie batterij met externe batterijen

**Capabilities Gebruikt**:
- `frank_energie_trading_result` (Frank Energie Battery)
- `external_battery_count` (Frank Energie Battery)
- `external_battery_daily_discharged` (Frank Energie Battery)

**Flow Action** (bijv. Sessy app):
```
Action: Receive Battery Metrics (Frank Energie Battery device)
  batteryId: "sessy-1"
  totalChargedKwh: {{sessy_total_charged}}
  totalDischargedKwh: {{sessy_total_discharged}}
  batteryPercentage: {{sessy_percentage}}
```

**Resultaat**: Unified monitoring van alle batterijen

---

## Capabilities Samenvatting

### Per Driver Type

| Driver | Totaal | Groepen | Focus |
|--------|--------|---------|-------|
| **Frank Energie Battery** | 14 | Trading (5), Settings (4), Rankings (2), Extern (3) | Trading results, rankings, external batteries |
| **Frank Energie EV Charger** | 5 | Laadstatus (2), Bonus (1), Rankings (2) | EV charging, bonus, rankings |
| **Frank Energie Energy Meter** | 11 | Marktprijzen (5), Verbruik (4), Rankings (2) | Electricity prices, consumption, rankings |
| **Frank Energie PV System** | 6 | Productie (2), Status (2), Rankings (2) | PV generation, status, rankings |
| **Zonneplan Battery** | 8 | Earnings (3), Energy (2), Status (3) | Manual flow-based data entry |
| **TOTAAL** | **44** | - | - |

### Gedeelde Capabilities (alle drivers)

- `frank_energie_overall_rank` - Overall Onbalansmarkt ranking
- `frank_energie_provider_rank` - Provider-specific ranking

### Zonneplan Specifiek

De Zonneplan driver is fundamenteel anders - het ontvangt data via Homey flow actions, niet via API-verbinding.

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

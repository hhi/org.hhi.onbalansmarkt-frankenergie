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

De Frank Energie app biedt capabilities per driver zoals hieronder samengevat:

| Driver | Aantal Capabilities | Primaire Focus |
|--------|--------------------|----------------|
| **Frank Energie Battery** | 18 basis + 6 runtime migraties | Trading resultaten, Onbalansmarkt rankings, externe batterijen |
| **Frank Energie EV Charger** | 5 | Laadstatus, bonus, pollingcontrole |
| **Frank Energie Energy Meter** | 10 | Marktprijzen, site verbruik/kosten |
| **Frank Energie PV System** | 6 | PV status, bonus, pollingcontrole |
| **Zonneplan Battery** | 8 | Handmatig aangeleverde Zonneplan metrieken |

### Data Update Frequentie

Alle Frank Energie drivers volgen de **`poll_interval`** instelling (1‑1440 minuten, standaard 5). `poll_start_minute` bepaalt de alignment binnen het uur. De eerste poll wordt direct tijdens `onInit` uitgevoerd voordat de intervaltimer start.

---

## Frank Energie Battery Driver (Trading + Onbalansmarkt + Aggregatie)

### Trading & Earnings
- `frank_energie_trading_result` — dagresultaat, rechtstreeks uit `getSmartBatterySessions()`
- `frank_energie_lifetime_total` — cumulatieve opbrengst van alle batterijen
- `frank_energie_frank_slim_bonus` — dagelijkse Frank Slim korting
- `frank_energie_epex_result` — day-ahead/EPEX component
- `frank_energie_imbalance_result` — onbalanscomponent

### Onbalansmarkt & Telemetrie
- `onbalansmarkt_overall_rank` / `onbalansmarkt_provider_rank` — bijgewerkt na elke profielpoll
- `onbalansmarkt_reported_charged` / `onbalansmarkt_reported_discharged` — laatste waarden die Onbalansmarkt kent
- `frank_energie_last_upload` — ISO 8601 timestamp van laatste succesvolle upload
- `frank_energie_recovery_state` — status van automatische baseline reset jobs
- `frank_energie_next_poll_minutes` — lokale countdown tot volgende poll

### Battery Mode
- `frank_energie_battery_mode` — gedetecteerde modus op basis van GraphQL settings (`imbalance`, `imbalance_aggressive`, `self_consumption_plus`, `manual`, `day_ahead`)

### Externe Batterij Aggregatie (compose-capabilities)
- `external_battery_selector` — picker voor individuele externe batterijen
- `external_battery_percentage` — gemiddeld SoC
- `external_battery_count` — aantal actieve externe batterijen
- `external_battery_daily_charged` / `external_battery_daily_discharged` — dagtotalen

### Externe Batterij Aggregatie (runtime migraties)
Tijdens `ensureExternalBatteryAggregatedCapabilities()` worden ontbrekende capabilities toegevoegd of vernieuwd:
- `external_battery_current_charged` / `external_battery_current_discharged`
- `external_battery_startofday_charged` / `external_battery_startofday_discharged`

Deze velden ontvangen data via de flow actions `receive_battery_metrics` (lifetime) en `receive_battery_daily_metrics` (daily-only).

## Frank Energie EV Charger Driver (5 capabilities)

| Capability | Type | Bron | Opmerking |
|------------|------|------|-----------|
| `onoff` | boolean | Flow action (manual toggles) | UI toggle; driver zelf schakelt niet automatisch |
| `measure_battery` | number (%) | Enode sessies → grafieken | Toont laadstatus indien beschikbaar |
| `frank_energie_ev_charging_status` | enum (`charging`, `idle`, `scheduled`, `completed`) | `FrankEnergieClient.getEnodeSessions()` | Wordt bepaald uit sessiegegevens |
| `frank_energie_ev_bonus` | number (€) | Enode sessies | Dagelijkse savings/bonus |
| `frank_energie_next_poll_minutes` | number (min) | Lokale timer | Countdown tot volgende sessie poll |

Geen ranking-capabilities meer: EV devices vertrouwen op de gedeelde batteryranking (`onbalansmarkt_*`) binnen het Battery device.

## Frank Energie Energy Meter Driver (10 capabilities)

| Capability | Type | Units | Bron |
|------------|------|-------|------|
| `frank_energie_current_market_price` | number | €/kWh (4 decimals) | `MarketPrices` query (current period) |
| `frank_energie_next_hour_market_price` | number | €/kWh | `MarketPrices` (next period) |
| `frank_energie_min_market_price_today` | number | €/kWh | Locally berekend uit prijzen voor vandaag |
| `frank_energie_max_market_price_today` | number | €/kWh | idem |
| `frank_energie_avg_market_price_today` | number | €/kWh | idem |
| `frank_energie_today_consumption` | number | kWh | `PeriodUsageAndCosts` (site usage) |
| `frank_energie_today_costs` | number | € | `PeriodUsageAndCosts` (site costs) |
| `frank_energie_site_usage` | number | kWh | `MonthSummary` (huidige maand) |
| `frank_energie_site_costs` | number | € | `MonthSummary` |
| `frank_energie_next_poll_minutes` | number | minuten | Lokale timer |

De meter driver bevat geen ranking capabilities en geen Onbalansmarkt API afhankelijkheid.

## Frank Energie PV System Driver (6 capabilities)

Capabilities volgens `drivers/frank-energie-pv/driver.compose.json`:

- `onoff` — UI toggle (geen automatische aansturing)
- `frank_energie_pv_current_power` — placeholder; wordt 0 kW totdat Frank Energie live vermogen levert
- `frank_energie_pv_today_generation` — placeholder; wacht op API-uitbreiding
- `frank_energie_pv_status` — afgeleid van `smartPvSystemSummary.operationalStatus`
- `frank_energie_pv_bonus` — mapped naar `totalBonus` uit `smartPvSystemSummary`
- `frank_energie_next_poll_minutes` — lokale timer

Ranking-capabilities zijn hier niet aanwezig; PV apparaten vertrouwen op de Battery device voor Onbalansmarkt rankings.

## Zonneplan Battery Driver (8 capabilities)

De Zonneplan driver ontvangt data via flow cards (`receive_zonneplan_metrics`). Er is geen rechtstreekse API-koppeling naar Zonneplan, maar de device kan desgewenst een Onbalansmarkt API key gebruiken om dezelfde resultaten door te sturen.

| Capability | Beschrijving | Bron |
|------------|--------------|------|
| `measure_battery` | Huidig batterijniveau (%) | Flow action arg `battery_percentage` |
| `zonneplan_daily_earned` | Vandaag verdiend (€) | Flow action arg `daily_earned` |
| `zonneplan_total_earned` | Totale verdiensten (met `total_earned_offset`) | Flow action arg `total_earned` |
| `zonneplan_daily_charged` | Vandaag geladen (kWh) | Flow action arg `daily_charged` |
| `zonneplan_daily_discharged` | Vandaag geleverd (kWh) | Flow action arg `daily_discharged` |
| `zonneplan_cycle_count` | Totaal aantal cycli | Flow action arg `cycle_count` |
| `zonneplan_load_balancing` | Boolean voor load balancing status | Flow action arg `load_balancing_active` |
| `zonneplan_last_update` | Laatste update (locale datum/tijdstring) | Automatisch gezet bij ontvangst |

Wanneer `auto_send_measurements` + `onbalansmarkt_api_key` zijn geconfigureerd, stuurt het apparaat dezelfde data door naar Onbalansmarkt via `OnbalansmarktClient.sendMeasurement()`.

## Data Bronnen

### Frank Energie GraphQL API

**Endpoint**: Frank Energie GraphQL
**Authenticatie**: Email + Password
**Data Types (selectie)**:
- Battery discovery & settings (`getSmartBatteries`, `getSmartBattery`, `getSmartBatterySettings`)
- Battery sessions (`getSmartBatterySessions`)
- PV systemen (`getSmartPvSystems`, `getSmartPvSystemSummary`)
- EV / Enode sessies (`getEnodeSessions`, `getUserSmartCharging`)
- Smart feed-in (`getSmartFeedInSessions`, `getUserSmartFeedIn`)
- Market data (`MarketPrices`, `WeightedAveragePrices`)
- Verbruik/kosten (`PeriodUsageAndCosts`, `MonthSummary`, `MonthInsights`, `CostsDelta`)
- Sessies/token beheer (`RenewToken`)

**Query Frequentie**: Elke poll interval (1-1440 minuten, standaard 5)

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
- `onbalansmarkt_overall_rank` (Battery)

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
| **Frank Energie Battery** | 24 (18 compose + 6 runtime) | Trading (5), Mode/telemetry (4), Onbalansmarkt (4), External aggregation (11) | Trading, rankings, externe batterijen |
| **Frank Energie EV Charger** | 5 | Status (3), Bonus (1), Polling (1) | EV/Enode sessies |
| **Frank Energie Energy Meter** | 10 | Marktprijzen (5), Gebruik/kosten (4), Polling (1) | Tarieven en site metrics |
| **Frank Energie PV System** | 6 | Status/bonus (3), Placeholders (2), Polling (1) | PV status + bonus |
| **Zonneplan Battery** | 8 | Earnings (3), Energy (2), Status (3) | Flow-based Zonneplan data |
| **TOTAAL** | **53** | - | - |

### Gedeelde Capabilities (alle drivers)

De meeste drivers hebben eigen capabilities; alleen de Battery driver bevat Onbalansmarkt rankings (`onbalansmarkt_overall_rank`, `onbalansmarkt_provider_rank`). Andere drivers verwijzen naar deze gegevens via flow cards of app-level notificaties.

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

# Frank Energie GraphQL Architecture - Query Relaties en Toegangspaden

Dit document beschrijft de architectuur van de Frank Energie GraphQL API, inclusief alle query relaties, toegangspaden, en sleutelvelden die queries aan elkaar koppelen.

**Laatste update**: 27 oktober 2025
**Gebaseerd op**: Analyse van alle 22 GraphQL query voorbeelden in `docs/graphql/`

---

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Query Hiërarchie](#query-hiërarchie)
3. [Gebruikersaccount (Entrypoint)](#1-gebruikersaccount-entrypoint)
4. [Smart Battery Queries](#2-smart-battery-queries)
5. [Smart PV System Queries](#3-smart-pv-system-queries)
6. [Energie & Kosten Queries](#4-energie--kosten-queries)
7. [Overige Queries](#5-overige-queries)
8. [Relatiediagram](#relatiediagram)
9. [Kernvelden voor Relaties](#kernvelden-voor-relaties)
10. [Authenticatie Vereisten](#authenticatie-vereisten)
11. [Query Strategie voor Homey App](#query-strategie-voor-homey-app)

---

## Overzicht

De Frank Energie GraphQL API heeft een hiërarchische structuur waarbij **`Me`** als centrale entrypoint fungeert. Vanuit de `Me` query kunnen alle andere entiteiten worden bereikt via ID's en referenties.

**Belangrijkste relatie-types**:
- **Direct** - Geen extra parameters nodig (behalve authenticatie)
- **Via ID** - Vereist ID van parent query (bijv. `deviceId` van `SmartBatteries`)
- **Via Reference** - Vereist berekende referentie (bijv. `siteReference` afgeleid van `connections`)

---

## Query Hiërarchie

```
Me (Entrypoint)
├── SmartBatteries
│   ├── SmartBattery(deviceId)
│   ├── SmartBatterySummary(deviceId)
│   ├── smartBatterySettings(deviceId)
│   ├── SmartBatterySessions(deviceId, startDate, endDate)
│   └── SmartBatterySession(deviceId, date)
├── SmartPvSystems
│   └── SmartPvSystemSummary(deviceId)
├── connections → siteReference
│   ├── MarketPrices(siteReference, date)
│   ├── PeriodUsageAndCosts(siteReference, date)
│   ├── MonthSummary(siteReference)
│   ├── MonthInsights(siteReference, date)
│   └── WeightedAveragePrices(siteReference, dateRange)
├── SmartBatteryGetConnectRequests
├── SmartPvSystemGetConnectRequests
├── UserSmartCharging
├── UserSmartFeedIn
├── SmartFeedInSessions(startDate, endDate)
├── EnodeSessions
├── CostsDelta(siteReference, dateRange)
└── RenewToken(refreshToken)
```

---

## 1. Gebruikersaccount (Entrypoint)

### Query: `Me`

**Toegangspad**: **DIRECT** (geen parameters nodig behalve authenticatie)

**GraphQL Query**:
```graphql
query Me($siteReference: String) {
  me {
    id
    email
    connections(siteReference: $siteReference) {
      id
      connectionId
      EAN
      segment  # "ELECTRICITY" | "GAS"
      status
      contractStatus
    }
  }
}
```

**Variabelen**:
- `siteReference` (optioneel) - Filter voor specifieke site

**Primaire ID's die deze query levert**:
- `me.id` → Gebruikers-ID
- `me.connections[].connectionId` → Connectie-ID's
- `me.connections[].EAN` → EAN-nummers (elektriciteit/gas)
- **Berekend** of via Connection.cluster: `siteReference` (formaat: "1234AB 55 C 1234567")

**Deze ID's worden gebruikt in**:
- → `connections[].EAN` gebruikt in: `MarketPrices`, `PeriodUsageAndCosts`
- → Berekend `siteReference` gebruikt in: `MonthSummary`, `MarketPrices`, `PeriodUsageAndCosts`

**Voorbeeld response**:
```json
{
  "me": {
    "id": "clucz24l20h0qhj22m4gvw587",
    "email": "user@example.com",
    "connections": [
      {
        "id": "clucz2kiq02mohr22noqrb5dg",
        "connectionId": "c2ab0dc5-a28d-46e7-a651-b1420123064d",
        "EAN": "871691500018399755",
        "segment": "ELECTRICITY"
      }
    ]
  }
}
```

**Belangrijke velden**:
- `connections[].externalDetails.address` → Bevat adresgegevens voor `siteReference` berekening
- `connections[].externalDetails.gridOperator` → Netbeheerder informatie
- `InviteLinkUser` → Uitnodigingslink informatie (bomen, korting)

---

## 2. Smart Battery Queries

### 2.1 Query: `SmartBatteries` (Lijst)

**Toegangspad**: `Me` → **SmartBatteries**

**GraphQL Query**:
```graphql
query SmartBatteries {
  smartBatteries {
    id
    brand
    capacity
    externalReference
    provider
    maxChargePower
    maxDischargePower
    onboardingStatus
  }
}
```

**Variabelen**: Geen

**Primaire ID die deze query levert**:
- `smartBatteries[].id` → Battery Device ID

**Deze ID wordt gebruikt in**:
- → `SmartBattery(deviceId)`
- → `SmartBatterySummary(deviceId)`
- → `smartBatterySettings(deviceId)`
- → `SmartBatterySessions(deviceId, startDate, endDate)`
- → `SmartBatterySession(deviceId, date)`

**Voorbeeld response**:
```json
{
  "smartBatteries": [
    {
      "id": "clvvf1dh901upc93qd1wxm5bk",
      "brand": "Sessy",
      "capacity": 5.2,
      "externalReference": "A3K6SDKD",
      "provider": "SESSY",
      "maxChargePower": 2.2,
      "maxDischargePower": 1.7,
      "onboardingStatus": "ACTIVE"
    }
  ]
}
```

---

### 2.2 Query: `SmartBattery` (Detail)

**Toegangspad**: `Me` → `SmartBatteries` → **SmartBattery**(`deviceId`)

**GraphQL Query**:
```graphql
query SmartBattery($deviceId: String!) {
  smartBattery(deviceId: $deviceId) {
    id
    brand
    capacity
    externalReference
    settings {
      batteryMode
      imbalanceTradingStrategy
      selfConsumptionTradingAllowed
      selfConsumptionTradingThresholdPrice
      requestedUpdate {
        batteryMode
        effectiveFrom
        imbalanceTradingStrategy
      }
    }
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartBatteries.id`)

**Uniek veld**:
- `settings` object met batterij-instellingen (niet beschikbaar in lijst)

**Gebruikt voor**:
- Trading mode detectie
- Instellingen wijzigingen

---

### 2.3 Query: `SmartBatterySummary`

**Toegangspad**: `Me` → `SmartBatteries` → **SmartBatterySummary**(`deviceId`)

**GraphQL Query**:
```graphql
query SmartBatterySummary($deviceId: String!) {
  smartBatterySummary(deviceId: $deviceId) {
    lastKnownStateOfCharge
    lastKnownStatus
    lastUpdate
    totalResult
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartBatteries.id`)

**Data**:
- `lastKnownStateOfCharge` - Laadniveau (0-100%)
- `lastKnownStatus` - Status (bijv. "DISCHARGE_INTRADAY", "CHARGE_INTRADAY", "IDLE_INTRADAY")
- `lastUpdate` - Laatste update timestamp (ISO 8601)
- `totalResult` - Lifetime totaal resultaat (€)

**Voorbeeld response**:
```json
{
  "smartBatterySummary": {
    "lastKnownStateOfCharge": 15,
    "lastKnownStatus": "DISCHARGE_INTRADAY",
    "lastUpdate": "2025-10-15T21:15:00.000Z",
    "totalResult": 459.6981544574045
  }
}
```

**Gebruikt voor**:
- Real-time status updates
- Lifetime total tracking (voor individuele battery sensoren)

---

### 2.4 Query: `smartBatterySettings`

**Toegangspad**: `Me` → `SmartBatteries` → **smartBatterySettings**(`deviceId`)

**GraphQL Query**:
```graphql
query SmartBatterySettings($deviceId: String!) {
  smartBatterySettings(deviceId: $deviceId) {
    batteryMode {
      current
      updatable
      options { code, selectable }
      pending
      pendingValueEffectiveFrom
      requestUpdateBefore
      updateDelayedTill
    }
    imbalanceTradingStrategy {
      current
      updatable
      options {
        code
        expectedCyclesPerDay
        expectedResultPercentDelta
      }
      pending
      pendingValueEffectiveFrom
    }
    selfConsumptionTradingAllowed {
      current
      discountAmount
      updatable
    }
    selfConsumptionTradingThresholdPrice {
      current
      updatable
      options {
        amount
        expectedResultPercentDelta
      }
    }
    lockedForUpdatesTill
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartBatteries.id`)

**Data**: Uitgebreide instellingen met:
- Huidige waarden (`current`)
- Beschikbare opties (`options`)
- Pending updates (`pending`, `pendingValueEffectiveFrom`)
- Update beperkingen (`updatable`, `lockedForUpdatesTill`)

**Voorbeeld batteryMode waarden**:
- `IMBALANCE_TRADING` - Onbalans handel
- `SELF_CONSUMPTION_MIX` - Zelfverbruik mix

**Voorbeeld imbalanceTradingStrategy waarden**:
- `STANDARD` - Standaard (1.1 cycli/dag, 0% delta)
- `AGGRESSIVE` - Agressief (1.3 cycli/dag, +14.62% delta)

---

### 2.5 Query: `SmartBatterySessions` (Periode)

**Toegangspad**: `Me` → `SmartBatteries` → **SmartBatterySessions**(`deviceId`, `startDate`, `endDate`)

**GraphQL Query**:
```graphql
query SmartBatterySessions(
  $startDate: String!
  $endDate: String!
  $deviceId: String!
) {
  smartBatterySessions(
    startDate: $startDate
    endDate: $endDate
    deviceId: $deviceId
  ) {
    deviceId
    fairUsePolicyVerified
    periodStartDate
    periodEndDate
    periodEpexResult
    periodFrankSlim
    periodImbalanceResult
    periodTotalResult
    periodTradeIndex
    periodTradingResult
    sessions {
      cumulativeResult
      date
      result
      status
      tradeIndex
    }
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartBatteries.id`)
- `startDate` (formaat: "YYYY-MM-DD")
- `endDate` (formaat: "YYYY-MM-DD")

**Data**:
- **Periode aggregaties**:
  - `periodEpexResult` - EPEX opbrengst (€)
  - `periodFrankSlim` - Frank Slim bonus (€)
  - `periodImbalanceResult` - Onbalans opbrengst (€)
  - `periodTotalResult` - Totale opbrengst (€)
  - `periodTradingResult` - Trading opbrengst (€)
  - `periodTradeIndex` - Trade index
- **Dagelijkse sessies**:
  - `sessions[].date` - Datum (YYYY-MM-DD)
  - `sessions[].result` - Dagresultaat (€)
  - `sessions[].cumulativeResult` - Cumulatief resultaat (€)
  - `sessions[].status` - Status (bijv. "COMPLETE_FINAL")
  - `sessions[].tradeIndex` - Trade index voor die dag

**Voorbeeld response**:
```json
{
  "smartBatterySessions": {
    "deviceId": "clvvf1dh901upc93qd1wxm5bk",
    "periodStartDate": "2025-08-01",
    "periodEndDate": "2025-08-31",
    "periodEpexResult": -11.16341781835913,
    "periodFrankSlim": 0.01894166665049995,
    "periodImbalanceResult": 22.2183636554575,
    "periodTotalResult": 11.07388750374887,
    "periodTradingResult": 22.237305322108,
    "sessions": [
      {
        "date": "2025-08-01",
        "result": 0.5193794870435,
        "cumulativeResult": 400.8173848979387,
        "status": "COMPLETE_FINAL"
      }
    ]
  }
}
```

**Gebruikt voor**:
- Maand/periode overzichten
- Historische data
- EPEX/Imbalance/Frank Slim uitsplitsing

---

### 2.6 Query: `SmartBatterySession` (Enkele dag)

**Toegangspad**: `Me` → `SmartBatteries` → **SmartBatterySession**(`deviceId`, `date`)

**GraphQL Query**:
```graphql
query SmartBatterySession($date: String!, $deviceId: String!) {
  smartBatterySession(date: $date, deviceId: $deviceId) {
    date
    deviceId
    epexResult
    fairUsePolicyVerified
    frankSlim
    imbalanceResult
    intervals {
      endCharge
      energyPrice
      epexPrice
      imbalancePrice
      imbalanceState
      intervalEnd
      intervalStart
      startCharge
      status
      timeBand
      tradingResult
      variableCostEstimate
    }
    status
    totalResult
    tradeIndex
    tradingResult
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartBatteries.id`)
- `date` (formaat: "YYYY-MM-DD")

**Data**: Zeer gedetailleerde 15-minuten intervallen met:
- **Per interval (96 intervallen per dag)**:
  - `intervalStart`/`intervalEnd` - Tijdstip (ISO 8601)
  - `startCharge`/`endCharge` - Laadniveau voor/na interval (%)
  - `epexPrice` - EPEX prijs (€/kWh)
  - `imbalancePrice` - Onbalans prijs (€/kWh)
  - `imbalanceState` - Onbalans state (bijv. "RT2", null)
  - `status` - Interval status (bijv. "CHARGE_INTRADAY", "DISCHARGE_INTRADAY", "IDLE_INTRADAY", "STATUS_UNRELIABLE_DATA")
  - `tradingResult` - Trading resultaat voor interval (€)
- **Dag totalen**:
  - `epexResult` - EPEX resultaat (€)
  - `frankSlim` - Frank Slim bonus (€)
  - `imbalanceResult` - Onbalans resultaat (€)
  - `tradingResult` - Trading resultaat (€)
  - `totalResult` - Totaal resultaat (€)

**Gebruikt voor**:
- Gedetailleerde analyse van batterij gedrag
- Debugging
- Visualisaties per interval

---

### 2.7 Query: `SmartBatteryGetConnectRequests`

**Toegangspad**: `Me` → **SmartBatteryGetConnectRequests**

**GraphQL Query**:
```graphql
query SmartBatteryGetConnectRequests {
  smartBatteryConnectRequests {
    brand
    error
    id
    status
  }
}
```

**Variabelen**: Geen

**Data**: Lijst van battery connect requests
- `id` - Request ID
- `brand` - Battery merk
- `status` - Request status
- `error` - Foutmelding (indien van toepassing)

**Authenticatie**: Vereist speciale autorisatie (geeft "user-error:auth-not-authorised" voor reguliere gebruikers)

---

## 3. Smart PV System Queries

### 3.1 Query: `SmartPvSystems` (Lijst)

**Toegangspad**: `Me` → **SmartPvSystems**

**GraphQL Query**:
```graphql
query SmartPvSystems {
  smartPvSystems {
    id
    brand
    connectionEAN
    displayName
    externalReference
    inverterSerialNumbers
    model
    onboardingStatus
    provider
    steeringStatus
  }
}
```

**Variabelen**: Geen

**Primaire ID die deze query levert**:
- `smartPvSystems[].id` → PV System Device ID

**Relatie naar connections**:
- `connectionEAN` links naar `Me.connections[].EAN`

**Deze ID wordt gebruikt in**:
- → `SmartPvSystemSummary(deviceId)`

**Voorbeeld response**:
```json
{
  "smartPvSystems": [
    {
      "id": "cmd362tku000sz3kcm4ucudw4",
      "brand": "SolarEdge",
      "connectionEAN": "871691500018399755",
      "displayName": null,
      "externalReference": "47da3432-0525-4820-b404-32bb0f30de32_ced74d9c-78da-48e3-9187-9f4356369118",
      "inverterSerialNumbers": ["7B0748E9-A1"],
      "provider": "SOLAREDGE",
      "onboardingStatus": "ACTIVE",
      "steeringStatus": "ACTIVE"
    }
  ]
}
```

---

### 3.2 Query: `SmartPvSystemSummary`

**Toegangspad**: `Me` → `SmartPvSystems` → **SmartPvSystemSummary**(`deviceId`)

**GraphQL Query**:
```graphql
query SmartPvSystemSummary($deviceId: String!) {
  smartPvSystemSummary(deviceId: $deviceId) {
    operationalStatus
    operationalStatusTimestamp
    steeringStatus
    totalBonus
  }
}
```

**Variabelen**:
- `deviceId` (van `SmartPvSystems.id`)

**Data**:
- `operationalStatus` - Operationele status (bijv. "OFF", "PRODUCING")
- `operationalStatusTimestamp` - Laatste status update (ISO 8601)
- `steeringStatus` - Sturing status (bijv. "ACTIVE")
- `totalBonus` - Totale PV bonus (€)

**Voorbeeld response**:
```json
{
  "smartPvSystemSummary": {
    "operationalStatus": "OFF",
    "operationalStatusTimestamp": "2025-10-15T21:19:56.000Z",
    "steeringStatus": "ACTIVE",
    "totalBonus": 6.238522773410809
  }
}
```

---

### 3.3 Query: `SmartPvSystemGetConnectRequests`

**Toegangspad**: `Me` → **SmartPvSystemGetConnectRequests**

**Variabelen**: Geen

**Authenticatie**: Vereist speciale autorisatie

---

## 4. Energie & Kosten Queries

Deze queries gebruiken `siteReference` die wordt afgeleid van `Me.connections[]`.

**siteReference formaat**: `"{zipCode} {houseNumber} {houseNumberAddition} {connectionId-suffix}"`

- Voorbeeld: `"1234AB 55 C 1234567"`

### 4.1 Query: `MarketPrices`

**Toegangspad**: `Me` → `Me.connections[]` → **MarketPrices**(`siteReference`, `date`)

**GraphQL Query**:
```graphql
query MarketPrices($date: String!, $siteReference: String!) {
  customerMarketPrices(date: $date, siteReference: $siteReference) {
    id
    averageElectricityPrices {
      averageMarketPrice
      averageMarketPricePlus
      averageAllInPrice
      perUnit
      isWeighted
    }
    electricityPrices {
      id
      from
      till
      date
      marketPrice
      marketPricePlus
      allInPrice
      perUnit
    }
    gasPrices {
      id
      from
      till
      date
      marketPrice
      marketPricePlus
      allInPrice
      perUnit
    }
  }
}
```

**Variabelen**:
- `siteReference` (afgeleid van `Me.connections`)
- `date` (formaat: "YYYY-MM-DD")

**Data**:
- **Gemiddelde prijzen** (electriciteit):
  - `averageMarketPrice` - Gemiddelde marktprijs (€/kWh)
  - `averageMarketPricePlus` - Met belastingen (€/kWh)
  - `averageAllInPrice` - All-in prijs (€/kWh)
- **Uurlijkse prijzen** (electriciteit & gas):
  - `from`/`till` - Tijdvak (ISO 8601)
  - `marketPrice` - Basis marktprijs (€/kWh of €/m³)
  - `marketPricePlus` - Met belastingen (€/kWh of €/m³)
  - `allInPrice` - All-in prijs (€/kWh of €/m³)

**Gebruikt voor**:
- Real-time prijsinformatie
- Meter driver capabilities
- Kostprijs berekeningen

---

### 4.2 Query: `PeriodUsageAndCosts`

**Toegangspad**: `Me` → `Me.connections[]` → **PeriodUsageAndCosts**(`siteReference`, `date`)

**GraphQL Query**:
```graphql
query PeriodUsageAndCosts($date: String!, $siteReference: String!) {
  periodUsageAndCosts(date: $date, siteReference: $siteReference) {
    _id
    gas {
      usageTotal
      costsTotal
      unit
      items {
        date
        from
        till
        usage
        costs
        unit
      }
    }
    electricity {
      usageTotal
      costsTotal
      unit
      items {
        date
        from
        till
        usage
        costs
        unit
      }
    }
    feedIn {
      usageTotal
      costsTotal
      unit
      items {
        date
        from
        till
        usage
        costs
        unit
      }
    }
  }
}
```

**Variabelen**:
- `siteReference` (afgeleid van `Me.connections`)
- `date` (formaat: "YYYY-MM" voor maand)

**Data**:
- **Per segment** (gas, electricity, feedIn):
  - `usageTotal` - Totaal verbruik/teruglevering (kWh of m³)
  - `costsTotal` - Totale kosten (€)
  - `unit` - Eenheid ("KWH" of "M3")
  - **Dagelijkse items**:
    - `date` - Datum (YYYY-MM-DD)
    - `from`/`till` - Tijdvak (ISO 8601)
    - `usage` - Verbruik/teruglevering (kWh of m³)
    - `costs` - Kosten (€)

**Voorbeeld response**:
```json
{
  "periodUsageAndCosts": {
    "_id": "1234AB 55 C 1234567|2025-10",
    "electricity": {
      "usageTotal": 440.548,
      "costsTotal": 46.46,
      "unit": "KWH",
      "items": [
        {
          "date": "2025-10-01",
          "from": "2025-09-30T22:00:00.000Z",
          "till": "2025-10-01T22:00:00.000Z",
          "usage": 22.78,
          "costs": 3.0488,
          "unit": "KWH"
        }
      ]
    },
    "feedIn": {
      "usageTotal": 184.254,
      "costsTotal": 32.2,
      "unit": "KWH",
      "items": [...]
    },
    "gas": {
      "usageTotal": 6.392,
      "costsTotal": 2.93,
      "unit": "M3",
      "items": [...]
    }
  }
}
```

**Gebruikt voor**:
- Maand overzichten
- Dagelijks verbruik tracking
- Feed-in teruglevering

---

### 4.3 Query: `MonthSummary`

**Toegangspad**: `Me` → `Me.connections[]` → **MonthSummary**(`siteReference`)

**GraphQL Query**:
```graphql
query MonthSummary($siteReference: String!) {
  monthSummary(siteReference: $siteReference) {
    _id
    lastMeterReadingDate
    expectedCostsUntilLastMeterReadingDate
    actualCostsUntilLastMeterReadingDate
    meterReadingDayCompleteness
    gasExcluded
  }
}
```

**Variabelen**:
- `siteReference` (afgeleid van `Me.connections`)

**Data**:
- `lastMeterReadingDate` - Laatste meterdatum (YYYY-MM-DD)
- `expectedCostsUntilLastMeterReadingDate` - Verwachte kosten (€)
- `actualCostsUntilLastMeterReadingDate` - Werkelijke kosten (€)
- `meterReadingDayCompleteness` - Compleetheid (0.0-1.0)
- `gasExcluded` - Gas uitgesloten (boolean)

**Voorbeeld response**:
```json
{
  "monthSummary": {
    "_id": "1234AB 55 C 1234567|2025-10",
    "lastMeterReadingDate": "2025-10-14",
    "expectedCostsUntilLastMeterReadingDate": 45.81,
    "actualCostsUntilLastMeterReadingDate": 39.49,
    "meterReadingDayCompleteness": 1.0,
    "gasExcluded": false
  }
}
```

**Gebruikt voor**:
- Maand kosten overzicht
- Expected vs actual vergelijking

---

## 5. Overige Queries

### 5.1 Query: `UserSmartCharging`

**Toegangspad**: `Me` → **UserSmartCharging**

**GraphQL Query**:
```graphql
query UserSmartCharging {
  userSmartCharging {
    hasAcceptedTerms
    isActivated
    isAvailableInCountry
    needsSubscription
    provider
    subscription {
      endDate
      id
      proposition {
        product
        countryCode
      }
      startDate
    }
    userCreatedAt
    userId
  }
}
```

**Variabelen**: Geen

**Data**: Smart charging abonnement informatie

**Authenticatie**: Vereist speciale autorisatie (geeft "user-error:auth-not-authorised" voor reguliere gebruikers)

---

## Relatiediagram

```
┌──────────────────┐
│       Me         │ ◄─── ENTRYPOINT (Direct, geen parameters)
└────────┬─────────┘
         │
         ├─── connections[].EAN ──────────┬───→ MarketPrices(siteReference, date)
         │                                ├───→ PeriodUsageAndCosts(siteReference, date)
         │                                └───→ MonthSummary(siteReference)
         │
         ├─── SmartBatteries ─────┬───→ SmartBattery(deviceId)
         │   [].id (deviceId)      ├───→ SmartBatterySummary(deviceId)
         │                          ├───→ smartBatterySettings(deviceId)
         │                          ├───→ SmartBatterySessions(deviceId, startDate, endDate)
         │                          └───→ SmartBatterySession(deviceId, date)
         │
         ├─── SmartPvSystems ──────────→ SmartPvSystemSummary(deviceId)
         │   [].id (deviceId)
         │   [].connectionEAN → links naar Me.connections[].EAN
         │
         ├─── SmartBatteryGetConnectRequests ⚠️ (requires special auth)
         ├─── SmartPvSystemGetConnectRequests ⚠️ (requires special auth)
         └─── UserSmartCharging ⚠️ (requires special auth)
```

**Legenda**:
- `→` = Query relatie (parent → child)
- `⚠️` = Vereist speciale autorisatie
- `[].id` = Array element ID veld

---

## Kernvelden voor Relaties

| Veld | Type | Bron Query | Gebruikt in Queries | Opmerking |
|------|------|-----------|---------------------|-----------|
| `deviceId` (battery) | String | `SmartBatteries[].id` | SmartBattery, SmartBatterySummary, smartBatterySettings, SmartBatterySessions, SmartBatterySession | Primary key voor battery |
| `deviceId` (PV) | String | `SmartPvSystems[].id` | SmartPvSystemSummary | Primary key voor PV |
| `siteReference` | String | `Me.connections` (berekend) | MarketPrices, PeriodUsageAndCosts, MonthSummary | Formaat: "{zipCode} {houseNumber} {addition} {suffix}" |
| `EAN` | String | `Me.connections[].EAN` | SmartPvSystems.connectionEAN (relatie) | EAN-nummer energie aansluiting |
| `connectionId` | String | `Me.connections[].connectionId` | Identificatie energie-aansluiting | UUID format |

**siteReference berekening**:
```typescript
// Pseudo-code
const address = connection.externalDetails.address;
const siteReference = `${address.zipCode} ${address.houseNumber} ${address.houseNumberAddition} ${connection.id.suffix}`;
// Voorbeeld: "1234AB 55 C 1234567"
```

---

## Authenticatie Vereisten

### Standaard Queries (Werken met basis authenticatie)

**Gebruikersaccount**:
- ✅ `Me`

**Smart Battery**:
- ✅ `SmartBatteries`
- ✅ `SmartBattery`
- ✅ `SmartBatterySummary`
- ✅ `smartBatterySettings`
- ✅ `SmartBatterySessions`
- ✅ `SmartBatterySession`

**Smart PV**:
- ✅ `SmartPvSystems`
- ✅ `SmartPvSystemSummary`

**Energie & Kosten**:
- ✅ `MarketPrices`
- ✅ `PeriodUsageAndCosts`
- ✅ `MonthSummary`

### Restricted Queries (Vereisen extra autorisatie)

Geeft `"user-error:auth-not-authorised"` error voor reguliere gebruikers:

- ⚠️ `SmartBatteryGetConnectRequests`
- ⚠️ `SmartPvSystemGetConnectRequests`
- ⚠️ `UserSmartCharging`

**Opmerking**: Deze queries zijn waarschijnlijk alleen beschikbaar voor:
- Beheerders
- Beta testers
- Specifieke gebruikersgroepen
- Of tijdens het onboarding proces

---

## Query Strategie voor Homey App

### Initialisatie Flow (Bij device toevoegen)

**Volgorde**:

1. **`Me`** → Verkrijg gebruikersinfo
   - Verkrijg `siteReference` voor meter driver
   - Verkrijg `EAN` nummers

2. **`SmartBatteries`** → Verkrijg alle battery ID's
   - Voor elk battery:
     - `SmartBattery(deviceId)` → Settings voor trading mode
     - `SmartBatterySummary(deviceId)` → Initial status

3. **`SmartPvSystems`** (optioneel) → Voor PV driver
   - Voor elk PV system:
     - `SmartPvSystemSummary(deviceId)` → Initial status

**Code voorbeeld**:
```typescript
// Parallel fetching voor efficiency
const [userInfo, batteries, pvSystems] = await Promise.all([
  client.login(email, password),  // Retourneert Me data
  client.getSmartBatteries(),
  client.getSmartPvSystems()
]);

// Per battery: settings + summary parallel
const batteryData = await Promise.all(
  batteries.map(async (battery) => {
    const [details, summary] = await Promise.all([
      client.getSmartBattery(battery.id),
      client.getSmartBatterySummary(battery.id)
    ]);
    return { battery, details, summary };
  })
);
```

---

### Reguliere Polling Flow (Elke X minuten)

**Hoogfrequent (bijv. elke 5 minuten)**:

1. **Per battery**: `SmartBatterySummary(deviceId)`
   - Real-time laadniveau
   - Status (charging/discharging/idle)
   - Lifetime total

**Middelfrequent (bijv. elke 30 minuten)**:

1. **Per battery**: `SmartBatterySessions(today, today)`
   - Vandaag resultaten
   - EPEX/Trading/Imbalance uitsplitsing
   - Frank Slim bonus

2. **Meter driver**: `MarketPrices(siteReference, today)`
   - Huidige marktprijzen
   - Prijzen voor vandaag

**Laagfrequent (bijv. 1x per dag)**:

1. **Meter driver**: `PeriodUsageAndCosts(siteReference, currentMonth)`
   - Maand verbruik
   - Gas/elektriciteit/feed-in

2. **Meter driver**: `MonthSummary(siteReference)`
   - Expected vs actual costs

**Code voorbeeld**:
```typescript
// High frequency (5 min)
async function pollRealtime() {
  const summaries = await Promise.all(
    batteries.map(b => client.getSmartBatterySummary(b.id))
  );
  updateCapabilities(summaries);
}

// Medium frequency (30 min)
async function pollSessions() {
  const today = new Date();
  const sessions = await Promise.all(
    batteries.map(b =>
      client.getSmartBatterySessions(b.id, today, today)
    )
  );
  updateTradingResults(sessions);
}

// Low frequency (1x per day)
async function pollMonthly() {
  const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [usage, summary] = await Promise.all([
    client.getPeriodUsageAndCosts(siteReference, month),
    client.getMonthSummary(siteReference)
  ]);
  updateMonthlyStats(usage, summary);
}
```

---

### Geavanceerde Features (Op aanvraag)

**Gedetailleerde analyse**:
- `SmartBatterySession(deviceId, date)` → 15-minuten detail voor specifieke dag
- Gebruik voor debugging, visualisaties, of advanced flow cards

**Settings management**:
- `smartBatterySettings(deviceId)` → Uitgebreide instellingen met opties
- Gebruik voor settings UI in device configuratie

**PV monitoring**:
- `SmartPvSystemSummary(deviceId)` → PV status en bonus
- Poll frequentie afhankelijk van PV production

---

## Performance Optimalisatie Tips

### 1. Parallel Fetching
Gebruik `Promise.all()` voor onafhankelijke queries:

```typescript
// ✅ GOED: Parallel (3 seconden)
const [batteries, pvSystems, prices] = await Promise.all([
  client.getSmartBatteries(),
  client.getSmartPvSystems(),
  client.getMarketPrices(siteRef, date)
]);

// ❌ SLECHT: Sequentieel (9 seconden)
const batteries = await client.getSmartBatteries();
const pvSystems = await client.getSmartPvSystems();
const prices = await client.getMarketPrices(siteRef, date);
```

### 2. Caching Strategy
Cache resultaten die niet frequent wijzigen:

```typescript
// Cache statische data (1 dag)
const STATIC_CACHE_TTL = 24 * 60 * 60 * 1000;
- SmartBatteries (brand, capacity, provider)
- SmartPvSystems (brand, capacity)

// Cache semi-statische data (1 uur)
const SEMI_STATIC_CACHE_TTL = 60 * 60 * 1000;
- smartBatterySettings (options change infrequent)
- MarketPrices (prijzen per dag)

// No cache (real-time)
- SmartBatterySummary (laadniveau elke 5 min)
- SmartBatterySessions (resultaten elke 30 min)
```

### 3. Conditional Polling
Poll alleen wanneer nodig:

```typescript
// Poll alleen tijdens actieve uren
const currentHour = new Date().getHours();
const isActiveHour = currentHour >= 6 && currentHour <= 23;

if (isActiveHour) {
  await pollRealtime();
} else {
  // Minder frequent 's nachts
  await sleep(15 * 60 * 1000); // 15 min
}
```

### 4. Error Handling & Retry
Implement exponential backoff voor API errors:

```typescript
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await sleep(delay);
    }
  }
}
```

---

## Datum Formaten

| Query | Parameter | Formaat | Voorbeeld |
|-------|-----------|---------|-----------|
| SmartBatterySessions | startDate, endDate | YYYY-MM-DD | "2025-10-27" |
| SmartBatterySession | date | YYYY-MM-DD | "2025-10-27" |
| MarketPrices | date | YYYY-MM-DD | "2025-10-27" |
| PeriodUsageAndCosts | date | YYYY-MM | "2025-10" |
| MonthSummary | - | Auto (huidige maand) | - |

**Timezone**: Alle timestamps in ISO 8601 UTC formaat
- Voorbeeld: `"2025-10-15T21:15:00.000Z"`
- Conversie naar lokale tijd: Amsterdam (Europe/Amsterdam, UTC+1/UTC+2)

---

## Samenvatting

**Query Hiërarchie**:
1. **Me** is het startpunt voor alle queries
2. **Devices** (batteries, PV) worden opgehaald via lijst queries
3. **Details** worden opgehaald via device ID's
4. **Energie data** gebruikt `siteReference` afgeleid van connections / cluster rechtstreeks

**Best Practices**:
- ✅ Gebruik parallelle queries waar mogelijk
- ✅ Cache statische data
- ✅ Poll real-time data frequent, historische data minder frequent
- ✅ Implement error handling met retry logic
- ✅ Respect API rate limits

**Belangrijkste Relaties**:
- `SmartBatteries[].id` → Alle battery detail queries
- `SmartPvSystems[].id` → PV detail queries
- `Me.connections` → `siteReference` → Energie & kosten queries
- `Me.connections[].EAN` ↔ `SmartPvSystems[].connectionEAN`

---

**Document versie**: 1.0
**Laatste update**: 27 oktober 2025
**Auteur**: Claude Code (Anthropic)

# GraphQL Queries Overzicht

Dit document geeft een overzicht van alle beschikbare GraphQL queries in de FrankEnergieClient en welke sensoren/capabilities daaruit afgeleid kunnen worden per driver.

## Referentie: lib/frank-energie-client.ts

Alle queries zijn geïmplementeerd in `lib/frank-energie-client.ts`.

---

## 1. Battery Driver Queries

### 1.1 `getSmartBatteries()`
**Retourneert**: `SmartBattery[]`

**Beschikbare data**:
- `id`: Battery ID
- `brand`: Merk (bijv. "Sessy")
- `provider`: Provider naam
- `capacity`: Capaciteit in kWh
- `maxChargePower`: Max laadvermogen in kW
- `maxDischargePower`: Max ontlaadvermogen in kW
- `createdAt`, `updatedAt`: Timestamps
- `externalReference`: Externe referentie

**Huidige capabilities**: Gebruikt voor device discovery.

**Mogelijke nieuwe capabilities**:
- `battery_capacity` - Batterij capaciteit (kWh)
- `max_charge_power` - Max laadvermogen (kW)
- `max_discharge_power` - Max ontlaadvermogen (kW)

---

### 1.2 `getSmartBatterySessions(deviceId, startDate, endDate)`
**Retourneert**: `SmartBatterySessionData`

**Beschikbare data** (see `lib/frank-energie-client.ts:543`):
```typescript
{
  sessions: BatterySession[];
  periodTradingResult: number;
  periodFrankSlim: number;
  periodEpexResult: number;
  periodImbalanceResult: number;
  periodTotalResult: number;
  periodTradeIndex: number | null;
  totalTradingResult: number;
}
```

**Huidige capabilities**:
- `frank_energie_trading_result`
- `frank_energie_lifetime_total`
- `frank_energie_frank_slim_bonus`
- `frank_energie_epex_result`
- `frank_energie_imbalance_result`

---

### 1.3 `getSmartBatterySummary(deviceId)`
**Retourneert**: `SmartBatterySummary`

**Beschikbare data**:
- `lastKnownStateOfCharge`: Laadniveau (0-100%)
- `lastKnownStatus`: Status (bijv. "charging", "discharging", "idle")
- `lastUpdate`: Laatste update timestamp
- `totalResult`: Totale opbrengst (€)

**Huidige capabilities**:
- Niet direct gemapt. De actuele app richt zich op trading-resultaten i.p.v. individuele SoC.

**Mogelijke toekomstige capabilities**:
- `battery_status` - Status (charging/discharging/idle)
- `frank_energie_battery_charge` - Aggregated SoC (indien opnieuw geïntroduceerd)
- `last_battery_update` - Timestamp laatste update

---

### 1.4 `getSmartBatterySettings(deviceId)`
**Retourneert**: `DetailedBatterySettings`

**Beschikbare data**:
```typescript
{
  batteryMode: SettingField<string>;              // "TRADING_MODE" / "SELF_CONSUMPTION_PLUS"
  imbalanceTradingStrategy: SettingField<string>; // "AGGRESSIVE" / "MODERATE" / "PASSIVE"
  selfConsumptionTradingAllowed: { current: boolean, discountAmount?: number };
  selfConsumptionTradingThresholdPrice: SettingField<number>;
  lockedForUpdatesTill?: string;
}
```

**Huidige capabilities**:
- `frank_energie_battery_mode` - Batterij modus

**Mogelijke nieuwe capabilities**:
- `trading_strategy` - Onbalans strategie (aggressive/moderate/passive)
- `self_consumption_allowed` - Zelfverbruik toegestaan (boolean)
- `self_consumption_threshold` - Zelfverbruik drempelprijs (€/kWh)
- `frank_slim_discount` - Frank Slim korting (€)
- `settings_locked_until` - Settings vergrendeld tot (timestamp)

---

## 2. PV (Zonnepanelen) Driver Queries

### 2.1 `getSmartPvSystems()`
**Retourneert**: `SmartPvSystem[]`

**Beschikbare data**:
- `id`: PV systeem ID
- `displayName`: Weergave naam
- `brand`: Merk (bijv. "SolarEdge")
- `capacity`: Capaciteit in kWp
- `maxPower`: Max vermogen in kW
- `provider`: Provider naam
- `createdAt`, `updatedAt`: Timestamps

**Huidige capabilities**: Gebruikt voor device discovery.

**Mogelijke nieuwe capabilities**:
- `pv_capacity` - PV capaciteit (kWp)
- `pv_max_power` - Max vermogen (kW)

---

### 2.2 `getSmartPvSystemSummary(deviceId)`
**Retourneert**: `SmartPvSystemSummary`

**Beschikbare data**:
- `operationalStatus`
- `operationalStatusTimestamp`
- `steeringStatus`
- `totalBonus`

**Huidige capabilities**:
- `frank_energie_pv_status` (derived from `operationalStatus`)
- `frank_energie_pv_bonus` (mapped to `totalBonus`)

**Nog niet beschikbaar uit GraphQL**:
- Live power en dagopwek (de API retourneert ze nog niet, daarom blijven `frank_energie_pv_current_power` en `frank_energie_pv_today_generation` placeholderwaarden totdat Frank Energie de data ontsluit).

---

### 2.3 `getUserSmartFeedIn()`
**Retourneert**: `UserSmartFeedInStatus`

**Beschikbare data**:
- `status`: Smart Feed-In status (bijv. "ACTIVE", "INACTIVE")
- `expectedBonus`: Verwachte bonus (€)
- `actualBonus`: Daadwerkelijke bonus (€)

**Huidige capabilities**: Niet gebruikt.

**Mogelijke nieuwe capabilities**:
- `smart_feedin_status` - Smart Feed-In status
- `expected_feedin_bonus` - Verwachte bonus (€)
- `actual_feedin_bonus` - Werkelijke bonus (€)

---

### 2.4 `getSmartFeedInSessions(startDate, endDate)`
**Retourneert**: `SmartFeedInSessionData`

**Beschikbare data**:
```typescript
{
  sessions: SmartFeedInSession[];
  periodBonus: number;       // Bonus in periode (€)
  totalBonus: number;        // Totale bonus (€)
}
```

**Mogelijke nieuwe capabilities**:
- `feedin_bonus_today` - Feed-in bonus vandaag (€)
- `feedin_bonus_total` - Totale feed-in bonus (€)

---

## 3. EV Charger Driver Queries

### 3.1 `getUserSmartCharging()`
**Retourneert**: `UserSmartChargingStatus`

**Beschikbare data**:
- `status`: Smart Charging status (bijv. "ACTIVE", "INACTIVE")
- `provider`: Provider (bijv. "Enode")
- `chargingMode`: Laadmodus
- `chargeLimit`: Laadlimiet (A)

**Huidige capabilities**: Niet volledig gebruikt.

**Mogelijke nieuwe capabilities**:
- `smart_charging_status` - Smart Charging status
- `charging_mode` - Laadmodus
- `charge_limit_amps` - Laadlimiet in ampère (A)

---

### 3.2 `getEnodeSessions(dateFilter)`
**Retourneert**: `EnodeSessionData`

**Beschikbare data**:
```typescript
{
  rows: EnodeSession[];
  totalBonus: number;         // Totale bonus (€)
  periodBonus: number;        // Bonus in periode (€)
}
```

**Per sessie**:
- `id`: Sessie ID
- `startedAt`: Start tijd
- `endedAt`: Eind tijd
- `energyDelivered`: Energie geleverd (kWh)
- `bonus`: Bonus (€)
- `status`: Status
- `averagePower`: Gemiddeld vermogen (kW)

**Huidige capabilities**:
- `frank_energie_ev_charging_status` - Laadstatus
- `frank_energie_ev_bonus` - Bonus

**Mogelijke nieuwe capabilities**:
- `session_energy_delivered` - Energie geleverd deze sessie (kWh)
- `session_average_power` - Gemiddeld vermogen (kW)
- `session_start_time` - Start tijd laadsessie
- `session_end_time` - Eind tijd laadsessie
- `ev_bonus_today` - EV bonus vandaag (€)
- `ev_bonus_total` - Totale EV bonus (€)

---

## 4. Meter (Site) Driver Queries

### 4.1 `getMarketPrices(siteReference, date)`
**Retourneert**: `MarketPricesData`

**Beschikbare data**:
- `marketPrices`: Array van prijzen per uur
  - `from`: Vanaf tijd
  - `till`: Tot tijd
  - `marketPrice`: Marktprijs (€/kWh)
  - `marketPriceTax`: Marktprijs incl. belasting (€/kWh)
  - `sourcingMarkupPrice`: Sourcing markup (€/kWh)
  - `energyTaxPrice`: Energiebelasting (€/kWh)

**Mogelijke capabilities**:
- `current_market_price` - Huidige marktprijs (€/kWh)
- `current_market_price_tax` - Huidige marktprijs incl. BTW (€/kWh)
- `next_hour_market_price` - Marktprijs volgend uur (€/kWh)
- `avg_market_price_today` - Gemiddelde marktprijs vandaag (€/kWh)
- `min_market_price_today` - Laagste marktprijs vandaag (€/kWh)
- `max_market_price_today` - Hoogste marktprijs vandaag (€/kWh)

---

### 4.2 `getWeightedAveragePrices(siteReference, date)`
**Retourneert**: `WeightedAveragePricesData`

**Beschikbare data**:
- `weightedAveragePrices`: Array van gewogen prijzen
  - `from`: Vanaf tijd
  - `till`: Tot tijd
  - `weightedAveragePrice`: Gewogen gemiddelde prijs (€/kWh)

**Mogelijke capabilities**:
- `weighted_avg_price_today` - Gewogen gem. prijs vandaag (€/kWh)

---

### 4.3 `getMonthSummary(siteReference)`
**Retourneert**: `MonthSummaryData`

**Beschikbare data**:
```typescript
{
  costs: number;              // Kosten deze maand (€)
  usage: number;              // Verbruik deze maand (kWh)
  expectedCosts: number;      // Verwachte kosten (€)
  expectedUsage: number;      // Verwacht verbruik (kWh)
}
```

**Huidige capabilities**:
- `frank_energie_site_costs` - Kosten
- `frank_energie_site_usage` - Verbruik

**Mogelijke nieuwe capabilities**:
- `month_costs_actual` - Daadwerkelijke kosten deze maand (€)
- `month_usage_actual` - Daadwerkelijk verbruik deze maand (kWh)
- `month_costs_expected` - Verwachte kosten deze maand (€)
- `month_usage_expected` - Verwacht verbruik deze maand (kWh)

---

### 4.4 `getMonthInsights(siteReference, date)`
**Retourneert**: `MonthInsightsData`

**Beschikbare data**:
- `insights`: Array van dagelijkse insights
  - `date`: Datum
  - `costs`: Kosten (€)
  - `usage`: Verbruik (kWh)
  - `averagePrice`: Gemiddelde prijs (€/kWh)

**Mogelijke capabilities**:
- `avg_daily_costs` - Gemiddelde dagkosten (€)
- `avg_daily_usage` - Gemiddeld dagverbruik (kWh)
- `avg_price_month` - Gemiddelde prijs deze maand (€/kWh)

---

### 4.5 `getPeriodUsageAndCosts(siteReference, date)`
**Retourneert**: `PeriodUsageAndCostsData`

**Beschikbare data**:
```typescript
{
  consumptionData: Array<{
    from: string;
    till: string;
    consumption: number;      // Verbruik (kWh)
    costs: number;            // Kosten (€)
  }>;
  totalConsumption: number;   // Totaal verbruik (kWh)
  totalCosts: number;         // Totale kosten (€)
}
```

**Mogelijke capabilities**:
- `today_consumption` - Verbruik vandaag (kWh)
- `today_costs` - Kosten vandaag (€)
- `current_hour_consumption` - Verbruik huidig uur (kWh)
- `current_hour_costs` - Kosten huidig uur (€)

---

### 4.6 `getCostsDelta(siteReference, date)`
**Retourneert**: `CostsDeltaData`

**Beschikbare data**:
```typescript
{
  delta: number;              // Verschil t.o.v. vorige periode (€)
  percentage: number;         // Percentage verschil (%)
  period: string;             // Periode (bijv. "week", "month")
}
```

**Mogelijke capabilities**:
- `costs_delta_week` - Kostenverschil t.o.v. vorige week (€)
- `costs_delta_percentage` - Kostenverschil percentage (%)

---

## 5. Query Prioritering per Driver

### Battery Driver (Prioriteit HOOG)
1. ✅ `getSmartBatterySessions()` - Al gebruikt voor dagresultaat
2. ✅ `getSmartBatterySummary()` - Al gebruikt voor laadniveau
3. ✅ `getSmartBatterySettings()` - Al gebruikt voor batterij modus
4. 🆕 **Toe te voegen**: Frank Slim bonus, EPEX, trading, imbalance uitsplitsing

### PV Driver (Prioriteit GEMIDDELD)
1. ✅ `getSmartPvSystemSummary()` - Al gebruikt voor status
2. 🆕 **Toe te voegen**: `currentPower`, `todayGeneration`
3. 🆕 **Overweeg**: `getSmartFeedInSessions()` voor feed-in bonus tracking

### EV Driver (Prioriteit GEMIDDELD)
1. ✅ `getEnodeSessions()` - Al gebruikt voor bonus
2. 🆕 **Toe te voegen**: Sessie details (energie, vermogen, tijden)
3. 🆕 **Overweeg**: `getUserSmartCharging()` voor status/modus

### Meter Driver (Prioriteit HOOG)
1. ✅ `getMonthSummary()` - Al gebruikt voor maandkosten/verbruik
2. 🆕 **Toe te voegen**: `getMarketPrices()` voor realtime prijzen
3. 🆕 **Toe te voegen**: `getPeriodUsageAndCosts()` voor dagverbruik
4. 🆕 **Overweeg**: `getMonthInsights()` voor trends

---

## Aanbevelingen

### Hoogste Prioriteit (Direct Implementeren)
1. **Battery**: Frank Slim bonus capability (`frank_slim_bonus`)
2. **Battery**: EPEX/Trading/Imbalance uitsplitsing
3. **Meter**: Huidige marktprijs (`current_market_price`)
4. **Meter**: Verbruik/kosten vandaag (`today_consumption`, `today_costs`)

### Gemiddelde Prioriteit
1. **PV**: Huidig vermogen (`current_power`)
2. **PV**: Opwek vandaag (`today_generation`)
3. **EV**: Sessie energie/vermogen details
4. **Meter**: Marktprijs trends (min/max/avg)

### Lage Prioriteit (Nice-to-have)
1. **Battery**: Batterij capaciteit/max power (statisch)
2. **PV**: Feed-in bonus tracking
3. **Meter**: Kostendelta's en trends
4. **Alle**: Lifetime totalen

---

## Volgende Stappen

1. Bepaal welke capabilities het meest waardevol zijn voor gebruikers
2. Update driver compose files met nieuwe capabilities
3. Implementeer polling logic in device classes
4. Test met echte Frank Energie data
5. Update flow cards om nieuwe capabilities te ondersteunen

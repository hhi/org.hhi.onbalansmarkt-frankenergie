# Device Lifecycle & Architecture

Uitgebreide documentatie over de werking van de Frank Energie Homey app, met focus op de SmartBatteryDevice lifecycle.

## Inhoudsopgave

1. [Overzicht](#overzicht)
2. [Fase 1: Pairing](#fase-1-pairing-gebruiker-voegt-device-toe)
3. [Fase 2: Device Initialisatie](#fase-2-device-initialisatie-oninit)
4. [Fase 3: Data Polling](#fase-3-data-polling-elke-x-minuten)
5. [Fase 4: Settings Wijzigingen](#fase-4-settings-wijzigingen)
6. [Architectuur Diagram](#architectuur-diagram)

---

## Overzicht

De Frank Energie Homey app volgt een gelaagde architectuur met duidelijke scheiding tussen concerns:

- **App Layer** (`app.ts`): App-level credential management
- **Driver Layer** (`driver.ts`): Device pairing en creatie
- **Device Layer** (`device.ts`): Device logica en data management
- **Base Layer** (`frank-energie-device-base.ts`): Gedeelde functionaliteit
- **Library Layer** (`lib/`): API clients en services

---

## Fase 1: Pairing (Gebruiker voegt device toe)

### 1.1 Pairing Start

**Flow**: `drivers/frank-energie-battery/pair/login.html`

```
Gebruiker → Homey App → "Device toevoegen" → Frank Energie Battery Driver
```

**Gebruiker invoer**:
- Frank Energie email + wachtwoord
- Onbalansmarkt.com API key (optioneel)

**Code**: [driver.ts:19-48](../drivers/frank-energie-battery/driver.ts#L19-L48)

### 1.2 Credential Verificatie

**Handler**: `verify_credentials`

```typescript
session.setHandler('verify_credentials', async (data: { email: string; password: string }) => {
  // 1. Maak FrankEnergieClient aan
  const client = new FrankEnergieClient({
    logger: (msg, ...args) => this.log(msg, ...args),
  });

  // 2. Login bij Frank Energie GraphQL API
  await client.login(data.email, data.password);

  // 3. Haal alle batterijen op van account
  const batteries = await client.getSmartBatteries();

  if (batteries.length === 0) {
    throw new Error('No smart batteries found on this Frank Energie account');
  }

  // 4. Return battery informatie naar pairing UI
  return {
    batteryCount: batteries.length,
    batteries: batteries.map((b) => ({
      id: b.id,
      name: b.externalReference || `Battery ${b.id.slice(0, 8)}`,
    })),
  };
});
```

**Code**: [driver.ts:21-48](../drivers/frank-energie-battery/driver.ts#L21-L48)

### 1.3 Device Creatie

**Handler**: `list_devices`

```typescript
session.setHandler('list_devices', async (data) => {
  // 1. Sla credentials op app-niveau op (gedeeld tussen alle devices)
  this.homey.app.setCredentials(data.email, data.password);
  this.log('Stored Frank Energie credentials at app level');

  // 2. Bepaal device naam
  const deviceName = data.batteryCount && data.batteryCount > 1
    ? `Frank Energie Batteries (${data.batteryCount})`
    : 'Frank Energie Battery';

  // 3. Creëer device configuratie
  return [
    {
      name: deviceName,
      data: {
        id: 'frank-energie-batteries',
        type: 'smart-battery-aggregator',
      },
      settings: {
        // Device-level credentials (backwards compatibility)
        frank_energie_email: data.email,
        frank_energie_password: data.password,
        onbalansmarkt_api_key: apiKey,
        poll_interval: 15,              // Default: 15 minuten
        send_measurements: false,       // Default: UIT (privacy)
      },
    },
  ];
});
```

**Belangrijke concepten**:
- **App-level credentials**: Eén keer opslaan, delen tussen alle devices
- **Device-level credentials**: Backwards compatibility fallback
- **Aggregator pattern**: Één device beheert meerdere batterijen

**Code**: [driver.ts:51-84](../drivers/frank-energie-battery/driver.ts#L51-L84)

---

## Fase 2: Device Initialisatie (onInit)

### 2.1 Base Class Initialisatie

**Inheritance Chain**:
```
SmartBatteryDevice extends FrankEnergieDeviceBase extends Homey.Device
```

**Initialisatie Flow**:
```typescript
async onInit() {
  this.log('SmartBatteryDevice initializing...');

  try {
    await this.initializeClients();              // API clients opzetten
    await this.setupCommonFlowCards();           // Gemeenschappelijke flow cards
    await this.setupDeviceSpecificFlowCards();   // Battery-specifieke flow cards
    await this.setupPolling();                   // Automatische data polling

    this.log('SmartBatteryDevice initialized successfully');
  } catch (error) {
    this.error('Failed to initialize device:', error);
    await this.setUnavailable(`Initialization failed: ${error.message}`);
  }
}
```

**Code**: [frank-energie-device-base.ts:34-48](../lib/frank-energie-device-base.ts#L34-L48)

### 2.2 Client Initialisatie

#### Stap 2.2.1: Credentials Ophalen

**Preferentie**: App-level credentials → Device-level credentials (fallback)

```typescript
// Probeer eerst app-level credentials (nieuw systeem)
const appCredentials = this.homey.app.getCredentials();

let frankEmail: string;
let frankPassword: string;

if (appCredentials && appCredentials.email && appCredentials.password) {
  // Use app-level credentials (preferred)
  frankEmail = appCredentials.email;
  frankPassword = appCredentials.password;
  this.log('Using app-level Frank Energie credentials');
} else {
  // Fall back to device-level credentials (backwards compatibility)
  frankEmail = this.getSetting('frank_energie_email');
  frankPassword = this.getSetting('frank_energie_password');
  this.log('Using device-level Frank Energie credentials (legacy)');
}

// Validate credentials exist
if (!frankEmail?.trim() || !frankPassword?.trim()) {
  throw new Error('Frank Energie credentials not configured');
}
```

**Code**: [frank-energie-device-base.ts:56-82](../lib/frank-energie-device-base.ts#L56-L82)

#### Stap 2.2.2: Frank Energie Client

```typescript
// Initialize and test Frank Energie client
this.frankEnergieClient = new FrankEnergieClient({
  logger: (msg, ...args) => this.log(msg, ...args),
});

try {
  await this.frankEnergieClient.login(frankEmail, frankPassword);
  this.log('Successfully authenticated with Frank Energie');
} catch (error) {
  throw new Error(`Frank Energie authentication failed: ${error.message}`);
}
```

**Functionaliteit**:
- GraphQL API communicatie met Frank Energie
- Authenticatie met email/password
- Data ophalen: batteries, PV systems, EV chargers, meter data

**Code**: [frank-energie-device-base.ts:84-95](../lib/frank-energie-device-base.ts#L84-L95)

#### Stap 2.2.3: Onbalansmarkt Client (Optioneel)

```typescript
// Initialize Onbalansmarkt client if API key is configured
const onbalansmarktApiKey = this.getSetting('onbalansmarkt_api_key');

if (onbalansmarktApiKey?.trim()) {
  this.onbalansmarktClient = new OnbalansmarktClient({
    apiKey: onbalansmarktApiKey,
    logger: (msg, ...args) => this.log(msg, ...args),
  });
  this.log('Onbalansmarkt client initialized');
} else {
  this.onbalansmarktClient = undefined;
  this.log('Onbalansmarkt API key not configured - rankings will not be updated');
}
```

**Functionaliteit**:
- REST API communicatie met Onbalansmarkt.com
- Versturen van metingen (trading results)
- Ophalen van rankings (overall + provider-specific)

**Code**: [frank-energie-device-base.ts:97-115](../lib/frank-energie-device-base.ts#L97-L115)

#### Stap 2.2.4: Device-Specific Clients

**Battery Aggregator**:
```typescript
this.batteryAggregator = new BatteryAggregator({
  frankEnergieClient: this.frankEnergieClient,
  logger: (msg, ...args) => this.log(msg, ...args),
});
```

**Functionaliteit**: Combineert trading results van alle batterijen op het account

**Batterijen Ophalen**:
```typescript
this.batteries = await this.frankEnergieClient.getSmartBatteries();
this.log(`Found ${this.batteries.length} smart batteries`);

if (this.batteries.length === 0) {
  throw new Error('No smart batteries found on Frank Energie account');
}
```

**External Battery Metrics Store**:
```typescript
this.externalBatteryMetrics = new BatteryMetricsStore({
  device: this,
  logger: (msg, ...args) => this.log(msg, ...args),
});
this.log('External battery metrics store initialized');
```

**Functionaliteit**: Beheert metrics van externe batterijen (via receive_battery_metrics flow action)

**Code**: [device.ts:42-67](../drivers/frank-energie-battery/device.ts#L42-L67)

### 2.3 Flow Cards Setup

#### Battery-Specific Triggers (11 total)

```typescript
// Daily results available
this.homey.flow.getTriggerCard('daily_results_available')
  .registerRunListener(this.onDailyResultsAvailable.bind(this));

// Result positive/negative
this.homey.flow.getTriggerCard('result_positive_negative')
  .registerRunListener(this.onResultPositiveNegative.bind(this));

// Milestone reached (€50, €100, €250, etc)
this.homey.flow.getTriggerCard('milestone_reached')
  .registerRunListener(this.onMilestoneReached.bind(this));

// Top performer alert
this.homey.flow.getTriggerCard('top_performer_alert')
  .registerRunListener(this.onTopPerformerAlert.bind(this));

// Trading mode changed
this.homey.flow.getTriggerCard('trading_mode_changed')
  .registerRunListener(this.onTradingModeChanged.bind(this));

// Frank Slim bonus detected
this.homey.flow.getTriggerCard('frank_slim_bonus_detected')
  .registerRunListener(this.onFrankSlimBonusDetected.bind(this));

// New battery added
this.homey.flow.getTriggerCard('new_battery_added')
  .registerRunListener(this.onNewBatteryAdded.bind(this));

// External battery metrics updated
this.homey.flow.getTriggerCard('external_battery_metrics_updated')
  .registerRunListener(this.onExternalBatteryMetricsUpdated.bind(this));

// + 3 common triggers: ranking_improved, ranking_declined, measurement_sent
```

#### Battery-Specific Conditions (4 total)

```typescript
// Result is positive
this.homey.flow.getConditionCard('result_positive')
  .registerRunListener(this.condResultPositive.bind(this));

// Result exceeds threshold
this.homey.flow.getConditionCard('result_exceeds_threshold')
  .registerRunListener(this.condResultExceedsThreshold.bind(this));

// Trading mode matches
this.homey.flow.getConditionCard('trading_mode_matches')
  .registerRunListener(this.condTradingModeMatches.bind(this));

// Frank Slim active
this.homey.flow.getConditionCard('frank_slim_active')
  .registerRunListener(this.condFrankSlimActive.bind(this));

// + 2 common conditions: rank_in_top_x, provider_rank_better
```

#### Battery-Specific Actions (7 total)

```typescript
// Send notification
this.homey.flow.getActionCard('send_notification')
  .registerRunListener(this.actionSendNotification.bind(this));

// Send rich notification
this.homey.flow.getActionCard('send_rich_notification')
  .registerRunListener(this.actionSendRichNotification.bind(this));

// Toggle measurement sending
this.homey.flow.getActionCard('toggle_measurement_sending')
  .registerRunListener(this.actionToggleMeasurementSending.bind(this));

// Update dashboard
this.homey.flow.getActionCard('update_dashboard')
  .registerRunListener(this.actionUpdateDashboard.bind(this));

// Log to timeline
this.homey.flow.getActionCard('log_to_timeline')
  .registerRunListener(this.actionLogToTimeline.bind(this));

// Force data poll
this.homey.flow.getActionCard('force_data_poll')
  .registerRunListener(this.actionForceDataPoll.bind(this));

// Receive battery metrics
this.homey.flow.getActionCard('receive_battery_metrics')
  .registerRunListener(this.actionReceiveBatteryMetrics.bind(this));
```

**Total**: 22 flow cards (11 triggers + 6 conditions + 7 actions) voor battery driver

**Code**: [device.ts:72-120](../drivers/frank-energie-battery/device.ts#L72-L120)

### 2.4 Polling Setup

**Poll Interval Configuration**:
```typescript
// Get poll interval from settings (default: 15 minutes)
const pollIntervalMinutes = this.validatePollInterval(
  this.getSetting('poll_interval')
);

this.log(`Setting up polling with interval: ${pollIntervalMinutes} minutes`);

// Start polling timer
this.pollInterval = this.homey.setInterval(
  async () => {
    try {
      await this.pollData();
    } catch (error) {
      this.error('Polling error:', error);
    }
  },
  pollIntervalMinutes * 60 * 1000  // Convert minutes to milliseconds
);

// Eerste data poll direct uitvoeren
await this.pollData();
```

**Validatie**:
- Poll interval moet tussen 1-60 minuten liggen
- Dropdown settings: 15, 30, 45, 60 minuten
- Fallback naar 5 minuten bij ongeldige waarde

**Code**: [frank-energie-device-base.ts:190-210](../lib/frank-energie-device-base.ts#L190-L210)

---

## Fase 3: Data Polling (Elke X minuten)

### 3.1 Poll Cyclus

**Automatisch elke X minuten** (volgens `poll_interval` setting):

```typescript
async pollData() {
  try {
    // 1. Haal trading resultaten op van Frank Energie
    const today = new Date().toISOString().split('T')[0];
    const results = await this.batteryAggregator.getAggregatedResults(
      today,
      today
    );

    // 2. Bepaal trading mode
    const battery = this.batteries[0]; // Use first battery for mode detection
    const batteryDetails = await this.frankEnergieClient.getSmartBattery(battery.id);
    const tradingModeInfo = TradingModeDetector.detectTradingMode(batteryDetails.settings);

    // 3. Update alle capabilities
    await this.updateCapabilities(results, tradingModeInfo);

    // 4. Rankings updaten (als Onbalansmarkt API key ingesteld)
    if (this.onbalansmarktClient) {
      await this.updateRankings();
    }

    // 5. Stuur measurement naar Onbalansmarkt.com (als enabled)
    const sendMeasurements = this.getSetting('send_measurements') as boolean;
    if (sendMeasurements && results.periodTradingResult !== 0) {
      await this.sendMeasurement(results, tradingModeInfo.mode);
    }

    // 6. Check en trigger flow cards
    await this.checkAndTriggerFlows(results, tradingModeInfo);

    this.log('Poll completed successfully');
  } catch (error) {
    this.error('Poll data failed:', error);
    // Device blijft beschikbaar, volgende poll probeert opnieuw
  }
}
```

**Code**: [device.ts:125-168](../drivers/frank-energie-battery/device.ts#L125-L168)

### 3.2 Update Capabilities

**16 capabilities worden bijgewerkt**:

#### Battery State Capabilities
```typescript
// Charging state: 'charging' | 'discharging' | 'idle'
await this.setCapabilityValue('battery_charging_state', chargingState);

// Battery charge percentage
await this.setCapabilityValue('frank_energie_battery_charge', batteryCharge);

// Battery trading mode
await this.setCapabilityValue('frank_energie_battery_mode', tradingMode);
```

#### Trading Results Capabilities
```typescript
// Total trading result today
await this.setCapabilityValue('frank_energie_trading_result', results.periodTradingResult);

// Frank Slim bonus
await this.setCapabilityValue('frank_energie_frank_slim_bonus', results.periodFrankSlim);

// EPEX result
await this.setCapabilityValue('frank_energie_epex_result', results.periodEpexResult);

// Trading result split
await this.setCapabilityValue('frank_energie_trading_result_split', results.periodTradingResult);

// Imbalance result
await this.setCapabilityValue('frank_energie_imbalance_result', results.periodImbalanceResult);
```

#### Ranking Capabilities (optioneel)
```typescript
if (this.onbalansmarktClient) {
  const profile = await this.onbalansmarktClient.getProfile();

  // Overall ranking position
  await this.setCapabilityValue('frank_energie_overall_rank',
    profile.resultToday?.overallRank || null);

  // Provider-specific ranking position
  await this.setCapabilityValue('frank_energie_provider_rank',
    profile.resultToday?.providerRank || null);
}
```

#### External Battery Capabilities (optioneel)
```typescript
if (this.externalBatteryMetrics) {
  const metrics = this.externalBatteryMetrics.getAggregatedMetrics();

  // Number of external batteries
  await this.setCapabilityValue('external_battery_count', metrics.count);

  // Average charge percentage
  await this.setCapabilityValue('external_battery_percentage', metrics.avgPercentage);

  // Total charged today (kWh)
  await this.setCapabilityValue('external_battery_daily_charged', metrics.totalCharged);

  // Total discharged today (kWh)
  await this.setCapabilityValue('external_battery_daily_discharged', metrics.totalDischarged);
}
```

**Concurrency**: Alle capability updates worden parallel uitgevoerd met `Promise.allSettled()` om partial failures te voorkomen.

**Code**: [device.ts:173-240](../drivers/frank-energie-battery/device.ts#L173-L240)

### 3.3 Send Measurement (Optioneel)

**Voorwaarden**:
- `send_measurements` setting = `true`
- `results.periodTradingResult` ≠ 0 (geen nutteloze 0-metingen versturen)
- `onbalansmarkt_api_key` is ingesteld

**Upload Flow**:
```typescript
async sendMeasurement(results: AggregatedResults, mode: TradingMode): Promise<void> {
  if (!this.onbalansmarktClient) {
    return; // No API key configured
  }

  try {
    const batteryCharge = await this.getStoreValue('lastBatteryCharge') as number || 0;
    const uploadTimestamp = new Date();

    // Send measurement to Onbalansmarkt.com API
    await this.onbalansmarktClient.sendMeasurement({
      timestamp: uploadTimestamp,
      batteryResult: results.periodTradingResult,        // Today's result (€)
      batteryResultTotal: results.totalTradingResult,    // Lifetime total (€)
      batteryResultEpex: results.periodEpexResult,       // EPEX component (€)
      batteryResultImbalance: results.periodImbalanceResult, // Imbalance component (€)
      batteryResultCustom: results.periodFrankSlim,      // Frank Slim bonus (€)
      mode,                                               // Trading mode
    });

    // Update last upload timestamp capability
    await this.setCapabilityValue('frank_energie_last_upload', uploadTimestamp.toISOString())
      .catch((error) => this.error('Failed to update last upload timestamp:', error));

    // Trigger "Measurement Sent" flow card
    await this.emitMeasurementSent(
      results.periodTradingResult,
      batteryCharge,
      mode,
      uploadTimestamp.toISOString(),
    );

    this.log('Measurement sent to Onbalansmarkt');
  } catch (error) {
    this.error('Failed to send measurement:', error.message);
    // Non-critical error - continue with poll cycle
  }
}
```

**Data Sent to Onbalansmarkt.com**:
```json
{
  "timestamp": "2025-10-26T14:30:00.000Z",
  "batteryResult": 0.61,
  "batteryResultTotal": 293.94,
  "batteryResultEpex": 0.25,
  "batteryResultImbalance": 0.30,
  "batteryResultCustom": 0.06,
  "mode": "imbalance"
}
```

**Code**: [device.ts:340-376](../drivers/frank-energie-battery/device.ts#L340-L376)

### 3.4 Flow Card Triggers

**Automatische event detection en triggers**:

#### Rankings Changed
```typescript
// Ranking improved?
if (newRank !== null && previousRank !== null && newRank < previousRank) {
  await this.homey.flow.getTriggerCard('ranking_improved').trigger(this, {
    rank: newRank,
    previous_rank: previousRank,
    improvement: previousRank - newRank,
  });
}

// Ranking declined?
if (newRank !== null && previousRank !== null && newRank > previousRank) {
  await this.homey.flow.getTriggerCard('ranking_declined').trigger(this, {
    rank: newRank,
    previous_rank: previousRank,
    decline: newRank - previousRank,
  });
}
```

#### Result Events
```typescript
// Result positive or negative?
await this.homey.flow.getTriggerCard('result_positive_negative').trigger(this, {
  result: results.periodTradingResult,
  is_positive: results.periodTradingResult > 0 ? 'positive' : 'negative',
});

// Top performer? (Rank in top 10)
if (newRank !== null && newRank <= 10) {
  await this.homey.flow.getTriggerCard('top_performer_alert').trigger(this, {
    rank: newRank,
  });
}
```

#### Milestone Tracking
```typescript
// Milestone reached? (€50, €100, €250, €500, €1000, etc)
const milestones = [50, 100, 250, 500, 1000, 2500, 5000];

for (const milestone of milestones) {
  if (results.totalTradingResult >= milestone && !this.milestones.has(milestone)) {
    this.milestones.add(milestone);

    await this.homey.flow.getTriggerCard('milestone_reached').trigger(this, {
      milestone,
      total: results.totalTradingResult,
    });
  }
}
```

#### Battery Changes
```typescript
// New battery added?
const currentBatteryCount = this.batteries.length;
if (currentBatteryCount > this.previousBatteryCount) {
  await this.homey.flow.getTriggerCard('new_battery_added').trigger(this, {
    count: currentBatteryCount,
    new_count: currentBatteryCount - this.previousBatteryCount,
  });
}

// Trading mode changed?
if (tradingMode !== this.previousMode && this.previousMode !== null) {
  await this.homey.flow.getTriggerCard('trading_mode_changed').trigger(this, {
    mode: tradingMode,
    previous_mode: this.previousMode,
  });
}

// Frank Slim bonus detected?
if (results.periodFrankSlim > 0) {
  await this.homey.flow.getTriggerCard('frank_slim_bonus_detected').trigger(this, {
    bonus: results.periodFrankSlim,
    date: new Date().toISOString().split('T')[0],
  });
}
```

**Code**: Flow trigger emission gebeurt verspreid door [device.ts](../drivers/frank-energie-battery/device.ts)

---

## Fase 4: Settings Wijzigingen

**Wanneer gebruiker settings aanpast** in Homey app:

```typescript
async onSettings({
  oldSettings,
  newSettings,
  changedKeys
}: {
  oldSettings: Record<string, unknown>;
  newSettings: Record<string, unknown>;
  changedKeys: string[];
}): Promise<void> {
  this.log('Settings changed:', changedKeys);

  // 1. Credentials gewijzigd?
  if (changedKeys.includes('frank_energie_email') ||
      changedKeys.includes('frank_energie_password')) {

    const newEmail = newSettings.frank_energie_email as string;
    const newPassword = newSettings.frank_energie_password as string;

    // Re-authenticate with new credentials
    await this.frankEnergieClient?.login(newEmail, newPassword);
    this.log('Re-authenticated with new Frank Energie credentials');

    // Update app-level credentials
    this.homey.app.setCredentials(newEmail, newPassword);

    // Re-initialize device-specific clients
    await this.initializeDeviceSpecificClients();
  }

  // 2. Onbalansmarkt API key gewijzigd?
  if (changedKeys.includes('onbalansmarkt_api_key')) {
    const newApiKey = newSettings.onbalansmarkt_api_key as string;

    if (newApiKey?.trim()) {
      // Initialize new client
      this.onbalansmarktClient = new OnbalansmarktClient({
        apiKey: newApiKey,
        logger: (msg, ...args) => this.log(msg, ...args),
      });
      this.log('Onbalansmarkt client re-initialized with new API key');
    } else {
      // API key removed
      this.onbalansmarktClient = undefined;
      this.log('Onbalansmarkt client disabled (no API key)');
    }
  }

  // 3. Poll interval gewijzigd?
  if (changedKeys.includes('poll_interval')) {
    // Stop oude polling timer
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }

    // Start nieuwe polling met nieuwe interval
    await this.setupPolling();
    this.log(`Polling restarted with new interval: ${newSettings.poll_interval} minutes`);
  }

  // 4. Send measurements gewijzigd?
  if (changedKeys.includes('send_measurements')) {
    const enabled = newSettings.send_measurements as boolean;
    this.log(`Measurement sending ${enabled ? 'enabled' : 'disabled'}`);
  }
}
```

**Settings Impact**:

| Setting | Impact | Action |
|---------|--------|--------|
| `frank_energie_email` | Authentication | Re-authenticate + update app credentials |
| `frank_energie_password` | Authentication | Re-authenticate + update app credentials |
| `onbalansmarkt_api_key` | Rankings + Uploads | Re-initialize OnbalansmarktClient |
| `poll_interval` | Data refresh frequency | Restart polling timer |
| `send_measurements` | Upload behavior | Enable/disable uploads (no restart needed) |

**Code**: [frank-energie-device-base.ts:265-310](../lib/frank-energie-device-base.ts#L265-L310)

---

## Architectuur Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Homey Platform                                │
│  • User Interface                                                       │
│  • Flow Cards System                                                    │
│  • Device Management                                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    FrankEnergieApp (app.ts)                             │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ App-Level Credential Storage                                      │ │
│  │  • frank_energie_email                                            │ │
│  │  • frank_energie_password                                         │ │
│  │                                                                    │ │
│  │ Methods:                                                          │ │
│  │  • getCredentials()   → Returns shared credentials                │ │
│  │  • setCredentials()   → Stores credentials for all devices        │ │
│  │  • hasCredentials()   → Checks if configured                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              SmartBatteryDriver (driver.ts)                             │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Pairing Handlers                                                  │ │
│  │  • verify_credentials  → Validate + fetch batteries               │ │
│  │  • list_devices        → Create device configuration              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  SmartBatteryDevice (device.ts) extends FrankEnergieDeviceBase         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Lifecycle Methods                                                 │ │
│  │  • onInit()                → Initialize device                    │ │
│  │  • onSettings()            → Handle settings changes              │ │
│  │  • onDeleted()             → Cleanup on removal                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ API Clients                                                       │ │
│  │  • frankEnergieClient      → GraphQL API (Frank Energie)          │ │
│  │  • onbalansmarktClient     → REST API (Onbalansmarkt.com)         │ │
│  │  • batteryAggregator       → Multi-battery data aggregation       │ │
│  │  • externalBatteryMetrics  → External battery tracking            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Polling Timer (15-60 minutes)                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ async pollData()                                            │ │ │
│  │  │  1. Fetch trading results from Frank Energie               │ │ │
│  │  │  2. Detect trading mode                                     │ │ │
│  │  │  3. Update 16 capabilities                                  │ │ │
│  │  │  4. Update rankings (if API key set)                        │ │ │
│  │  │  5. Send measurement (if enabled)                           │ │ │
│  │  │  6. Trigger flow cards                                      │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Capabilities (15 total)                                           │ │
│  │  • battery_charging_state                                         │ │
│  │  • frank_energie_battery_charge                                   │ │
│  │  • frank_energie_battery_mode                                     │ │
│  │  • frank_energie_trading_result                                   │ │
│  │  • frank_energie_frank_slim_bonus                                 │ │
│  │  • frank_energie_epex_result                                      │ │
│  │  • frank_energie_imbalance_result                                 │ │
│  │  • frank_energie_overall_rank                                     │ │
│  │  • frank_energie_provider_rank                                    │ │
│  │  • frank_energie_last_upload                                      │ │
│  │  • external_battery_count                                         │ │
│  │  • external_battery_percentage                                    │ │
│  │  • external_battery_daily_charged                                 │ │
│  │  • external_battery_daily_discharged                              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Flow Cards (22 total)                                             │ │
│  │  • 11 Triggers (daily_results, milestone, ranking, mode, etc)     │ │
│  │  • 6 Conditions (positive, threshold, mode, rank, etc)            │ │
│  │  • 7 Actions (notification, toggle, poll, metrics, etc)           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓                                    ↓
        ┌───────────────────────┐          ┌───────────────────────────┐
        │  Frank Energie        │          │  Onbalansmarkt.com        │
        │  GraphQL API          │          │  REST API                 │
        │                       │          │                           │
        │  Endpoints:           │          │  Endpoints:               │
        │  • login              │          │  • POST /api/live         │
        │  • getSmartBatteries  │          │  • GET /api/me            │
        │  • getSmartBattery    │          │                           │
        │  • tradingResults     │          │  Returns:                 │
        │                       │          │  • Rankings               │
        │  Returns:             │          │  • Profile data           │
        │  • Battery data       │          │                           │
        │  • Trading results    │          │                           │
        │  • Settings           │          │                           │
        └───────────────────────┘          └───────────────────────────┘
```

---

## Data Flow Voorbeeld

**Scenario**: Gebruiker heeft device geïnstalleerd, poll interval = 15 minuten

### T+0: Device Start
```
1. onInit() → Initialize clients
2. Login to Frank Energie → Success
3. Fetch 3 batteries → [Battery#1, Battery#2, Battery#3]
4. Setup polling → 15 minute interval
5. First poll → Immediate execution
```

### T+0:00 - T+0:05: First Poll
```
1. getAggregatedResults(today, today)
   → Query Frank Energie GraphQL
   → Aggregate 3 batteries
   → Return: {
       periodTradingResult: 0.61,
       periodEpexResult: 0.25,
       periodImbalanceResult: 0.30,
       periodFrankSlim: 0.06,
       totalTradingResult: 293.94,
       batteryCount: 3
     }

2. updateCapabilities()
   → Set frank_energie_trading_result: 0.61
   → Set frank_energie_epex_result: 0.25
   → Set frank_energie_imbalance_result: 0.30
   → Set frank_energie_frank_slim_bonus: 0.06
   → Set battery_charging_state: 'charging'
   → ... (15 capabilities total)

3. updateRankings() (if API key set)
   → Call Onbalansmarkt.com /api/me
   → Return: { overallRank: 12, providerRank: 3 }
   → Set frank_energie_overall_rank: 12
   → Set frank_energie_provider_rank: 3

4. sendMeasurement() (if send_measurements = true)
   → POST to Onbalansmarkt.com /api/live
   → Body: { batteryResult: 0.61, ... }
   → Success
   → Set frank_energie_last_upload: "2025-10-26T14:30:00.000Z"
   → Trigger: measurement_sent

5. checkAndTriggerFlows()
   → Result positive? → Trigger: result_positive_negative
   → Milestone €250 reached? → Trigger: milestone_reached
```

### T+15:00: Second Poll
```
Repeat poll cycle with new data...
```

### Settings Change (T+20:00)
```
User changes poll_interval: 15 → 30 minutes

1. onSettings({ changedKeys: ['poll_interval'] })
2. Stop current polling timer
3. Start new polling timer with 30 minute interval
4. Continue operations with new schedule
```

---

## Samenvatting

**SmartBatteryDevice is een complex, event-driven device dat**:

### Bij Pairing
- ✅ Credentials verifieert via Frank Energie GraphQL API
- ✅ Alle batterijen op account detecteert
- ✅ App-level credentials opslaat voor hergebruik
- ✅ Device configureert met intelligente defaults

### Bij Start (onInit)
- ✅ Multi-layered client initialization (Frank Energie + Onbalansmarkt)
- ✅ Battery aggregator opzet voor multi-battery support
- ✅ 22 flow cards registreert (triggers, conditions, actions)
- ✅ Polling timer start met eerste immediate execution

### Tijdens Operatie (Elke X minuten)
- ✅ Trading results ophaalt van alle batterijen (aggregated)
- ✅ 16 capabilities real-time update
- ✅ Rankings bijwerkt van Onbalansmarkt.com (optioneel)
- ✅ Metingen verstuurt (optioneel, privacy-first default: OFF)
- ✅ Flow card events triggert (rankings, milestones, modes, etc)

### Bij Settings Wijzigingen
- ✅ Credentials re-authentication on-the-fly
- ✅ API clients dynamisch herinitialiseren
- ✅ Polling interval runtime aanpassen
- ✅ Zero-downtime configuration updates

---

## Key Features

### Multi-Battery Support
**Eén device beheert alle batterijen**:
- Aggregeert trading results van meerdere batteries
- Automatische detectie bij nieuwe batteries toevoegen
- Triggers flow card bij battery count changes

### Privacy-First Design
**Upload naar Onbalansmarkt.com standaard UIT**:
- Gebruiker moet expliciet opt-in
- Last upload timestamp capability voor transparantie
- Complete controle via settings

### Robust Error Handling
**Non-critical failures are isolated**:
- Frank Energie authentication failure → Device unavailable
- Onbalansmarkt API failure → Continue without rankings
- Upload failure → Log error, continue poll cycle
- Capability update failure → Partial updates allowed

### Flexible Polling
**Configurable data refresh**:
- Dropdown settings: 15, 30, 45, 60 minutes
- Runtime adjustable zonder device restart
- First poll immediate bij device start

### Extensive Flow Support
**22 flow cards voor automation**:
- Event-driven triggers (rankings, milestones, modes)
- Conditional logic (thresholds, modes, ranks)
- Actions (notifications, polling, metrics)

---

## Gerelateerde Documentatie

- [CREDENTIALS_ARCHITECTURE.md](CREDENTIALS_ARCHITECTURE.md) - App-level vs device-level credentials
- [GRAPHQL_QUERIES_OVERVIEW.md](GRAPHQL_QUERIES_OVERVIEW.md) - Available GraphQL queries
- [FLOW_CARDS_SPECIFICATION.md](FLOW_CARDS_SPECIFICATION.md) - Complete flow cards reference
- [CLAUDE.md](../CLAUDE.md) - Development guidelines

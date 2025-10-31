# Frank Energie Battery Trading - Flow Cards Technical Specification

## Overview

This document provides complete technical specifications for all flow cards implemented in the Frank Energie Battery Trading app for Homey.

## Architecture

### File Structure

```
.homeycompose/flow/
├── triggers/
│   ├── daily_results_available.json
│   ├── ranking_improved.json
│   ├── ranking_declined.json
│   ├── result_positive_negative.json
│   ├── milestone_reached.json
│   ├── top_performer_alert.json
│   ├── trading_mode_changed.json
│   ├── frank_slim_bonus_detected.json
│   ├── new_battery_added.json
│   └── measurement_sent.json
├── conditions/
│   ├── rank_in_top_x.json
│   ├── result_positive.json
│   ├── result_exceeds_threshold.json
│   ├── trading_mode_matches.json
│   ├── frank_slim_active.json
│   └── provider_rank_better.json
└── actions/
    ├── send_notification.json
    ├── send_rich_notification.json
    ├── force_data_poll.json
    ├── toggle_measurement_sending.json
    ├── log_to_timeline.json
    └── update_dashboard.json
```

### Implementation Location

All flow card handlers are implemented in:
- **File:** `drivers/frank-energie-battery/device.ts`
- **Class:** Frank Energie Battery device class

### State Tracking

The device maintains flow card state in private properties:

```typescript
private previousRank: number | null = null;
private previousProviderRank: number | null = null;
private previousResult: number = 0;
private previousMode: string | null = null;
private previousBatteryCount: number = 0;
private previousTotalResult: number = 0;
private milestones: Set<number> = new Set();
```

And in device store for persistence:

```
Store Keys:
- lastBatteryResult: number
- lastBatteryResultTotal: number
- lastTradingMode: string
- lastFrankSlim: number
- lastBatteryCharge: number
- lastTimelineEntry: { message, timestamp }
```

---

## Detailed Specifications

### TRIGGERS

#### 1. daily_results_available

**File:** `.homeycompose/flow/triggers/daily_results_available.json`

**Purpose:** Fires when new daily Onbalansmarkt trading results are fetched

**Emission Point:** `pollData()` → `processFlowCardTriggers()` → `emitDailyResultsAvailable()`

**Emission Frequency:** Once per polling cycle when results are available

**Tokens Provided:**

| Token | Type | Source |
|-------|------|--------|
| `batteryResult` | number | `results.periodTradingResult` |
| `batteryResultTotal` | number | `results.totalTradingResult` |
| `overallRank` | number | Capability: `frank_energie_overall_rank` |
| `providerRank` | number | Capability: `frank_energie_provider_rank` |
| `tradingMode` | string | `TradingModeDetector.detectTradingMode()` |
| `resultDate` | string | Current date (YYYY-MM-DD) |

**Handler Method:** `onDailyResultsAvailable(args: any)`

```typescript
private async onDailyResultsAvailable(args: any) {
  return args.device === this;
}
```

**Emission Code:**

```typescript
private async emitDailyResultsAvailable(
  result: number,
  totalResult: number,
  overallRank: number,
  providerRank: number,
  mode: string,
  date: string,
) {
  await this.homey.flow
    .getTriggerCard('daily_results_available')
    .trigger({
      device: this,
      batteryResult: result,
      batteryResultTotal: totalResult,
      overallRank,
      providerRank,
      tradingMode: mode,
      resultDate: date,
    })
    .catch((error) => this.error('Failed to emit daily_results_available trigger:', error));
}
```

---

#### 2. ranking_improved

**File:** `.homeycompose/flow/triggers/ranking_improved.json`

**Purpose:** Fires when overall ranking position improves (lower number = better)

**Emission Point:** `processFlowCardTriggers()` → `emitRankingImproved()`

**Condition:** `overallRank < this.previousRank`

**Tokens Provided:**

| Token | Type | Calculation |
|-------|------|-------------|
| `currentRank` | number | Current overall rank |
| `previousRank` | number | Previous overall rank |
| `improvement` | number | `previousRank - currentRank` |
| `batteryResult` | number | Daily trading result |

---

#### 3. ranking_declined

**File:** `.homeycompose/flow/triggers/ranking_declined.json`

**Purpose:** Fires when overall ranking position gets worse (higher number = worse)

**Emission Point:** `processFlowCardTriggers()` → `emitRankingDeclined()`

**Condition:** `overallRank > this.previousRank`

**Tokens Provided:**

| Token | Type | Calculation |
|-------|------|-------------|
| `currentRank` | number | Current overall rank |
| `previousRank` | number | Previous overall rank |
| `decline` | number | `currentRank - previousRank` |

---

#### 4. result_positive_negative

**File:** `.homeycompose/flow/triggers/result_positive_negative.json`

**Purpose:** Fires when daily result is positive or negative (user-configured)

**Emission Point:** `processFlowCardTriggers()` → `emitResultPositiveNegative()`

**Condition:** Always fires when `results.periodTradingResult !== 0`

**Tokens Provided:**

| Token | Type | Source |
|-------|------|--------|
| `batteryResult` | number | Daily result |
| `batteryResultTotal` | number | Monthly total |
| `tradingMode` | string | Current trading mode |

---

#### 5. milestone_reached

**File:** `.homeycompose/flow/triggers/milestone_reached.json`

**Purpose:** Fires when monthly trading result reaches configured threshold

**Emission Point:** `processFlowCardTriggers()` → `emitMilestoneReached()`

**Condition:** `previousTotalResult < milestone && result >= milestone && !milestones.has(milestone)`

**Default Milestones:** 10, 25, 50, 100, 150, 200, 250, 500

**Deduplication:** Using `Set<number>` to prevent duplicate fires

**Tokens Provided:**

| Token | Type | Description |
|-------|------|-------------|
| `batteryResultTotal` | number | Current monthly total |
| `overThreshold` | number | Amount exceeding threshold |

---

#### 6. top_performer_alert

**File:** `.homeycompose/flow/triggers/top_performer_alert.json`

**Purpose:** Fires when reaching top X ranking position

**Emission Point:** `processFlowCardTriggers()` → `emitTopPerformerAlert()`

**Condition:** `overallRank <= 100 && (previousRank === null || previousRank > 100)`

**Percentile Calculation:**

```typescript
const percentile = currentRank <= 10 ? 'Top 1%' :
                   currentRank <= 50 ? 'Top 5%' :
                   'Top 10%';
```

**Tokens Provided:**

| Token | Type | Description |
|-------|------|-------------|
| `currentRank` | number | Current rank |
| `percentile` | string | Percentile description |

---

#### 7. trading_mode_changed

**File:** `.homeycompose/flow/triggers/trading_mode_changed.json`

**Purpose:** Fires when battery trading strategy mode changes

**Emission Point:** `processFlowCardTriggers()` → `emitTradingModeChanged()`

**Condition:** `previousMode !== null && previousMode !== mode`

**Supported Modes:**
- `imbalance`
- `imbalance_aggressive`
- `self_consumption`
- `self_consumption_plus`
- `manual`
- `day_ahead`

**Tokens Provided:**

| Token | Type | Description |
|-------|------|-------------|
| `newMode` | string | New trading mode |
| `previousMode` | string | Previous trading mode |

---

#### 8. frank_slim_bonus_detected

**File:** `.homeycompose/flow/triggers/frank_slim_bonus_detected.json`

**Purpose:** Fires when Frank Slim discount bonus is earned

**Emission Point:** `processFlowCardTriggers()` → `emitFrankSlimBonusDetected()`

**Condition:** `results.periodFrankSlim > 0`

**Tokens Provided:**

| Token | Type | Source |
|-------|------|--------|
| `bonusAmount` | number | `results.periodFrankSlim` |
| `batteryResult` | number | `results.periodTradingResult` |

---

#### 9. new_battery_added

**File:** `.homeycompose/flow/triggers/new_battery_added.json`

**Purpose:** Fires when new battery is added to Frank Energie account

**Emission Point:** `processFlowCardTriggers()` → `emitNewBatteryAdded()`

**Condition:** `previousBatteryCount > 0 && results.batteryCount > previousBatteryCount`

**Tokens Provided:**

| Token | Type | Description |
|-------|------|-------------|
| `newBatteryCount` | number | Total batteries after addition |
| `previousBatteryCount` | number | Total batteries before addition |

---

#### 10. measurement_sent

**File:** `.homeycompose/flow/triggers/measurement_sent.json`

**Purpose:** Fires when trading results are sent to Onbalansmarkt API

**Emission Point:** `sendMeasurement()` → `emitMeasurementSent()`

**Condition:** Measurement sent successfully to Onbalansmarkt

**Tokens Provided:**

| Token | Type | Description |
|-------|------|-------------|
| `batteryResult` | number | Sent battery result |
| `batteryCharge` | number | Battery charge percentage |
| `tradingMode` | string | Trading mode of measurement |
| `timestamp` | string | ISO 8601 timestamp |

---

### CONDITIONS

#### 1. rank_in_top_x

**File:** `.homeycompose/flow/conditions/rank_in_top_x.json`

**Purpose:** Tests if ranking is within top X positions

**Parameters:**

| Name | Type | Values |
|------|------|--------|
| `rankType` | dropdown | `"overall"` or `"provider"` |
| `threshold` | number | 1-∞ (position) |

**Handler:**

```typescript
private async condRankInTopX(args: any) {
  if (args.device !== this) return false;
  const rank = args.rankType === 'overall'
    ? await this.getCapabilityValue('frank_energie_overall_rank')
    : await this.getCapabilityValue('frank_energie_provider_rank');
  return (rank as number) <= args.threshold;
}
```

---

#### 2. result_positive

**File:** `.homeycompose/flow/conditions/result_positive.json`

**Purpose:** Tests if daily result exceeds minimum threshold

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| `threshold` | number | 0 |

**Handler:**

```typescript
private async condResultPositive(args: any) {
  if (args.device !== this) return false;
  const lastResult = await this.getStoreValue('lastBatteryResult') as number || 0;
  return lastResult > (args.threshold as number || 0);
}
```

---

#### 3. result_exceeds_threshold

**File:** `.homeycompose/flow/conditions/result_exceeds_threshold.json`

**Purpose:** Tests if monthly trading result exceeds threshold

**Parameters:**

| Name | Type | Required |
|------|------|----------|
| `threshold` | number | Yes |

**Handler:**

```typescript
private async condResultExceedsThreshold(args: any) {
  if (args.device !== this) return false;
  const totalResult = await this.getStoreValue('lastBatteryResultTotal') as number || 0;
  return totalResult > args.threshold;
}
```

---

#### 4. trading_mode_matches

**File:** `.homeycompose/flow/conditions/trading_mode_matches.json`

**Purpose:** Tests if current trading mode matches specified mode

**Parameters:**

| Name | Type | Values |
|------|------|--------|
| `mode` | dropdown | imbalance, imbalance_aggressive, self_consumption, self_consumption_plus, manual, day_ahead |

**Handler:**

```typescript
private async condTradingModeMatches(args: any) {
  if (args.device !== this) return false;
  const currentMode = await this.getStoreValue('lastTradingMode') as string;
  return currentMode === args.mode;
}
```

---

#### 5. frank_slim_active

**File:** `.homeycompose/flow/conditions/frank_slim_active.json`

**Purpose:** Tests if Frank Slim bonus exceeds threshold

**Parameters:**

| Name | Type | Default |
|------|------|---------|
| `threshold` | number | 0 |

**Handler:**

```typescript
private async condFrankSlimActive(args: any) {
  if (args.device !== this) return false;
  const frankSlim = await this.getStoreValue('lastFrankSlim') as number || 0;
  return frankSlim > (args.threshold as number || 0);
}
```

---

#### 6. provider_rank_better

**File:** `.homeycompose/flow/conditions/provider_rank_better.json`

**Purpose:** Tests if provider ranking is better than overall ranking

**Parameters:** None

**Handler:**

```typescript
private async condProviderRankBetter(args: any) {
  if (args.device !== this) return false;
  const overallRank = await this.getCapabilityValue('frank_energie_overall_rank') as number;
  const providerRank = await this.getCapabilityValue('frank_energie_provider_rank') as number;
  return providerRank < overallRank;
}
```

---

### ACTIONS

#### 1. send_notification

**File:** `.homeycompose/flow/actions/send_notification.json`

**Purpose:** Sends custom notification with optional metrics

**Parameters:**

| Name | Type | Required |
|------|------|----------|
| `title` | text | Yes |
| `message` | textarea | Yes |
| `includeMetrics` | checkbox | No |

**Handler:**

```typescript
private async actionSendNotification(args: any) {
  if (args.device !== this) return;
  const title = args.title || 'Trading Update';
  let message = args.message || 'No message';

  if (args.includeMetrics) {
    const result = await this.getStoreValue('lastBatteryResult') as number || 0;
    const rank = await this.getCapabilityValue('frank_energie_overall_rank') as number;
    const mode = await this.getStoreValue('lastTradingMode') as string;
    message += `\n\nResult: €${result.toFixed(2)}\nRank: #${rank}\nMode: ${mode}`;
  }

  this.log(`Sending notification: ${title}`);
  await this.homey.notifications.createNotification({ excerpt: `${title}\n${message}` });
}
```

---

#### 2. send_rich_notification

**File:** `.homeycompose/flow/actions/send_rich_notification.json`

**Purpose:** Sends formatted notification with metric combinations

**Parameters:**

| Name | Type | Values |
|------|------|--------|
| `type` | dropdown | daily_summary, ranking_update, result_only, monthly_milestone |

**Message Formats:**

```
daily_summary: "Daily Results\nResult: €X\nMonthly Total: €X\nRank: #X\nMode: X"
ranking_update: "Ranking Update\nOverall: #X\nProvider: #X"
result_only: "Trading Result\n€X"
monthly_milestone: "Monthly Milestone\nTotal: €X"
```

---

#### 3. force_data_poll

**File:** `.homeycompose/flow/actions/force_data_poll.json`

**Purpose:** Immediately fetches latest data from Frank Energie API

**Handler:**

```typescript
private async actionForceDataPoll(args: any) {
  if (args.device !== this) return;
  this.log('Force data poll triggered via flow');
  await this.pollData();
}
```

---

#### 4. toggle_measurement_sending

**File:** `.homeycompose/flow/actions/toggle_measurement_sending.json`

**Purpose:** Controls automatic Onbalansmarkt measurement sending

**Parameters:**

| Name | Type | Values |
|------|------|--------|
| `state` | dropdown | on, off, toggle |

**Handler:**

```typescript
private async actionToggleMeasurementSending(args: any) {
  if (args.device !== this) return;

  const currentValue = this.getSetting('send_measurements') as boolean;
  let newValue = currentValue;

  switch (args.state) {
    case 'on': newValue = true; break;
    case 'off': newValue = false; break;
    case 'toggle': newValue = !currentValue; break;
  }

  if (newValue !== currentValue) {
    await this.setSettings({ send_measurements: newValue });
    this.log(`Measurement sending toggled to: ${newValue}`);
  }
}
```

---

#### 5. log_to_timeline

**File:** `.homeycompose/flow/actions/log_to_timeline.json`

**Purpose:** Creates a visible notification in Homey's timeline and stores the event locally for reference

**Parameters:**

| Name | Type | Required |
|------|------|----------|
| `event` | text | Yes |
| `includeResult` | checkbox | No |

**Handler:**

```typescript
private async actionLogToTimeline(args: any) {
  if (args.device !== this) return;

  const batteryResult = await this.getStoreValue('lastBatteryResult') as number || 0;
  let logMessage = args.event || 'Trading event logged';

  if (args.includeResult) {
    logMessage += ` (€${batteryResult.toFixed(2)})`;
  }

  // Send notification to Homey timeline (visible in app)
  try {
    await this.homey.notifications.createNotification({
      excerpt: `${this.getName()}: ${logMessage}`,
    });
    this.log(`Timeline notification sent: ${logMessage}`);
  } catch (error) {
    this.error('Failed to create timeline notification:', error);
  }

  // Store locally for reference
  await this.setStoreValue('lastTimelineEntry', {
    message: logMessage,
    timestamp: Date.now(),
  });
}
```

---

#### 6. update_dashboard

**File:** `.homeycompose/flow/actions/update_dashboard.json`

**Purpose:** Prepares dashboard data (for dashboard integration)

**Parameters:**

| Name | Type | Values |
|------|------|--------|
| `displayType` | dropdown | current_metrics, ranking_progress, monthly_earnings |

---

## Integration Points

### Data Flow

```
pollData()
  ├── getAggregatedResults() → Battery data
  ├── detectTradingMode() → Trading mode
  ├── updateCapabilities() → Update device state
  ├── processFlowCardTriggers()
  │   ├── Emit daily_results_available
  │   ├── Check & emit ranking_improved/declined
  │   ├── Check & emit result_positive_negative
  │   ├── Check & emit milestone_reached
  │   ├── Check & emit top_performer_alert
  │   ├── Check & emit trading_mode_changed
  │   ├── Check & emit frank_slim_bonus_detected
  │   ├── Check & emit new_battery_added
  │   └── Store state for next cycle
  └── sendMeasurement()
      └── Emit measurement_sent
```

### Device Store Keys

```typescript
// Results
lastBatteryResult: number            // Daily result
lastBatteryResultTotal: number       // Monthly total
lastBatteryCharge: number            // Battery %, if available

// Settings
lastTradingMode: string              // Current mode
lastFrankSlim: number                // Daily Frank Slim amount

// Tracking
lastPollTime: number                 // Timestamp
lastBatteryId: string                // Primary battery ID
lastTimelineEntry: {                 // For log_to_timeline
  message: string
  timestamp: number
}
```

---

## Error Handling

All trigger emissions are wrapped with error logging:

```typescript
.catch((error) => this.error('Failed to emit {trigger_name} trigger:', error));
```

Trigger processing errors do not propagate:

```typescript
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  this.error('Error processing flow card triggers:', errorMsg);
  // Don't throw - trigger processing is not critical
}
```

---

## Performance Considerations

### Polling Frequency
- Default: 5 minutes (configurable 1-60 minutes)
- Each poll triggers 1-10 flow cards depending on changes

### State Tracking
- Previous states stored in memory (not persisted)
- Milestones stored in Set for O(1) deduplication

### Trigger Deduplication
- Milestones: Only fire once per threshold using `Set<number>`
- Top Performer: Only fires when crossing threshold
- Mode Change: Only fires when actual change detected

---

## Testing

### Manual Testing
1. Add Frank Energie device in Homey
2. Create test automations in Homey Flow
3. Force data poll via action
4. Verify triggers fire in Homey logs

### Automated Testing
Currently no unit tests. Recommend:
- Mock `AggregatedResults`
- Test trigger emission conditions
- Test condition evaluation logic
- Test action execution

---

## Future Enhancements

### Potential Phase 3+ Cards
- **EV Charging Integration:** Enode session triggers/conditions
- **PV System Monitoring:** SmartPV system triggers
- **Multi-Device Support:** Cross-device conditions
- **Historical Analysis:** Trend-based conditions
- **Webhook Actions:** Send to external services

---

## References

- Homey SDK Flow Cards: https://apps-sdk-v3.developer.homey.app/Flow.html
- Device Class: https://apps-sdk-v3.developer.homey.app/Device.html
- Capabilities: https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html


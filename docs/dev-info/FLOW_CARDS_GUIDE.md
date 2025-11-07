# Frank Energie Battery Trading - Flow Cards Guide

## Overview

This app provides comprehensive flow card support for automating battery trading notifications, tracking, and control. Flow cards enable powerful automation scenarios through Homey's automation engine.

## Quick Start Examples

### Example 1: Daily Trading Summary Notification
**Use Case:** Get notified every day with your trading results and ranking

```
TRIGGER: Daily results available
CONDITIONS: (none)
ACTIONS:
  1. Send trading update notification
     - Title: "Daily Trading Results"
     - Message: "Check your results on Onbalansmarkt"
     - ✓ Include metrics
```

### Example 2: Celebrate Top 100 Ranking
**Use Case:** Get excited notification when you reach top 100

```
TRIGGER: Top performer alert
CONDITIONS: (none)
ACTIONS:
  1. Send rich notification: Daily Summary
  2. Send notification: "Congratulations!"
```

### Example 3: Smart Conditional Alerts
**Use Case:** Only notify about profitable days

```
TRIGGER: Daily results available
CONDITIONS:
  - Is daily result positive? (minimum €5)
  - Is rank in top 500?
ACTIONS:
  1. Send rich notification: Result Only
```

### Example 4: Monthly Milestone Tracking
**Use Case:** Celebrate reaching €100, €200, €500 in monthly earnings

```
TRIGGER: Milestone reached (€100, €200, €500)
CONDITIONS: (none)
ACTIONS:
  1. Send rich notification: Monthly Milestone
  2. Log to timeline: "Reached {{threshold}}€ milestone!"
```

### Example 5: Mode Switch Alert
**Use Case:** Get notified when trading strategy changes

```
TRIGGER: Trading mode changed
CONDITIONS: (none)
ACTIONS:
  1. Send notification:
     - Title: "Trading Mode Changed"
     - Message: "Your battery trading strategy has been updated"
```

### Example 6: Bonus Earnings Detection
**Use Case:** Highlight when Frank Slim bonuses are earned

```
TRIGGER: Frank Slim bonus detected
CONDITIONS: (none)
ACTIONS:
  1. Send rich notification: Monthly Milestone
```

### Example 7: Force Refresh Data
**Use Case:** Manually update trading data when needed

```
(Triggered manually from Homey)
TRIGGER: (Manual trigger via automation button)
ACTIONS:
  1. Force data poll
```

### Example 8: Ranking Improvement Celebration
**Use Case:** Get notified when your ranking improves

```
TRIGGER: Ranking improved
CONDITIONS: (none)
ACTIONS:
  1. Send notification:
     - Title: "Ranking Improved!"
     - Message: "You moved up {{improvement}} positions! Now #{{currentRank}}"
```

---

## All Available Flow Cards

The battery ecosystem now exposes **12 triggers**, **6 conditions**, and **10 actions**. Triggers and actions are defined under `.homeycompose/flow/**` and implemented in `drivers/frank-energie-battery/device.ts` (plus the separate Zonneplan driver for Zonneplan-specific flows).

### TRIGGERS

#### Daily Results Available
Fires when new daily Onbalansmarkt trading results are fetched.

- **Tokens (Available in Actions/Conditions):**
- `batteryResult` - Today's battery trading result (€)
- `batteryResultTotal` - Cumulative monthly result (€)
- `overallRank` - Your position in overall Onbalansmarkt rankings (`onbalansmarkt_overall_rank`)
- `providerRank` - Provider-specific ranking (`onbalansmarkt_provider_rank`)
- `tradingMode` - Current trading mode (imbalance, aggressive, etc.)
- `resultDate` - Date of result (YYYY-MM-DD)

#### Ranking Improved
Fires when your overall ranking position improves (lower number = better).

**Tokens:**
- `currentRank` - New rank position
- `previousRank` - Previous rank position
- `improvement` - Number of positions improved
- `batteryResult` - Today's battery result

#### Ranking Declined
Fires when your ranking position gets worse (higher number = worse).

**Tokens:**
- `currentRank` - New rank position
- `previousRank` - Previous rank position
- `decline` - Number of positions declined

#### Result Positive/Negative
Fires when daily trading result is positive or negative.

**Parameters:**
- **Positive/Negative** - Choose which to trigger on

**Tokens:**
- `batteryResult` - Today's battery result
- `batteryResultTotal` - Monthly total
- `tradingMode` - Current trading mode

#### Milestone Reached
Fires when monthly trading result reaches a configured target amount (€10, €25, €50, €100, etc.).

**Parameters:**
- **Amount (€)** - Target milestone amount

**Tokens:**
- `batteryResultTotal` - Current monthly total
- `overThreshold` - Amount over target

#### Top Performer Alert
Fires when you reach a top ranking position (e.g., top 10, top 50, top 100).

**Parameters:**
- **Rank Type** - Overall or Provider ranking
- **Top Position** - e.g., 100 for top 100

**Tokens:**
- `currentRank` - Your current position
- `percentile` - Percentile description (Top 1%, Top 5%, etc.)

#### Trading Mode Changed
Fires when your battery trading strategy switches between modes.

**Tokens:**
- `newMode` - New trading mode
- `previousMode` - Previous trading mode

#### Frank Slim Bonus Detected
Fires when Frank Slim discount bonus is earned.

**Tokens:**
- `bonusAmount` - Bonus amount (€)
- `batteryResult` - Today's trading result

#### New Battery Added
Fires when a new battery is added to your Frank Energie account.

**Tokens:**
- `newBatteryCount` - Total battery count after addition
- `previousBatteryCount` - Count before addition

#### Measurement Sent
Fires when trading results are sent to Onbalansmarkt.

**Tokens:**
- `batteryResult` - Sent battery result
- `batteryCharge` - Battery charge percentage
- `tradingMode` - Trading mode sent
- `timestamp` - When sent (ISO 8601)

#### External Battery Metrics Updated
Fires whenever the `BatteryMetricsStore` aggregates new external metrics (flow actions `receive_battery_metrics` or `receive_battery_daily_metrics`).

**Tokens:**
- `daily_charged_kwh`
- `daily_discharged_kwh`
- `average_percentage`
- `battery_count`

#### Zonneplan Metrics Updated
Fires when the Zonneplan virtual battery driver receives fresh data via `receive_zonneplan_metrics`.

**Tokens:**
- `daily_earned`, `total_earned`
- `daily_charged`, `daily_discharged`
- `battery_percentage`
- `cycle_count`
- `load_balancing_active`

---

### CONDITIONS

#### Rank Is in Top X
Tests if your ranking is within top X positions.

**Parameters:**
- **Rank Type** - Overall or Provider ranking
- **Position** - Target position (e.g., 100)

**Returns:** True if rank ≤ position

#### Daily Result Is Positive
Tests if today's battery trading result exceeds a threshold.

**Parameters:**
- **Minimum Amount (€)** - Threshold (default €0)

**Returns:** True if result > threshold

#### Result Exceeds Threshold
Tests if monthly trading result is above specified amount.

**Parameters:**
- **Threshold Amount (€)** - Target amount

**Returns:** True if monthly total > threshold

#### Trading Mode Matches
Tests if current trading mode equals specified mode.

**Parameters:**
- **Trading Mode** - Mode to test against
  - Imbalance Trading (Standard)
  - Imbalance Trading (Aggressive)
  - Self Consumption Plus
  - Self Consumption
  - Manual Mode
  - Day-Ahead Trading

**Returns:** True if modes match

#### Frank Slim Bonus Earned
Tests if today's Frank Slim bonus exceeds threshold.

**Parameters:**
- **Minimum Bonus (€)** - Threshold (default €0)

**Returns:** True if bonus > threshold

#### Provider Rank Better Than Overall
Tests if your provider-specific ranking is better than overall ranking.

**Returns:** True if providerRank < overallRank

---

### ACTIONS

#### Send Trading Notification
Sends a custom notification with optional trading metrics.

**Parameters:**
- **Title** - Notification title
- **Message** - Notification body
- **Include Metrics** - Checkbox to append result, rank, and mode

#### Send Rich Metrics Notification
Sends formatted notification with specific metric combinations.

**Parameters:**
- **Notification Type**
  - Daily Summary: Result, Monthly Total, Rank, Mode
  - Ranking Update: Overall & Provider ranks
  - Result Only: Daily result amount
  - Monthly Milestone: Monthly total

#### Force Data Poll
Immediately fetches latest trading data from Frank Energie (overrides poll interval).

#### Toggle Measurement Sending
Controls automatic sending of measurements to Onbalansmarkt.

**Parameters:**
- **State**
  - On: Enable measurements
  - Off: Disable measurements
  - Toggle: Switch current state

#### Log to Timeline
Creates historical log entry of trading event.

**Parameters:**
- **Event Description** - What happened
- **Include Result** - Checkbox to add trading amount

#### Update Dashboard
Prepares dashboard data for display (for dashboard app integration).

**Parameters:**
- **Display Type**
  - Current Metrics: Rank, Result, Mode
  - Ranking Progress: Visual rank progression
  - Monthly Earnings Chart: Earnings over time

#### Receive Battery Metrics (lifetime)
Accepts cumulative charged/discharged values and pushes them into the external battery aggregator. Use this in flows that receive lifetime totals (e.g., Sessy API).

**Parameters:**
- `battery_id`
- `total_charged_kwh`
- `total_discharged_kwh`
- `battery_percentage`

#### Receive Battery Daily Metrics
Specialized version for batteries that only expose daily totals (resets every night). Values are inserted directly as “daily-only” without delta calculation.

**Parameters:**
- `battery_id`
- `daily_charged_kwh`
- `daily_discharged_kwh`
- `battery_percentage`

#### Reset Baseline
Emergency action that aligns the start-of-day baseline with current totals. Use when external data got out of sync; the next measurement will generate the correct delta again.

#### Receive Zonneplan Metrics
Dedicated action for the Zonneplan virtual device. Accepts per-flow values (earnings, charged/discharged kWh, percentage, cycle count, load-balancing status, timestamp) and optionally forwards them to Onbalansmarkt (if enabled in the device settings).

---

## Advanced Automation Scenarios

### Scenario 1: Performance-Based Smart Alerts

```
IF Ranking improved AND Result positive (€10+)
  THEN Send "Great day! You improved {{improvement}} positions to #{{currentRank}}"

IF Ranking declined OR Result negative
  THEN Send quiet notification "Rank changed to #{{currentRank}}"
```

### Scenario 2: Financial Tracking

```
IF Milestone reached (€100)
  THEN
    1. Send notification "€100 milestone achieved!"
    2. Log "Monthly profit: €{{batteryResultTotal}}"

IF Milestone reached (€250)
  THEN
    1. Send "Excellent! €250 earned this month"
    2. Send daily summary with all metrics
```

### Scenario 3: Strategy Monitoring

```
IF Trading mode changed
  THEN Send "Mode changed from {{previousMode}} to {{newMode}}"

IF Trading mode matches "imbalance_aggressive"
  AND Rank worse than 500
  THEN Send "Warning: Aggressive strategy in poor ranking position"
```

### Scenario 4: Bonus Tracking

```
IF Frank Slim bonus detected (€5+)
  THEN
    1. Send "Frank Slim bonus: €{{bonusAmount}}"
    2. Log to timeline "Bonus earned"

IF Result positive (€25+)
  AND Frank Slim bonus earned (€2+)
  THEN Send "Excellent day: €{{batteryResult}} + €{{bonusAmount}} bonus"
```

### Scenario 5: Daily Digest

```
TRIGGER: Daily results available (scheduled daily at 21:00)
CONDITIONS: None
ACTIONS:
  1. IF Result positive THEN Send "Profitable day: €{{batteryResult}}"
  2. IF Ranking improved THEN Send "Ranking: #{{currentRank}} (↑{{improvement}})"
  3. IF frank Slim earned THEN Send "Bonus: €{{bonusAmount}}"
```

---

## Token Reference

### Available in All Triggers

| Token | Type | Description | Example |
|-------|------|-------------|---------|
| `batteryResult` | number | Daily trading result | 45.67 |
| `batteryResultTotal` | number | Monthly cumulative result | 523.45 |
| `overallRank` | number | Overall ranking position | 42 |
| `providerRank` | number | Provider-specific ranking | 12 |
| `tradingMode` | string | Current trading strategy | "imbalance_aggressive" |
| `improvement` | number | Rank positions improved | 14 |
| `decline` | number | Rank positions declined | 8 |
| `bonusAmount` | number | Frank Slim bonus earned | 12.50 |
| `percentile` | string | Percentile description | "Top 5%" |
| `newMode` | string | New trading mode | "self_consumption" |
| `previousMode` | string | Previous trading mode | "imbalance" |
| `newBatteryCount` | number | Total batteries after addition | 3 |

---

## Tips & Best Practices

### 1. Reduce Notification Fatigue
- Use conditions to filter notifications
- Only alert on significant changes (€10+ milestones, top 100 ranks)
- Use different notification types for different events

### 2. Combine Multiple Conditions
```
IF Daily results available
  AND Result positive (€5+)
  AND Rank in top 100
THEN Send "Strong performance today"
```

### 3. Use Milestone Thresholds Strategically
- Set at €10, €25, €50, €100, €250, €500 for good coverage
- Higher milestones for less frequent notifications
- Lower for more engagement

### 4. Monitor Trading Mode Changes
- Alert when strategy changes
- Use conditions to validate mode switches
- Track performance by mode

### 5. Leverage Rich Notifications
- Use "Daily Summary" for comprehensive info
- Use "Ranking Update" for competitive players
- Use "Result Only" for quick glance

### 6. Data Polling
- Automatic polling every 5 minutes (configurable 1-60 min)
- Use "Force Data Poll" for immediate refresh
- Consider frequency vs. API rate limits

---

## Troubleshooting

### Triggers Not Firing
- Check device is available (green status in Homey)
- Verify Frank Energie credentials are correct
- Check Onbalansmarkt API key is valid
- Ensure polling interval is configured

### Notifications Not Sending
- Check Homey notification settings
- Verify message content is not empty
- Check for special characters in custom messages
- Review Homey logs for errors

### Ranking Not Updating
- Verify you have results on Onbalansmarkt
- Check internet connection
- Wait for next polling interval
- Use "Force Data Poll" to refresh immediately

### Conditions Always Fail
- Double-check condition parameters (threshold, rank type)
- Use correct units (€ for amounts, number for ranks)
- Verify device has fresh data from last poll
- Check stored values in device store

---

## Further Help

- **Homey Flow Documentation:** https://support.homey.app/hc/en-us/articles/207957916-Flow
- **Frank Energie:** https://www.frankenergieservice.nl/
- **Onbalansmarkt:** https://onbalansmarkt.com/
- **App Issues:** Report at GitHub issues

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Homey home automation solution for reporting battery trading results to onbalansmarkt.com (Dutch energy balance market). The system integrates Frank Energie smart trading with multiple home battery systems through Homey Advanced Flows.

## Core Architecture

### Main Components

1. **homey-onbalansmarkt-frankenergie.js** - Primary script that:
   - Authenticates with Frank Energie GraphQL API 
   - Retrieves battery trading session data
   - Aggregates results across multiple batteries
   - Determines trading mode automatically based on battery settings
   - Sends measurements to Onbalansmarkt API

2. **Battery Setup Scripts** - Configure device capabilities per battery brand:
   - `sessy-setup.js` - Sessy battery configuration
   - `alphaESS-setup.js` - AlphaESS battery configuration  
   - `sigEnergy-setup.js` - SolarEdge SigEnergy configuration

3. **Data Processing Scripts**:
   - `battery-calculate-averages.js` - Calculates averages across multiple batteries
   - `battery-update-deltas.js` - Calculates daily delta values for systems that only provide cumulative totals
   - `battery-update-prevs.js` - Stores previous day values for delta calculations

4. **API Classes** (defined inline in `homey-onbalansmarkt-frankenergie.js`):
   - `FrankEnergie` - GraphQL API client for Frank Energie
     - `login(username, password)` - Authenticates and stores auth tokens
     - `getSmartBatteries()` - Retrieves all registered batteries
     - `getSmartBatterySessions(deviceId, startDate, endDate)` - Gets trading session data with results
     - `getSmartBattery(deviceId)` - Gets battery details including settings, mode, and strategy
   - `OnbalansMarkt` - REST API client for reporting measurements
     - `sendMeasurement({...})` - Posts measurement data to Onbalansmarkt API
   - `HomeyVars` - Homey global variable management wrapper
     - `getVariableValue(name, defaultValue)` - Retrieves global variable
     - `setVariableValue(name, value)` - Stores global variable and creates timeline tag

### Battery System Support

The system supports multiple battery brands through configurable device capabilities. Each battery system requires specific capability names for reading energy data:

| System | Battery % | kWh Import | kWh Export | Driver ID | Class | Delta Processing |
|--------|-----------|------------|------------|-----------|-------|------------------|
| Sessy | measure_battery | meter_power.import | meter_power.export | sessy | battery | Yes |
| AlphaESS | measure_battery | meter_power.charged | meter_power.discharged | alphaess | battery | Yes |
| ZP Nexus | measure_battery | meter_power.daily_import | meter_power.daily_export | zonneplan | battery | No |
| Homevolt | measure_battery | meter_power.imported | meter_power.exported | homevolt-battery | battery | Yes |
| SolarEdge SigEnergy | measure_battery | meter_power.daily_charge | meter_power.daily_discharge | sigenergy | solarpanel | No |
| SolarEdge Solax | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | solax | solarpanel | No |
| SolarEdge Wattsonic | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | wattsonic | solarpanel | No |
| SolarEdge Sungrow | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | sungrow | solarpanel | No |
| SolarEdge Huawei | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | huawei | solarpanel | No |
| SolarEdge Growatt | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | growatt | solarpanel | No |
| SolarEdge StoreEdge | measure_battery | meter_power.import | meter_power.export | storeedge | solarpanel | Yes |

**Delta Processing**: Systems with "Yes" provide only cumulative totals and require daily delta calculations. Systems with "No" provide built-in daily totals.

### Trading Mode Determination

Trading modes are automatically determined from Frank Energie API:

| Battery Mode | Trading Strategy | Resulting Mode |
|--------------|------------------|----------------|
| IMBALANCE_TRADING | STANDARD | imbalance |
| IMBALANCE_TRADING | AGGRESSIVE | imbalance_aggressive |
| SELF_CONSUMPTION_MIX | - | self_consumption_plus |
| Other | - | manual |

## Development Workflow

### Required Homey Global Variables
- `frankenergie_id` - Frank Energie login email
- `frankenergie_pw` - Frank Energie password  
- `onbalansmarkt_apikey` - Onbalansmarkt API key
- Battery system configuration variables (set by setup scripts)
- Calculated averages and deltas (managed by processing scripts)

### Homey Advanced Flow Structure

Scripts execute sequentially in a Homey Advanced Flow. The execution order is critical:

1. **Scheduled trigger** (e.g., every 15 minutes at 23:59 or custom intervals)
2. **Battery system setup** - Run brand-specific setup script (e.g., `sessy-setup.js`, `alphaESS-setup.js`)
3. **Calculate averages** - Run `battery-calculate-averages.js` to aggregate data across multiple batteries
4. **Update deltas** - Run `battery-update-deltas.js` to calculate daily energy differences (for systems requiring delta processing)
5. **Main reporting** - Run `homey-onbalansmarkt-frankenergie.js` to authenticate and send measurements to Onbalansmarkt

**Note**: At day boundary (typically 23:59), run `battery-update-prevs.js` to store current values as previous day values before the delta calculation.

### Adding New Battery Systems
1. Create new `{brand}-setup.js` file based on existing examples
2. Configure battery system variables:
   - `battery_system` - driver identifier
   - `battery_class` - device class ('battery' or 'solarpanel')
   - `battery_import`, `battery_export`, `battery_level` - capability names
   - `battery_delta` - 'Yes' if daily deltas needed, 'No' for systems with built-in daily totals

### Key Data Flow

The system follows this data flow pattern:

1. **Configuration** - Setup script writes battery system variables (`battery_system`, `battery_class`, `battery_import`, `battery_export`, `battery_level`, `battery_delta`)
2. **Device Query** - Calculate-averages script queries Homey devices matching configured driver ID and class
3. **Aggregation** - Averages are calculated across all matching devices and stored as `averageImportPower`, `averageExportPower`, `averageBatteryLevel`
4. **Delta Calculation** - If `battery_delta == 'Yes'`, deltas are computed by subtracting `prevAverageImportPower`/`prevAverageExportPower` from current averages
5. **Result Multiplication** - Main script multiplies kWh values by the number of participating batteries (loop counter)
6. **API Integration** - Main script authenticates with Frank Energie, retrieves trading sessions for all batteries, accumulates results, determines trading mode, and sends to Onbalansmarkt

**Global Variables Flow**:
- Setup → `battery_*` config vars
- Calculate → `average*` vars
- Update deltas → `delta*` vars
- Update prevs → `prevAverage*` vars (at day boundary)
- Main script → reads `delta*` and `average*` for reporting

## Important Considerations

### Homey Environment Constraints
- Scripts run in Homey's restricted JavaScript environment (no Node.js modules, no file system access)
- All external dependencies must be implemented inline (FrankEnergie, OnbalansMarkt, HomeyVars classes)
- Use `await Homey.devices.getDevices()` to access device capabilities
- Use `await global.get()` and `await global.set()` for persistent variables
- Use `await tag()` for timeline notifications visible to users

### Multi-Battery Support
- System automatically discovers all devices matching configured `battery_system` driver ID and `battery_class`
- Averages are calculated per battery, then multiplied by the number of participating batteries in the main script
- This approach ensures accurate reporting when multiple identical batteries are configured

### Delta Processing Logic
- **Cumulative systems** (Sessy, AlphaESS, StoreEdge): Provide grand totals only, require `battery_delta = 'Yes'`
  - Daily deltas computed as: `current - previous`
  - Previous values reset at day boundary via `battery-update-prevs.js`
- **Daily total systems** (ZP Nexus, SigEnergy, most SolarEdge): Provide built-in daily totals, use `battery_delta = 'No'`
  - No delta calculation needed, values used directly

### Trading Mode Mapping
- Trading mode is automatically determined from Frank Energie battery settings
- Retrieved via `getSmartBattery()` which returns `batteryMode` and `imbalanceTradingStrategy`
- Mapped according to the Trading Mode Determination table and sent to Onbalansmarkt API
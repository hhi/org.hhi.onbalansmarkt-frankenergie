# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Homey App** for the Frank Energie smart battery system. It delivers real-time battery trading results to onbalansmarkt.com, integrating with the Homey home automation platform.

- **Homey SDK**: Version 3 (SDK3)
- **Compatibility**: Homey OS >= 12.4.0
- **Platforms**: Local only
- **Language**: TypeScript
- **App ID**: org.hhi.onbalansmarkt-frankenergie

## Architecture Overview

### High-Level Structure

The app follows Homey's standard architecture with four main layers:

1. **App Layer** (`app.ts`): Main application entry point that initializes the app
2. **Driver Layer** (`drivers/frank-energie/driver.ts`): Manages device discovery and pairing
3. **Device Layer** (`drivers/frank-energie/device.ts`): Handles individual device logic, capabilities, and settings
4. **Library Layer** (`lib/`): Reusable TypeScript services for API communication and data processing

### Library Services

The app uses specialized services in the `lib/` directory:

#### FrankEnergieClient (`lib/frank-energie-client.ts`)

GraphQL API client for Frank Energie:

- **Authentication**: Login with email/password
- **Battery Management**: Get all smart batteries on account
- **Session Data**: Retrieve trading results and statistics
- **Battery Details**: Get battery settings and trading strategy

```typescript
import { FrankEnergieClient } from '../lib';

const client = new FrankEnergieClient({
  logger: (msg, ...args) => this.log(msg, ...args),
});

await client.login(email, password);
const batteries = await client.getSmartBatteries();
```

#### OnbalansmarktClient (`lib/onbalansmarkt-client.ts`)

REST API client for Onbalansmarkt.com:

- **Send Measurements**: Post battery trading results to Onbalansmarkt
- **Get Profile**: Retrieve user profile with ranking information
- **Supports All Fields**: batteryResult, batteryResultTotal, EPEX, imbalance, Frank Slim discount
- **Trading Mode**: Automatically includes detected trading mode
- **Rankings**: Overall rank and provider-specific rank

```typescript
import { OnbalansmarktClient } from '../lib';

const client = new OnbalansmarktClient({
  apiKey: 'your-api-key',
  logger: (msg, ...args) => this.log(msg, ...args),
});

// Send measurements
await client.sendMeasurement({
  timestamp: new Date(),
  batteryResult: 0.61,
  batteryResultTotal: 293.94,
  batteryCharge: 76,
  mode: 'imbalance',
});

// Get profile with rankings
const profile = await client.getProfile();
console.log(`Overall Rank: ${profile.resultToday?.overallRank}`);
console.log(`Provider Rank: ${profile.resultToday?.providerRank}`);
```

#### BatteryAggregator (`lib/battery-aggregator.ts`)

Aggregates trading results across multiple batteries:

- **Multi-Battery Support**: Accumulates results from all batteries on account
- **Comprehensive Results**: Period totals, EPEX, trading, Frank Slim, imbalance
- **Energy Scaling**: Helper to scale import/export values by battery count

```typescript
import { BatteryAggregator } from '../lib';

const aggregator = new BatteryAggregator({
  frankEnergieClient: client,
  logger: (msg, ...args) => this.log(msg, ...args),
});

const results = await aggregator.getAggregatedResults(startDate, endDate);
// results.periodTradingResult, results.totalTradingResult, etc.
```

#### TradingModeDetector (`lib/trading-mode-detector.ts`)

Determines Onbalansmarkt trading mode from Frank Energie battery settings:

- **Automatic Detection**: Maps Frank Energie batteryMode and imbalanceTradingStrategy
- **Supported Modes**: imbalance, imbalance_aggressive, self_consumption_plus, manual
- **Localization**: EN/NL descriptions for user display

```typescript
import { TradingModeDetector } from '../lib';

const battery = await client.getSmartBattery(deviceId);
const modeInfo = TradingModeDetector.detectTradingMode(battery.settings);
// modeInfo.mode: 'imbalance' | 'imbalance_aggressive' | ...
```

### Architecture Benefits

- **Separation of Concerns**: API clients separate from device logic
- **Reusability**: Services can be used by device, flows, or future features
- **Testability**: Each service can be unit tested independently
- **Type Safety**: Full TypeScript interfaces for all API responses
- **Logging Integration**: All services support Homey's logging system

### Key Concepts

- **Capabilities**: The app exposes four capabilities for the Frank Energie driver:
  - `battery_charging_state`: Battery charging state
  - `meter_power`: Power meter readings
  - `frank_energie_overall_rank`: Overall ranking position on Onbalansmarkt.com
  - `frank_energie_provider_rank`: Provider-specific ranking position

- **Configuration via Compose**: The app uses Homey's "compose" format for configuration:
  - `.homeycompose/app.json`: Main app configuration (gets compiled to `app.json`)
  - `drivers/frank-energie/driver.compose.json`: Driver configuration (gets compiled to `app.json`)

### Build Output

- TypeScript is compiled to JavaScript in the `.homeybuild/` directory
- The `app.json` file is auto-generated from `.homeycompose/app.json` and driver compose files
- `.homeybuild/` contains the compiled output ready for deployment

## Development Commands

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `.homeybuild/` directory.

### Validate

```bash
homey app validate
```

Validates the Homey app structure, manifest, and configuration. Use `-l debug` for detailed logging.

**Development Workflow:**

- Use `homey app validate -l debug` to check if you can test the app via `homey app run`
- Use `homey app validate` to verify the app is ready for publishing via `homey app publish`

### Lint

```bash
npm run lint
```

Runs ESLint on `.js` and `.ts` files using the Athom configuration.

### Coding and Formatting

All coding should be TypeScript compliant. The code should adhere to ESLint rules (for example whitespacing). For Markdown files, adhere to markdownlint rules.

#### Homey-Specific Best Practices

**Timer Management**:

- **ALWAYS** use `this.homey.setTimeout()` instead of global `setTimeout()`
- **ALWAYS** use `this.homey.setInterval()` instead of global `setInterval()`
- **WHY**: Homey's timer management provides automatic cleanup during app updates/restarts and prevents memory leaks
- **Pattern for Promise.race() with timeout**:

  ```typescript
  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    await Promise.race([
      asyncOperation(),
      new Promise((_, reject) => {
        timeoutHandle = this.homey.setTimeout(
          () => reject(new Error('Timeout')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
  ```

**Type Safety**:

- **NEVER** use `as any` - it disables TypeScript's type checking entirely
- **PREFER** `@ts-expect-error` with explanatory comment when accessing library internals
- **Example**:

  ```typescript
  // ❌ BAD: No explanation, disables all type checking
  const socket = (this.tuya as any).client;

  // ✅ GOOD: Documented reason, TypeScript still validates rest of line
  // @ts-expect-error - Accessing internal property for specific use case
  const socket = this.tuya.client;
  ```

**Logging**:

- **NEVER** use `console.log()` - logs don't appear in Homey's app logs
- **ALWAYS** use Homey's logging system via `this.log()`, `this.error()`, etc.
- **Pattern for service classes without Homey.Device access**:

  ```typescript
  export interface ServiceConfig {
    // ... other config
    logger?: (message: string, ...args: unknown[]) => void;
  }

  export class MyService {
    private logger: (message: string, ...args: unknown[]) => void;

    constructor(config: ServiceConfig) {
      // Fallback to no-op if logger not provided
      this.logger = config.logger || (() => {});
    }

    someMethod(): void {
      this.logger('MyService: Something happened', { detail: 'value' });
    }
  }

  // In device.ts or other code with Homey access:
  new MyService({
    logger: (msg, ...args) => this.log(msg, ...args),
  });
  ```

### Debug Mode

Set `DEBUG=1` environment variable to enable debug features in the Homey app.

### Changelog Management

When updating `.homeychangelog.json`:

**Target Audience**: Regular end users (not developers)

**Writing Guidelines**:

- ✅ **State WHAT changed** - Be factual and direct
- ✅ **Include concrete examples** - Show before/after when relevant
  (e.g., "3-Oct 14:25" instead of "03-10 14:25")
- ❌ **Do NOT explain WHY** - Avoid phrases like "makes it more readable", "for cleaner interface", "for better user experience"
- ❌ **Do NOT explain HOW** - Skip technical details like "supports both languages", implementation details
- ❌ **Do NOT add marketing language** - No justifications or selling points

**Structure**: Keep entries concise (1-2 sentences maximum)

**Good Examples**:

```text
"Connection status now shows month abbreviations
(e.g., '3-Oct 14:25' instead of '03-10 14:25')."

"Device credentials can now be updated directly in settings."
```

**Bad Examples**:

```text
"Improved connection status display with month abbreviations.
Supports both English and Dutch.
Makes timestamps more readable at a glance."

"Simplified credential management for cleaner interface
and better user experience."
```

## Development Workflow

### Making Code Changes

1. Edit TypeScript files in `/drivers/frank-energie/` or `app.ts`
2. Run `npm run build` to compile
3. Check `.homeybuild/` for compilation output
4. Fix any TypeScript errors before proceeding

### Modifying App Configuration

- Edit `.homeycompose/app.json` for app-level metadata (name, description, author, permissions)
- Do NOT manually edit `app.json` (it's auto-generated)
- Run `npm run build` after configuration changes to regenerate `app.json`

### Adding New Capabilities or Drivers

1. Update the driver composition file (`drivers/frank-energie/driver.compose.json`) with new capabilities
2. Add corresponding logic in `device.ts` to handle the new capabilities
3. Run `npm run build` to regenerate configuration files
4. Update device implementation files accordingly

## Configuration Files

### Homey Compose Architecture (CRITICAL)

**✅ CORRECT approach - Use Homey Compose structure:**

```text
.homeycompose/
├── app.json                     # App configuration
├── capabilities/                # Modular capability definitions (optional)
│   ├── custom_capability_1.json
│   └── custom_capability_2.json
├── flow/
│   ├── actions/                # Flow action definitions
│   ├── conditions/             # Flow condition definitions
│   └── triggers/               # Flow trigger definitions
└── drivers/
    └── frank-energie/
        ├── driver.compose.json         # Driver structure
        └── driver.settings.compose.json # Device settings
```

**❌ NEVER manually edit `app.json`:**

- File contains: `"_comment": "This file is generated. Please edit .homeycompose/app.json instead."`
- Gets overwritten on every build
- Manual changes will be lost

**✅ Benefits of Homey Compose approach:**

- **Consistency**: Ensures proper structure and validation
- **Maintainability**: Modular files easier to manage
- **Version Control**: Clear separation of concerns
- **Compliance**: Follows official Homey development guidelines

### Settings Architecture (IMPORTANT)

**Device settings belong in `driver.settings.compose.json`, NOT in `driver.compose.json`:**

- ✅ **`driver.settings.compose.json`** - User-configurable settings for each device instance:
  - Device credentials (API keys, tokens, etc.)
  - Feature toggles (enable/disable features)
  - Configuration options
  - Diagnostic settings

- ❌ **`driver.compose.json`** - Driver structure and metadata only:
  - Capabilities definitions
  - Capability options (min/max values, titles, etc.)
  - Pairing flows
  - Driver class and platform settings

**Rule**: If a user can change it in device settings UI, it belongs in `driver.settings.compose.json`

### Configuration File Details

- **app.json**: **AUTO-GENERATED** - Never edit manually! Generated by Homey Compose from `.homeycompose/` structure
- **`.homeycompose/app.json`**: App-level configuration source file
- **`.homeycompose/capabilities/`**: Individual capability definition files (modular approach for custom capabilities)
- **driver.compose.json**: Driver metadata, capability assignments, capability options, pairing flows
- **driver.settings.compose.json**: Device settings that users can configure per device instance
- **tsconfig.json**: TypeScript compilation settings targeting Node 16

### Context Token Optimization

**Context Token Optimization**: The auto-generated `app.json` file can become large and should be handled efficiently:

- **For app.json analysis**: Use specialized agents or read selectively when needed
- **For changelog updates**: Always refer to `.homeycompose/app.json` instead of `app.json`
- **For general development**: Focus on editable source files in `.homeycompose/` directory
- **When app.json access needed**: Read specific sections rather than entire file

**Rationale**: `app.json` is auto-generated from `.homeycompose/` files, creating redundant context. Efficient access provides information when needed while keeping general context lean.

## Important Files and Their Purposes

| File | Purpose |
|------|---------|
| `app.ts` | Main app class, entry point for app initialization |
| `drivers/frank-energie/driver.ts` | Driver class handling device discovery and pairing |
| `drivers/frank-energie/device.ts` | Device class handling individual device logic, settings, and capabilities |
| `drivers/frank-energie/driver.compose.json` | Driver configuration (capabilities, platforms, images) |
| `.homeycompose/app.json` | Source app configuration (auto-generates `app.json`) |
| `app.json` | **Auto-generated** - do not edit manually |
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript configuration (extends Node16, outputs to `.homeybuild/`) |

## Testing and Building

This is a simple Homey app with minimal dependencies. There are no test files in this repository. Testing should be done through:

1. Local Homey development environment
2. The Homey CLI (if available in your setup)
3. Manual testing on a Homey device

### Viewing System Logs

**Important**: The "System Logs" option is **not available by default** in the Homey Developer Portal.

**Alternative for viewing logs**:

```bash
homey app run
```

When running the app in development mode with `homey app run`, the terminal provides real-time log output from your app. This includes:

- `this.log()` messages
- `this.error()` messages
- Stack traces and error information
- App initialization and lifecycle events

**Best Practices for Logging**:

- Use descriptive log messages during development
- Include context in error logs (device ID, operation, parameters)
- Remove excessive debug logging before publishing
- Use `this.error()` for error conditions, `this.log()` for informational messages

## Deployment Notes

- The `.homeybuild/` directory contains the compiled JavaScript output ready for deployment
- The `.homeyignore` file specifies files that should be excluded from app deployments (CLAUDE.md, docs, etc.)
- Only files not in `.homeyignore` are included in the final app package

## Type Definitions

- The project uses `@types/homey` for Homey SDK type definitions
- TypeScript version 5.9.3 is used with strict type checking enabled
- The `@tsconfig/node16` configuration is extended for Node 16+ compatibility

## Official Homey Documentation

### Core References

- [Homey Apps SDK v3](https://apps-sdk-v3.developer.homey.app/index.html) - Main entry for documentation of all managers & classes in the Homey Apps SDK
- [Homey Apps SDK](https://apps.developer.homey.app) - SDK assisted manual overview

### Key SDK Components

- [App Class](https://apps-sdk-v3.developer.homey.app/App.html) - Main application entry point
- [Driver Class](https://apps-sdk-v3.developer.homey.app/Driver.html) - Device discovery and pairing
- [Device Class](https://apps-sdk-v3.developer.homey.app/Device.html) - Individual device management
- [Capabilities System](https://apps.developer.homey.app/the-basics/devices/capabilities) - Device capability definitions
- [Homey built-in device capabilities](https://apps-sdk-v3.developer.homey.app/tutorial-device-capabilities.html) - List of all system capabilities Homey provides
- [New guidelines for device capabilities](https://apps.developer.homey.app/upgrade-guides/device-capabilities) - Transition to custom capabilities in favor of system capabilities
- [Device Classes](https://apps-sdk-v3.developer.homey.app/tutorial-device-classes.html) - List of IDs to refer to a device in the Driver Manifest

### Configuration & Composition

- [App Manifest (app.json)](https://apps.developer.homey.app/the-basics/app) - App configuration
- [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose) - Build system for generating app.json
- [Driver Development](https://apps.developer.homey.app/the-basics/devices) - Driver-specific settings
- [Custom Capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities) - Creating device-specific capabilities

### Flow Cards & Automation

- [Flow Cards Overview](https://apps.developer.homey.app/the-basics/flow) - Automation triggers, conditions, actions
- [Flow Card Implementation](https://apps.developer.homey.app/the-basics/flow) - Registering flow card listeners

### Pairing & Device Management

- [Device Pairing](https://apps.developer.homey.app/the-basics/devices/pairing) - Custom pairing flows
- [Device Settings](https://apps.developer.homey.app/the-basics/devices/settings) - Device configuration management

### Localization

Strings exposed to the user should be localized. Use localization as required following the [Homey localization guide](https://apps.developer.homey.app/the-basics/app#locales).

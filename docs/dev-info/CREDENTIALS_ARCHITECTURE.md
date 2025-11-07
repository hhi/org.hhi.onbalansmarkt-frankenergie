# Credentials Architecture - Shared Frank Energie Credentials

## Overview

The Frank Energie Homey app now uses **app-level credentials** that are shared across all device types (Battery, EV, PV, Meter). This eliminates the need to enter Frank Energie credentials multiple times when adding different device types.

## Architecture

### Credential Storage Hierarchy

```
App Level (homey.settings)
├── frank_energie_email      ← Shared by all devices
├── frank_energie_password   ← Shared by all devices
│
└── Devices (device.settings)
    ├── Battery Device
    │   ├── frank_energie_email      (legacy/backup)
    │   ├── frank_energie_password   (legacy/backup)
    │   └── onbalansmarkt_api_key    ← Battery-specific (required during pairing)
    │
    ├── EV Charger Device
    │   ├── frank_energie_email      (legacy/backup)
    │   └── frank_energie_password   (legacy/backup)
    │
    ├── PV System Device
    │   ├── frank_energie_email      (legacy/backup)
    │   └── frank_energie_password   (legacy/backup)
    │
    └── Meter Device
        ├── frank_energie_email      (legacy/backup)
        └── frank_energie_password   (legacy/backup)
```

### Credential Resolution Order

When a device needs credentials:

1. **Try app-level credentials** (preferred, via `homey.settings`)
2. **Fall back to device-level credentials** (`device.settings`) for users that paired before the shared-store rollout
3. **Throw an error** if neither location has a value

```typescript
// lib/frank-energie-device-base.ts
const app = this.homey.app as FrankEnergieApp;
const appCredentials: AppCredentials | null = app.getCredentials?.() || null;

if (appCredentials) {
  frankEmail = appCredentials.email;
  frankPassword = appCredentials.password;
  this.log('Using app-level Frank Energie credentials');
} else {
  frankEmail = this.getSetting('frank_energie_email') as string;
  frankPassword = this.getSetting('frank_energie_password') as string;
  this.log('Using device-level Frank Energie credentials (legacy)');
}
```

## User Experience

### Scenario 1: Add Battery Device First (Recommended)

**Step 1 - Add Battery**:
```
User → Adds "Smart Battery" device
     → Enters: Email, Password, Onbalansmarkt API Key
     → App stores credentials at app level
     → Device created ✅
```

**Step 2 - Add EV Charger**:
```
User → Adds "EV Charger" device
     → NO credentials required! (uses app-level)
     → Device created ✅
```

**Step 3 - Add PV System**:
```
User → Adds "PV System" device
     → NO credentials required! (uses app-level)
     → Device created ✅
```

### Scenario 2: Add Non-Battery Device First

**Step 1 - Add EV Charger First**:
```
User → Adds "EV Charger" device
     → Enters: Email, Password
     → App stores credentials at app level
     → Device created ✅
```

**Step 2 - Add Battery**:
```
User → Adds "Smart Battery" device
     → Email & Password auto-filled from app level
     → Enters: Onbalansmarkt API Key only
     → Device created ✅
```

## Implementation Details

### App Class ([app.ts](app.ts:11))

```typescript
class FrankEnergieApp extends Homey.App {
  // Get credentials
  getCredentials(): { email: string; password: string } | null {
    const email = this.homey.settings.get('frank_energie_email');
    const password = this.homey.settings.get('frank_energie_password');
    return email && password ? { email, password } : null;
  }

  // Set credentials
  setCredentials(email: string, password: string): void {
    this.homey.settings.set('frank_energie_email', email);
    this.homey.settings.set('frank_energie_password', password);
  }

  // Check if credentials exist
  hasCredentials(): boolean {
    return this.getCredentials() !== null;
  }
}
```

### Device Base Class ([frank-energie-device-base.ts](lib/frank-energie-device-base.ts:55))

```typescript
protected async initializeClients(): Promise<void> {
  // Try app-level first
  const appCredentials = this.homey.app.getCredentials?.();

  let frankEmail: string;
  let frankPassword: string;

  if (appCredentials && appCredentials.email && appCredentials.password) {
    // Use app-level credentials (preferred)
    frankEmail = appCredentials.email;
    frankPassword = appCredentials.password;
    this.log('Using app-level Frank Energie credentials');
  } else {
    // Fall back to device-level (backwards compatibility)
    frankEmail = this.getSetting('frank_energie_email');
    frankPassword = this.getSetting('frank_energie_password');
    this.log('Using device-level Frank Energie credentials (legacy)');
  }

  // Validate and use credentials...
}
```

### Battery Driver ([drivers/frank-energie-battery/driver.ts](drivers/frank-energie-battery/driver.ts:19))

```typescript
session.setHandler('store_credentials', async (data) => {
  pairingData = data;
  return true;
});

session.setHandler('list_devices', async () => {
  this.homey.app.setCredentials?.(pairingData.email, pairingData.password);

  return [{
    settings: {
      frank_energie_email: pairingData.email,
      frank_energie_password: pairingData.password,
      onbalansmarkt_api_key: pairingData.onbalansmarktApiKey,
      poll_interval: 15,
      send_measurements: false,
    },
  }];
});
```

### EV Driver ([drivers/frank-energie-ev/driver.ts](drivers/frank-energie-ev/driver.ts:28))

```typescript
session.setHandler('verify_charger', async (data) => {
  // Get credentials from app settings OR provided data
  const appCreds = this.homey.app.getCredentials?.();
  const email = data.email || appCreds?.email;
  const password = data.password || appCreds?.password;

  // Store at app level if provided
  if (data.email && data.password) {
    this.homey.app.setCredentials?.(data.email, data.password);
  }
});
```

## Battery Device: Onbalansmarkt API Key Handling

### Why the UI still requires it

The Battery driver is the only component that:
- Sends measurements to Onbalansmarkt.com
- Retrieves rankings (overall/provider) via the REST API
- Emits ranking-related flow cards

To avoid a broken initial experience, the pairing UI keeps the API key field `required`. When users paste a placeholder key, the driver logs a warning but still creates the device so they can fetch Frank Energie data immediately (see `drivers/frank-energie-battery/driver.ts:97-107`).

### Runtime behavior

* Settings screen allows the key to be cleared after pairing.
* `initializeClients()` only instantiates `OnbalansmarktClient` when a trimmed API key is present.
* All ranking-related capabilities (`onbalansmarkt_*`) and flow cards automatically disable themselves when no API key is configured.

## Migration Path

### Existing Users (Upgrade from Old Version)

**Scenario**: User has multiple devices with individual credentials

**What happens**:
1. App upgrades, but credentials stay at device level
2. Devices continue to work (backwards compatibility)
3. FrankEnergieDeviceBase falls back to device-level credentials
4. No action required from user

**Optional**: User can re-pair devices to migrate to app-level

### New Users

**Scenario**: Fresh installation

**Workflow**:
1. Add Battery device → Enter credentials + API key → Stored at app level
2. Add other devices → No credentials needed → Use app-level
3. Done! ✅

## Benefits

### 1. Better User Experience
- ✅ Enter credentials once
- ✅ No duplicate credential entry
- ✅ Easier to add multiple device types

### 2. Easier Credential Management
- ✅ Update credentials in one place
- ✅ All devices automatically use updated credentials
- ✅ No need to update each device individually

### 3. Backwards Compatible
- ✅ Existing devices keep working
- ✅ Device-level credentials still supported
- ✅ Smooth migration path

### 4. Clearer Architecture
- ✅ App-level: Shared data (credentials)
- ✅ Device-level: Device-specific data (API keys, settings)
- ✅ Logical separation of concerns

## Security Considerations

### Credential Storage

**App-level credentials**:
```typescript
// Stored using Homey's settings API
this.homey.settings.set('frank_energie_email', email);
this.homey.settings.set('frank_energie_password', password);
```

**Security**:
- Credentials stored in Homey's secure settings storage
- Not exposed via API
- Encrypted at rest
- Same security level as device-level credentials

### API Key (Onbalansmarkt)

**Device-level only**:
- Each battery device has its own API key
- Not shared between devices
- Can be different per battery device if needed

## Testing

### Test Cases

1. **New Installation - Battery First**
   - [ ] Add battery device with credentials + API key
   - [ ] Verify app-level credentials stored
   - [ ] Add EV device without credentials
   - [ ] Verify EV device uses app-level credentials

2. **New Installation - EV First**
   - [ ] Add EV device with credentials
   - [ ] Verify app-level credentials stored
   - [ ] Add battery device
   - [ ] Verify battery can use app-level credentials
   - [ ] Verify API key required for battery

3. **Upgrade from Old Version**
   - [ ] Have devices with device-level credentials
   - [ ] Upgrade app
   - [ ] Verify devices still work
   - [ ] Verify device-level credentials still used

4. **Credential Priority**
   - [ ] Set app-level credentials
   - [ ] Set different device-level credentials
   - [ ] Verify app-level credentials take priority
   - [ ] Remove app-level credentials
   - [ ] Verify falls back to device-level

## Future Enhancements

### Possible Improvements

1. **App Settings UI**
   - Add UI to view/update app-level credentials
   - Show which devices use which credentials
   - Credential validation test button

2. **Credential Migration Tool**
   - Migrate all devices from device-level to app-level
   - One-click migration button

3. **Multi-Account Support**
   - Support multiple Frank Energie accounts
   - Device-level account selection

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Credentials per device** | Yes (4x entry) | No (1x entry) |
| **App-level storage** | ❌ | ✅ |
| **Backwards compatible** | N/A | ✅ |
| **Battery API key** | In settings | Required at pairing |
| **Credential reuse** | ❌ | ✅ |
| **Migration needed** | N/A | ❌ (automatic) |

**Result**: Simpler, more user-friendly, and more maintainable! 🎉

# Pairing Flow Simplification - Frank Energie Battery Driver

## Changes Overview

The battery pairing flow has been simplified from a 2-step process to a single-step process.

### Before

```
1. login.html
   ↓ (user enters credentials)
   ↓ (calls get_batteries handler)
   ↓
2. select-battery.html
   ↓ (user selects ONE battery)
   ↓ (calls list_devices with specific batteryId)
   ↓
3. Device created for ONE battery
```

### After

```
1. login.html
   ↓ (user enters credentials)
   ↓ (calls verify_credentials handler)
   ↓ (calls list_devices directly)
   ↓
2. Device created for ALL batteries
```

## Rationale

The battery selection step was redundant because:

1. **Automatic Battery Discovery**: The device implementation ([device.ts:54](drivers/frank-energie-battery/device.ts:54)) automatically fetches ALL batteries on the account via `getSmartBatteries()`

2. **Automatic Aggregation**: The `BatteryAggregator` processes all batteries automatically - there's no need to select one

3. **Single Device = All Batteries**: One device represents ALL Frank Energie batteries on the account, not a single battery

4. **External Batteries via Flows**: External batteries (like Sessy) are now added via flow cards, not during pairing

## Technical Changes

### 1. Driver Changes ([driver.ts](drivers/frank-energie-battery/driver.ts:1))

**Removed Handler**: `get_batteries`
- Was used to fetch battery list for selection screen
- No longer needed

**New Handler**: `verify_credentials`
- Verifies login credentials
- Checks if account has batteries
- Returns battery count for device naming

**Updated Handler**: `list_devices`
- No longer requires specific `batteryId`
- Uses fixed device ID: `frank-energie-batteries`
- Creates device with dynamic name based on battery count:
  - 1 battery: "Frank Energie Battery"
  - Multiple batteries: "Frank Energie Batteries (N)"

### 2. Login HTML Changes ([login.html](drivers/frank-energie-battery/pair/login.html:1))

**Updated Flow**:
```javascript
// Old: fetch batteries and go to next view
const result = await Homey.emit('get_batteries', { email, password });
Homey.nextView(); // Goes to select-battery.html

// New: verify and create device immediately
const result = await Homey.emit('verify_credentials', { email, password });
await Homey.emit('list_devices', { email, password, batteryCount });
```

**UX Improvements**:
- Added loading state: button shows "Verifying..." during authentication
- Button disabled during verification to prevent double-submit
- Clearer error handling with automatic re-enable on failure

### 3. File Deletions

**Removed**: `drivers/frank-energie-battery/pair/select-battery.html`
- No longer needed with simplified flow
- Battery selection is now automatic

## User Experience

### Before
1. User enters credentials
2. User sees list of batteries
3. User clicks on one battery to add
4. Device is created

### After
1. User enters credentials
2. Device is created automatically with all batteries
3. Done! ✅

## Device ID Change

**Important**: The device ID has changed from battery-specific to account-wide:

**Old**: Each device had unique ID from battery
```javascript
data: {
  id: batteryId,  // e.g., "abc123def456"
  batteryId: batteryId
}
```

**New**: Single fixed ID per account
```javascript
data: {
  id: 'frank-energie-batteries',
  type: 'smart-battery-aggregator'
}
```

**Impact**: Users can only have ONE Frank Energie battery device per account, which makes sense because:
- One device aggregates ALL batteries
- Multiple devices would create duplicate data
- Settings are account-level, not battery-level

## Migration Notes

**Existing Users**: No migration needed
- Existing devices keep their original IDs
- Will continue to work normally
- Can be removed and re-paired with new flow if desired

**New Users**: Will get the simplified experience
- Single pairing step
- Automatic battery discovery
- All batteries managed by one device

## Testing Checklist

- [x] TypeScript compilation successful
- [x] Homey app validation passes (`publish` level)
- [x] select-battery.html removed
- [x] login.html updated with new handlers
- [x] driver.ts uses verify_credentials and simplified list_devices
- [ ] Manual testing: Pair device with 1 battery
- [ ] Manual testing: Pair device with multiple batteries
- [ ] Manual testing: Error handling (wrong credentials)
- [ ] Manual testing: Error handling (no batteries on account)

## Benefits

1. **Simpler UX**: One less step for users
2. **More Intuitive**: Device represents "Frank Energie" account, not specific battery
3. **Consistent with Other Drivers**: EV and PV drivers work the same way
4. **Better Architecture**: Device automatically discovers and manages all batteries
5. **Extensible**: External batteries added via flows, not pairing

## Related Features

This simplification works well with the new **External Battery Metrics** feature:
- Frank Energie batteries: Auto-discovered during pairing
- External batteries (Sessy, etc.): Added via flow cards
- Both types: Aggregated in same device

See [EXTERNAL_BATTERY_METRICS.md](EXTERNAL_BATTERY_METRICS.md) for details.

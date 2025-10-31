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

1. **Automatic Battery Discovery**: The device automatically fetches ALL batteries on the account via Frank Energie API

2. **Automatic Aggregation**: The `BatteryAggregator` processes all batteries automatically - there's no need to select one

3. **Single Device = All Batteries**: One device represents ALL Frank Energie batteries on the account, not a single battery

4. **External Batteries via Flows**: External batteries (like Sessy, Zonneplan) are now added via flow cards, not during pairing

## Technical Changes

### 1. Driver Changes ([driver.ts](drivers/frank-energie-battery/driver.ts))

**Removed Handler**: `get_batteries`
- Was used to fetch battery list for selection screen
- No longer needed

**Updated Handlers**: `verify_credentials` and `list_devices`
- `verify_credentials`: Verifies login credentials and checks if account has batteries
- `list_devices`: Creates device with fixed ID `frank-energie-batteries`

### 2. Login HTML Changes ([pair/login.html](drivers/frank-energie-battery/pair/login.html))

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

### 3. File Changes

**Removed**: `drivers/frank-energie-battery/pair/select-battery.html`
- No longer needed with simplified pairing flow
- Battery selection is now automatic during first poll

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

## Device ID

The Frank Energie Battery device uses a fixed account-level ID:

```javascript
data: {
  id: 'frank-energie-batteries',
  type: 'smart-battery-aggregator'
}
```

**Design**: Users can only have ONE Frank Energie Battery device per account because:
- One device aggregates ALL batteries from that account
- Multiple devices would create duplicate data
- Credentials and settings are account-level

## Backward Compatibility

**Existing Users**: Works as-is
- Old devices continue functioning with original device IDs
- New pairing uses simplified flow
- Can remove and re-pair if desired

**New Users**: Get simplified experience
- Single pairing step
- Automatic battery discovery
- All batteries immediately available

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

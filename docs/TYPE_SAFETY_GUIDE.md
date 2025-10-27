# Type Safety Guide

## Avoiding @ts-expect-error: Using FrankEnergieApp Types

This guide shows how to access app-level methods in a type-safe manner without using `@ts-expect-error`.

## The Problem

When accessing custom app-level methods like `getCredentials()` or `hasCredentials()`, TypeScript doesn't know about these methods because they're not defined in the base `Homey.App` interface.

### ❌ Old Approach (Using @ts-expect-error)

```typescript
// ❌ Disables type checking for this line
// @ts-expect-error - Accessing app instance with specific methods
const appCredentials = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

// ❌ No IDE autocomplete, no type safety
// @ts-expect-error - Accessing app instance with specific methods
const hasCredentials = this.homey.app.hasCredentials?.() as boolean | undefined;
```

**Problems:**
- Disables TypeScript checking
- No IDE autocomplete
- Manual type casting required
- Harder to maintain

## ✅ New Approach (Using FrankEnergieApp Type)

### Step 1: Import the Type

```typescript
import { FrankEnergieApp, AppCredentials } from '../lib';
```

### Step 2: Type Cast Once

```typescript
// Type cast the app instance once at the beginning
const app = this.homey.app as FrankEnergieApp;
```

### Step 3: Use with Full Type Safety

```typescript
// ✅ Full type safety, IDE autocomplete works
const hasCredentials = app.hasCredentials?.() || false;

// ✅ Typed return value
const appCredentials: AppCredentials | null = app.getCredentials?.() || null;

if (appCredentials) {
  // TypeScript knows these properties exist
  const email = appCredentials.email;    // ✅ Type: string
  const password = appCredentials.password; // ✅ Type: string
}
```

## Complete Examples

### Example 1: Device Base Class

**Before (with @ts-expect-error):**
```typescript
protected async initializeClients(): Promise<void> {
  // @ts-expect-error - Accessing app instance with specific methods
  const appCredentials = this.homey.app.getCredentials?.() as { email: string; password: string } | null | undefined;

  if (appCredentials && appCredentials.email && appCredentials.password) {
    // Use app-level credentials
  }
}
```

**After (with FrankEnergieApp type):**
```typescript
import { FrankEnergieApp, AppCredentials } from './index';

protected async initializeClients(): Promise<void> {
  const app = this.homey.app as FrankEnergieApp;
  const appCredentials: AppCredentials | null = app.getCredentials?.() || null;

  if (appCredentials) {
    // TypeScript knows appCredentials.email and appCredentials.password exist
    const frankEmail = appCredentials.email;
    const frankPassword = appCredentials.password;
    this.log('Using app-level Frank Energie credentials');
  } else {
    // Fall back to device-level credentials
    const frankEmail = this.getSetting('frank_energie_email') as string;
    const frankPassword = this.getSetting('frank_energie_password') as string;
    this.log('Using device-level Frank Energie credentials (legacy)');
  }
}
```

### Example 2: Driver Pairing Handler

**Before (with @ts-expect-error):**
```typescript
session.setHandler('check_credentials', async () => {
  // @ts-expect-error - Accessing app instance with specific methods
  const hasCredentials = this.homey.app.hasCredentials?.() as boolean | undefined;
  return { hasCredentials: hasCredentials || false };
});
```

**After (with FrankEnergieApp type):**
```typescript
import { FrankEnergieApp } from '../../lib';

session.setHandler('check_credentials', async () => {
  const app = this.homey.app as FrankEnergieApp;
  const hasCredentials = app.hasCredentials?.() || false;
  return { hasCredentials };
});
```

### Example 3: With Type Guard (Advanced)

For extra safety, use the type guard function:

```typescript
import { FrankEnergieApp, isFrankEnergieApp } from '../lib';

protected async initializeClients(): Promise<void> {
  // Check if app has Frank Energie methods
  if (isFrankEnergieApp(this.homey.app)) {
    // TypeScript now knows this.homey.app is FrankEnergieApp
    const credentials = this.homey.app.getCredentials?.() || null;

    if (credentials) {
      this.log('Using app-level credentials');
      // Use credentials.email, credentials.password
    }
  } else {
    this.log('App does not have credential methods, using device settings');
  }
}
```

## Benefits of This Approach

| Feature | @ts-expect-error | FrankEnergieApp Type |
|---------|------------------|----------------------|
| Type Safety | ❌ Disabled | ✅ Enabled |
| IDE Autocomplete | ❌ No | ✅ Yes |
| Compile-time Checks | ❌ No | ✅ Yes |
| Refactoring Support | ❌ Limited | ✅ Full |
| Maintainability | ❌ Lower | ✅ Higher |
| Documentation | ❌ Via comments | ✅ Via types |

## When to Use Each Approach

### Use FrankEnergieApp Type (Preferred):
- ✅ Accessing custom app-level methods
- ✅ When you control both the app and the calling code
- ✅ For better IDE support and type safety

### Use @ts-expect-error (Only When Necessary):
- ⚠️ Accessing third-party library internals
- ⚠️ Temporary workarounds for library bugs
- ⚠️ When proper types are impossible to define
- ⚠️ **Always include an explanatory comment**

## Migration Checklist

To migrate existing code from `@ts-expect-error` to `FrankEnergieApp`:

- [ ] Import `FrankEnergieApp` and `AppCredentials` from `lib/index`
- [ ] Replace `@ts-expect-error` comments with type cast: `const app = this.homey.app as FrankEnergieApp;`
- [ ] Remove manual type casting (e.g., `as boolean`, `as { email: string }`)
- [ ] Use typed return values: `AppCredentials | null` instead of `any`
- [ ] Test that IDE autocomplete works
- [ ] Verify TypeScript compilation succeeds

## References

- Type definitions: [`lib/app-types.ts`](../lib/app-types.ts)
- Type exports: [`lib/index.ts`](../lib/index.ts)
- CLAUDE.md Type Safety section

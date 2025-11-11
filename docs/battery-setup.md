# Setting Up Sessy Batteries with Flow Cards

This guide explains how to link each Sessy battery from your Slim Handelen battery set to its own flow card, enabling you to report measured energy values to the Onbalansmarkt app.

## Overview

Each Sessy battery in your battery set needs to be connected to a flow card action. This allows the Homey system to receive and track:

- **Total Charged Energy** (in kWh)
- **Total Discharged Energy** (in kWh)
- **Current Battery Percentage**

The system uses a unique **Battery ID** to identify and track each battery individually.

## Step 1: Identifying Your Battery ID

Each Sessy battery has a unique identifier that you'll use to connect it to the flow card system.

You can use **either**:

- **The battery's own ID** - A unique identifier assigned by Sessy (e.g., `DNTDLQM3`, `DV6THVJP`)
- **A custom ID** - A name of your choice for easier reference (e.g., `Sessy-1`, `Sessy-Kitchen`, `Battery-Main`)

![Sessy Battery ID Selection](Sessy%20batterij%20toevoegen%20op%20ID.png)

**Example:** In the image above, battery ID `DNTDLQM3` is entered in the flow card action, which corresponds to the Sessy battery named "SESSY_DNTDLQM3 #2".

## Step 2: Creating the Flow Card Action

For each battery in your battery set, you need to create a **"Receive battery metrics"** flow card action that:

1. **Identifies the battery** by its unique ID
2. **Provides the measured values** that the battery reports

### Setting Up a Single Battery

In your Homey flow:

1. Create a new automation or edit an existing one
2. Add an action card: **"Receive battery metrics for battery"** (Frank Energie Batteries app)
3. Enter the battery's unique ID
4. Fill in the three measurement fields:

   - **Energy Charged** (kWh, delivered) - Total energy charged to the battery
   - **Energy Discharged** (kWh, on) - Total energy discharged from the battery
   - **Battery Level** (%) - Current battery state of charge percentage

![Energy Measured Values](Sessy%20Energie%20geladen%20argument.png)

**Example:** The image shows the available energy measurements from a Sessy battery, including:
- `Energie Geladen` (Energy Charged) = 2010.66 kWh
- `Energie Ontladen` (Energy Discharged) = 1678.79 kWh
- `Accuniveau` (Battery Level) = 57%

## Step 3: Setting Up Multiple Batteries

For a battery set with **3 participating batteries**, you would create 3 separate flow card actions, one for each battery:

![Three Battery Setup Example](Sessy%20batterry%20info.png)

### Example Configuration

**Battery 1: DV6THVJP**

- Energy Charged: [value from Sessy battery #1]
- Energy Discharged: [value from Sessy battery #1]
- Battery Level: [percentage from Sessy battery #1]

**Battery 2: DNTDLQM3**

- Energy Charged: [value from Sessy battery #2]
- Energy Discharged: [value from Sessy battery #2]
- Battery Level: [percentage from Sessy battery #2]

**Battery 3: DP5USJQ9**

- Energy Charged: [value from Sessy battery #3]
- Energy Discharged: [value from Sessy battery #3]
- Battery Level: [percentage from Sessy battery #3]

As shown in the example image, when you provide metrics for multiple batteries, the app aggregates them to show:

- Total charged/discharged across all batteries
- Average battery percentage
- Individual battery tracking

## Key Points

- **Unique IDs are essential**: Each battery must have a unique identifier so the app can track which battery reported which values
- **Battery ID consistency**: Once you choose an ID for a battery, use the same ID every time you report its metrics
- **Measured values matter**: Always use the total energy values from your Sessy battery display, not delta values
- **Frequency**: Update battery metrics as frequently as your Sessy system provides updates (typically every 5-15 minutes)

## Troubleshooting

### Battery metrics not appearing

- Verify the battery ID is entered correctly and consistently
- Check that all three measurement fields (charged, discharged, percentage) are provided
- Ensure the flow card action is triggered at the right time

### Seeing duplicate batteries

- This usually means the same battery was registered with different IDs
- Use consistent IDs for each battery across all flow cards

### Aggregated values seem wrong

- Check that each battery is only counted once (no duplicate IDs)
- Verify that the measured values are cumulative totals, not daily deltas

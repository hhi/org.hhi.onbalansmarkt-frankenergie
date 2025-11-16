# Onbalansmarkt Frank Energie Homey App

Homey app for live feedback of current trading results from Frank Energie to onbalansmarkt.com.

**Languages:** English | [Nederlands](#nederlands)

## Overview

This Homey app delivers real-time battery trading results from your Frank Energie smart battery directly to [onbalansmarkt.com](https://onbalansmarkt.com), enabling you to track your trading performance and rankings.

### Supported Devices

- **Frank Energie Smart Battery** - Primary device for trading results and battery metrics
- **Frank Energie Meter** - Track electricity consumption and production data
- **Frank Energie EV Charger** - Monitor electric vehicle charging status
- **Frank Energie PV System** - Track solar panel performance

## Features

- **Real-time Trading Data**: Automatically fetch daily trading results, EPEX pricing, and imbalance metrics
- **Onbalansmarkt Integration**: Send measurements directly to onbalansmarkt.com with a single API key
- **Rankings Display**: View your overall ranking and provider-specific ranking
- **External Battery Support**: Track metrics from external batteries (charge percentage, daily charged/discharged energy)
- **Multiple Batteries**: Support for multiple batteries on a single account with aggregated results
- **Flow Cards**: 30+ flow cards (triggers, conditions, actions) for powerful automation
- **Custom Capabilities**: 50+ custom capabilities for comprehensive data visualization
- **Historical Graphs**: View trading results and rankings over time
- **Automatic Daily Resets**: Baseline resets for accurate daily calculations
- **Flexible Polling**: Configurable polling intervals per driver (1-1440 minutes)
- **Credential Pre-filling**: Seamless multi-device setup with shared credentials

## Requirements

### Prerequisites

1. **Homey Device** running Homey OS >= 12.4.0 (local platform only)
2. **Frank Energie Account** - Smart battery system with Frank Energie
3. **Onbalansmarkt API Key** - Available from [onbalansmarkt.com](https://onbalansmarkt.com) (for measurement sending)

### Optional

- **Zonneplan Account** - For Zonneplan battery integration via flow cards

## Installation

1. Open Homey App Store
2. Search for "Onbalansmarkt Frank Energie"
3. Tap "Install"
4. Follow the pairing wizard to add your first device

## Configuration

### First Device Setup

When adding the first Frank Energie Battery device:

1. **Enter Credentials**: Provide your Frank Energie email and password
2. **Provide API Key**: Enter your Onbalansmarkt API key (get it from onbalansmarkt.com)
3. **Select Battery**: Choose which battery to add
4. **Automatic**: Credentials are saved for future devices

### Adding Additional Devices

For subsequent devices (Meter, EV, PV):

1. **Credentials Pre-filled**: Your Frank Energie credentials are automatically pre-filled
2. **Select Device**: Choose the specific device to add
3. **Configure Settings**: Device-specific settings (poll interval, etc.)

### Device Settings

#### Battery Driver Settings

- **Email/Password**: Frank Energie credentials
- **API Key**: Onbalansmarkt.com API key (required for measurement sending)
- **Poll Interval**: Data polling frequency (1-1440 minutes, default: 5 minutes)
- **Onbalansmarkt Profile Poll Interval**: Profile/rankings polling frequency (1-1440 minutes, default: 5 minutes)
- **Auto-send Measurements**: Automatically send data to Onbalansmarkt
- **Report zero trading days**: Send measurements to Onbalansmarkt and trigger flow cards even when daily result is €0 (default: disabled)
- **Trading Mode**: Detected automatically from battery settings
- **Load Balancing**: Toggle to indicate dynamic load balancing status
- **Show amounts including VAT**: Display trading results with VAT applied (default: enabled, 21%)
- **VAT Percentage**: Configure VAT percentage for display (0-100%, default: 21%)

#### Meter Driver Settings

- **Email/Password**: Frank Energie credentials
- **Poll Interval**: Data polling frequency (30 or 60 minutes, default: 60)
- Site reference auto-discovered during pairing

#### EV Driver Settings

- **Email/Password**: Frank Energie credentials
- **Poll Interval**: Data polling frequency (1-1440 minutes)
- Enode location ID auto-discovered during pairing

#### PV Driver Settings

- **Email/Password**: Frank Energie credentials
- **Poll Interval**: Data polling frequency (1-1440 minutes)
- Solar system ID auto-discovered during pairing

## Flow Cards

### Triggers

- Daily results available
- External battery metrics updated
- Frank Slim bonus detected
- Measurement sent
- New battery added
- Ranking improved/declined
- Result positive/negative
- Top performer alert
- Trading mode changed
- And more...

### Conditions (6)

- Frank Slim active
- Provider rank better than X
- Rank in top X
- Result exceeds threshold
- Result is positive
- Trading mode matches

### Actions (10)

- Force data poll
- Log to timeline
- Receive battery metrics
- Reset baseline
- Send notification
- Toggle measurement sending
- Update dashboard
- And more...

## Capabilities

The app provides 50+ custom capabilities including:

- `frank_energie_trading_result` - Daily trading result (€)
- `frank_energie_battery_charge` - Battery percentage (%)
- `onbalansmarkt_overall_rank` - Your overall ranking
- `onbalansmarkt_provider_rank` - Provider-specific ranking
- `frank_energie_trading_result_total` - Monthly/period total
- `external_battery_percentage` - External battery charge %
- And many more for comprehensive monitoring...

## Troubleshooting

### Device Won't Pair

**Issue**: Pairing fails with "Invalid credentials"

**Solution**:
1. Verify your Frank Energie email and password
2. Check Frank Energie app to confirm account access
3. Ensure your account has an active smart battery

### Measurements Not Sending

**Issue**: Data not appearing in onbalansmarkt.com

**Solution**:
1. Verify your API key in device settings (copy from onbalansmarkt.com)
2. Ensure "Auto-send Measurements" is enabled
3. Check Homey logs for error messages
4. Manually trigger a poll via "Force Data Poll" action

### High API Usage

**Issue**: Too many Frank Energie API requests

**Solution**:
1. Increase polling interval in device settings (default: 5 minutes)
2. Use "Polling Alignment" setting to distribute requests across time
3. Reduce number of active devices if possible

### Missing Data Points

**Issue**: Some capabilities show no value

**Solution**:
1. Allow time for initial data collection (first poll may take a minute)
2. Verify device is polling correctly via logs
3. Check battery has sufficient data in Frank Energie app first
4. Review "Next Poll" sensor to see when next update occurs

## Support

For issues, feature requests, or bug reports, please visit:
[GitHub Issues](https://github.com/hhi/org.hhi.onbalansmarkt-frankenergie/issues)

## License

Please see the repository for license information.

## Privacy

This app respects your privacy:
- Credentials are stored locally on your Homey device only
- Data is only sent to onbalansmarkt.com if explicitly enabled
- No telemetry or tracking

---

# Nederlands

## Overzicht

Deze Homey-app levert real-time batterijtradingresultaten van uw Frank Energie-slimme batterij rechtstreeks naar [onbalansmarkt.com](https://onbalansmarkt.com), zodat u uw tradingprestaties en rankings kunt volgen.

### Ondersteunde Apparaten

- **Frank Energie Slimme Batterij** - Primair apparaat voor tradingresultaten
- **Frank Energie Meter** - Traceer energie consumptie en productie
- **Frank Energie EV Lader** - Monitor EV laadstatus
- **Frank Energie PV Systeem** - Volg zonnepaneel prestaties

## Functies

- **Real-time Tradinggegevens**: Automatisch dagelijkse tradingresultaten ophalen
- **Onbalansmarkt Integratie**: Direct metingen naar onbalansmarkt.com verzenden
- **Rankings Weergave**: Bekijk uw overall ranking en provider-specifieke ranking
- **Externe Batterij Ondersteuning**: Traceer metriek van externe batterijen
- **Meerdere Batterijen**: Ondersteuning voor meerdere batterijen met geaggregeerde resultaten
- **Flow Cards**: 30+ flow cards voor krachtige automatisering
- **Aangepaste Capabilities**: 50+ custom capabilities voor gedetailleerde gegevens
- **Historische Grafieken**: Bekijk tradingresultaten in de tijd
- **Automatische Dagelijkse Reset**: Baseline resets voor nauwkeurige berekeningen
- **Flexibele Polling**: Configureerbare poll-intervallen per driver

## Vereisten

### Noodzakelijk

1. **Homey Apparaat** met Homey OS >= 12.4.0
2. **Frank Energie Account** - Slimme batterij systeem
3. **Onbalansmarkt API Key** - Beschikbaar op onbalansmarkt.com

## Installatie

1. Open Homey App Store
2. Zoek naar "Onbalansmarkt Frank Energie"
3. Tik op "Installeren"
4. Volg de pairingwizard

## Ondersteuning

Voor problemen of vragen: [GitHub Issues](https://github.com/hhi/org.hhi.onbalansmarkt-frankenergie/issues)

## Privacy

- Inloggegevens worden alleen lokaal opgeslagen op uw Homey-apparaat
- Geen telemetrie of tracking

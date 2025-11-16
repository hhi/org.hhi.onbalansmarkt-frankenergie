Send live feedback of your current trading results achieved with your home battery system via Frank Energie to Onbalansmarkt.
Monitor Onbalansmarkt rankings and reported charge/discharge values from your participating home battery system.
Overview of relevant Frank Energie smart services information.


FEATURES

Frank Energie - Slim Handelen:
Deploy your battery system via Frank Energie's Slim Handelen:
- Sum of batteries that register total charge/discharge state
- Aggregate handling of batteries with daily total charge/discharge values
- Average battery percentage determination
- Load balancer presence indicator processing (via settings)
- Trading strategy forwarding
- Poll and reporting timer (preferably every 15 minutes)

Onbalansmarkt feedback:
- Reported charged and delivered (previous upload)
- Live Frank Energie ranking
- Ranking across all providers

Frank Energie - Slim Handelen (smart battery) metrics:
- Trading result and EPEX yield
- Lifetime total
- Slim discount
- Yield per participating battery

Frank Energie EV - Smart charging (electric vehicle):
- EV charging bonus
- Last known EV battery percentage
- EV charger status
- Poll timer (minimum every 5 minutes)

Frank Energie PV - Smart PV system (solar panels):
- Current power output
- Current generation
- PV bonus
- Poll timer (minimum every 5 minutes)

Frank Energie - Energy measurement reporting:
- Current and next market price
- Today's consumption and costs
- Lowest/highest/average market price today
- Consumption on low tariff
- Poll timer (minimum every 30 minutes)


SETUP

Add the Frank Energie Battery (Slim Laden) device first:
- Enter your Frank Energie login credentials,
- Enter the Onbalansmarkt API key,
- Let the wizard save credentials for any additional drivers (PV, EV, Meter)

INTEGRATION

To process current battery set measurements in the app, we use an Advanced Flow schema.
Via an action (THEN) flow card, you provide the measured values for each participating battery.

Using the "Receive daily battery metrics" action card:
- Daily charged power in kWh
- Daily delivered power in kWh
- Measured battery percentage

Using the "Receive battery metrics" action card:
- Total charged power value in kWh
- Total delivered power value in kWh
- Measured battery percentage

See the source code documentation at docs/battery-setup.md for adding a Sessy battery.


USAGE

After integration, open the battery settings to configure:
- Poll-interval: How often to fetch data from Frank Energie (1-1440 minutes, default: 5)
- Onbalansmarkt Profile Poll Interval: How often to fetch profile data (rankings) from Onbalansmarkt (1-1440 minutes, default: 5)
- Auto-send measurements: Enable to automatically send trading results to Onbalansmarkt
- Load-balancing: Indicate if dynamic load balancing is active on your battery system
- Report zero trading days: Enable to send measurements and trigger flow cards even when daily result is €0 (default: disabled)
- VAT display: Choose to display trading results with or without VAT (default: with 21% VAT)

Note: automatic sending of live results is disabled by default. 
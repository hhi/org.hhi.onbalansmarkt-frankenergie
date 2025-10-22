# onbalansmarkt-frankenergie-homey

Homey oplossing voor live-opbrengst rapportage op [onbalansmarkt.com](https://onbalansmarkt.com):

- (Sessy) thuisbatterijsysteem (1 tot n batterijen)
- In experimentele fase, support voor diverse thuisbatterijsystemen waaronder AlphaESS, HomeVolt of de via SolarEdge modbus aangestuurde configuraties.
- Frank Energie slim handelen account

*Voorbeeld:*
![hhi-onbalans](./hhi-onbalansmarkt.png)

### uitgebreide scripting

De scripting in deze repository als copy van het originele script is geschikt gemaakt voor rapportage over meerdere individuele (Sessy)batterijen, omdat het basisscript hierin niet voorzag, d.w.z. alleen de eerste deelnemende batterij ging mee in de rapportage.

De repository bevat de benodigde Homeyscripts waarmee je een Advanced Flow kunt maken, zodat je onbalans resultaat periodiek (instelbaar) via de API kunt rapporteren naar de service.

Je hebt naast je account creditionals van je energiemaatschappij ook een API key nodig die je op kunt vragen na aanmelding bij Onbalansmarkt.

## features

Enkele features waarmee het basisscript is uitgebreid:

- rapportage over de gehele batterijcollectie aan deelnemende thuisbatterijen;
- rapportage van het actuele batterijpercentage gemiddelde;
- rapportage van de dan geldende Kwhs geladen en kWh ontladen waarden, cummulatief;
- automatische bepaling van de handelsmodus (onbalans, zelfconsumptie)
- scripting is geanonimiseerd door login credentionals en de benodigde API-key extern aan het script aan te bieden;
- periode instelbaar van upload van de meetgegevens naar onbalansmarkt.com;
- het is relatief eenvoudig een ander merk batterij (waaronder AlphaESS) te bevragen, zie de **systeemnaam**-setup.js als voorbeeld, waarin de benodigde device capabilities per batterij staan waarover gerapporteerd.

## Homey Advanced Flow

Onderstaand het screenshot hoe de gebruiker een Homey Advanced Flow kan maken. Helaas biedt Homey geen makkelijke manier aan om dit soort flows te exporteren cq importeren. Dit is handwerk en vergt kennis van hoe je een Advanced Flow kunt designen.

- Sla de inhoud per (javascript) .js bestand op als Homeyscript, met gelijksoortige naamgeving (naam zonder de extensie);
- Maak de globale variabelen aan (zie verderop);
- Maak de Advanced flow aan met daarbij de 'then' Homeyscipt - as script kaartjes, waarbij je per kaartje de naam van het overeenkomstige bestand kiest;
- Maak voor je eigen batterij (zonodig) een Homey script aan onder de naam  merk-setup.js en verbind deze zoals in het voorbeeld het sessy-setup Homeyscript;
- Door met de muis op de '23:59 kaartje' te staan, is deze afzonderlijk te starten. Voer eventueel eenmalig uit als setup mocht je initieel problemen ondervinden. De geleverde scripts zijn ook afzonderlijk uit te voeren in de Homeyscript (< / >) mode sectie zelf natuurlijk (*handig wat betreft logging output*).

### flow

![Homey-FrankEnergie](./Homey-FrankEnergie.png)

### autorisatie

De login/password combinatie kan de gebruiker zelf opvoeren als Homey Flow variabele, zodat het script voortaan geen wijziging behoeft. Zie hiervoor onderstaand screenshot want de naamgeving en de manier van doorgeven moet overeenkomstig zijn. Voor het mee kunnen geven van de namen van de variabelen betreft het hier een 'script met argument' kaartje met een explicite komma tussen de variable namen: "frankenergie_id,frankenergie_pw,onbalansmarkt_apikey"

![Homey-variabelen](./Homey-variabelen.png)

### rapportage

De Sessy API (als bijvoorbeeld) leverde initieel geen dagtotalen (alleen grand totals). Voor de rapportage per dag is dit probleem opgelost door een delta gemiddelde te bepalen t.o.v. voorgaande dag.
Instelbaar welke periode (om de 15 minuten in dit voorbeeld) wordt de API van onbalansmarkt.com gevoed met nieuwe gegevens.

Op de tijdlijn krijgt de Homey gebruiker een feed te zien van aangeleverde baterijpercentage en de naar beneden afgeroden (ont)laad kWhs. Bij de 'teller op nul' notificatie zie je de vorige dag intern opgeslagen waarden.

![Tijdlijn voorbeeld](./Tijdlijn%20voorbeeld.png)

## ondersteuning merkgebonden batterijsystemen

De scripting is relatief eenvoudig aan te passen voor andere batterijsystemen dan Sessy, zoals o.a. de AlphaESS.
(Zie ook [batterij capabilities](./batteries.md))

```javascript
//excerpt uit sessy-setup.js als voorbeeld

// bepaal de device capabilities per battery systeem, en of de delta bepaald moet worden
await setVariableValue('battery_system', 'sessy');
console.log('battery_system:', await getVariableValue('battery_system', 'default'));

await setVariableValue('battery_class', 'battery');
console.log('battery_class:', await getVariableValue('battery_class', 'default'));


await setVariableValue('battery_import', 'meter_power.import');
console.log('battery_import:', await getVariableValue('battery_import', 'default'));

await setVariableValue('battery_export', 'meter_power.export');
console.log('battery_export:', await getVariableValue('battery_export', 'default'));

await setVariableValue('battery_level', 'measure_battery');
console.log('battery_level:', await getVariableValue('battery_level', 'default'));


await setVariableValue('battery_delta', 'Yes');
console.log('battery_delta:', await getVariableValue('battery_delta', 'Yes'));
```

Bij batterijsystemen die al voorzien in dagtotalen moet de extra delta verwerking stop op 'No' taan. Voor zover nu na te gaan is alleen bij Sessy, AlphaESS en SolarEdge StoreEdge kWh de dag ont(laad)totaal mode van toepassing.
Zie daarvoor de scripts sessy-setup.js, alphaESS-setup.js of sigEnergy-setup.js:

| Systeem | Batterij % | kWh laadtotaal | kWh ontlaadtotaal | Driver-Id | Class | delta verwerking |
|---|---|---|---|---|---|---|
| Sessy | measure_battery | meter_power.import | meter_power.export | sessy | battery | Yes |
| AlphaESS | measure_battery | meter_power.charged | meter_power.discharged | alpaess | battery | Yes |
| ZP Nexus | measure_battery | meter_power.daily_import | meter_power.daily_export |  zonneplan | battery | No |
| Homevolt | measure_battery | meter_power.imported | meter_power.exported | homevolt-battery | battery | Yes |
| SolarEdge SigEnergy | measure_battery | meter_power.daily_charge | meter_power.daily_discharge | sigenergy  | solarpanel | No |
| SolarEdge Solax | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | solax | solarpanel | No |
| SolarEdge Wattsonic | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | wattsonic | solarpanel | No |
| SolarEdge Sungrow | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | sungrow | solarpanel | No |
| SolarEdge Huawei | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | huawei | solarpanel | No |
| SolarEdge Growatt | measure_battery | meter_power.today_batt_input | meter_power.today_batt_output | growatt | solarpanel | No |
| SolarEdge StoreEdge | measure_battery | meter_power.import | meter_power.export | storeedge | solarpanel | Yes |

De aan SolarEdge Modbus geleerde batterijen worden naar verwachting bevraagd via de 'SolarEdge + Growatt TCP modbus' App. Maak je eigen setup script op basis van bovenstaande waarden en vervang in de flow het 'sessy-setup' kaartje met je eigen homeyscript variant.

### afgeleide handelsmodus bepaling

De bevraging van welke handelsmodus van toepassing, wordt bepaald door een mapping tussen Frank Energie gerelateerde gegevens aan die van de Onbalansmarkt API. De uiteindelijk bepaalde handelsmodus (mode) wordt in de code als volgt gemapt.

| Handelsmode            | Handelsstrategie | Uiteindelijke handelsmodeus                 |
|------------------------|------------------|----------------------|
| IMBALANCE_TRADING      | STANDARD         | imbalance            |
| IMBALANCE_TRADING      | AGGRESSIVE       | imbalance_aggressive |
| SELF_CONSUMPTION_MIX   | -                | self_consumption_plus|
| Other                  | -                | manual               |
| ? | ? | self_consumption (n/a)|
| ? | ? | day_ahead (n/a) |

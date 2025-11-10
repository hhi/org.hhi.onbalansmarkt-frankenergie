Stuur live feedback van je actuele handelsresultaten die je met je thuisbatterijsysteem hebt behaalt bij Frank Energie naar Onbalansmarkt.
Monitoring van Onbalansmarkt Ranking en gerapporteerde waarden van (ont)laden van je participerende thuisbatterijset.
Overzicht van relevante Frank Energie slimme diensten informatie.

KOPPELINGEN

- Deelnemende Frank Energie batterijen via Slim laden

FEATURES

Frank Energie - Slim Handelen:
Inzetten van je batterijsysteem via Frank Energie's Slim Handelen:
- som van batterijen die de totaal (ont)laad stand registreren
- som afhandeling van batterijen met dagtotaal (ont)laad stand
- gemiddelde batterij percentage bepaling
- load balancer aanwezig indicatie verwerking (via settings)
- handelstrategie doorgeven
- poll en rapportage timer (per 15 minuten bij voorkeur)

Onbalansmarkt feedback:
- gerapporteerd geladen en geleverd (vorgie upload)
- ranglijst live Frank Energie
- ranglijst alle Providers

Frank Energie - Slim handelen metrieken:
- Handelsresultaat en EPEX opbrengst
- Lifetime totaal
- slim korting
- Opbrengst per participerende batterij

Frank Energie EV - Slim laden (electrische auto):
- EV laad bonus
- Laatst bekende Accu percentage EV
- EV Charger status
- poll timer (per 5 minuten minimaal)

Frank Energie PV - Smart PV systeem (zonnepanelen):
- Huidig vermogen
- Huiddig opwek
- PV bonus
- poll timer (per 5 minuten minimaal)

Frank Energie - Energie meetwaarden rapportage:
- Huidige en volgende Marktprijs
- Verbruik en Kosten vandaag
- Laagste/Hoogste/Gemiddelde marktprijs vandaag
- Verbruik op laag tarief
- poll timer (minimaal 30 minuten)


SETUP

Voeg als eerste device de Frank Energie Batterij (Slim laden) toe:
- vul je Frank Energie-inloggegevens in,
- voer de Onbalansmarkt API-key in,
- laat de wizard de credentials opslaan voor eventuele extra drivers (PV, EV, Meter)

KOPPELING

Om de actuele meetwaarden van de batterijset te verwerken in de app, maken we gebruik een Advanced Flow schema.
Via een actie (DAN) flow kaartje geef je per deelnemende batterij de gemeten waarden door.

Middels het "Ontvang dagelijkse batterij metrieken" actie kaartje:
- dagelijks geladen vermogen in kWh
- dagelijks geleverd vermogen in kWh
- gemeten accu percentage

Middels het "Ontvang batterij metrieken" actie kaartje:
- totaalwaarde geladen vermogen in kWh
- totaalwaarde geleverd vermogen in kWh
- gemeten accu percentage

Open na het koppelen de batterij-instellingen om poll-interval, auto-send measurements en load-balancing in te stellen.

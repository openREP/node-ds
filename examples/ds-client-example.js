const DriverStationClient = require('../lib/ds-client');
const DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');

var dsClient = new DriverStationClient(new DS2016Protocol());

console.log('Starting DS Client');
dsClient.start();
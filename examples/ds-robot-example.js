const DriverStationRobot = require('../lib/ds-robot');
const DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');

var dsRobotClient = new DriverStationRobot(new DS2016Protocol());

console.log('Starting DS Robot');
dsRobotClient.start();

dsRobotClient.robotCode = true;
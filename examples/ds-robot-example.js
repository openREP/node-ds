const DriverStationRobot = require('../lib/ds-robot');
const DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');

var dsRobotClient = new DriverStationRobot(new DS2016Protocol());

dsRobotClient.on('shouldReboot', () => {
    console.log('Asked to reboot');
});

dsRobotClient.on('joysticksUpdated', (sticks) => {
    console.log(sticks);
});

console.log('Starting DS Robot');
dsRobotClient.start();

dsRobotClient.robotCode = true;
dsRobotClient.voltage = 12.5;
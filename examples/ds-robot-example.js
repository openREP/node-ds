const DriverStationRobot = require('../lib/ds-robot');
const DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('../lib/constants');

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const screen = blessed.screen({smartCSR: true});

const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});
var dsRobotClient = new DriverStationRobot(new DS2016Protocol());

function updateJoystickAxes(sticks) {
    var stickData = {
        titles: [],
        data: []
    };

    if (sticks.length > 0) {
        var stick = sticks[0];
        for (var i = 0; i < stick.axes.length; i++) {
            stickData.titles.push(i);
            stickData.data.push(stick.axes[i]);
        }
    }
    return stickData;
}

function updateControlMode() {
    if (dsRobotClient.robotCommunications) {
        switch (dsRobotClient.controlMode) {
            case DSControlMode.AUTONOMOUS:
                return 'Autonomous';
            case DSControlMode.TELEOPERATED:
                return 'Teleoperated';
            case DSControlMode.TEST:
                return 'Test';
        }
    }
    else {
        return 'No Client Connection';
    }
}

function updateEnabledState() {
    return dsRobotClient.robotEnabled ? 'Enabled' : 'Disabled';
}

const controlModeView = grid.set(0, 0, 2, 5, blessed.box, { content: updateControlMode()});
const enabledView = grid.set(0, 5, 2, 5, blessed.box, { content: updateEnabledState() });
const joystickView = grid.set(2, 0, 8, 8, contrib.bar, {
    label: 'Joysticks',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 2,
    maxHeight: 9
});

dsRobotClient.on('shouldReboot', () => {
    console.log('Asked to reboot');
});

dsRobotClient.on('joysticksUpdated', (sticks) => {
    joystickView.setData(updateJoystickAxes(sticks));
    screen.render();
});

dsRobotClient.on('stateChanged', (evt) => {
    controlModeView.setContent(updateControlMode());
    enabledView.setContent(updateEnabledState());
    screen.render();
});

dsRobotClient.start();
dsRobotClient.robotCode = true;
dsRobotClient.voltage = 12.5;

// Set up Keyboard Commands
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return process.exit(0);
});

screen.render();
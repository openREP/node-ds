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
            stickData.titles.push("A" + i);
            stickData.data.push((stick.axes[i] * 4) + 4);
        }
    }
    return stickData;
}

function updateControlMode() {
    if (dsRobotClient.robotCommunications) {
        var mode;
        switch (dsRobotClient.controlMode) {
            case DSControlMode.AUTONOMOUS:
                mode = 'Autonomous';
                break;
            case DSControlMode.TELEOPERATED:
                mode = 'Teleoperated';
                break;
            case DSControlMode.TEST:
                mode = 'Test';
                break;
        }

        return 'Control Mode: ' + mode;
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
const joystickView = grid.set(2, 0, 6, 6, contrib.bar, {
    label: 'Joysticks',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 2,
    maxHeight: 8
});
const logView = grid.set(8, 0, 4, 12, contrib.log, {label: 'Log', fg: 'green', selectedFg: 'green'});

dsRobotClient.on('shouldReboot', () => {
    logView.log('Asked to reboot');
});

dsRobotClient.on('joysticksUpdated', (sticks) => {
    joystickView.setData(updateJoystickAxes(sticks));
    screen.render();
});

dsRobotClient.on('stateChanged', (evt) => {
    controlModeView.setContent(updateControlMode());
    enabledView.setContent(updateEnabledState());

    switch(evt.field) {
        case 'controlMode': {
            var mode;
            switch(evt.value) {
                case DSControlMode.AUTONOMOUS: {
                    mode = 'AUTONOMOUS';
                } break;
                case DSControlMode.TELEOPERATED: {
                    mode = 'TELEOPERATED';
                } break;
                case DSControlMode.TEST: {
                    mode = 'TEST';
                } break;
            }
            logView.log('Control Mode Changed to: ' + mode);
        } break;
        case 'robotEnabled': {
            logView.log('Robot Enabled state changed to: ' + (evt.value ? 'ENABLED':'DISABLED'));
        } break;
        case 'robotCommunications': {
            logView.log('Robot Communications Changed to: ' + (evt.value ? 'PRESENT':'NOT PRESENT'));
        } break;
    }
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
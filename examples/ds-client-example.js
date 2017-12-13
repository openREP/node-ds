const DriverStationClient = require('../lib/ds-client');
const DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('../lib/constants');

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const screen = blessed.screen({smartCSR: true});

const grid = new contrib.grid({rows: 12, cols: 12, screen: screen });
const dsClient = new DriverStationClient(new DS2016Protocol());

var hasJoysticks = false;

function updateRobotStatus() {
    return 'STATUS: \n\n' +
           '[' + (dsClient.robotCommunications ? 'X' : ' ') + '] Robot Comms\n' +
           '[' + (dsClient.robotCode ? 'X' : ' ') + '] Robot Code\n' +
           '[' + (hasJoysticks ? 'X' : ' ') + '] Joysticks';
}

function updateControlMode() {
    if (dsClient.robotCommunications) {
        switch(dsClient.controlMode) {
            case DSControlMode.AUTONOMOUS: 
                return 'Autonomous';
            case DSControlMode.TELEOPERATED:
                return 'Teleoperated';
            case DSControlMode.TEST:
                return 'Test';
        }
    }
    else {
        return 'No Robot Connection';
    }
}

function updateEnabledState() {
    return dsClient.robotEnabled ? 'Enabled' : 'Disabled';
}

function updateVoltage() {
    return 'Voltage: ' + dsClient.robotVoltage;
}

const defaultFooterTest = 'Quit (q)  Set enabled (e,d)  Set Control Mode (o,a,t)  More Options (m)';

// Set up the display grid
const voltageLine = grid.set(0, 0, 2, 3, blessed.box, { content: updateVoltage()})
const controlModeView = grid.set(0, 3, 2, 6, blessed.box, { content: updateControlMode()});
const enabledView = grid.set(0, 9, 2, 3, blessed.box, { content: 'Disabled'});

const logView = grid.set(2, 0, 9, 9, contrib.log, {fg: 'green', selectedFg: 'green', label: 'Log'});
const statusView = grid.set(2, 9, 9, 3, blessed.box, { content: updateRobotStatus()});

const footerView = grid.set(11, 0, 1, 12, blessed.box, { 
    content: defaultFooterTest
});

dsClient.customRobotAddress = 'localhost';

// Start the client
dsClient.start();
logView.log('[CLIENT] DriverStation Client Started');

dsClient.on('stateChanged', (evt) => {
    statusView.setContent(updateRobotStatus());
    controlModeView.setContent(updateControlMode());
    enabledView.setContent(updateEnabledState());
    voltageLine.setContent(updateVoltage());

    // Log the appropriate value changes
    switch (evt.field) {
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
            logView.log('Control Mode changed to: ' + mode);
        } break;
        case 'robotEnabled': {
            logView.log('Robot Enabled state changed to: ' + (evt.value ? 'ENABLED':'DISABLED'));
        } break;
        case 'robotCommunications': {
            logView.log('Robot Communications Changed to: ' + (evt.value ? 'PRESENT':'NOT PRESENT'));
        } break;
        case 'fmsCommunications': {
            logView.log('FMS Communications Changed to: ' + (evt.value ? 'PRESENT':'NOT PRESENT'));
        } break;
        case 'robotCode': {
            logView.log('Robot Code Changed to: ' + (evt.value ? 'PRESENT':'NOT PRESENT'));
        } break;

    }

    screen.render();
});

// Set up Keyboard Commands
screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return process.exit(0);
});

screen.key(['o'], (ch, key) => {
    dsClient.controlMode = DSControlMode.TELEOPERATED;
});

screen.key(['a'], (ch, key) => {
    dsClient.controlMode = DSControlMode.AUTONOMOUS;
});

screen.key(['t'], (ch, key) => {
    dsClient.controlMode = DSControlMode.TEST;
});

screen.key(['e', 'd'], (ch, key) => {
    dsClient.robotEnabled = (ch === 'e');
    logView.log('Robot set to ' + (ch === 'e' ? 'ENABLED':'DISABLED'));
});

screen.render();

const DSProtocolBase = require('./ds-protocol-base');
const DSConstants = require('../constants');
const { DSControlMode, DSAlliance, DSPosition } = DSConstants;

/**
 * @class JoystickData
 * @property {number[]} axes - Axis values (-1 to 1)
 * @property {number[]} hats - Hat switch values
 * @property {boolean[]} buttons - Button values
 */

// Protocol Bytes
const MODE_TEST             = 0x01;
const MODE_ENABLED          = 0x04;
const MODE_AUTONOMOUS       = 0x02;
const MODE_TELEOPERATED     = 0x00;
const MODE_FMS_ATTACHED     = 0x08;
const MODE_EMERGENCY_STOP   = 0x80;

const REQUEST_REBOOT        = 0x08;
const REQUEST_NORMAL        = 0x80;
const REQUEST_UNCONNECTED   = 0x00;
const REQUEST_RESTART_CODE  = 0x04;

const FMS_RADIO_PING        = 0x10;
const FMS_ROBOT_PING        = 0x08;
const FMS_ROBOT_COMMS       = 0x20;
const FMS_DS_VERSION        = 0x00;

const TAG_DATE              = 0x0F;
const TAG_GENERAL           = 0x01;
const TAG_JOYSTICK          = 0x0C;
const TAG_TIMEZONE          = 0x10;

const TEAM_RED_1            = 0x00;
const TEAM_RED_2            = 0x01;
const TEAM_RED_3            = 0x02;
const TEAM_BLUE_1           = 0x03;
const TEAM_BLUE_2           = 0x04;
const TEAM_BLUE_3           = 0x05;

const TAG_CAN_INFO          = 0x0E;
const TAG_CPU_INFO          = 0x05;
const TAG_RAM_INFO          = 0x06;
const TAG_DISK_INFO         = 0x04;

const REQUEST_TIME          = 0x01;
const ROBOT_HAS_CODE        = 0x20;

function encodeVoltage(voltage) {
    var voltInt = Math.floor(voltage);
    var voltFloat = (voltage - voltInt) * 100;
    return {
        upper: voltInt & 0xFF,
        lower: voltFloat & 0xFF
    };
}

function decodeVoltage(upper, lower) {
    return (upper & 0xFF) + (lower / 0xFF);
}

/**
 * Returns a single byte value representing the ratio between the
 * given valu and max value
 * @param {number} val 
 * @param {number} max 
 */
function floatToByte(value, max) {
    if (value !== 0 && max !== 0 && value <= max) {
        var pct = Math.floor(value / max) * Math.floor(0xFF / 2);
        return pct & 0xFF;
    }
}

function getDateTime() {
    var buf = Buffer.alloc(10);
    var currDate = new Date();
    var usec = currDate.getMilliseconds() * 1000;
    
    buf.writeUInt32BE(usec, 0);
    buf.writeUInt8(currDate.getSeconds(), 4);
    buf.writeUInt8(currDate.getMinutes(), 5);
    buf.writeUInt8(currDate.getHours(), 6);
    buf.writeUInt8(currDate.getDate(), 7);
    buf.writeUInt8(currDate.getMonth(), 8);
    buf.writeUInt8(currDate.getFullYear() - 1900, 9);

    return buf;
}

/**
 * Get the control code to send to/from FMS
 * @param {Object} state 
 */
function getFMSControlCode(state) {
    var code = 0;
    switch (state.controlMode) {
        case DSControlMode.TEST: {
            code |= MODE_TEST;
        } break;
        case DSControlMode.AUTONOMOUS: {
            code |= MODE_AUTONOMOUS;
        } break;
        case DSControlMode.TELEOPERATED: {
            code |= MODE_TELEOPERATED;
        } break;
    }

    if (state.emergencyStopped) {
        code |= MODE_EMERGENCY_STOP;
    }

    if (state.robotEnabled) {
        code |= MODE_ENABLED;
    }

    if (state.robotCommunications) {
        code |= FMS_ROBOT_COMMS;
        code |= FMS_ROBOT_PING;
    }

    return code;
}

/**
 * Get the control code to send to a robot
 * @param {Object} state 
 */
function getRobotControlCode(state) {
    var code = 0;
    switch (state.controlMode) {
        case DSControlMode.TEST: {
            code |= MODE_TEST;
        } break;
        case DSControlMode.AUTONOMOUS: {
            code |= MODE_AUTONOMOUS;
        } break;
        case DSControlMode.TELEOPERATED: {
            code |= MODE_TELEOPERATED;
        } break;
    }

    if (state.fmsCommunications) {
        code |= MODE_FMS_ATTACHED;
    }

    if (state.emergencyStopped) {
        code |= MODE_EMERGENCY_STOP;
    }

    if (state.robotEnabled) {
        code |= MODE_ENABLED;
    }

    return code;
}

function getStationCode(state) {
    if (state.robotPosition === DSPosition.POSITION_1) {
        if (state.robotAlliance === DSAlliance.RED) {
            return TEAM_RED_1;
        }
        else {
            return TEAM_BLUE_1;
        }
    }

    if (state.robotPosition === DSPosition.POSITION_2) {
        if (state.robotAlliance === DSAlliance.RED) {
            return TEAM_RED_2;
        }
        else {
            return TEAM_BLUE_2;
        }
    }

    if (state.robotPosition === DSPosition.POSITION_3) {
        if (state.robotAlliance === DSAlliance.RED) {
            return TEAM_RED_3;
        }
        else {
            return TEAM_BLUE_3;
        }
    }

    return TEAM_RED_1;
}

function getRequestCode(state) {
    var code = REQUEST_NORMAL;
    if (state.robotCommunications) {
        if (state.reboot) {
            code = REQUEST_REBOOT;
        }
        else if (state.restartCode) {
            code = REQUEST_RESTART_CODE;
        }
    }
    else {
        code = REQUEST_UNCONNECTED;
    }

    return code;
}

/**
 * Calculate size of the joystick data buffer
 * @param {JoystickData} stick 
 */
function getJoystickPacketSize(stick) {
    const headerSize = 2;
    const buttonData = 3;
    const axisData = stick.axes.length + 1;
    const hatData = (stick.hats.length * 2) + 1;

    return headerSize + buttonData + axisData + hatData;
}

function getJoystickData(state) {
    var i = 0, j = 0;
    var data = []; // byte array, which will then convert to a buffer
    const joysticks = state.joysticks;

    for (i = 0; i < joysticks.length; i++) {
        var stick = joysticks[i];
        data.push(getJoystickPacketSize(stick) & 0xFF);
        data.push(TAG_JOYSTICK & 0xFF);

        // Add axis data
        data.push(stick.axes.length & 0xFF);
        for (j = 0; j < stick.axes.length; j++) {
            data.push(floatToByte(stick.axes[j], 1) & 0xFF);
        }

        // Button data
        var buttonFlags = 0;
        for (j = 0; j < stick.buttons.length; j++) {
            buttonFlags += stick.buttons[j] ? Math.floor(Math.pow(2, j)) : 0;
        }

        data.push(stick.buttons.length);
        data.push((buttonFlags >> 8) & 0xFF);
        data.push(buttonFlags & 0xFF);

        // Hat data
        data.push(stick.hats.length & 0xFF);
        for (j = 0; j < stick.hats.length; j++) {
            var hatVal = stick.hats[j];
            data.push((hatVal >> 8) & 0xFF);
            data.push(hatVal & 0xFF);
        }
    }

    return Buffer.from(data);
}

class DSProtocol2016 extends DSProtocolBase {
    constructor() {
        super();

        // Set private vars accordingly
        this.d_protocolName = 'FRC 2016';

        // === Ports ===
        this.d_clientToFMSPort = 1160;
        this.d_fmsToClientPort = 1120;
        this.d_clientToRobotPort = 1110;
        this.d_robotToClientPort = 1150;
        this.d_clientToNetconsolePort = 6668;
        this.d_netconsoleToClientPort = 6666;

        // === Intervals ===
        this.d_clientToFMSInterval = 500;
        this.d_clientToRobotInterval = 20;

        // === Joystick ===
        this.d_maxJoysticks = 6;
        this.d_maxJoystickHatCount = 1;
        this.d_maxJoystickAxisCount = 6;
        this.d_maxJoystickButtonCount = 10;

        this.d_maxVoltage = 13;

        this.d_clientToFMSPackets = 0;
        this.d_fmsToClientPackets = 0;
        this.d_clientToRobotPackets = 0;
        this.d_robotToClientPackets = 0;
    }

    get defaultFMSAddress() {
        return '0.0.0.0';
    }

    get defaultRobotAddress() {
        return 'roboRIO-' + this.teamNumber + '-frc.local';
    }

    /**
     * Generate a client->FMS packet given a state object
     * @param {Object} packetInfo
     * @param {number} packetInfo.seq - Packet Number
     * @param {number} packetInfo.teamNumber - Team Number
     * @param {number} packetInfo.voltage - Robot Voltage
     * @param {number} packetInfo.controlMode - Current Control Mode
     * @param {boolean} packetInfo.emergencyStopped - Emergency Stopped State
     * @param {boolean} packetInfo.robotEnabled - Robot Enabled State
     * @param {boolean} packetInfo.robotCommunications - Robot Comms Present
     */
    makeClientToFMSPacket(packetInfo) {
        const packet = Buffer.alloc(8);

        // Voltage bytes
        const {upper, lower} = encodeVoltage(packetInfo.robotVoltage);

        packet.writeUInt16BE(packetInfo.seq, 0);
        packet.writeUInt8(0x00, 2);
        packet.writeUInt8(getFMSControlCode(packetInfo), 3);
        packet.writeUInt16BE(packetInfo.teamNumber, 4);
        packet.writeUInt8(upper, 6);
        packet.writeUInt8(lower, 7);

        return packet;
    }

    /**
     * Generate a FMS->Client packet given a state object
     * @param {Object} packetInfo 
     * @param {number} packetInfo.seq - Packet Number
     * @param {number} packetInfo.controlMode - Current Control Mode
     * @param {boolean} packetInfo.emergencyStopped - Emergency Stopped State
     * @param {boolean} packetInfo.robotEnabled - Robot Enabled State
     * @param {boolean} packetInfo.robotCommunications - Robot Comms Present
     * @param {number} packetInfo.robotAlliance - Alliance
     * @param {number} packetInfo.robotPosition - Position
     * @param {number} packetInfo.tournamentLevel - Current Tournament Level
     * @param {number} packetInfo.matchNumber - Current Match Number
     * @param {number} packetInfo.timeRemaining - Time Remaining in seconds
     */
    makeFMSToClientPacket(packetInfo) {
        const packetHeader = Buffer.alloc(10);
        const packetTimeRemaining = Buffer.alloc(2);

        const seq = packetInfo.seq;
        const control = getFMSControlCode(packetInfo);
        const station = getStationCode(packetInfo);
        const tournamentLevel = packetInfo.tournamentLevel;
        const matchNumber = packetInfo.matchNumber; // 2 bytes
        const dateBuf = getDateTime();
        const remainTime = packetInfo.timeRemaining; // 2 bytes

        packetHeader.writeUInt16BE(seq, 0);
        packetHeader.writeUInt8(0x00, 2); // Comm Version
        packetHeader.writeUInt8(control, 3);
        packetHeader.writeUInt8(0x00, 4); // Request Byte
        packetHeader.writeUInt8(station, 5);
        packetHeader.writeUInt8(tournamentLevel, 6);
        packetHeader.writeUInt16BE(matchNumber, 7);
        packetHeader.writeUInt8(0x00, 9); // Play Number

        packetTimeRemaining.writeUInt16BE(remainTime);

        return Buffer.concat([packetHeader, dateBuf, remainTime]);
        
    }

    /**
     * Generate a client->robot packet
     * @param {Object} packetInfo 
     * @param {number} packetInfo.seq - Packet Number
     * @param {number} packetInfo.controlMode - Current Control Mode
     * @param {boolean} packetInfo.emergencyStopped - Emergency Stopped State
     * @param {boolean} packetInfo.robotEnabled - Robot Enabled State
     * @param {boolean} packetInfo.robotCommunications - Robot Comms Present
     * @param {number} packetInfo.robotAlliance - Alliance
     * @param {number} packetInfo.robotPosition - Position
     * @param {boolean} packetInfo.reboot - Request to reboot controller
     * @param {boolean} packetInfo.restartCode - Request to restart robot code
     * @param {JoystickData[]} packetInfo.joysticks - Joystick data
     */
    makeClientToRobotPacket(packetInfo) {
        const packetHeader = Buffer.alloc(6);

        packetHeader.writeUInt16BE(packetInfo.seq, 0);
        packetHeader.writeUInt8(TAG_GENERAL, 2);

        // Control Code
        packetHeader.writeUInt8(getRobotControlCode(packetInfo), 3);
        packetHeader.writeUInt8(getRequestCode(packetInfo), 4);
        packetHeader.writeUInt8(getStationCode(packetInfo), 5);

        var pktArr = [packetHeader];
        if (packetInfo.sendTimeData) {
            pktArr.push(getTimezoneData());
        }
        else if (packetInfo.seq > 5) {
            pktArr.push(getJoystickData(packetInfo));
        }

        return Buffer.concat(pktArr);
    }

    makeRobotToClientPacket(state) {

    }

    readClientToFMSPacket(data) {

    }

    readFMSToClientPacket(data) {

    }

    readClientToRobotPacket(data) {

    }

    readRobotToClientPacket(data) {

    }

    rebootController() {

    }

    restartRobotCode() {

    }

    reset() {

    }
}
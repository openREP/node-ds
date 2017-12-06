const DSProtocolBase = require('./protocol-base');
const DSSocket = require('../socket');
const DSConstants = require('../constants');
const moment = require('moment');
/*
 *  Protocol Bytes
 */
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

function decodeVoltage(upper, lower) {
    return (upper & 0xFF) + (lower / 0xFF);
}

function encodeVoltage(voltage) {
    var voltInt = Math.floor(voltage);
    var voltFloat = (voltage - voltInt) * 100;
    return {
        upper: voltInt & 0xFF,
        lower: voltFloat & 0xFF
    };
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

/**
 * Get the alliance type from the recevied byte
 * @param {number} byte 
 */
function getAlliance(byte) {
    if (byte === TEAM_BLUE_1 || byte === TEAM_BLUE_2 || byte === TEAM_BLUE_3) {
        return DSConstants.DSAlliance.BLUE;
    }
    return DSConstants.DSAlliance.RED;
}

/**
 * Get the position type from received byte
 * @param {number} byte 
 */
function getPosition(byte) {
    if (byte === TEAM_BLUE_1 || byte === TEAM_RED_1) {
        return DSConstants.DSPosition.POSITION_1;
    }
    else if (byte === TEAM_BLUE_2 || byte === TEAM_RED_2) {
        return DSConstants.DSPosition.POSITION_2;
    }
    else if (byte === TEAM_BLUE_3 || byte === TEAM_RED_3) {
        return DSConstants.DSPosition.POSITION_3;
    }
    return DSConstants.DSPosition.POSITION_1;
}

function getFMSControlCode(dsInstance) {
    var code = 0;
    switch(dsInstance.controlMode) {
        case DSConstants.DSControlMode.TEST: {
            code |= MODE_TEST;
        } break;
        case DSConstants.DSControlMode.AUTONOMOUS: {
            code |= MODE_AUTONOMOUS;
        } break;
        case DSConstants.DSControlMode.TELEOPERATED: {
            code |= MODE_TELEOPERATED;
        } break;
    }

    if (dsInstance.emergencyStopped) {
        code |= MODE_EMERGENCY_STOP;
    }

    if (dsInstance.robotEnabled) {
        code |= MODE_ENABLED;
    }

    if (dsInstance.radioCommunications) {
        code |= FMS_RADIO_PING;
    }

    if (dsInstance.robotCommunications) {
        code |= FMS_ROBOT_COMMS;
        code |= FMS_ROBOT_PING;
    }

    return code;
}

/**
 * Returns control code sent to robot
 * @param {*} dsInstance 
 */
function getRobotControlCode(dsInstance) {
    var code = 0;
    switch (dsInstance.controlMode) {
        case DSConstants.DSControlMode.TEST: {
            code |= MODE_TEST;
        } break;
        case DSConstants.DSControlMode.AUTONOMOUS: {
            code |= MODE_AUTONOMOUS;
        } break;
        case DSConstants.DSControlMode.TELEOPERATED: {
            code |= MODE_TELEOPERATED;
        } break;
    }

    if (dsInstance.fmsCommunications) {
        code |= MODE_FMS_ATTACHED;
    }

    if (dsInstance.emergencyStopped) {
        code |= MODE_EMERGENCY_STOP;
    }

    if (dsInstance.robotEnabled) {
        code |= MODE_ENABLED;
    }

    return code;
}

/**
 * Generate the request code sent to the robot, which may instruct to:
 * - Operate normally
 * - Reboot processor
 * - Restart robot code
 * @param {*} dsInstance 
 */
function getRequestCode(dsInstance) {
    var code = REQUEST_NORMAL;
    if (dsInstance.robotCommunications) {
        if (this.d_reboot) {
            code = REQUEST_REBOOT;
        }
        else if (this.d_restartCode) {
            code = REQUEST_RESTART_CODE;
        }
    }
    else {
        code = REQUEST_UNCONNECTED;
    }

    return code;
}

/**
 * Return team station code sent to robot
 * @param {*} dsInstance 
 */
function getStationCode(dsInstance) {
    if (dsInstance.robotPosition === DSConstants.DSPosition.POSITION_1) {
        if (dsInstance.robotAlliance === DSConstants.DSAlliance.RED) {
            return TEAM_RED_1;
        }
        else {
            return TEAM_BLUE_1;
        }
    }

    if (dsInstance.robotPosition === DSConstants.DSPosition.POSITION_2) {
        if (dsInstance.robotAlliance === DSConstants.DSAlliance.RED) {
            return TEAM_RED_2;
        }
        else {
            return TEAM_BLUE_2;
        }
    }

    if (dsInstance.robotPosition === DSConstants.DSPosition.POSITION_3) {
        if (dsInstance.robotAlliance === DSConstants.DSAlliance.RED) {
            return TEAM_RED_3;
        }
        else {
            return TEAM_BLUE_3;
        }
    }

    return TEAM_RED_1;
}

/**
 * Returns a buffer with the current date/time and timezone of the client
 */
function getTimezoneData() {
    const buf = Buffer.alloc(14);
    var currDate = new Date();
    var msec = currDate.getTime();

    buf.writeUInt8(0x0B, 0x00);
    buf.writeUInt8(TAG_DATE, 0x01);
    buf.writeUInt32BE(msec, 0x02);
    buf.writeUInt8(currDate.getSeconds(), 0x06);
    buf.writeUInt8(currDate.getMinutes(), 0x07);
    buf.writeUInt8(currDate.getHours(), 0x08);
    buf.writeUInt8(currDate.getDate(), 0x09);
    buf.writeUInt8(currDate.getMonth(), 0x0A);
    buf.writeUInt8(currDate.getFullYear() - 1900, 0x0B);

    // Timezone and tag
    var zone = moment.tz.guess();
    var tz = moment.tz(zone).format("z");

    buf.writeUInt8(tz.length, 0x0C);
    buf.writeUInt8(TAG_TIMEZONE, 0x0D);

    var tzBuf = Buffer.from(tz);

    return Buffer.concat([buf, tzBuf]);
}

function getJoystickSize(dsInstance, joystick) {
    const headerSize = 2;
    const buttonData = 3;
    const axisData = dsInstance.getJoystickNumAxes(joystick) + 1;
    const hatData = (dsInstance.getJoystickNumHats(joystick) * 2) + 1;

    return headerSize + buttonData + axisData + hatData;
}

/**
 * Construct a joystick information struct for every attached joystick
 * @param {Buffer} dsInstance 
 */
function getJoystickData(dsInstance) {
    var i = 0, j = 0;
    var data = []; // byte array, which we will then convert to a buffer

    for (i = 0; i < dsInstance.joystickCount; i++) {
        data.push(getJoystickSize(dsInstance, i) & 0xFF);
        data.push(TAG_JOYSTICK & 0xFF);

        // Add axis data
        data.push(dsInstance.getJoystickNumAxes(i) & 0xFF);
        for (j = 0; j < dsInstance.getJoystickNumAxes(i); j++) {
            data.push(floatToByte(dsInstance.getJoystickAxis(i, j), 1) & 0xFF);
        }

        // Button data
        var buttonFlags = 0;
        for (j = 0; j < dsInstance.getJoystickNumButtons(i); j++) {
            buttonFlags += dsInstance.getJoystickButton(i, j) ? Math.floor(2, j) : 0;
        }

        data.push(dsInstance.getJoystickNumButtons(i) & 0xFF);
        data.push((buttonFlags >> 8) & 0xFF);
        data.push((buttonFlags & 0xFF));

        // Hat data
        data.push(dsInstance.getJoystickNumHats(i) & 0xFF);
        for (j = 0; j < dsInstance.getJoystickNumHats(i); j++) {
            var hatVal = dsInstance.getJoystickHat(i, j);
            data.push((hatVal >> 8) & 0xFF);
            data.push(hatVal & 0xFF);
        }
    }

    return Buffer.from(data);
}

class DSProtocol2015 extends DSProtocolBase {
    constructor(dsInstance) {
        super(dsInstance);

        this.d_sentFMSPackets = 0;
        this.d_sentRobotPackets = 0;

        this.d_sendTimeData = false;
        this.d_reboot = false;
        this.d_restartCode = false;

        this.d_name = 'FRC 2016';
        this.d_fmsAddress = '0.0.0.0';
        this.d_radioAddress = '0.0.0.0';
        this.d_robotAddress = null;

    }

    // dynamically generate the robot address
    get robotAddress() {
        return "roboRIO-" + this.d_dsInstance.teamNumber + "-frc.local";
    }

    /**
     * Generate a packet that the DS will send to the FMS. Contains:
     * - FMS Packet Index
     * - Robot Voltage
     * - Robot Control Code
     * - DS Version
     * - Radio and robot ping flags
     * - Team number
     * @return {Buffer} A filled FMS packet
     */
    createFMSPacket() {
        // 8 byte buffer
        const packet = Buffer.alloc(8);

        // Voltage bytes
        const vInfo = encodeVoltage(this.d_dsInstance.robotVoltage);
        const vInt = vInfo.upper;
        const vDec = vInfo.lower;

        // FMS Packet Count (Big endian), first 2 bytes
        packet.writeUInt16BE(this.d_sentFMSPackets, 0x00);

        // DS Version
        packet.writeUInt8(0x00, 0x02);
        packet.writeUInt8(getFMSControlCode(this.d_dsInstance), 0x03);

        // Team number
        packet.writeUInt16BE(this.d_dsInstance.teamNumber, 0x04);

        // Voltage
        packet.writeUInt8(vInt, 0x06);
        packet.writeUInt8(vDec, 0x07);

        this.d_sentFMSPackets++;

        return packet;
    }

    createRadioPacket() {
        const packet = Buffer.alloc(0);
        return packet;
    }

    /**
     * Create a packet that the DS will send to the robot. Contains:
     * - Packet ID
     * - Control code (control mode, estop etc)
     * - Request code (robot reboot, restart code, etc)
     * - Team station
     * - Date and time (if requested)
     * - Joystick information
     */
    createRobotPacket() {
        // Build header
        const packetHeader = Buffer.alloc(6);
        
        // Packet index, BE, 2 bytes
        packetHeader.writeUInt16BE(this.d_sentRobotPackets, 0x00);

        packetHeader.writeUInt8(TAG_GENERAL, 0x02);

        // Add control code etc
        packetHeader.writeUInt8(getRobotControlCode(this.d_dsInstance), 0x03);
        packetHeader.writeUInt8(getRequestCode(this.d_dsInstance), 0x04);
        packetHeader.writeUInt8(getStationCode(this.d_dsInstance), 0x05);

        var pktArr = [packetHeader];
        if (this.d_sendTimeData) {
            pktArr.push(getTimezoneData());
        }
        else if (this.d_sentRobotPackets > 5) {
            pktArr.push(getJoystickData(dsInstance));
        }
        
        this.d_sentRobotPackets++;
        return Buffer.concat(pktArr);
    }

    /**
     * Interpret the packet and follows the instructions sent by FMS
     * Possible instructions:
     * - Change robot control mode
     * - Change robot enabled state
     * - Change team alliance
     * - Change team position
     * @param {Buffer} data
     */
    readFMSPacket(data) {
        if (!data) {
            return 0;
        }

        // Packet too small
        if (data.length < 22) {
            return 0;
        }

        // Read the packet
        const control = data.readUInt8(3);
        const station = data.readUInt8(5);

        // Change robot enabled state
        this.d_dsInstance.robotEnabled = (control & MODE_ENABLED);

        // Get FMS Robot mode
        if (control & MODE_TELEOPERATED) {
            this.d_dsInstance.controlMode = DSConstants.DSControlMode.TELEOPERATED;
        }
        else if (control & MODE_AUTONOMOUS) {
            this.d_dsInstance.controlMode = DSConstants.DSControlMode.AUTONOMOUS;
        }
        else if (control & MODE_TEST) {
            this.d_dsInstance.controlMode = DSConstants.DSControlMode.TEST;
        }

        // Update to correct alliance/position
        this.d_dsInstance.robotAlliance = getAlliance(station);
        this.d_dsInstance.robotPosition = getPosition(station);

        return 1;
    }

    readRadioPacket(data) {
        return 0;
    }

    /**
     * Interprets the packet and obtains the following information
     * - User code state of the robot
     * - If the robot needs to get current date/time from client
     * - Emergency stop state of the robot
     * - robot voltage
     * - Extended information
     * @param {Buffer} data 
     */
    readRobotPacket(data) {
        if (!data) {
            return 0;
        }
         
        if (data.length < 7) {
            return 0;
        }

        // Read packet
        const control = data.readUInt8(3);
        const rstatus = data.readUInt8(4);
        const request = data.readUInt8(7);

        // Update client info
        this.d_dsInstance.robotCode = (rstatus & ROBOT_HAS_CODE);
        this.d_dsInstance.emergencyStopped = (control & MODE_EMERGENCY_STOP);

        // Update date/time request flag
        this.d_sendTimeData = (request === REQUEST_TIME);

        // Calc voltage
        const upper = data.readUInt8(5);
        const lower = data.readUInt8(6);
        this.d_dsInstance.robotVoltage = decodeVoltage(upper, lower);

        // Extended packet, read extra data
        if (data.length > 9) {
            // Don't actually care about this...
        }

        return 1;
    }

    rebootRobot() {
        this.d_reboot = true;
    }

    restartRobotCode() {
        this.d_restartCode = true;
    }

    resetRobot() {
        this.d_reboot = false;
        this.d_restartCode = false;
        this.d_sendTimeData = false;
    }

    resetFMS() {
        
    }

    resetRobotPackets() {
        this.d_sentRobotPackets = 0;
        this.d_receivedRobotPackets = 0;
    }
}

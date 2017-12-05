const DSProtocolBase = require('./protocol-base');
const DSSocket = require('../socket');
const DSConstants = require('../constants');
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

function fmsControlCode(dsInstance) {
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
function robotControlCode(dsInstance) {
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
function requestCode(dsInstance) {
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
function stationCode(dsInstance) {
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
        packet.writeUInt8(fmsControlCode(this.d_dsInstance), 0x03);

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
        packetHeader.writeUInt8(robotControlCode(this.d_dsInstance), 0x03);
        packetHeader.writeUInt8(requestCode(this.d_dsInstance), 0x04);
        packetHeader.writeUInt8(stationCode(this.d_dsInstance), 0x05);

        var packetBody;
        if (this.d_sendTimeData) {

        }
        else {

        }

        this.d_sentRobotPackets++;
        
    }

    rebootRobot() {

    }

    restartRobotCode() {

    }

    resetRobot() {

    }

    resetFMS() {
        
    }
}

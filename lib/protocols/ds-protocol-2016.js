const DSProtocolBase = require('./ds-protocol-base');
const DSConstants = require('../constants');
const { DSControlMode, DSAlliance, DSPosition } = DSConstants;

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

function getFMSControlCode(protoInstance) {
    var code = 0;
    switch (protoInstance.controlMode) {
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

    if (protoInstance.emergencyStopped) {
        code |= MODE_EMERGENCY_STOP;
    }

    if (protoInstance.robotEnabled) {
        code |= MODE_ENABLED;
    }

    if (protoInstance.robotCommunications) {
        code |= FMS_ROBOT_COMMS;
        code |= FMS_ROBOT_PING;
    }

    return code;
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

    makeClientToFMSPacket() {
        const packet = Buffer.alloc(8);

        // Voltage bytes
        const {upper, lower} = encodeVoltage(this.robotVoltage);

        packet.writeUInt16BE(this.d_clientToFMSPackets, 0);
        packet.writeUInt8(0x00, 2);
        packet.writeUInt8(getFMSControlCode(this), 3);
        packet.writeUInt16BE(this.teamNumber, 4);
        packet.writeUInt8(upper, 6);
        packet.writeUInt8(lower, 7);

        this.d_clientToFMSPackets++;

        return packet;
    }

    makeFMSToClientPacket(state) {
        const packet = Buffer.alloc(22);
        
        const seq = (state.seq !== undefined ? state.seq : 0);
        const control = 0; // TODO this should be FMSControlCode
        const station = 0; // TODO This should be alliance station
        const tournamentLevel = 1; // TODO Refer to docs
        const matchNumber = 1; // 2 bytes
        const playNumber = 0; // ??
        const dateBuf = getDateTime();
        const remainTime = 0; // 2 bytes
        
    }

    makeClientToRobotPacket() {

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
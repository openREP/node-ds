const DSProtocolBase = require('../ds-protocol-base');
const DSConstants = require('../../constants');
const { DSControlMode, 
        DSAlliance, 
        DSPosition, 
        DSTournamentLevel } = DSConstants;

const ProtoConstants = require('./ds-protocol-2016-constants');
const ProtoUtils = require('./ds-protocol-2016-utils');

/**
 * @typedef {Object} ClientToFMSPacket
 * @property {number} seq - Packet Number
 * @property {number} teamNumber - Team Number
 * @property {number} voltage - Robot Voltage
 * @property {DSControlMode} controlMode - Current Control Mode
 * @property {boolean} emergencyStopped - E-Stop State
 * @property {boolean} robotEnabled - Robot Enabled State
 * @property {boolean} robotCommunications - Robot Comms State
 */

/**
 * @typedef {Object} FMSToClientPacket
 * @property {number} seq - Packet Number
 * @property {DSControlMode} controlMode - Current Control Mode
 * @property {boolean} emergencyStopped - E-Stop state
 * @property {boolean} robotEnabled - Robot Enabled State
 * @property {boolean} robotCommunications - Robot Comms State
 * @property {DSAlliance} robotAlliance - Alliance
 * @property {DSPosition} robotPosition - Position
 * @property {DSTournamentLevel} tournamentLevel - Type of tournament
 * @property {number} matchNumber - Match Number
 * @property {number} timeRemaining - Time remaining for this segment
 */

/**
 * @typedef {Object} ClientToRobotPacket
 * @property {number} seq - Packet Number
 * @property {DSControlMode} controlMode - Current Control Mode
 * @property {boolean} emergencyStopped - Emergency Stopped State
 * @property {boolean} robotEnabled - Robot Enabled State
 * @property {boolean} fmsCommunications - FMS Comms Present
 * @property {DSAlliance} robotAlliance - Alliance
 * @property {DSPosition} robotPosition - Position
 * @property {boolean} reboot - Request to reboot controller
 * @property {boolean} restartCode - Request to restart robot code
 * @property {JoystickData[]} joysticks - Joystick data
 */

/**
 * @typedef {Object} RobotToClientPacket
 * @property {number} seq - Packet Number
 * @property {DSControlMode} controlMode - Current control mode
 * @property {boolean} fmsCommunications - FMS Comms present
 * @property {boolean} emergencyStopped - Emergency Stopped state
 * @property {boolean} robotEnabled - Robot enabled state
 * @property {number} voltage - Current battery voltage
 */

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
     * Generate a client->FMS packet buffer given a packet info object
     * @param {ClientToFMSPacket} packetInfo
     * @return {Buffer}
     */
    makeClientToFMSPacket(packetInfo) {
        const packet = Buffer.alloc(8);

        // Voltage bytes
        const {upper, lower} = ProtoUtils.encodeVoltage(packetInfo.robotVoltage);

        packet.writeUInt16BE(packetInfo.seq, 0);
        packet.writeUInt8(0x00, 2);
        packet.writeUInt8(ProtoUtils.makeFMSControlCode(packetInfo), 3);
        packet.writeUInt16BE(packetInfo.teamNumber, 4);
        packet.writeUInt8(upper, 6);
        packet.writeUInt8(lower, 7);

        return packet;
    }

    /**
     * Generate a FMS->Client packet buffer
     * @param {FMSToClientPacket} packetInfo 
     * @return {Buffer}
     */
    makeFMSToClientPacket(packetInfo) {
        const packetHeader = Buffer.alloc(10);
        const packetTimeRemaining = Buffer.alloc(2);

        const seq = packetInfo.seq;
        const control = ProtoUtils.makeFMSControlCode(packetInfo);
        const station = ProtoUtils.makeStationCode(packetInfo);
        const tournamentLevel = packetInfo.tournamentLevel;
        const matchNumber = packetInfo.matchNumber; // 2 bytes
        const dateBuf = ProtoUtils.makeDateTimeBuffer(new Date());
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
     * Generate a client->robot packet buffer
     * @param {ClientToRobotPacket} packetInfo
     * @return {Buffer}
     */
    makeClientToRobotPacket(packetInfo) {
        const packetHeader = Buffer.alloc(6);

        packetHeader.writeUInt16BE(packetInfo.seq, 0);
        packetHeader.writeUInt8(TAG_GENERAL, 2);

        // Control Code
        packetHeader.writeUInt8(ProtoUtils.makeRobotControlCode(packetInfo), 3);
        packetHeader.writeUInt8(ProtoUtils.makeRequestCode(packetInfo), 4);
        packetHeader.writeUInt8(ProtoUtils.makeStationCode(packetInfo), 5);

        var pktArr = [packetHeader];
        if (packetInfo.sendTimeData) {
            pktArr.push(ProtoUtils.makeTimeAndTZBuffer());
        }
        else if (packetInfo.seq > 5) {
            pktArr.push(ProtoUtils.makeJoystickDataBuffer(packetInfo));
        }

        return Buffer.concat(pktArr);
    }

    /**
     * Generate a robot->DS response packet buffer
     * @param {RobotToClientPacket} packetInfo 
     * @return {Buffer}
     */
    makeRobotToClientPacket(packetInfo) {
        var packet = Buffer.alloc(7);
        const {upper,lower} = ProtoUtils.encodeVoltage(packetInfo.voltage);

        packet.writeUInt16BE(packetInfo.seq, 0);
        packet.writeUInt8(0x01, 2);
        packet.writeUInt8(ProtoUtils.makeRobotControlCode(packetInfo), 3);
        packet.writeUInt8(upper, 4);
        packet.writeUInt8(lower, 5);
        packet.writeUInt8((packet.seq === 0 ? 1 : 0), 6);

        return packet;
    }

    /**
     * Generate a ClientToFMSPacket struct from the incoming data buffer
     * @param {Buffer} data
     * @return {ClientToFMSPacket} Contents of packet, or null if error 
     */
    readClientToFMSPacket(data) {
        if (data.length < 8) {
            return null;
        }

        const seq = data.readUInt16BE(0);
        const control = data.readUInt8(3);
        const team = data.readUInt16BE(4);
        const upper = data.readUInt8(6);
        const lower = data.readUInt8(7);

        const voltage = ProtoUtils.decodeVoltage(upper, lower);

        const { controlMode, 
                emergencyStopped, 
                robotEnabled, 
                robotCommunications } = ProtoUtils.parseFMSControlCode(control);
        
        return {
            seq: seq,
            teamNumber: team,
            voltage: voltage,
            controlMode: controlMode,
            emergencyStopped: emergencyStopped,
            robotEnabled: robotEnabled,
            robotCommunications: robotCommunications
        };
    }

    /**
     * Generate a FMSToClientPacket struct from the incoming data buffer
     * @param {Buffer} data
     * @return {FMSToClientPacket} Contents of packet, or null if error 
     */
    readFMSToClientPacket(data) {
        if (data.length < 22) {
            return null;
        }

        const seq = data.readUInt16BE(0);
        const control = data.readUInt8(3);
        const station = data.readUInt8(5);
        const tournamentLevel = data.readUInt8(6);
        const matchNumber = data.readUInt16BE(7);
        const date = ProtoUtils.parseDateDataBuffer(data.slice(10, 20));
        const timeRemaining = data.readUInt16BE(20);

        const { controlMode, 
            emergencyStopped, 
            robotEnabled, 
            robotCommunications } = ProtoUtils.parseFMSControlCode(control);

        const { robotAlliance, 
                robotPosition} = ProtoUtils.parseStationCode(station);

        return {
            seq,
            controlMode,
            emergencyStopped,
            robotEnabled,
            robotCommunications,
            robotAlliance,
            robotPosition,
            tournamentLevel,
            matchNumber,
            timeRemaining,
            date
        };
    }

    /**
     * Generate a ClientToRobotPacket struct from the incoming data buffer
     * @param {Buffer} data
     * @return {ClientToRobotPacket} Contents of packet, or null if error 
     */
    readClientToRobotPacket(data) {
        if (data.length < 6) {
            return null;
        }

        const seq = data.readUInt16BE(0);
        const control = data.readUInt8(3);
        const request = data.readUInt8(4);
        const station = data.readUInt8(5);

        const { controlMode,
                emergencyStopped,
                robotEnabled,
                fmsCommunications} = ProtoUtils.parseRobotControlCode(control);

        const { robotAlliance,
                robotPosition } = ProtoUtils.parseStationCode(station);

        const { reboot, restartCode } = ProtoUtils.parseRequestCode(request);

        var ret = {
            seq,
            controlMode,
            emergencyStopped,
            robotEnabled,
            fmsCommunications,
            robotAlliance,
            robotPosition,
            reboot,
            restartCode
        };

        // See if we have additional data
        if (data.length > 7) {
            const extendedData = 
                ProtoUtils.parseRobotPacketExtendedDataBuffer(data.slice(6));
            if (extendedData.date) {
                ret.date = extendedData.date;
            }
            if (extendedData.timezone) {
                ret.timezone = extendedData.timezone;
            }
            if (extendedData.joysticks) {
                ret.joysticks = extendedData.joysticks;
            }
        }

        return ret;
    }

    /**
     * Generate a RobotToClientPacket struct from the incoming data buffer
     * @param {Buffer} data
     * @return {RobotToClientPacket} Contents of packet, or null if error 
     */
    readRobotToClientPacket(data) {

    }

    rebootController() {

    }

    restartRobotCode() {

    }

    reset() {

    }
}
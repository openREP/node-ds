const DSProtocolBase = require('../ds-protocol-base');
const DSConstants = require('../../constants');
const { DSControlMode, DSAlliance, DSPosition } = DSConstants;

const ProtoConstants = require('./ds-protocol-2016-constants');
const ProtoUtils = require('./ds-protocol-2016-utils');

/**
 * @class JoystickData
 * @property {number[]} axes - Axis values (-1 to 1)
 * @property {number[]} hats - Hat switch values
 * @property {boolean[]} buttons - Button values
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
        const {upper, lower} = ProtoUtils.encodeVoltage(packetInfo.robotVoltage);

        packet.writeUInt16BE(packetInfo.seq, 0);
        packet.writeUInt8(0x00, 2);
        packet.writeUInt8(ProtoUtils.getFMSControlCode(packetInfo), 3);
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
        const control = ProtoUtils.getFMSControlCode(packetInfo);
        const station = ProtoUtils.getStationCode(packetInfo);
        const tournamentLevel = packetInfo.tournamentLevel;
        const matchNumber = packetInfo.matchNumber; // 2 bytes
        const dateBuf = ProtoUtils.getDateTime(new Date());
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
     * @param {boolean} packetInfo.fmsCommunications - FMS Comms Present
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
        packetHeader.writeUInt8(ProtoUtils.getRobotControlCode(packetInfo), 3);
        packetHeader.writeUInt8(ProtoUtils.getRequestCode(packetInfo), 4);
        packetHeader.writeUInt8(ProtoUtils.getStationCode(packetInfo), 5);

        var pktArr = [packetHeader];
        if (packetInfo.sendTimeData) {
            pktArr.push(ProtoUtils.getTimezoneData());
        }
        else if (packetInfo.seq > 5) {
            pktArr.push(ProtoUtils.getJoystickData(packetInfo));
        }

        return Buffer.concat(pktArr);
    }

    /**
     * Generate a robot->DS response packet
     * @param {Object} packetInfo 
     * @param {number} packetInfo.seq - Packet Number
     * @param {number} packetInfo.controlMode - Current control mode
     * @param {boolean} packetInfo.fmsCommunications - FMS Comms present
     * @param {boolean} packetInfo.emergencyStopped - Emergency Stopped state
     * @param {boolean} packetInfo.robotEnabled - Robot enabled state
     * @param {number} packetInfo.voltage - Current battery voltage
     */
    makeRobotToClientPacket(packetInfo) {
        var packet = Buffer.alloc(7);
        const {upper,lower} = ProtoUtils.encodeVoltage(packetInfo.voltage);

        packet.writeUInt16BE(packetInfo.seq, 0);
        packet.writeUInt8(0x01, 2);
        packet.writeUInt8(ProtoUtils.getRobotControlCode(packetInfo), 3);
        packet.writeUInt8(upper, 4);
        packet.writeUInt8(lower, 5);
        packet.writeUInt8((packet.seq === 0 ? 1 : 0), 6);

        return packet;
    }

    /**
     * Generate a packetInfo struct from the incoming data buffer
     * @param {Buffer} data
     * @return {Object} PacketInfo structure, or null if an error occured 
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
                robotCommunications } = ProtoUtils.fmsControlCodeToState(control);
        
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

    readFMSToClientPacket(data) {
        if (data.length < 22) {
            return null;
        }

        const seq = data.readUInt16BE(0);
        const control = data.readUInt8(3);
        const station = data.readUInt8(5);
        const tournamentLevel = data.readUInt8(6);
        const matchNumber = data.readUInt16BE(7);
        const date = ProtoUtils.parseDateBuffer(data.slice(10, 20));
        const remainTime = data.readUInt16BE(20);

        const { controlMode, 
            emergencyStopped, 
            robotEnabled, 
            robotCommunications } = ProtoUtils.fmsControlCodeToState(control);

        const { robotAlliance, 
                robotPosition} = ProtoUtils.stationCodeToAlliancePosition(station);

        return {
            seq: seq,
            controlMode: controlMode,
            emergencyStopped: emergencyStopped,
            robotEnabled: robotEnabled,
            robotCommunications: robotCommunications,
            robotAlliance: robotAlliance,
            robotPosition: robotPosition,
            tournamentLevel: tournamentLevel,
            matchNumber: matchNumber,
            timeRemaining: remainTime,
            date: date
        };
    }

    /**
     * 
     * @param {Buffer} data 
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
                fmsCommunications} = ProtoUtils.robotControlCodeToState(control);

        const { robotAlliance,
                robotPosition } = ProtoUtils.stationCodeToAlliancePosition(station);

        const { reboot, restartCode } = ProtoUtils.requestCodeToState(request);

        var ret = {
            seq: seq,
            controlMode: controlMode,
            emergencyStopped: emergencyStopped,
            robotEnabled: robotEnabled,
            fmsCommunications: fmsCommunications,
            robotAlliance: robotAlliance,
            robotPosition, robotPosition,
            reboot: reboot,
            restartCode: restartCode
        };

        if (data.length > 7) {
            if (data.readUInt8(7) === ProtoConstants.TAG_DATE) {
                // Parse the date object
                const dateBuf = data.slice(7);

            }
            else if (data.readUInt8(7) === ProtoConstants.TAG_JOYSTICK) {
                // Parse the joystick array from byte 7 till the end
            }
        }

        return ret;
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
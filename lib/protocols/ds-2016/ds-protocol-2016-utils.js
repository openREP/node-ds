const ProtoConstants = require('./ds-protocol-2016-constants');
const moment = require('moment');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('../../constants');

// ------------------------------------------------------------
// "Class" documentation
// ------------------------------------------------------------

/**
 * @typedef {Object} VByte
 * @property {number} upper High-order byte
 * @property {number} lower Low-order byte
 */

/**
 * @typedef {Object} DateTime
 * @property {number} microseconds
 * @property {number} seconds
 * @property {number} minutes
 * @property {number} hours
 * @property {number} day Day of month, starting at 0
 * @property {number} month Month of year, starting at 0
 * @property {number} year Calendar year 
 */

/**
 * @typedef {Object} FMSControlCodeState
 * @property {DSControlMode} controlMode Current mode (auto/teleop/test)
 * @property {boolean} emergencyStopped E-stop state
 * @property {boolean} robotEnabled Robot enabled state
 * @property {boolean} robotCommunications Robot Comms state
 */

/**
 * @typedef {Object} RobotControlCodeState
 * @property {DSControlMode} controlMode Current mode (auto/teleop/test)
 * @property {boolean} emergencyStopped E-stop state
 * @property {boolean} robotEnabled Robot enabled state
 * @property {boolean} fmsCommunications FMS Comms state
 */

/**
 * @typedef {Object} StationState
 * @property {DSAlliance} robotAlliance Robot Alliance (red/blue)
 * @property {DSPosition} robotPosition Robot Position (1/2/3)
 */

/**
 * @typedef {Object} RobotRequestState
 * @property {boolean} reboot Whether or not the controller should reboot
 * @property {boolean} restartCode Whether or not robot code should restart
 * @property {boolean} [robotCommunications] (Only on outbound request)
 */

/**
 * @typedef {Object} JoystickData
 * @property {number[]} axes Axis values (-1 to 1)
 * @property {number[]} hats Hat switch values
 * @property {boolean[]} buttons Button states
 */

/**
 * @typedef {Object} RobotExtendedData
 * @property {DateTime} [date] Date Information
 * @property {string} [timezone] Timezone
 * @property {JoystickData[]} [joysticks] Joystick Information
 */

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
 * @property {JoystickData[]} [joysticks] - Joystick data
 * @property {boolean} [sendTimeData] - Send time information
 */

/**
 * @typedef {Object} RobotToClientPacket
 * @property {number} seq - Packet Number
 * @property {number} voltage - Current battery voltage
 * @property {boolean} requestDate - If a date was requested
 */

// ------------------------------------------------------------
// General Utility Methods
// ------------------------------------------------------------

/**
 * Convert a voltage value into high/low bytes
 * @param {number} voltage
 * @return {VByte}
 */
function encodeVoltage(voltage) {
    var voltInt = Math.floor(voltage);
    var voltFloat = (voltage - voltInt) * 100;
    return {
        upper: voltInt & 0xFF,
        lower: voltFloat & 0xFF
    };
}

/**
 * Return a voltage given high and low order bytes
 * @param {number} upper 
 * @param {number} lower 
 */
function decodeVoltage(upper, lower) {
    return (upper & 0xFF) + (lower / 100);
}

/**
 * Returns a single byte value representing the ratio between the
 * given value and max value
 * @param {number} val 
 * @param {number} max 
 */
function floatToByte(value, max) {
    if (value !== 0 && max !== 0 && value <= max) {
        var pct = Math.floor((value / max) * Math.floor(0xFF / 2));
        return pct & 0xFF;
    }
    return 0;
}

/**
 * Returns a float value (-1 to 1) represented by a byte
 * @param {number} byteVal 
 */
function byteToFloat(byteVal) {
    if (byteVal === 0) {
        return 0.0;
    }
    if (byteVal < 0) {
        return byteVal / 128.0;
    }
    return byteVal / 127.0;
}

// ------------------------------------------------------------
// Date/Time/TZ Buffer Related
// ------------------------------------------------------------

/**
 * Get a packet buffer representing the current date/time
 * @param {Date} currDate 
 * @return {Buffer}
 */
function makeDateTimeBuffer(currDate) {
    var buf = Buffer.alloc(10);
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
 * Parse a 10 byte date buffer into parts.
 * This does NOT include the size + header ID
 * @param {Buffer} buf 
 * @return {DateTime}
 */
function parseDateTimeBuffer(buf) {
    if (buf.length < 10) {
        return null;
    }

    return {
        microseconds: buf.readUInt32BE(0),
        seconds: buf.readUInt8(4),
        minutes: buf.readUInt8(5),
        hours: buf.readUInt8(6),
        day: buf.readUInt8(7),
        month: buf.readUInt8(8),
        year: buf.readUInt8(9) + 1900
    };
}

/**
 * Get a packet buffer representing the current TZ string
 * @return {Buffer}
 */
function makeTZBuffer() {
    const zone = moment.tz.guess();
    const tz = moment.tz(zone).format('z');

    return Buffer.from(tz);
}

/**
 * Get a packet buffer representing the concatenation of date/time
 * and TZ information (with relevant header/size)
 * @param {Date} currDate 
 * @return {Buffer}
 */
function makeTimeAndTZBuffer(currDate) {
    const timeHeader = Buffer.alloc(2);

    timeHeader.writeUInt8(0x0B, 0);
    timeHeader.writeUInt8(ProtoConstants.TAG_DATE, 1);

    const dateTimeBuf = makeDateTimeBuffer(currDate);

    const tzHeader = Buffer.alloc(2);
    const tzBuf = makeTZBuffer();

    tzHeader.writeUInt8(tzBuf.length + 1, 0);
    tzHeader.writeUInt8(ProtoConstants.TAG_TIMEZONE, 1);

    return Buffer.concat([timeHeader, dateTimeBuf, tzHeader, tzBuf]);
}

// ------------------------------------------------------------
// Control Code/Station Code Methods
// ------------------------------------------------------------

/**
 * Get the control code to send to/from FMS
 * @param {FMSControlCodeState} state 
 * @return {number} Byte representing current control code
 */
function makeFMSControlCode(state) {
    var code = 0;
    switch (state.controlMode) {
        case DSControlMode.TEST: {
            code |= ProtoConstants.MODE_TEST;
        } break;
        case DSControlMode.AUTONOMOUS: {
            code |= ProtoConstants.MODE_AUTONOMOUS;
        } break;
        case DSControlMode.TELEOPERATED: {
            code |= ProtoConstants.MODE_TELEOPERATED;
        } break;
    }

    if (state.emergencyStopped) {
        code |= ProtoConstants.MODE_EMERGENCY_STOP;
    }

    if (state.robotEnabled) {
        code |= ProtoConstants.MODE_ENABLED;
    }

    if (state.robotCommunications) {
        code |= ProtoConstants.FMS_ROBOT_COMMS;
        code |= ProtoConstants.FMS_ROBOT_PING;
    }

    return code;
}

/**
 * Parse FMS Control byte into constituent parts
 * @param {number} control Byte representing current control code
 * @return {FMSControlCodeState} Properties represented by control code
 */
function parseFMSControlCode(control) {
    var controlMode = DSControlMode.TELEOPERATED;
    if (control & ProtoConstants.MODE_TEST) {
        controlMode = DSControlMode.TEST;
    }
    else if (control & ProtoConstants.MODE_AUTONOMOUS) {
        controlMode = DSControlMode.AUTONOMOUS;
    }

    const emergencyStopped = !!(control & ProtoConstants.MODE_EMERGENCY_STOP);
    const robotEnabled = !!(control & ProtoConstants.MODE_ENABLED);
    const robotCommunications = (!!(control & ProtoConstants.FMS_ROBOT_COMMS) && 
                                 !!(control & ProtoConstants.FMS_ROBOT_PING));
    
    return {
        controlMode: controlMode,
        emergencyStopped: emergencyStopped,
        robotEnabled: robotEnabled,
        robotCommunications: robotCommunications
    };
}

/**
 * Get the control code to send to a robot
 * @param {RobotControlCodeState} state 
 * @return {number} Byte representing the robot control code
 */
function makeRobotControlCode(state) {
    var code = 0;
    switch (state.controlMode) {
        case DSControlMode.TEST: {
            code |= ProtoConstants.MODE_TEST;
        } break;
        case DSControlMode.AUTONOMOUS: {
            code |= ProtoConstants.MODE_AUTONOMOUS;
        } break;
        case DSControlMode.TELEOPERATED: {
            code |= ProtoConstants.MODE_TELEOPERATED;
        } break;
    }

    if (state.fmsCommunications) {
        code |= ProtoConstants.MODE_FMS_ATTACHED;
    }

    if (state.emergencyStopped) {
        code |= ProtoConstants.MODE_EMERGENCY_STOP;
    }

    if (state.robotEnabled) {
        code |= ProtoConstants.MODE_ENABLED;
    }

    return code;
}

/**
 * Parse a robot control byte into constituent properties
 * @param {number} control 
 * @return {RobotControlCodeState} Properties represented by control code
 */
function parseRobotControlCode(control) {
    var controlMode = DSControlMode.TELEOPERATED;
    if (control & ProtoConstants.MODE_TEST) {
        controlMode = DSControlMode.TEST;
    }
    else if (control & ProtoConstants.MODE_AUTONOMOUS) {
        controlMode = DSControlMode.AUTONOMOUS;
    }

    const emergencyStopped = !!(control & ProtoConstants.MODE_EMERGENCY_STOP);
    const robotEnabled = !!(control & ProtoConstants.MODE_ENABLED);
    const fmsCommunications = !!(control & ProtoConstants.MODE_FMS_ATTACHED);

    return {
        controlMode: controlMode,
        emergencyStopped: emergencyStopped,
        robotEnabled: robotEnabled,
        fmsCommunications: fmsCommunications
    };
}

/**
 * Make the station code byte to send to a robot/FMS
 * @param {StationState} state 
 * @return {number} Byte representing station information
 */
function makeStationCode(state) {
    if (state.robotPosition === DSPosition.POSITION_1) {
        if (state.robotAlliance === DSAlliance.RED) {
            return ProtoConstants.TEAM_RED_1;
        }
        else {
            return ProtoConstants.TEAM_BLUE_1;
        }
    }

    if (state.robotPosition === DSPosition.POSITION_2) {
        if (state.robotAlliance === DSAlliance.RED) {
            return ProtoConstants.TEAM_RED_2;
        }
        else {
            return ProtoConstants.TEAM_BLUE_2;
        }
    }

    if (state.robotPosition === DSPosition.POSITION_3) {
        if (state.robotAlliance === DSAlliance.RED) {
            return ProtoConstants.TEAM_RED_3;
        }
        else {
            return ProtoConstants.TEAM_BLUE_3;
        }
    }

    return ProtoConstants.TEAM_RED_1;
}

/**
 * Get constituent alliance/position information from station code
 * @param {number} station 
 * @return {StationState} 
 */
function parseStationCode(station) {
    var robotAlliance = DSAlliance.RED;
    var robotPosition = DSPosition.POSITION_1;

    switch (station) {
        case ProtoConstants.TEAM_RED_1: {
            robotAlliance = DSAlliance.RED;
            robotPosition = DSPosition.POSITION_1;
        } break;
        case ProtoConstants.TEAM_RED_2: {
            robotAlliance = DSAlliance.RED;
            robotPosition = DSPosition.POSITION_2;
        } break;
        case ProtoConstants.TEAM_RED_3: {
            robotAlliance = DSAlliance.RED;
            robotPosition = DSPosition.POSITION_3;
        } break;
        case ProtoConstants.TEAM_BLUE_1: {
            robotAlliance = DSAlliance.BLUE;
            robotPosition = DSPosition.POSITION_1;
        } break;
        case ProtoConstants.TEAM_BLUE_2: {
            robotAlliance = DSAlliance.BLUE;
            robotPosition = DSPosition.POSITION_2;
        } break;
        case ProtoConstants.TEAM_BLUE_3: {
            robotAlliance = DSAlliance.BLUE;
            robotPosition = DSPosition.POSITION_3;
        } break;
    }

    return {
        robotAlliance: robotAlliance,
        robotPosition: robotPosition
    };
}

/**
 * Generate a request byte from the given request parameters
 * @param {RobotRequestState} state 
 * @return {number} Request byte
 */
function makeRequestCode(state) {
    var code = ProtoConstants.REQUEST_NORMAL;
    if (state.robotCommunications) {
        if (state.reboot) {
            code = ProtoConstants.REQUEST_REBOOT;
        }
        else if (state.restartCode) {
            code = ProtoConstants.REQUEST_RESTART_CODE;
        }
    }
    else {
        code = ProtoConstants.REQUEST_UNCONNECTED;
    }

    return code;
}

/**
 * Get the relevant parameters from a request byte
 * @param {number} request 
 * @return {RobotRequestState}
 */
function parseRequestCode(request) {
    const reboot = !!(request & ProtoConstants.REQUEST_REBOOT);
    const restartCode = !!(request & ProtoConstants.REQUEST_RESTART_CODE);

    return {
        reboot: reboot,
        restartCode: restartCode
    };
}

// ------------------------------------------------------------
// Joystick Methods
// ------------------------------------------------------------

/**
 * Calculate size of the joystick data buffer
 * @param {JoystickData} stick 
 * @return {number} Size of a Joystick data buffer
 * @private
 */
function calcJoystickBufferSize(stick) {
    const headerSize = 2;
    const buttonData = 3;
    const axisData = stick.axes.length + 1;
    const hatData = (stick.hats.length * 2) + 1;

    return headerSize + buttonData + axisData + hatData;
}

/**
 * Generate a buffer representing the state of all joysticks in the system
 * @param {JoystickData[]} joysticks 
 * @return {Buffer}
 */
function makeJoystickDataBuffer(joysticks) {
    if (!joysticks) return Buffer.alloc(0);

    var i = 0, j = 0;
    var data = []; // byte array, which will then convert to a buffer
    
    for (i = 0; i < joysticks.length; i++) {
        var stick = joysticks[i];
        data.push(calcJoystickBufferSize(stick) & 0xFF);
        data.push(ProtoConstants.TAG_JOYSTICK & 0xFF);

        // Add axis data
        data.push(stick.axes.length & 0xFF);
        for (j = 0; j < stick.axes.length; j++) {
            data.push(floatToByte(stick.axes[j], 1) & 0xFF);
        }

        // Button data
        var buttonFlags = 0;
        for (j = 0; j < stick.buttons.length; j++) {
            buttonFlags += stick.buttons[j] ? (1 << j) : 0;
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

/**
 * Parse a Joystick data buffer
 * @param {Buffer} buf 
 * @return {JoystickData}
 */
function parseJoystickDataBuffer(buf) {
    var stick = {
        axes: [],
        hats: [],
        buttons: []
    };

    const axisCountPtr = 0;
    const axisCount = buf.readUInt8(0);

    const buttonCountPtr = axisCountPtr + axisCount + 1;
    const buttonCount = buf.readUInt8(buttonCountPtr);
    const hatCountPtr = buttonCountPtr + 2 + 1;
    const hatCount = buf.readUInt8(hatCountPtr);
    const estimatedPktSize = hatCountPtr + (2 * hatCount) + 1;

    var i;
    if (buf.length >= estimatedPktSize) {
        for (i = axisCountPtr + 1; i < axisCountPtr + 1 + axisCount; i++) {
            var axisVal = byteToFloat(buf.readInt8(i));
            stick.axes.push(axisVal);
        }

        const buttonFlags = buf.readUInt16BE(buttonCountPtr + 1);
        for (i = 0; i < buttonCount; i++) {
            var val = !!((buttonFlags >> i) & 0x1);
            stick.buttons.push(val);
        }

        for (i = hatCountPtr + 1; i < estimatedPktSize; i+=2) {
            stick.hats.push(buf.readInt16BE(i));
        }
    }
    return stick;
}

// ------------------------------------------------------------
// High Level Packet Buffer Related
// ------------------------------------------------------------

/**
 * Generate a client->FMS packet buffer given a packet info object
 * @param {ClientToFMSPacket} packetInfo
 * @return {Buffer}
 */
function makeClientToFMSPacket(packetInfo) {
    const packet = Buffer.alloc(8);

    // Voltage bytes
    const { upper, lower } = encodeVoltage(packetInfo.robotVoltage);

    packet.writeUInt16BE(packetInfo.seq, 0);
    packet.writeUInt8(0x00, 2);
    packet.writeUInt8(makeFMSControlCode(packetInfo), 3);
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
function makeFMSToClientPacket(packetInfo) {
    const packetHeader = Buffer.alloc(10);
    const packetTimeRemaining = Buffer.alloc(2);

    const seq = packetInfo.seq;
    const control = makeFMSControlCode(packetInfo);
    const station = makeStationCode(packetInfo);
    const tournamentLevel = packetInfo.tournamentLevel;
    const matchNumber = packetInfo.matchNumber; // 2 bytes
    const dateBuf = makeDateTimeBuffer(new Date());
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
function makeClientToRobotPacket(packetInfo) {
    const packetHeader = Buffer.alloc(6);

    packetHeader.writeUInt16BE(packetInfo.seq, 0);
    packetHeader.writeUInt8(ProtoConstants.TAG_GENERAL, 2);

    // Control Code
    packetHeader.writeUInt8(makeRobotControlCode(packetInfo), 3);
    packetHeader.writeUInt8(makeRequestCode(packetInfo), 4);
    packetHeader.writeUInt8(makeStationCode(packetInfo), 5);

    var pktArr = [packetHeader];
    if (packetInfo.sendTimeData) {
        pktArr.push(makeTimeAndTZBuffer());
    }
    else if (packetInfo.seq > 5) {
        pktArr.push(makeJoystickDataBuffer(packetInfo.joysticks));
    }

    return Buffer.concat(pktArr);
}

/**
 * Generate a robot->DS response packet buffer
 * @param {RobotToClientPacket} packetInfo 
 * @return {Buffer}
 */
function makeRobotToClientPacket(packetInfo) {
    var packet = Buffer.alloc(7);
    const { upper, lower } = encodeVoltage(packetInfo.voltage);

    packet.writeUInt16BE(packetInfo.seq, 0);
    packet.writeUInt8(0x01, 2);
    packet.writeUInt8(makeRobotControlCode(packetInfo), 3);
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
function readClientToFMSPacket(data) {
    if (data.length < 8) {
        return null;
    }

    const seq = data.readUInt16BE(0);
    const control = data.readUInt8(3);
    const team = data.readUInt16BE(4);
    const upper = data.readUInt8(6);
    const lower = data.readUInt8(7);

    const voltage = decodeVoltage(upper, lower);

    const { controlMode,
        emergencyStopped,
        robotEnabled,
        robotCommunications } = parseFMSControlCode(control);

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
function readFMSToClientPacket(data) {
    if (data.length < 22) {
        return null;
    }

    const seq = data.readUInt16BE(0);
    const control = data.readUInt8(3);
    const station = data.readUInt8(5);
    const tournamentLevel = data.readUInt8(6);
    const matchNumber = data.readUInt16BE(7);
    const date = parseDateDataBuffer(data.slice(10, 20));
    const timeRemaining = data.readUInt16BE(20);

    const { controlMode,
        emergencyStopped,
        robotEnabled,
        robotCommunications } = parseFMSControlCode(control);

    const { robotAlliance,
        robotPosition } = parseStationCode(station);

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
function readClientToRobotPacket(data) {
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
        fmsCommunications } = parseRobotControlCode(control);

    const { robotAlliance,
        robotPosition } = parseStationCode(station);

    const { reboot, restartCode } = parseRequestCode(request);

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
            parseRobotPacketExtendedDataBuffer(data.slice(6));
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
function readRobotToClientPacket(data) {
    if (data.length < 7) {
        return null;
    }

    const seq = data.readUInt16BE(0);
    const voltage = decodeVoltage(data.readUInt8(4),
        data.readUInt8(5));
    const requestDate = !!data.readUInt8(6);

    var ret = {
        seq,
        voltage,
        requestDate
    };
    // The controller should send additional data, which we will ignore
}

// ------------------------------------------------------------
// Others
// ------------------------------------------------------------

/**
 * Get a set of extended robot data objects
 * This includes time, timezone, joysticks, etc
 * @param {Buffer} buf Buffer containing extended data from robot
 * @return {RobotExtendedData}
 */
function parseRobotPacketExtendedDataBuffer(buf) {
    const dataLen = buf.length;
    var bytesProcessed = 0;

    var dataBuf = buf.slice(0);
    var output = {};

    // Data format is always: 
    // [ size - 1 byte ] [ ID - 1 byte ] [ ... ]
    while(bytesProcessed < dataLen) {
        // Start from where we stopped before
        dataBuf = buf.slice(bytesProcessed);

        // size does not include size block
        var dataSize = dataBuf.readUInt8(0);
        // Break out if we can't possible read anymore
        if (bytesProcessed + dataSize > dataLen) {
            break;
        }
        // Re-slice the buffer
        dataBuf = dataBuf.slice(1, dataSize + 1);
        // dataBuf is now HEADER + DATA

        var dataType = dataBuf.readUInt8(0);
        dataBuf = dataBuf.slice(1); // Only DATA
        switch (dataType) {
            // from controller
            case ProtoConstants.TAG_DISK_INFO: {
                // TODO Implement
            } break;
            case ProtoConstants.TAG_CPU_INFO: {
                // TODO Implement
            } break;
            case ProtoConstants.TAG_RAM_INFO: {
                // TODO Implement
            } break;
            case ProtoConstants.TAG_CAN_INFO: {
                // TODO Implement
            } break;
            // From DS
            case ProtoConstants.TAG_JOYSTICK: {
                if (!output.joysticks) {
                    output.joysticks = [];
                }
                output.joysticks.push(parseJoystickDataBuffer(dataBuf));
            } break;
            case ProtoConstants.TAG_DATE: {
                output.date = parseDateTimeBuffer(dataBuf);
            } break;
            case ProtoConstants.TAG_TIMEZONE: {

            } break;
        }

        bytesProcessed += dataSize;
    }

    return output;
}


module.exports = {
    // General
    encodeVoltage,
    decodeVoltage,
    floatToByte,
    byteToFloat,

    // Date/Time/TZ
    makeDateTimeBuffer,
    parseDateTimeBuffer,
    makeTZBuffer,
    makeTimeAndTZBuffer,

    // Control Codes
    makeFMSControlCode,
    parseFMSControlCode,
    makeRobotControlCode,
    parseRobotControlCode,
    makeStationCode,
    parseStationCode,
    makeRequestCode,
    parseRequestCode,

    // Joystick
    parseJoystickDataBuffer,
    makeJoystickDataBuffer,

    // Packet Buffer
    makeClientToFMSPacket,
    makeFMSToClientPacket,
    makeClientToRobotPacket,
    makeRobotToClientPacket,
    readClientToFMSPacket,
    readFMSToClientPacket,
    readClientToRobotPacket,
    readRobotToClientPacket,

    // Others
    parseRobotPacketExtendedDataBuffer,
};
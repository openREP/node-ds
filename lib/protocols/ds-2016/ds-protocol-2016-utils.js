const ProtoConstants = require('./ds-protocol-2016-constants');
const moment = require('moment');

function encodeVoltage(voltage) {
    var voltInt = Math.floor(voltage);
    var voltFloat = (voltage - voltInt) * 100;
    return {
        upper: voltInt & 0xFF,
        lower: voltFloat & 0xFF
    };
}

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

function byteToFloat(byteVal) {
    if (byteVal === 0) {
        return 0.0;
    }
    if (byteVal < 0) {
        return byteVal / 128.0;
    }
    return byteVal / 127.0;
}

/**
 * Get a packet buffer representing the current date/time
 * @param {Date} currDate 
 * @return {Buffer}
 */
function getDateTime(currDate) {
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
 * Get a packet buffer representing the current TZ string
 * @return {Buffer}
 */
function getTZ() {
    const zone = moment.tz.guess();
    const tz = moment.tz(zone).format('z');

    return Buffer.from(tz);
}

/**
 * Get a packet buffer representing the concatenation of date/time
 * and TZ information
 * @param {Date} currDate 
 * @return {Buffer}
 */
function getTimeAndTZData(currDate) {
    const timeHeader = Buffer.alloc(2);

    timeHeader.writeUInt8(0x0B, 0);
    timeHeader.writeUInt8(ProtoConstants.TAG_DATE, 1);

    const dateTimeBuf = getDateTime(currDate);

    const tzHeader = Buffer.alloc(2);
    const tzBuf = getTZ();

    tzHeader.writeUInt8(tzBuf.length + 1, 0);
    tzHeader.writeUInt8(ProtoConstants.TAG_TIMEZONE, 1);

    return Buffer.concat([timeHeader, dateTimeBuf, tzHeader, tzBuf]);
}

/**
 * Get a set of extended robot data objects
 * This includes time, timezone, joysticks, etc
 * @param {Buffer} buf 
 */
function parseRobotPacketExtendedData(buf) {
    const dataLen = buf.length;
    var bytesProcessed = 0;

    var dataBuf = buf.slice(0);

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

        var output = {};

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
                output.joysticks.push(parseJoystickData(dataBuf));
            } break;
            case ProtoConstants.TAG_DATE: {

            } break;
            case ProtoConstants.TAG_TIMEZONE: {

            } break;
        }

        bytesProcessed += dataSize;
    }
}

/**
 * 
 * @param {Buffer} buf 
 */
function parseJoystickData(buf) {
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

/**
 * Get the control code to send to/from FMS
 * @param {Object} state 
 */
function getFMSControlCode(state) {
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

function fmsControlCodeToState(control) {
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
 * @param {Object} state 
 */
function getRobotControlCode(state) {
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

function robotControlCodeToState(control) {
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

function getStationCode(state) {
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

function stationCodeToAlliancePosition(station) {
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

function getRequestCode(state) {
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

function requestCodeToState(request) {
    const reboot = !!(request & ProtoConstants.REQUEST_REBOOT);
    const restartCode = !!(request & ProtoConstants.REQUEST_RESTART_CODE);

    return {
        reboot: reboot,
        restartCode: restartCode
    };
}

/**
 * Parse a 10 byte date buffer into parts
 * @param {Buffer} buf 
 */
function parseDateBuffer(buf) {
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

module.exports = {
    encodeVoltage,
    decodeVoltage,
    floatToByte,
    byteToFloat,
    getDateTime,
    getTZ,
    getTimeAndTZData,
    parseRobotPacketExtendedData,
    parseJoystickData,
    getFMSControlCode,
    fmsControlCodeToState,
    getRobotControlCode,
    robotControlCodeToState,
    getStationCode,
    stationCodeToAlliancePosition,
    getRequestCode,
    requestCodeToState,
    parseDateBuffer,
    getJoystickPacketSize,
    getJoystickData,

};
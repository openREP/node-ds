module.exports = {
    DSEvent: {
        JOYSTICK_COUNT_CHANGED  : 0x01,
        NETCONSOLE_NEW_MESSAGE  : 0x02,
        ROBOT_VOLTAGE_CHANGED   : 0x03,
        ROBOT_CAN_UTIL_CHANGED  : 0x04,
        ROBOT_CPU_INFO_CHANGED  : 0x05,
        ROBOT_RAM_INFO_CHANGED  : 0x06,
        ROBOT_DISK_INFO_CHANGED : 0x07,
        STATUS_STRING_CHANGED   : 0x08,
        ROBOT_COMMS_CHANGED     : 0x09,
        ROBOT_CODE_CHANGED      : 0x0A
    },
    DSEventType: {
        NULL_EVENT              : 0x00,
        FMS_COMMS_CHANGED       : 0x01,
        RADIO_COMMS_CHANGED     : 0x03,
        JOYSTICK_COUNT_CHANGED  : 0x05,
        NETCONSOLE_NEW_MESSAGE  : 0x06,
        ROBOT_ENABLED_CHANGED   : 0x07,
        ROBOT_MODE_CHANGED      : 0x09,
        ROBOT_REBOOTED          : 0x0A,
        ROBOT_COMMS_CHANGED     : 0x0B,
        ROBOT_CODE_CHANGED      : 0x0D,
        ROBOT_CODE_RESTARTED    : 0x10,
        ROBOT_VOLTAGE_CHANGED   : 0x11,
        ROBOT_CAN_UTIL_CHANGED  : 0x12,
        ROBOT_CPU_INFO_CHANGED  : 0x13,
        ROBOT_RAM_INFO_CHANGED  : 0x14,
        ROBOT_DISK_INFO_CHANGED : 0x15,
        ROBOT_STATION_CHANGED   : 0x16,
        ROBOT_ESTOP_CHANGED     : 0x17,
        STATUS_STRING_CHANGED   : 0x18,
    },
    DSControlMode: {
        TEST            : 0x00,
        AUTONOMOUS      : 0x01,
        TELEOPERATED    : 0x02,
    },
    DSAlliance: {
        RED     : 0x00,
        BLUE    : 0x01
    },
    DSPosition: {
        POSITION_1  : 0x00,
        POSITION_2  : 0x01,
        POSITION_3  : 0x02
    },
    DSReconfigFlags: {
        RECONFIG_FMS    : 0x01,
        RECONFIG_RADIO  : 0x02,
        RECONFIG_ROBOT  : 0x04,
        RECONFIG_ALL    : 0x01 | 0x02 | 0x04
    }
};
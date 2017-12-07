module.exports = {
    MODE_TEST               : 0x01,
    MODE_ENABLED            : 0x04,
    MODE_AUTONOMOUS         : 0x02,
    MODE_TELEOPERATED       : 0x00,
    MODE_FMS_ATTACHED       : 0x08,
    MODE_EMERGENCY_STOP     : 0x80,

    REQUEST_REBOOT          : 0x08,
    REQUEST_NORMAL          : 0x80,
    REQUEST_UNCONNECTED     : 0x00,
    REQUEST_RESTART_CODE    : 0x04,
    REQUEST_TIME            : 0x01,

    FMS_RADIO_PING          : 0x10,
    FMS_ROBOT_PING          : 0x08,
    FMS_ROBOT_COMMS         : 0x20,
    FMS_DS_VERSION          : 0x00,

    TAG_DATE                : 0x0F,
    TAG_GENERAL             : 0x01,
    TAG_JOYSTICK            : 0x0C,
    TAG_TIMEZONE            : 0x10,
    TAG_CAN_INFO            : 0x0E,
    TAG_CPU_INFO            : 0x05,
    TAG_RAM_INFO            : 0x06,
    TAG_DISK_INFO           : 0x04,

    TEAM_RED_1              : 0x00,
    TEAM_RED_2              : 0x01,
    TEAM_RED_3              : 0x02,
    TEAM_BLUE_1             : 0x03,
    TEAM_BLUE_2             : 0x04,
    TEAM_BLUE_3             : 0x05,

    ROBOT_HAS_CODE          : 0x20,
};
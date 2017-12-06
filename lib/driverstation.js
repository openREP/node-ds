const dgram = require('dgram');
const crc32 = require('buffer-crc32');
const EventEmitter = require('events');

const DSConstants = require('./constants');

const FALLBACK_ADDRESS = '0.0.0.0';

class DriverStation extends EventEmitter {
    constructor() {
        super();

        // Socket
        this.d_fmsSocket = null;
        this.d_radioSocket = null;
        this.d_robotSocket = null;
        this.d_netconsoleSocket = null;

        // Protocol
        this.d_protocol = null;

        // Custom Remote Addresses
        // These will be used first. If they are null or empty, then
        // we fallback to whatever the protocol specifies
        this.d_customFmsAddress = null;
        this.d_customRobotAddress = null;
        this.d_customRadioAddress = null;

        // State
        this.d_team = 0;
        this.d_cpuUsage = -1;
        this.d_ramUsage = -1;
        this.d_diskUsage = -1;
        this.d_robotCode = false;
        this.d_robotEnabled = false;
        this.d_canUtilization = -1;
        this.d_robotVoltage = -1;
        this.d_emergencyStopped = false;
        this.d_fmsCommunications = false;
        this.d_radioCommunications = false;
        this.d_robotCommunications = false;
        this.d_robotPosition = DSConstants.DSPosition.POSITION_1;
        this.d_robotAlliance = DSConstants.DSAlliance.RED;
        this.d_controlMode = DSConstants.DSControlMode.TELEOPERATED;
    }

    // -------------------------------------------------------------
    // Default Addresses
    //--------------------------------------------------------------
    get defaultFMSAddress() {
        if (this.d_protocol) {
            return this.d_protocol.fmsAddress;
        }
        return FALLBACK_ADDRESS;
    }

    get defaultRadioAddress() {
        if (this.d_protocol) {
            return this.d_protocol.radioAddress;
        }
        return FALLBACK_ADDRESS;
    }

    get defaultRobotAddress() {
        if (this.d_protocol) {
            return this.d_protocol.robotAddress;
        }
        return FALLBACK_ADDRESS;
    }

    // -------------------------------------------------------------
    // Effective Addresses
    //--------------------------------------------------------------
    get effectiveFMSAddress() {
        if (!this.customFMSAddress) {
            return this.defaultFMSAddress;
        }
        return this.customFMSAddress;
    }

    get effectiveRadioAddress() {
        if (!this.customRadioAddress) {
            return this.defaultRadioAddress;
        }
        return this.customRadioAddress;
    }

    get effectiveRobotAddress() {
        if (!this.customRobotAddress) {
            return this.defaultRobotAddress;
        }
        return this.customRobotAddress;
    }
    
    // -------------------------------------------------------------
    // Custom Addresses
    //--------------------------------------------------------------
    get customFMSAddress() {
        return this.d_customFmsAddress;
    }
    set customFMSAddress(addr) {
        this.d_customFmsAddress = addr;
        this._reconfigureAddresses(DSConstants.DSReconfigFlags.RECONFIG_FMS);
    }

    get customRadioAddress() {
        return this.d_customRadioAddress;
    }
    set customRadioAddress(addr) {
        this.d_customRadioAddress = addr;
        this._reconfigureAddresses(DSConstants.DSReconfigFlags.RECONFIG_RADIO);
    }

    get customRobotAddress() {
        return this.d_customRobotAddress;
    }
    set customRobotAddress(addr) {
        this.d_customRobotAddress = addr;
        this._reconfigureAddresses(DSConstants.DSReconfigFlags.RECONFIG_ROBOT);
    }

    // -------------------------------------------------------------
    // Status String
    //--------------------------------------------------------------
    get statusString() {
        if (!this.d_robotCommunications) {
            return "No Robot Communications";
        }
        else if (!this.d_robotCode) {
            return "No Robot Code";
        }

        var enabled = this.d_robotEnabled;

        switch(this.d_controlMode) {
            case DSConstants.DSControlMode.TELEOPERATED: {
                return "Teleoperated " + (enabled ? "Enabled" : "Disabled");
            }
            case DSConstants.DSControlMode.AUTONOMOUS: {
                return "Autonomous " + (enabled ? "Enabled" : "Disabled");
            }
            case DSConstants.DSControlMode.TEST: {
                return "Test " + (enabled ? "Enabled" : "Disabled");
            }
        }

        return "Status Error";
    }

    get teamNumber() {
        return this.d_team;
    }
    set teamNumber(val) {
        if (val !== this.d_team) {
            this.d_team = val;
            this._reconfigureAddresses(DSConstants.DSReconfigFlags.RECONFIG_ALL);
        }
    }

    get robotCode() {
        return this.d_robotCode;
    }
    set robotCode(val) {
        if (val !== this.d_robotCode) {
            this.d_robotCode = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_CODE_CHANGED);
            this.emit('robotEvent', DSConstants.DSEventType.STATUS_STRING_CHANGED);
        }
    }

    /**
     * Can this robot be safely enabled
     * We determine this by:
     * - Robot communications are present
     * - The robot has code running
     * - The robot is NOT emergency stopped
     * @return {boolean} If the robot can be safely enabled
     * @property
     */
    get canBeEnabled() {
        return this.robotCode && 
               !this.emergencyStopped && 
               this.robotCommunications;
    }

    get controlMode() {
        return this.d_controlMode;
    }
    set controlMode(val) {
        if (val !== this.d_controlMode) {
            this.d_controlMode = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_MODE_CHANGED);
            this.emit('robotEvent', DSConstants.DSEventType.STATUS_STRING_CHANGED);
        }
    }

    get robotEnabled() {
        return this.d_robotEnabled;
    }
    set robotEnabled(val) {
        if (val !== this.d_robotEnabled) {
            this.d_robotEnabled = val && !this.emergencyStopped;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_ENABLED_CHANGED);
            this.emit('robotEvent', DSConstants.DSEventType.STATUS_STRING_CHANGED);
        }
    }

    get robotCPUUsage() {
        return this.d_cpuUsage;
    }

    get robotDiskUsage() {
        return this.d_diskUsage;
    }

    get robotRAMUsage() {
        return this.d_ramUsage;
    }

    get robotVoltage() {
        return this.d_robotVoltage;
    }
    set robotVoltage(val) {
        if (val !== this.d_robotVoltage) {
            this.d_robotVoltage = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_VOLTAGE_CHANGED);
        }
    }

    get alliance() {
        return this.d_robotAlliance;
    }
    set alliance(val) {
        if (val !== this.d_robotAlliance) {
            this.d_robotAlliance = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_STATION_CHANGED);
        }
    }

    get position() {
        return this.d_robotPosition;
    }
    set position(val) {
        if (val !== this.d_robotPosition) {
            this.d_robotPosition = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_STATION_CHANGED);
        }
    }

    get emergencyStopped() {
        return this.d_emergencyStopped;
    }
    set emergencyStopped(val) {
        if (val !== this.d_emergencyStopped) {
            this.d_emergencyStopped = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_ESTOP_CHANGED);
            this.emit('robotEvent', DSConstants.DSEventType.STATUS_STRING_CHANGED);
        }
    }

    get fmsCommunications() {
        return this.d_fmsCommunications;
    }

    get radioCommunications() {
        return this.d_radioCommunications;
    }

    get robotCommunications() {
        return this.d_robotCommunications;
    }
    set robotCommunications(val) {
        if (val !== this.d_robotCommunications) {
            this.d_robotCommunications = val;
            this.emit('robotEvent', DSConstants.DSEventType.ROBOT_COMMS_CHANGED);
            this.emit('robotEvent', DSConstants.DSEventType.STATUS_STRING_CHANGED);

            if (this.d_protocol) {
                this.d_protocol.resetRobotPackets();
            }
        }
    }

    get robotCANUtilization() {
        return this.d_canUtilization;
    }

    get maxBatteryVoltage() {
        if (this.d_protocol) {
            return this.d_protocol.maxBatteryVoltage;
        }
        return 0.0;
    }

    // -------------------------------------------------------------
    // Public Methods
    //--------------------------------------------------------------
    rebootRobot() {
        if (this.d_protocol) {
            this.d_protocol.rebootRobot();
        }
    }

    restartRobotCode() {
        if (this.d_protocol) {
            this.d_protocol.restartRobotCode();
        }
    }

    configureProtocol(proto) {
        if (this.d_protocol) {
            this.d_protocol.removeAllListeners();
            this.d_protocol.shutdown();
        }

        this.d_protocol = proto;
        // Protocol objects should be fairly self contained

    }

    // -------------------------------------------------------------
    // Private Methods
    //--------------------------------------------------------------
    _reconfigureAddresses(flags) {
        if (!this.d_protocol) {
            return;
        }
        
        if (flags & DSConstants.DSReconfigFlags.RECONFIG_FMS) {
            if (this.d_protocol.fmsSocket) {
                this.d_protocol.fmsSocket.changeAddress(this.effectiveFMSAddress);
            }
        }

        if (flags & DSConstants.DSReconfigFlags.RECONFIG_RADIO) {
            if (this.d_protocol.radioSocket) {
                this.d_protocol.radioSocket.changeAddress(this.effectiveRadioAddress);
            }
        }

        if (flags & DSConstants.DSReconfigFlags.RECONFIG_ROBOT) {
            if (this.d_protocol.robotSocket) {
                this.d_protocol.robotSocket.changeAddress(this.effectiveRobotAddress);
            }
        }
    }
};

module.exports = DriverStation;
const EventEmitter = require('events');
const DSProtocolBase = require('./protocols/ds-protocol-base');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('./constants');

const DEFAULTS = {
    teamNumber: 0,
    controlMode: DSControlMode.TELEOPERATED,
    robotAlliance: DSAlliance.RED,
    robotPosition: DSPosition.POSITION_1
};

class DriverStationClient extends EventEmitter {
    /**
     * Create a new DriverStationClient
     * @param {DSProtocolBase} protocol 
     */
    constructor(protocol) {
        super();
        
        if (!protocol) {
            throw new Error('Protocol must be provided');
        }

        if (!(protocol instanceof DSProtocolBase)) {
            throw new Error('Protocol needs to be of type DSProtocolBase');
        }
        
        this.loadProtocol(protocol);
    }

    // === Public Getters/Setters ===
    get teamNumber() {
        return this.d_protocol.teamNumber;
    }
    set teamNumber(team) {
        this.d_protocol.teamNumber = team;
    }

    get customRobotAddress() {
        return this.d_protocol.customRobotAddress;
    }
    set customRobotAddress(addr) {
        this.d_protocol.customRobotAddress = addr;
    }

    get customFMSAddress() {
        return this.d_protocol.customFMSAddress;
    }
    set customFMSAddress(addr) {
        this.d_protocol.customFMSAddress = addr;
    }

    get robotEnabled() {
        return this.d_protocol.robotEnabled;
    }
    set robotEnabled(val) {
        this.d_protocol.robotEnabled = !!val;
    }

    /**
     * The current control mode of the driver station
     * @property {DSControlMode}
     */
    get controlMode() {
        return this.d_protocol.controlMode;
    }
    set controlMode(val) {
        this.d_protocol.controlMode = val;
    }
    
    /**
     * Whether the robot was emergency stopped
     * @property {boolean}
     * @readonly
     */
    get emergencyStopped() {
        return this.d_protocol.emergencyStopped;
    }

    /**
     * Whether robot code is present on the controller
     * @property {boolean}
     * @readonly
     */
    get robotCode() {
        return this.d_protocol.robotCode;
    }

    /**
     * Current battery voltage of the robot
     * @property {number}
     * @readonly
     */
    get robotVoltage() {
        return this.d_protocol.robotVoltage;
    }

    /**
     * Whether or not the client has communications with the robot
     * @property {boolean}
     * @readonly
     */
    get robotCommunications() {
        return this.d_protocol.robotCommunications;
    }

    /**
     * Whether or not the client has communications with the FMS
     * @property {boolean}
     * @readonly
     */
    get fmsCommunications() {
        return this.d_protocol.fmsCommunications;
    }

    /**
     * Load a new protocol
     * This will also shutdown the old one (if any) and reset all state
     * @param {DSProtocolBase} proto 
     */
    loadProtocol(proto) {
        if (!proto) {
            throw new Error('Protocol needs to be provided');
        }

        if (!(proto instanceof DSProtocolBase)) {
            throw new Error('Protocol needs to be of type DSProtocolBase');
        }

        if (this.d_protocol) {
            this.d_protocol.stop();
            this.d_protocol.removeAllListeners();

            // Copy the relevant details over to the new protocol
            proto.teamNumber = this.d_protocol.teamNumber;
            proto.customFMSAddress = this.d_protocol.customFMSAddress;
            proto.customRobotAddress = this.d_protocol.customRobotAddress;
        }

        // Set up protocol events
        proto.on('stateChanged', (changeEvt) => {
            // Ignore teamNumber
            // Publish an event
            if (changeEvt.field !== 'teamNumber') {
                this.emit('stateChanged', changeEvt);
            }
        });

        this.d_protocol = proto;
    }

    rebootController() {
        this.d_protocol.shouldRebootController = true;
    }

    restartRobotCode() {
        this.d_protocol.shouldRestartCode = true;
    }

    // === Public Interface ===

    /**
     * Update the current state of the Joysticks
     * @param {JoystickData[]} sticks 
     */
    updateJoysticks(sticks) {
        this.d_protocol.updateJoysticks(sticks);
    }

    start() {
        this.d_protocol.startAsClient();
    }

    stop() {
        this.d_protocol.stop();
    }
};

module.exports = DriverStationClient;
/**
 * DriverStation Protocol Base Object
 */

const EventEmitter = require('events');
const DSConstants = require('../constants');
const DSAlliance = DSConstants.DSAlliance;
const DSPosition = DSConstants.DSPosition;
const DSControlMode = DSConstants.DSControlMode;

 /**
  * Base class for DriverStation protocol specifications
  */
class DSProtocolBase extends EventEmitter {
    constructor() {
        super();

        // --------------------------------------------------------
        // Private properties
        // --------------------------------------------------------
        this.d_protocolName = '';

        /* === Ports === */
        this.d_clientToFMSPort = 0;
        this.d_fmsToClientPort = 0;
        this.d_clientToRobotPort = 0;
        this.d_robotToClientPort = 0;
        this.d_clientToNetconsolePort = 0;
        this.d_netconsoleToClientPort = 0;

        /* === Intervals === */
        this.d_clientToFMSInterval = -1;
        this.d_clientToRobotInterval = -1;

        /* === Joystick Properties === */
        this.d_maxJoysticks = 0;
        this.d_maxJoystickHatCount = 0;
        this.d_maxJoystickAxisCount = 0;
        this.d_maxJoystickButtonCount = 0;

        /* === Address Information === */
        this.d_customFmsAddress = null;
        this.d_customRobotAddress = null;

        /* === General Properties === */
        this.d_maxVoltage = 0.0;

        /* === State Properties === */
        this.d_teamNumber = 0;
        this.d_robotAlliance = DSAlliance.RED;
        this.d_robotPosition = DSPosition.POSITION_1;
        this.d_controlMode = DSControlMode.TELEOPERATED;
        this.d_robotEnabled = false;
        this.d_emergencyStopped = false;
        this.d_robotCode = false;
        this.d_robotVoltage = 0.0;
        this.d_robotCommunications = false;
        this.d_fmsCommunications = false;
    }

    // --------------------------------------------------------
    // Public Properties (Getters/Setters)
    // --------------------------------------------------------

    /**
     * Get the name of this protocol
     * @return {string} protocol name
     */
    get protocolName() {
        return this.d_protocolName;
    }

    /* === Ports === */

    /**
     * Get the port number that a DS client will use to *send* messages
     * to the FMS. This is also the port that a FMS implementation should
     * listen on
     * @return {number} Port number that client uses to send to FMS
     */
    get clientToFMSPort() {
        return this.d_clientToFMSPort;
    }

    /**
     * Get the port number that a FMS implementation will use to *send* messages
     * to a DS client. This is the port that a DS client should listen on.
     * @return {number} Port number that FMS uses to send to client
     */
    get fmsToClientPort() {
        return this.d_fmsToClientPort;
    }

    /**
     * Get the port number that a DS client will use to *send* messages
     * to a robot implementation. This is the port that a robot DS implementation
     * should listen on
     * @return {number} Port number that client uses to send to robot
     */
    get clientToRobotPort() {
        return this.d_clientToRobotPort;
    }

    /**
     * Get the port number that a robot implementation will use to *send*
     * messages to a DS client. This is the port that a DS client should listen on.
     * @return {number} Port number that robot uses to send to client
     */
    get robotToClientPort() {
        return this.d_robotToClientPort;
    }

    /**
     * Get the port number that a DS client will use to *send* messages
     * to netconsole. 
     * @return {number} Port number that client uses to send to netconsole
     */
    get clientToNetconsolePort() {
        return this.d_clientToNetconsolePort;
    }

    /**
     * Get the port number that netconsole will use to *send* messages to
     * a DS client. This is the port that a DS client should listen on.
     * @return {number} Port number that netconsole uses to send to client
     */
    get netconsoleToClientPort() {
        return this.d_netconsoleToClientPort;
    }

    /* === Sending Intervals === */

    /**
     * Get the number of milliseconds between packets from a client to 
     * the FMS
     * @return {number} Send interval
     */
    get clientToFMSInterval() {
        return this.d_clientToFMSInterval;
    }

    /**
     * Get the number of milliseconds between packets from a client to
     * a robot
     * @return {number} Send interval
     */
    get clientToRobotInterval() {
        return this.d_clientToRobotInterval;
    }

    /* === Joystick Properties === */

    /**
     * Get the maximum number of joysticks the protocol supports
     * @return {number} Maximum number of joysticks
     */
    get maxJoysticks() {
        return this.d_maxJoysticks;
    }

    /**
     * Get the maximum number of hat switches the protocol supports
     * @return {number} Maximum number of hat switches/joystick
     */
    get maxJoystickHatCount() {
        return this.d_maxJoystickHatCount;
    }

    /**
     * Get the maximum number of axes the protocol supports
     * @return {number} Maximum number of axes/joystick
     */
    get maxJoystickAxisCount() {
        return this.d_maxJoystickAxisCount;
    }

    /**
     * Get the maximum number of buttons the protocol supports
     * @return {number} Maximum number of buttons/joystick
     */
    get maxJoystickButtonCount() {
        return this.d_maxJoystickButtonCount;
    }

    /* === Address === */
    
    /**
     * Custom address for the FMS (if specified)
     * If this is null, the default address will be used instead
     * @property {string} customFMSAddress
     */
    get customFMSAddress() {
        return this.d_customFmsAddress;
    }
    set customFMSAddress(val) {
        this.d_customFmsAddress = val;
        // No event update needed
    }

    get customRobotAddress() {
        return this.d_customRobotAddress;
    }
    set customRobotAddress(val) {
        this.d_customRobotAddress = val;
        // No event update needed
    }

    /**
     * Default address for the FMS. This is set by the protocol
     * @readonly
     * @property {string} defaultFMSAddress
     */
    get defaultFMSAddress() {
        throw new Error('defaultFMSAddress must be implemented');
    }

    /**
     * Default address for the robot. This is set by the protocol
     * @readonly
     * @property {string} defaultRobotAddress
     */
    get defaultRobotAddress() {
        throw new Error('defaultRobotAddress must be implemented');
    }

    /**
     * Effective address for the FMS (taking into account custom)
     * @readonly
     * @property {string} effectiveFMSAddress
     */
    get effectiveFMSAddress() {
        if (!this.customFMSAddress) {
            return this.defaultFMSAddress;
        }
        return this.customFMSAddress;
    }

    /**
     * Effective address for the robot (taking into account custom)
     * @readonly
     * @property {string} effectiveRobotAddress
     */
    get effectiveRobotAddress() {
        if (!this.customRobotAddress) {
            return this.defaultRobotAddress;
        }
        return this.customRobotAddress;
    }

    /* === General === */

    /**
     * Maximum voltage supported by the robot
     * @readonly
     * @property {number} maxVoltage
     */
    get maxVoltage() {
        return this.d_maxVoltage;
    }

    /* === State === */

    // Team and position information is in the protocol state as 
    // some of the information is used in generating endpoint addresses
    // or for use when creating robot packets

    /**
     * The team number of the robot (FRC specific)
     * @property {number} teamNumber
     */
    get teamNumber() {
        return this.d_teamNumber;
    }
    set teamNumber(val) {
        if (val !== this.d_teamNumber) {
            this.d_teamNumber = val;
            this.emit('stateChanged', {
                field: 'teamNumber',
                value: val
            });
        }
    }

    /**
     * Alliance the robot is on (red/blue)
     * @property {number} robotAlliance
     */
    get robotAlliance() {
        return this.d_robotAlliance;
    }
    set robotAlliance(val) {
        if (val !== this.d_robotAlliance) {
            this.d_robotAlliance = val;
            this.emit('stateChanged', {
                field: 'robotAlliance',
                value: val
            });
        }
    }

    /**
     * Position the robot is at (1,2,3)
     * @property {number} robotPosition
     */
    get robotPosition() {
        return this.d_robotPosition;
    }
    set robotPosition(val) {
        if (val !== this.d_robotPosition) {
            this.d_robotPosition = val;
            this.emit('stateChanged', {
                field: 'robotPosition',
                value: val
            });
        }
    }

    /**
     * The current control mode of the robot (AUTO, TELEOP, TEST)
     * @property {number} controlMode
     */
    get controlMode() {
        return this.d_controlMode;
    }
    set controlMode(val) {
        if (val !== this.d_controlMode) {
            this.d_controlMode = val;
            this.emit('stateChanged', {
                field: 'controlMode',
                value: val
            });
        }
    }

    /**
     * Whether or not the robot is enabled
     * @property {boolean} robotEnabled
     */
    get robotEnabled() {
        return this.d_robotEnabled;
    }
    set robotEnabled(val) {
        if (val !== this.d_robotEnabled) {
            this.d_robotEnabled = val;
            this.emit('stateChanged', {
                field: 'robotEnabled',
                value: val
            });
        }
    }

    /**
     * Whether or not the robot was e-stopped
     * @property {boolean} emergencyStopped
     */
    get emergencyStopped() {
        return this.d_emergencyStopped;
    }
    set emergencyStopped(val) {
        if (val !== this.d_emergencyStopped) {
            this.d_emergencyStopped = val;
            this.emit('stateChanged', {
                field: 'emergencyStopped',
                value: val
            });
        }
    }

    /**
     * Whether or not the robot has code running
     * @property {boolean} robotCode
     */
    get robotCode() {
        return this.d_robotCode;
    }
    set robotCode(val) {
        if (val !== this.d_robotCode) {
            this.d_robotCode = val;
            this.emit('stateChanged', {
                field: 'robotCode',
                value: val
            });
        }
    }

    /**
     * The current voltage level of the robot
     * @property {number} robotVoltage
     */
    get robotVoltage() {
        return this.d_robotVoltage;
    }
    set robotVoltage(val) {
        if (val !== this.d_robotVoltage) {
            this.d_robotVoltage = val;
            this.emit('stateChanged', {
                field: 'robotVoltage',
                value: val
            });
        }
    }

    /**
     * Whether or not the driver station has comms with robot
     * (CLIENT ONLY)
     * @property {boolean} robotCommunications
     */
    get robotCommunications() {
        return this.d_robotCommunications;
    }
    set robotCommunications(val) {
        if (val !== this.d_robotCommunications) {
            this.d_robotCommunications = val;
            this.emit('stateChanged', {
                field: 'robotCommunications',
                value: val
            });
        }
    }

    /**
     * Whether or not the DS has FMS comms
     * (CLIENT ONLY)
     * @property {boolean} fmsCommunications
     */
    get fmsCommunications() {
        return this.d_fmsCommunications;
    }
    set fmsCommunications(val) {
        if (val !== this.d_fmsCommunications) {
            this.d_fmsCommunications = val;
            this.emit('stateChanged', {
                field: 'fmsCommunications',
                value: val
            });
        }
    }

    // --------------------------------------------------------
    // Public Methods 
    // --------------------------------------------------------
    //
    // Note: The majority of methods here relate to the actual
    // implementation of the protocol. This might include packet
    // generation, as well as setting internal state on the protocol
    // Most of those decisions will be left up to individual 
    // protocol implementations.

    /* === Packet Generation === */

    /**
     * Generate a packet that a DS Client would send to FMS
     * @return {Buffer} Buffer to send
     */
    makeClientToFMSPacket() {
        throw new Error('makeClientToFMSPacket needs to be implemented');
    }

    /**
     * Generate a packet that a FMS would send to a client
     * @param {object} state Any additional state needed
     * @return {Buffer} Buffer to send
     */
    makeFMSToClientPacket(state) {
        throw new Error('makeFMSToClientPacket needs to be implemented');
    }

    /**
     * Generate a packet that a DS Client would send to a robot
     * @return {Buffer} Buffer to send
     */
    makeClientToRobotPacket() {
        throw new Error('makeClientToRobotPacket needs to be implemented');
    }

    /**
     * Generate a packet that a robot would send to a client
     * @param {object} state Additional state needed 
     * @return {Buffer} Buffer to send
     */
    makeRobotToClientPacket(state) {
        throw new Error('makeRobotToClientPacket needs to be implemented');
    }

    /* === Packet Interpretation === */

    /**
     * Interpret a Client->FMS packet 
     * @param {Buffer} data 
     * @return {object} Packet information
     */
    readClientToFMSPacket(data) {
        throw new Error('readClientToFMSPacket needs to be implemented');
    }

    /**
     * Interpret a FMS->Client packet 
     * @param {Buffer} data 
     * @return {object} Packet information
     */
    readFMSToClientPacket(data) {
        throw new Error('readFMSToClientPacket needs to be implemented');
    }

    /**
     * Interpret a Client->Robot packet 
     * @param {Buffer} data 
     * @return {object} Packet information
     */
    readClientToRobotPacket(data) {
        throw new Error('readClientToRobotPacket needs to be implemented');
    }

    /**
     * Interpret a Robot->Client packet 
     * @param {Buffer} data 
     * @return {object} Packet information
     */
    readRobotToClientPacket(data) {
        throw new Error('readRobotToClientPacket needs to be implemented');
    }

    /* === Client Operations === */

   /**
    * Request that the controller be rebooted
    * @method
    */
    rebootController() {
        throw new Error('rebootController needs to be implemented');
    }

    /**
     * Request that the robot code be restarted
     * @method
     */
    restartRobotCode() {
        throw new Error('restartRobotCode needs to be implemented');
    }

    /* === General Operations === */

    /**
     * Reset the protocol
     */
    reset() {
        throw new Error('reset needs to be implemented');
    }
};

module.exports = DSProtocolBase;
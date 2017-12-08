const EventEmitter = require('events');
const DSProtocolBase = require('./protocols/ds-protocol-base');
const Watchdog = require('./watchdog');
const Socket = require('./socket');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('./constants');

const RECEIVE_TIMEOUT = 500; 

class DriverStationClient extends EventEmitter {
    constructor() {
        super();

        // === Thin state interface to protocol ===
        /** 
         * @type {DSProtocolBase} 
         */
        this.d_protocol = null;

        /**
         * @type {string}
         */
        this.d_customRobotAddress = null;

        /**
         * @type {string}
         */
        this.d_customFMSAddress = null;

        this.d_teamNumber = 0;
        this.d_controlMode = DSControlMode.TELEOPERATED;
        this.d_robotEnabled = false;
        this.d_alliance = DSAlliance.RED;
        this.d_position = DSPosition.POSITION_1;
        this.d_estopped = false;
        this.d_robotCode = false;
        this.d_robotVoltage = 0.0;
        this.d_robotCommunications = false;
        this.d_fmsCommunications = false;

        this.d_joysticks = [];

        // === Internals ===
        this.d_fmsSocket = null;
        this.d_robotSocket = null;

        this.d_fmsSendTimer = null;
        this.d_robotSendTimer = null;
        this.d_fmsWatchdog = null;
        this.d_robotWatchdog = null;

        // === Message Counts ===
        this.d_sentFMSMessages = 0;
        this.d_receivedFMSMessages = 0;
        this.d_sentRobotMessages = 0;
        this.d_receivedRobotMessages = 0;

        // Other internal flags
        this.d_sendDate = false;
    }

    get customRobotAddress() {
        return this.d_customRobotAddress;
    }
    set customRobotAddress(addr) {
        if (addr !== this.d_customRobotAddress) {
            this.d_customRobotAddress = addr;
            if (this.d_protocol) {
                this.d_protocol.customRobotAddress = addr;
            }
        }
    }

    get customFMSAddress() {
        return this.d_customFMSAddress;
    }
    set customFMSAddress(addr) {
        if (addr !== this.d_customFMSAddress) {
            this.d_customFMSAddress = addr;
            if (this.d_protocol) {
                this.d_protocol.customFMSAddress = addr;
            }
        }
    }

    get teamNumber() {
        return this.d_teamNumber;
    }
    set teamNumber(team) {
        if (team !== this.d_teamNumber) {
            this.d_teamNumber = team;
            if (this.d_protocol) {
                this.d_protocol.teamNumber = team;
            }
        }
    }

    

    /**
     * Load a new protocol
     * This will also shutdown the old one (if any) and reset all state
     * @param {DSProtocolBase} proto 
     */
    loadProtocol(proto) {
        if (this.d_protocol) {
            this._shutdownTimers();
            this._shutdownSockets();
            
            this.d_protocol.reset();
        }

        // Load the properties into the protocol
        if (this.teamNumber) {
            proto.teamNumber = this.teamNumber;
        }
        if (this.customFMSAddress) {
            proto.customFMSAddress = this.customFMSAddress;
        }
        if (this.customRobotAddress) {
            proto.customRobotAddress = this.customRobotAddress;
        }

        this._setupSockets();
        this._setupTimers();

        // Hook up protocol events (stateChanged etc)
        
    }

    // === Public Interface ===

    /**
     * Update the current state of the Joysticks
     * @param {JoystickData[]} sticks 
     */
    updateJoysticks(sticks) {
        this.d_joysticks = sticks;
    }

    // === PRIVATE ===
    _setupTimers() {
        if (!this.d_protocol) {
            return;
        }

        this.d_robotSendTimer = setInterval(
            () => this._handleSendToRobot(), 
            this.d_protocol.clientToRobotInterval);

        this.d_fmsSendTimer = setInterval(() => {

        }, this.d_protocol.clientToFMSInterval);
    }

    _shutdownTimers() {
        clearInterval(this.d_robotSendTimer);
        clearInterval(this.d_fmsSendTimer);

        this.d_robotSendTimer = null;
        this.d_fmsSendTimer = null;
    }

    _setupSockets() {
        if (!this.d_protocol) {
            return;
        }

        this.d_robotSocket = new Socket({
            inPort: this.d_protocol.robotToClientPort,
            outPort: this.d_protocol.clientToRobotPort,
            remoteAddress: this.d_protocol.effectiveRobotAddress
        });

        this.d_robotSocket.on('data', (msg, rinfo) => {
            if (!this.d_protocol) {
                // Should not be possible
                return;
            }

            const pktInfo = this.d_protocol.readRobotToClientPacket(msg);
            if (pktInfo) {
                this._handleReceiveFromRobot(pktInfo);
            }

            this.d_receivedRobotMessages++;
        });

        this.d_fmsSocket - new Socket({
            inPort: this.d_protocol.fmsToClientPort,
            outPort: this.d_protocol.clientToFMSPort,
            remoteAddress: this.d_protocol.effectiveFMSAddress
        });

        this.d_fmsSocket.on('data', (msg, rinfo) => {
            // TODO If we didn't have a remote address set before for FMS
            // and we got a packet, use the rinfo address as our destination
        })
    }

    _shutdownSockets() {
        if (this.d_robotSocket) {
            this.d_robotSocket.shutdown();
            this.d_robotSocket.removeAllListeners();
            this.d_robotSocket = null;
        }

        if (this.d_fmsSocket) {
            this.d_fmsSocket.shutdown();
            this.d_fmsSocket.removeAllListeners();
            this.d_fmsSocket = null;
        }
    }

    _resetRobotProtocol() {
        this.d_sentRobotMessages = 0;
        this.d_receivedRobotMessages = 0;
        this.d_sendDate = false;
        this.d_protocol.shouldRebootController = false;
        this.d_protocol.shouldRestartCode = false;
        this.d_alliance = DSAlliance.RED;
        this.d_position = DSPosition.POSITION_1;
        this.d_controlMode = DSControlMode.TELEOPERATED;
        this.d_robotEnabled = false;
        this.d_robotCommunications = false;

        this.d_protocol.reset();

        // Update the protocol info
    }

    _resetFMSProtocol() {
        this.d_sentFMSMessages = 0;
        this.d_receivedFMSMessages = 0;
        this.d_fmsCommunications = false;
    }

    /**
     * Called every time we need to send a packet to the robot
     * 
     */
    _handleSendToRobot() {
        if (!this.d_protocol) {
            return;
        }

        const robotPacket = {
            seq: this.d_sentRobotMessages,
            controlMode: this.d_protocol.controlMode,
            emergencyStopped: this.d_protocol.emergencyStopped,
            robotEnabled: this.d_protocol.robotEnabled,
            fmsCommunications: this.d_protocol.fmsCommunications,
            robotAlliance: this.d_protocol.robotAlliance,
            robotPosition: this.d_protocol.robotPosition,
            reboot: this.d_protocol.shouldRebootController,
            restartCode: this.d_protocol.shouldRestartCode,
            joysticks: this.d_joysticks,
            sendTimeData: this.d_sendDate
        };

        if (this.d_sendDate) {
            this.d_sendDate = false;
        }

        const robotPacketBuf = this.d_protocol.makeClientToRobotPacket(robotPacket);

        if (this.d_robotSocket && robotPacketBuf) {
            this.d_robotSocket.send(robotPacketBuf);
            this.d_sentRobotMessages++;
        }
    }

    /**
     * Called every time we receive a packet from the robot
     * @param {RobotToClientPacket} packetInfo 
     */
    _handleReceiveFromRobot(packetInfo) {
        if (packetInfo.voltage !== this.d_robotVoltage) {
            this.d_robotVoltage = packetInfo.voltage;
            this.emit('voltageChanged', this.d_robotVoltage);
        }

        // Indicate that we should send a date the next time
        this.d_sendDate = true;
    }
};

module.exports = DriverStationClient;
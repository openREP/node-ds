const DSProtocolBase = require('../ds-protocol-base');
const DSConstants = require('../../constants');
const { DSControlMode, 
        DSAlliance, 
        DSPosition, 
        DSTournamentLevel } = DSConstants;

const ProtoConstants = require('./ds-protocol-2016-constants');
const ProtoUtils = require('./ds-protocol-2016-utils');
const Socket = require('../../socket');
const Watchdog = require('../../watchdog');

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

        this.d_operatingMode = null;
        this.d_protocolRunning = false;

        // Running as client
        this.d_clientToRobotSocket = null;
        this.d_clientToFMSSocket = null;
        this.d_clientToRobotSendTimer = null;
        this.d_clientToFMSSendTimer = null;
        this.d_clientSendTimeData = false;
        this.d_clientToRobotWatchdog = null;
        this.d_clientToFMSWatchdog = null;
        
        // Running as robot
        this.d_robotToClientSocket = null;
        this.d_robotToClientWatchdog = null;

        // Running as FMS
        this.d_fmsToClientSocket = null;
        this.d_fmsClients = {}; // Keep a map of clients
        // TODO the FMS part needs some work
    }

    get defaultFMSAddress() {
        return '0.0.0.0';
    }

    get defaultRobotAddress() {
        return 'roboRIO-' + this.teamNumber + '-frc.local';
    }

    reset() {
        // TODO zero out counts, and set all props back to defaults
    }

    startAsClient() {
        this.d_operatingMode = 'client';
        this.d_protocolRunning = true;

        // Reset for good measure
        this.reset();

        this._setupClientSockets();
        this._setupClientTimers();
    }

    _stopClient() {
        this._shutdownClientTimers();
        this._shutdownClientSockets();
    }

    _setupClientSockets() {
        this.d_clientToRobotSocket = new Socket({
            inPort: this.robotToClientPort,
            outPort: this.clientToRobotPort,
            remoteAddress: this.effectiveRobotAddress
        });

        this.d_clientToRobotSocket.on('data', (msg, rinfo) => {
            // Set the robot communications flag
            this.robotCommunications = true;

            const pktInfo = ProtoUtils.readRobotToClientPacket(msg);
            if (pktInfo) {
                // There's no real state change, so we just update the voltage
                if (pktInfo.voltage !== this.robotVoltage) {
                    this.robotVoltage = pktInfo.voltage;
                }

                if (pktInfo.sendTimeData) {
                    this.d_clientSendTimeData = true;
                }

                this.d_robotToClientPackets++;
            }

            this.d_clientToRobotWatchdog.feed();
        })

        this.d_clientToFMSSocket = new Socket({
            inPort: this.fmsToClientPort,
            outPort: this.clientToFMSPort,
            remoteAddress: this.effectiveFMSAddress
        });

        this.d_clientToFMSSocket.on('data', (msg, rinfo) => {
            const pktInfo = ProtoUtils.readFMSToClientPacket(msg);
            if (pktInfo) {
                // TODO Implement

                this.d_fmsToClientPackets++;
            }

            this.d_clientToFMSWatchdog.feed();
        });
    }

    _shutdownClientSockets() {
        if (this.d_clientToRobotSocket) {
            this.d_clientToRobotSocket.shutdown();
            this.d_clientToRobotSocket.removeAllListeners();
            this.d_clientToRobotSocket = null;
        }
        if (this.d_clientToFMSSocket) {
            this.d_clientToFMSSocket.shutdown();
            this.d_clientToFMSSocket.removeAllListeners();
            this.d_clientToFMSSocket = null;
        }
    }

    /**
     * Set up the send timers for the protocol in CLIENT mode
     */
    _setupClientTimers() {
        this.d_clientToRobotSendTimer = setInterval(() => {
            const robotPacket = {
                seq: this.d_clientToRobotPackets,
                controlMode: this.controlMode,
                emergencyStopped: this.emergencyStopped,
                robotEnabled: this.robotEnabled,
                fmsCommunications: this.fmsCommunications,
                robotAlliance: this.robotAlliance,
                robotPosition: this.robotPosition,
                reboot: this.shouldRebootController,
                restartCode: this.shouldRestartCode,
                joysticks: this.d_joysticks,
                sendTimeData: this.d_clientSendTimeData
            };

            if (this.d_clientSendTimeData) {
                this.d_clientSendTimeData = false;
            }

            const pktBuf = ProtoUtils.makeClientToRobotPacket(robotPacket);
            if (pktBuf) {
                this.d_clientToRobotSocket.send(pktBuf);
                this.d_clientToRobotPackets++;
            }
        }, this.clientToRobotInterval);

        this.d_clientToFMSSendTimer = setInterval(() => {

        }, this.clientToFMSInterval);

        this.d_clientToRobotWatchdog = new Watchdog(500);
        this.d_clientToFMSWatchdog = new Watchdog(500);

        this.d_clientToRobotWatchdog.on('expired', () => {
            // If the watchdog expires, we'll reset the packet count
            // Then we wait... Whenever we receive a robot packet response
            // we will restart the watchdog
            this.robotCommunications = false;
            this.d_clientToRobotPackets = 0;
        });

        this.d_clientToFMSWatchdog.on('expired', () => {
            this.fmsCommunications = false;
            this.d_clientToFMSPackets = 0;
        });

        this.d_clientToRobotWatchdog.start();
        this.d_clientToFMSWatchdog.start();
    }

    _shutdownClientTimers() {
        clearInterval(this.d_clientToRobotSendTimer);
        clearInterval(this.d_clientToFMSSendTimer);

        this.d_clientToRobotSendTimer = null;
        this.d_clientToFMSSendTimer = null;

        this.d_clientToRobotWatchdog.removeAllListeners();
        this.d_clientToRobotWatchdog.stop();

        this.d_clientToFMSWatchdog.removeAllListeners();
        this.d_clientToFMSWatchdog.stop();
    }

    startAsRobot() {
        this.d_operatingMode = 'robot';
        this.d_protocolRunning = true;

        this.reset();

        this._setupRobotTimers();
        this._setupRobotSockets();
    }

    startAsFMS() {
        
    }

    _setupRobotTimers() {
        this.d_robotToClientWatchdog = new Watchdog(500);
        this.d_robotToClientWatchdog.on('expired', () => {
            this.robotCommunications = false;
            this.d_robotToClientPackets = 0;
        });

        this.d_robotToClientWatchdog.start();
    }

    _shutdownRobotTimers() {
        this.d_robotToClientWatchdog.removeAllListeners();
        this.d_robotToClientWatchdog.stop();
        this.d_robotToClientWatchdog = null;
    }

    _setupRobotSockets() {
        this.d_robotToClientSocket = new Socket({
            inPort: this.clientToRobotPort,
            outPort: this.robotToClientPort
        });

        this.d_robotToClientSocket.on('data', (msg, rinfo) => {
            // If this is the first time we are getting a response
            // Set up our remote address
            if (!this.d_robotToClientSocket.remoteAddress) {
                this.d_robotToClientSocket.changeAddress(rinfo.address);
            }

            this.robotCommunications = true;

            const pktInfo = ProtoUtils.readClientToRobotPacket(msg);
            if (pktInfo) {
                // Set properties on ourselves and send a response
                this.controlMode = pktInfo.controlMode;
                this.emergencyStopped = pktInfo.emergencyStopped;
                this.robotEnabled = pktInfo.robotEnabled;
                this.fmsCommunications = pktInfo.fmsCommunications;
                this.robotAlliance = pktInfo.robotAlliance;
                this.robotPosition = pktInfo.robotPosition;

                if (pktInfo.reboot) {
                    this.emit('shouldReboot');
                }
                if (pktInfo.restartCode) {
                    this.emit('shouldRestartCode');
                }

                if (pktInfo.joysticks) {
                    this.emit('joysticksUpdated', pktInfo.joysticks);
                }
                
                const returnPacket = {
                    seq: pktInfo.seq,
                    controlMode: this.controlMode,
                    fmsCommunications: this.fmsCommunications,
                    emergencyStopped: this.emergencyStopped,
                    robotEnabled: this.robotEnabled,
                    voltage: this.robotVoltage,
                    requestDate: false,
                    hasCode: this.robotCode
                };

                const responseBuf = ProtoUtils.makeRobotToClientPacket(returnPacket);
                this.d_robotToClientSocket.send(responseBuf);

                this.d_clientToRobotPackets++;
            }

            this.d_robotToClientWatchdog.feed();
        });
    }

    _shutdownRobotSockets() {
        if (this.d_robotToClientSocket) {
            this.d_robotToClientSocket.shutdown();
            this.d_robotToClientSocket.removeAllListeners();
            this.d_robotToClientSocket = null;
        }
    }

    stop() {
        if (!this.d_protocolRunning) {
            return;
        }

        this.d_protocolRunning = false;
        switch (this.d_operatingMode) {
            case 'client': {
                this._shutdownClientTimers();
                this._shutdownClientSockets();
            } break;
            case 'robot': {
                this._shutdownRobotTimers();
                this._shutdownRobotSockets();
            } break;
        }
    }
}

module.exports = DSProtocol2016
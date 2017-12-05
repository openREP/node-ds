const EventEmitter = require('events');

class DSProtocol extends EventEmitter {
    constructor(dsInstance) {
        super();

        this.d_dsInstance = dsInstance;

        // Set up protected properties
        this.d_name = '';
        this.d_fmsAddress = '';
        this.d_radioAddress = '';
        this.d_robotAddress = '';

        this.d_fmsInterval = 0;
        this.d_robotInterval = 0;
        this.d_radioInterval = 0;

        this.d_maxJoysticks = 0;
        this.d_maxAxisCount = 0;
        this.d_maxHatCount = 0;
        this.d_maxButtonCount = 0;
        this.d_maxBatteryVoltage = 0;

        this.d_fmsSocket = null;
        this.d_radioSocket = null;
        this.d_robotSocket = null;
        this.d_netconsoleSocket = null;

        this.d_controlMode;
    }

    // === Public Setters/Getters ===
    get name() {
        return this.d_name;
    }

    get fmsAddress() {
        return this.d_fmsAddress;
    }

    get radioAddress() {
        return this.d_radioAddress;
    }

    get robotAddress() {
        return this.d_robotAddress;
    }

    get fmsInterval() {
        return this.d_fmsInterval;
    }

    get radioInterval() {
        return this.d_radioInterval;
    }

    get robotInterval() {
        return this.d_robotInterval;
    }

    get maxJoysticks() {
        return this.d_maxJoysticks;
    }

    get maxAxisCount() {
        return this.d_maxAxisCount;
    }

    get maxHatCount() {
        return this.d_maxHatCount;
    }

    get maxButtonCount() {
        return this.d_maxButtonCount;
    }

    get maxBatteryVoltage() {
        return this.d_maxBatteryVoltage;
    }

    get fmsSocket() {
        return this.d_fmsSocket;
    }

    get radioSocket() {
        return this.d_radioSocket;
    }

    get robotSocket() {
        return this.d_robotSocket;
    }

    get netconsoleSocket() {
        return this.d_netconsoleSocket;
    }
    
    createFMSPacket() {
        throw new Error("Call to abstract createFMSPacket()");
    }

    createRadioPacket() {
        throw new Error("Call to abstract createRadioPacket()");
    }

    createRobotPacket() {
        throw new Error("Call to abstract createRobotPacket()");
    }

    readFMSPacket(buf) {
        throw new Error("Call to abstract readFMSPacket()");
    }

    readRadioPacket(buf) {
        throw new Error("Call to abstract readRadioPacket()");
    }

    readRobotPacket(buf) {
        throw new Error("Call to abstract readRobotPacket()");
    }

    resetFMS() {
        throw new Error("Call to abstract resetFMS()()");
    }

    resetRadio() {
        throw new Error("Call to abstract resetRadio()");
    }

    resetRobot() {
        throw new Error("Call to abstract resetRobot()");
    }

    rebootRobot() {
        throw new Error("Call to abstract rebootRobot()");
    }

    restartRobotCode() {
        throw new Error("Call to abstract restartRobotCode()");
    }

    shutdown() {
        throw new Error("Call to abstract shutdown()");
    }
};

module.exports = DSProtocol;
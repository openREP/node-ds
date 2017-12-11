const EventEmitter = require('events');
const DSProtocolBase = require('./protocols/ds-protocol-base');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('./constants');

class DriverStationRobot extends EventEmitter {
    constructor(protocol) {
        super();

        this.d_protocol = null;
        this.loadProtocol(protocol);
    }

    get robotCode() {
        return this.d_protocol.robotCode;
    }
    set robotCode(val) {
        this.d_protocol.robotCode = !!val;
    }

    loadProtocol(protocol) {
        if (!protocol) {
            throw new Error('Protocol must be provided');
        }

        if (!(protocol instanceof DSProtocolBase)) {
            throw new Error('Protocol needs to be of type DSProtocolBase');
        }

        if (this.d_protocol) {
            this.d_protocol.stop();
            this.d_protocol.removeAllListeners();

            // TODO Copy over relevant details
        }

        protocol.on('stateChanged', (changeEvt) => {
            // Publish an event
            console.log('stateChanged', changeEvt);
        });

        this.d_protocol = protocol;
    }

    start() {
        this.d_protocol.startAsRobot();
    }

    stop() {
        this.d_protocol.stop();
    }
}

module.exports = DriverStationRobot;
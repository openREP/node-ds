const chai = require('chai');
const expect = chai.use(require('chai-bytes')).expect;
const mockery = require('mockery');
const EventEmitter = require('events');
const ProtoUtils = require('../lib/protocols/ds-2016/ds-protocol-2016-utils');
const ProtoConstants = require('../lib/protocols/ds-2016/ds-protocol-2016-constants');
const { DSControlMode,
        DSAlliance,
        DSPosition } = require('../lib/constants');

class MockDgramSocket extends EventEmitter {
    constructor() {
        super();

        this.d_lastMsg = null;
        this.d_lastOffset = -1;
        this.d_lastMsgLength = -1;
        this.d_lastPort = -1;
        this.d_lastAddress = '';
        
    }

    get lastMsg() {
        return this.d_lastMsg;
    }

    get lastOffset() {
        return this.d_lastOffset;
    }

    get lastMsgLength() {
        return this.d_lastMsgLength;
    }

    get lastPort() {
        return this.d_lastPort;
    }

    get lastAddress() {
        return this.d_lastAddress;
    }

    bind() {

    }

    close() {

    }

    send(msg, offset, length, port, address, callback) {

        this.d_lastMsg = msg;
        this.d_lastOffset = offset;
        this.d_lastMsgLength = length;
        this.d_lastPort = port;
        this.d_lastAddress = address;

        this.emit('sendCalled', {
            msg: msg,
            offset: offset,
            length: length,
            port: port,
            address: address
        });

        callback();
    }

    resetMock() {
        this.d_lastMsg = null;
        this.d_lastOffset = -1;
        this.d_lastMsgLength = -1;
        this.d_lastPort = -1;
        this.d_lastAddress = '';
    }

    simulateIncomingMessage(msg, rinfo) {
        this.emit('data', msg, rinfo);
    }
}

const mockSocket = new MockDgramSocket();

const MockDgram = {
    createSocket: function() {
        return mockSocket;
    }
};

describe('DS 2016 Protocol', () => {
    /**
     * @type {DSProtocolBase}
     */
    var DS2016Protocol;
    before(() => {
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });

        mockery.registerMock('dgram', MockDgram);
        DS2016Protocol = require('../lib/protocols/ds-2016/ds-protocol-2016');
    });

    after(() => {
        mockery.deregisterAll();
        mockery.disable();
    });

    beforeEach(() => {
        mockSocket.resetMock();
        mockSocket.removeAllListeners();
    });

    it('sends initial client to robot packet correctly', (done) => {
        const proto = new DS2016Protocol();
        proto.teamNumber = 1234;
        
        mockSocket.once('sendCalled', (evt) => {
            proto.stop();
            
            const expectedPacket = {
                seq: 0,
                controlMode: DSControlMode.TELEOPERATED,
                emergencyStopped: false,
                robotEnabled: false,
                fmsCommunications: false,
                robotAlliance: DSAlliance.RED,
                robotPosition: DSPosition.POSITION_1,
                reboot: false,
                restartCode: false,
            };
            const expected = ProtoUtils.makeClientToRobotPacket(expectedPacket)
            
            expect(evt.msg).to.equalBytes(expected);
            expect(evt.address).to.equal('roboRIO-1234-frc.local');
            expect(evt.port).to.equal(1110);
            done();
        });
        proto.startAsClient();

    });
});
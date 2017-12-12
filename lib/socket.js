const dgram = require('dgram');
const EventEmitter = require('events');

class DSSocket extends EventEmitter {
    constructor(config) {
        super();

        config = config || {};

        this.d_inSock = null;
        this.d_outSock = null;
        this.d_clientInited = false; // If we have output capabilities
        this.d_serverInited = false; // If we have input capabilities
        
        this.d_inPort = -1;
        this.d_outPort = -1;
        this.d_disabled = false;
        this.d_broadcast = false;
        this.d_remoteAddress = null;

        // Input port
        if (config.inPort !== undefined) {
            this.d_serverInited = true;
            this.d_inPort = config.inPort;
            this.d_inSock = dgram.createSocket('udp4');
            this.d_inSock.on('error', (err) => {
                this.emit('error', {
                    socket: 'inbound',
                    error: err
                });
            });

            this.d_inSock.on('message', (msg, rinfo) => {
                // Forward this up
                this.emit('data', msg, rinfo);
            });

            this.d_inSock.on('listening', () => {
            });
            
            this.d_inSock.bind(config.inPort);
        }

        // Output port
        if (config.outPort !== undefined) {
            this.d_clientInited = true;
            this.d_outPort = config.outPort;
            this.d_outSock = dgram.createSocket('udp4');

            this.d_outSock.on('error', (err) => {
                this.emit('error', {
                    socket: 'outbound',
                    error: err
                });
            });

        }

        if (config.remoteAddress !== undefined) {
            this.d_remoteAddress = config.remoteAddress;
        }

        if (config.disabled !== undefined) {
            this.d_disabled = !!config.disabled;
        }

        if (config.broadcast !== undefined) {
            this.d_broadcast = !!config.broadcast;
        }
    }

    shutdown() {
        if (this.d_inSock) {
            this.d_inSock.close();
        }

        if (this.d_outSock) {
            this.d_outSock.close();
        }
    }

    send(buf) {
        if (!this.d_outSock) {
            throw new Error("No output socket");
        }

        if (!this.d_clientInited || this.d_disabled) {
            return -1;
        }

        if (!this.d_remoteAddress) {
            return -1;
        }

        if (buf.length === 0) {
            return 0;
        }

        var bytesWritten = 0;
        var len = buf.length;
        this.d_outSock.send(buf, 0, len, this.d_outPort, this.d_remoteAddress, (err, numBytes) => {

        });
    }

    get remoteAddress() {
        return this.d_remoteAddress;
    }

    changeAddress(addr) {
        if (!addr) {
            return;
        }

        this.d_remoteAddress = addr;
    }
}

module.exports = DSSocket;
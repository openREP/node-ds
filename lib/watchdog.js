const EventEmitter = require('events');

class Watchdog extends EventEmitter {
    /**
     * Constructor for the watchdog
     * @param {number} timeout Timeout before the watchdog triggers, in milliseconds
     * @constructor
     */
    constructor(timeout) {
        super();
        
        this.d_timeout = timeout;
        this.d_watchdogTimer = null;
        this.d_started = false;
    }

    get started() {
        return this.d_started;
    }

    start() {
        if (this.d_watchdogTimer) {
            clearTimeout(this.d_watchdogTimer);
        }

        this.d_started = true;
        this.emit('started');
        this._setupTimeout();
    }

    stop() {
        if (this.d_watchdogTimer) {
            clearTimeout(this.d_watchdogTimer);
        }
        this.d_watchdogTimer = null;
        this.emit('stopped');
        this.d_started = false;
    }

    feed() {
        if (this.d_watchdogTimer) {
            clearTimeout(this.d_watchdogTimer);
        }

        this._setupTimeout();
    }

    _setupTimeout() {
        this.d_watchdogTimer = setTimeout(() => {
            this.emit('expired');
            this._setupTimeout();
        }, this.d_timeout);
    }
}

module.exports = Watchdog;
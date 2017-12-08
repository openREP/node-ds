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
        this.d_watchdogTimer = setTimeout(() => {
            // If we hit our timeout, send an alert and kill the timer
            // Then go into stopped state
            this.emit('expired');
            this.d_watchdogTimer = null;
            this.stop();
        }, this.d_timeout);
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

        this.d_watchdogTimer = setTimeout(() => {
            this.emit('expired');
            this.d_watchdogTimer = null;
            this.stop();
        });
    }
}

module.exports = Watchdog;
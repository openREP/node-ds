const chai = require('chai');
const expect = chai.expect;
const Watchdog = require('../lib/watchdog');

describe('Watchdog', () => {
    it('should expire if not fed', (done) => {
        const watchdog = new Watchdog(500);
        watchdog.once('expired', () => {
            watchdog.stop();
            done();
        });
        watchdog.start();
    });

    it ('should not expire if fed', (done) => {
        const watchdog = new Watchdog(500);
        var hasExpired = false;
        var feedTimer;

        setTimeout(() => {
            clearInterval(feedTimer);
            watchdog.removeAllListeners();
            watchdog.stop();
            expect(hasExpired).to.equal(false);
            done();
        }, 1500);

        feedTimer = setInterval(() => {
            watchdog.feed();
        }, 250);

        watchdog.on('expired', () => {
            hasExpired = true;
        });

        watchdog.start();
    });

    it('should continously expire if not fed', (done) => {
        const watchdog = new Watchdog(250);
        var expireCount = 0;

        watchdog.on('expired', () => {
            expireCount++;
        });

        setTimeout(() => {
            watchdog.removeAllListeners();
            watchdog.stop();
            expect(expireCount).to.be.above(4);
            done();
        }, 1500);

        watchdog.start();
    })
});
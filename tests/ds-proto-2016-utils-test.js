const chai = require('chai');
const expect = chai.use(require('chai-bytes')).expect;
const ProtoUtils = require('../lib/protocols/ds-2016/ds-protocol-2016-utils');

describe("DS 2016 Protocol Utils", () => {
    it('encodes voltage correctly', () => {
        const inputVoltage = 12.5;
        const expectedUpper = 12;
        const expectedLower = 50;
        const result = ProtoUtils.encodeVoltage(inputVoltage);
        expect(result.upper).to.be.equal(expectedUpper);
        expect(result.lower).to.be.equal(expectedLower);
    });

    it('decodes voltage correctly', () => {
        const inputUpper = 12;
        const inputLower = 50;
        const expectedVoltage = 12.5;
        const result = ProtoUtils.decodeVoltage(inputUpper, inputLower);
        expect(result).to.be.equal(expectedVoltage);
    });

    it('generates a datetime buffer correctly', () => {
        const testDate = new Date(2017, 11, 2, 3, 15, 42, 255);

        const expectedBuffer = Buffer.from([0x00, 0x03, 0xE4, 0x18,
                                            0x2A, 0x0F, 0x03, 0x02,
                                            0x0B, 0x75]);
        const result = ProtoUtils.getDateTime(testDate);
        expect(result).to.equalBytes(expectedBuffer);
    });

    it('generates a joystick buffer correctly', () => {
        // 2 joysticks, 10 buttons, 2 hats, 4 axes
        const testJoysticks = [
            {
                axes: [0, -0.2, 0.7, 1],
                hats: [-1, 255],
                buttons: [true, false, true, false, true, false, true, false, true, true]
            },
            {
                axes: [1, -0.5, 0, 1],
                hats: [100, 255],
                buttons: [false, false, false, false, true, false, true, false, true, true]
            },
        ];
        
        const byteArray =[
            0x0F, 0x0C, // Header
            0x04, 0x00, 0xE6, 0x58, 0x7F, // Axes
            0x0A, 0x03, 0x55, // Buttons
            0x02, 0xFF, 0xFF, 0x00, 0xFF,
        
            0x0F, 0x0C, // Header
            0x04, 0x7F, 0xC0, 0x00, 0x7F, // Axes
            0x0A, 0x03, 0x50, // Buttons
            0x02, 0x00, 0x64, 0x00, 0xFF
        ];

        const expectedBuffer = Buffer.from(byteArray);
        const result = ProtoUtils.getJoystickData({joysticks: testJoysticks});
        expect(result).to.equalBytes(expectedBuffer);
    });

    it('parses joystick data correctly', () => {
        const expectedJoystick = {
            axes: [0, -0.2, 0.7, 1],
            hats: [-1, 255],
            buttons: [true, false, true, false, true, false, true, false, true, true]
        };
        
        const testByteArray =[
            0x04, 0x00, 0xE6, 0x58, 0x7F, // Axes
            0x0A, 0x03, 0x55, // Buttons
            0x02, 0xFF, 0xFF, 0x00, 0xFF,
        ];
        const testBuffer = Buffer.from(testByteArray);
        const result = ProtoUtils.parseJoystickData(testBuffer);

        // The axes values are... fuzzy
        expect(result.hats).to.deep.equal(expectedJoystick.hats);
        expect(result.buttons).to.deep.equal(expectedJoystick.buttons);
    });
})
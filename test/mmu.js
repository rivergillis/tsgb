const mmu = require("../out/mmu");
const gpu = require("../out/gpu");
const assert = require("chai").assert;

mmu.reset();
gpu.reset();
let pc = 0;

describe("mmu", function() {
  beforeEach(function() {
    mmu.reset();
    gpu.reset();
    pc = 0;
  });
  describe("#rb", function() {
    it("Reads from bios", function() {
      const biosFourthByte = 0xaf;
      const read = mmu.rb(0x0003, pc, gpu);
      assert.equal(read, biosFourthByte);
      assert.isTrue(mmu.inbios);
    });
    it("Stops reading from bios when pc===0x0100", function() {
      assert.isTrue(mmu.inbios);

      const biosFourthByte = 0xaf;
      let romByte = 0x0a;
      mmu.rom[0x0104] = romByte;
      pc = 0x0100;
      let read = mmu.rb(0x0104, pc, gpu);
      assert.equal(read, romByte);
      assert.isFalse(mmu.inbios); // passed the bios

      // Now try to read from where the bios was
      romByte = 0xbb;
      mmu.rom[0x0004] = romByte;
      pc = 0x0101;
      read = mmu.rb(0x0004, pc, gpu);
      assert.equal(read, romByte);
      assert.notEqual(read, biosFourthByte);
      assert.isFalse(mmu.inbios);
    });
  });
});

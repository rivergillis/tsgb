const gpu = require("../out/gpu");
const assert = require("chai").assert;
// gpu.reset();
// gpu.step(12);

describe("gpu", function() {
  beforeEach(function() {
    gpu.reset();
  });
  describe("#step", function() {
    it("should through each mode with correct timings", function() {
      assert.equal(gpu.mode, 2);
      assert.equal(gpu.line, 0);
      gpu.step(12);
      assert.equal(gpu.mode, 2); // still in OAM
      gpu.step(70); // move beyond OAM to VRAM, modeclock is 82
      assert.equal(gpu.mode, 3); // now in VRAM mode
      gpu.step(30); // still in VRAM, modeclock is 30
      assert.equal(gpu.mode, 3);
      gpu.step(142); // move to hblank, modeclock is 172
      assert.equal(gpu.mode, 0);
      gpu.step(100); // still in hblank, modeclock is 100
      assert.equal(gpu.mode, 0);
      gpu.step(104); // end hblank, back to OAM, lines++
      assert.equal(gpu.mode, 2);
      assert.equal(gpu.line, 1);

      gpu.line = 142; // skip ahead some lines
      gpu.step(80); // move to vram
      gpu.step(172); // move to hblank
      gpu.step(204); // end hblank, lines++, move to vblank
      assert.equal(gpu.mode, 1);
      gpu.step(456); // move a whole line in vblank
      assert.equal(gpu.mode, 1);
      assert.equal(gpu.line, 144);

      gpu.line = 153; // skip some lines
      gpu.step(456); // end vblank
      assert.equal(gpu.mode, 2); // should be in OAM
      assert.equal(gpu.line, 0); // on line 0
      assert.equal(gpu.modeclock, 0); // with no clocks
    });
  });
});

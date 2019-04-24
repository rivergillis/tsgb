const cpu = require("../out/cpu");
const assert = require("chai").assert;

describe("cpu", function() {
  beforeEach(function() {
    cpu.reset();
  });

  describe("#reset()", function() {
    it("should reset all registers to 0", function() {
      cpu.reset();
      assert.deepStrictEqual(cpu.r, {
        a: 0,
        b: 0,
        c: 0,
        d: 0,
        e: 0,
        h: 0,
        l: 0,
        f: 0,
        pc: 0,
        sp: 0,
        clock: { m: 0, t: 0 }
      });
    });

    describe("#ADD_byte", function() {
      context("With invalid register arg", function() {
        it("should not do anything", function() {
          cpu.ADD_byte("o");
          assert.strictEqual(cpu.r.a, 0);
          assert.deepStrictEqual(cpu.clock, { m: 0, t: 0 });
          assert.deepStrictEqual(cpu.r.clock, { m: 0, t: 0 });
        });
      });
      context("With valid register arg", function() {
        beforeEach(function() {
          cpu.r.b = 0x10;
          cpu.r.a = 0x20;
        });

        it("should produce correct addition", function() {
          cpu.ADD_byte("b");
          assert.strictEqual(cpu.r.a, 0x30);
        });

        it("should produce correct timings", function() {
          cpu.ADD_byte("b");
          assert.deepStrictEqual(cpu.r.clock, { m: 1, t: 4 });
          // TODO: Test timings on cpu.clock
        });
        it("Should set overflow flags correctly", function() {
          cpu.r.b = 0xff;
          cpu.ADD_byte("b");
          assert.strictEqual(cpu.r.f & 0x10, 0x10);
          assert.isBelow(cpu.r.a, 256);
        });
        it("Should set zero flag", function() {
          cpu.reset();
          cpu.ADD_byte("d");
          assert.strictEqual(cpu.r.f & 0x80, 0x80);
        });
        // TODO: test for half-carry
      });
      context("ayy", function() {
        it("should not do anything", function() {});
      });
    });
  });
});

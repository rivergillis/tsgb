const cpu = require("../out/cpu");
const mmu = require("../out/mmu");
const gpu = require("../out/gpu");
const assert = require("chai").assert;

cpu.mmu = mmu;
cpu.gpu = gpu;

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
        assert.strictEqual(cpu.r.f & 0x40, 0); // sub flag off
      });

      it("should take 1 M-time", function() {
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
  });
  describe("#CP_reg", function() {
    it("Should not set carry flag or zero flag if A>n", function() {
      cpu.r.a = 0xff;
      cpu.r.c = 0x20;
      cpu.CP_reg("c");
      assert.strictEqual(cpu.r.f & 0x10, 0); // carry
      assert.strictEqual(cpu.r.f & 0x80, 0); // zero
      assert.strictEqual(cpu.r.f & 0x40, 0x40); // subtract
    });
    it("Should set zero flag if A=n", function() {
      cpu.r.a = 0x20;
      cpu.r.d = 0x20;
      cpu.CP_reg("d");
      assert.strictEqual(cpu.r.f & 0x10, 0); // carry
      assert.strictEqual(cpu.r.f & 0x80, 0x80); // zero
    });
    it("Should set carry flag if A<n", function() {
      cpu.r.a = 0x20;
      cpu.r.e = 0x30;
      cpu.CP_reg("e");
      assert.strictEqual(cpu.r.f & 0x10, 0x10); // carry
      assert.strictEqual(cpu.r.f & 0x80, 0); // zero
    });
    it("Should take 1 M-time", function() {
      cpu.r.a = 0x0;
      cpu.CP_reg("a");
      assert.deepStrictEqual(cpu.r.clock, { m: 1, t: 4 });
      // TODO: Check cpu.clock
    });
  });
  describe("#NOP", function() {
    it("Should take 1 M-time", function() {
      cpu.NOP();
      assert.deepStrictEqual(cpu.r.clock, { m: 1, t: 4 });
    });
  });
  // This only tests the CPU-side of things
  describe("#PUSH", function() {
    it("Should decrement the stack pointer", function() {
      cpu.r.sp = 100;
      const originalStackPointer = cpu.r.sp;
      cpu.PUSH("hl"); // PUSH h, l
      assert.strictEqual(cpu.r.sp, originalStackPointer - 2);
    });
    it("Should take 3 M-times", function() {
      cpu.r.sp = 100;
      cpu.PUSH("bc"); // PUSH B, C
      assert.deepStrictEqual(cpu.r.clock, { m: 3, t: 12 });
    });
  });
  describe("#POP", function() {
    it("Should increment the stack pointer", function() {
      cpu.r.sp = 100;
      const originalStackPointer = cpu.r.sp;
      cpu.POP("de"); // POP D, E
      assert.strictEqual(cpu.r.sp, originalStackPointer + 2);
    });
    it("Should take 3 M-times", function() {
      cpu.r.sp = 100;
      cpu.PUSH("af"); // PUSH A, F
      assert.deepStrictEqual(cpu.r.clock, { m: 3, t: 12 });
    });
  });
  describe("#LD_byte_imm", function() {
    it("Should take 4 M-times", function() {
      cpu.LD_byte_imm("e");
      // TODO: set the pc or something before doing that?
      assert.deepStrictEqual(cpu.r.clock, { m: 4, t: 16 });
    });
  });
});

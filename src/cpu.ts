interface Clock {
  m: number;
  t: number;
}
interface RegFile {
  // 8-bit registers
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  h: number;
  l: number;
  f: number; // flags
  // 16-bit registers
  pc: number; // program counter
  sp: number; // stack pointer
  // clock for last instruction
  clock: Clock;
  [key: string]: any;
}

/* I think:
PC should increas by 4 for each instr (maybe not all?)
SP inc/dec reversed, and also not just by 1?
*/

const byte_regs: string[] = ["a", "b", "c", "d", "e", "h", "l"];
const word_regs: string[] = ["bc", "de", "hl"];
const add_byte_regs: string[] = ["a", "b", "c", "d", "e", "h", "l"];
const compare_reg_regs: string[] = ["a", "b", "c", "d", "e", "h", "l"];
const imm_byte_ld_regs: string[] = ["a", "b", "c", "d", "e", "h", "l"];
const ld_reg_regs: string[] = ["a", "b", "c", "d", "e", "h", "l"];
const imm_word_ld_regs: string[] = ["bc", "de", "hl", "sp"];
const push_pop_regs: string[] = ["bc", "de", "hl", "af"];

/*
cpu = new Cpu();
cpu.mmu = new Mmu();
cpu.gpu = new Gpu();
mmu.reset();
cpu.reset();
gpu.reset();
*/
class Cpu {
  clock: Clock = { m: 0, t: 0 };
  r: RegFile = {
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
  };
  mmu: Mmu; // need to set this after creating
  gpu: Gpu; // need to set after creating

  // Adds @reg to A, leaving the result in A (ADD A, @reg)
  ADD_byte = (reg: string) => {
    if (add_byte_regs.indexOf(reg) <= -1) {
      console.error(`ADD_byte::BADREG ${reg}`);
      return;
    }

    // Clear the flags
    this.r.f = 0;
    // Before we add, we need to check the half-carry bit
    // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
    const halfByteSum = (this.r.a & 0xf) + (this.r[reg] & 0xf);
    if ((halfByteSum & 0x10) == 0x10) {
      this.r.f |= 0x20;
    }

    // perform the addition
    this.r.a += this.r[reg];

    // Check for zero (ANDing with 255 will produce 0 iff i===0)
    // TODO: check if we can just say this.r.a===0?
    if (!(this.r.a & 255)) {
      this.r.f |= 0x80;
    }
    // Check for overflow
    if (this.r.a > 255) {
      this.r.f |= 0x10;
    }

    this.r.a &= 255; // mask to 8-bits (discard the rest)

    // Took 1 M-time
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // Compare B to A, setting flags (CP A, B)
  CP_reg = (reg: string) => {
    if (compare_reg_regs.indexOf(reg) <= -1) {
      console.error(`CP_reg::BADREG ${reg}`);
      return;
    }

    let i: number = this.r.a; // temp copy of A
    i -= this.r[reg]; // sub reg from copy of A
    this.r.f |= 0x40; // set subtraction flag
    // check for zero
    if (!(i & 255)) {
      this.r.f |= 0x80;
    }
    // check for underflow
    // (This is how we check to see if a < n when using this instr)
    if (i < 0) {
      this.r.f |= 0x10;
    }
    // check the half-carry bit (prolly works?)
    const halfByteSum = (this.r.a & 0xf) - (this.r[reg] & 0xf);
    if ((halfByteSum & 0x10) == 0x10) {
      this.r.f |= 0x20;
    }

    // 1 M-time taken
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // No-operation
  NOP = () => {
    // 1 M-time taken
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // Push registers @regs[0] and @regs[1] (a word) to the stack (PUSH NN)
  PUSH = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      console.error(`PUSH::BADREG ${regs}`);
      return;
    }
    // TODO: Use ww?
    this.r.sp--; // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[0]], this.r.pc, this.gpu); // Write reg0 at the stack pointer
    this.r.sp--; // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[1]], this.r.pc, this.gpu); // write reg1 at the stack pointer

    // Three M-times taken
    // TODO: Should this be 1 and 16?
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  };

  // Pop registers @regs[0] and @regs[1] (a word) off the stack (POP NN)
  POP = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      console.error(`POP::BADREG ${regs}`);
      return;
    }
    this.r[regs[1]] = this.mmu.rb(this.r.sp, this.r.pc, this.gpu); // read reg1 at the stack pointer
    this.r.sp++; // move back up the stack
    this.r[regs[0]] = this.mmu.rb(this.r.sp, this.r.pc, this.gpu); // read reg0 at the stack pointer
    this.r.sp++; // move back up the stack
    // Three M-times taken
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  };

  // Read an immediate word into @regs (LD NN, d16)
  LD_word_imm = (regs: string) => {
    if (imm_word_ld_regs.indexOf(regs) <= -1) {
      console.error(`LD_word_imm::BADREG ${regs}`);
      return;
    }
    const imm: number = this.mmu.rw(this.r.pc, this.r.pc, this.gpu); // get imm from instr
    this.r.pc += 2; // advance PC twice bc 3-byte instr
    if (regs == "sp") {
      // If we're storing the 16-byte imm in the 16-byte stack pointer, do that
      this.r.sp = imm;
    } else {
      // Otherwise store into seperate registers
      // Pretty sure this is correct
      this.r[regs[0]] = imm >> 8; // store the upper byte in the first register
      this.r[regs[1]] = imm & 0x00ff; // store the lower byte in the second register
    }
    // 3 M-times taken
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  };

  // Read an immediate byte into @reg (LD N, d8)
  // TODO: support HL
  LD_byte_imm = (reg: string) => {
    if (imm_byte_ld_regs.indexOf(reg) <= -1) {
      console.error(`LD_byte_imm::BADREG ${reg}`);
    }
    const imm: number = this.mmu.rb(this.r.pc, this.r.pc, this.gpu);
    this.r.pc += 1; // increment PC past the immediate
    this.r[reg] = imm;

    this.r.clock.m = 2;
    this.r.clock.t = 8;
  };

  // Loads @r1 with the value in @r2
  // Use LD_byte_mem for instrs that look like LD H, (HL)
  LD_reg = (r1: string, r2: string) => {
    if (ld_reg_regs.indexOf(r1) <= -1 || ld_reg_regs.indexOf(r2) <= -1) {
      console.error(`LD_reg::BADREG ${r1}, ${r2}`);
    }
    this.r[r1] = this.r[r2];

    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // Loads byte specified by (@r2s[0] @r2s[1]) into register @r1 (LD B (HL); LD A (BC))
  LD_byte_mem = (r1: string, r2s: string) => {
    if (
      byte_regs.indexOf(r1) <= -1 ||
      word_regs.indexOf(r2s) <= -1 ||
      (r1 !== "a" && r2s !== "h")
    ) {
      console.error(`LD_byte_mem::BADREG ${r1}, (${r2s})`);
    }
    // In BC, B contains the high byte and C contains the low byte (big endian?)
    const highByte: number = this.r[r2s[0]] << 8;
    const lowByte: number = this.r[r2s[1]];

    // Load the byte and assign to the reg
    this.r[r1] = this.mmu.rb(highByte + lowByte, this.r.pc, this.gpu);

    this.r.clock.m = 2;
    this.r.clock.t = 8;
  };

  // Reset the CPU (used on startup)
  reset = () => {
    this.r.a = 0;
    this.r.b = 0;
    this.r.c = 0;
    this.r.d = 0;
    this.r.e = 0;
    this.r.h = 0;
    this.r.l = 0;
    this.r.f = 0;
    this.r.sp = 0xfffe; // this should be overwritten by programmer
    this.r.pc = 0;
    this.r.clock.m = 0;
    this.r.clock.t = 0;
    this.clock.m = 0;
    this.clock.t = 0;

    // Reset our GPU and MMU
    this.gpu.reset();
    this.mmu.reset();
  };

  unimplementedFunc = (idx: number) => {
    console.error(`CPU::Unimplemented function ${idx.toString(16)}`);
  };

  buildInstructionMap = (): Function[] => {
    const instrs: Function[] = [];
    for (let i = 0x00; i <= 0xff; i++) {
      instrs.push(this.unimplementedFunc.bind(this, i));
    }
    instrs[0x00] = this.NOP;
    instrs[0x01] = this.LD_word_imm.bind(this, "bc");
    instrs[0x06] = this.LD_byte_imm.bind(this, "b");
    instrs[0x0a] = this.LD_byte_mem.bind(this, "a", "bc");
    instrs[0x0e] = this.LD_byte_imm.bind(this, "c");
    instrs[0x11] = this.LD_word_imm.bind(this, "de");
    instrs[0x16] = this.LD_byte_imm.bind(this, "d");
    instrs[0x1a] = this.LD_byte_mem.bind(this, "a", "de");
    instrs[0x1e] = this.LD_byte_imm.bind(this, "e");
    instrs[0x21] = this.LD_word_imm.bind(this, "hl");
    instrs[0x26] = this.LD_byte_imm.bind(this, "h");
    instrs[0x2e] = this.LD_byte_imm.bind(this, "l");
    instrs[0x31] = this.LD_word_imm.bind(this, "sp");
    instrs[0x3e] = this.LD_byte_imm.bind(this, "a");

    // LD B, r2
    instrs[0x40] = this.LD_reg.bind(this, "b", "b");
    instrs[0x41] = this.LD_reg.bind(this, "b", "c");
    instrs[0x42] = this.LD_reg.bind(this, "b", "d");
    instrs[0x43] = this.LD_reg.bind(this, "b", "e");
    instrs[0x44] = this.LD_reg.bind(this, "b", "h");
    instrs[0x45] = this.LD_reg.bind(this, "b", "l");
    instrs[0x46] = this.LD_byte_mem.bind(this, "b", "hl");
    instrs[0x47] = this.LD_reg.bind(this, "b", "a");

    // LD C, r2
    instrs[0x48] = this.LD_reg.bind(this, "c", "b");
    instrs[0x49] = this.LD_reg.bind(this, "c", "c");
    instrs[0x4a] = this.LD_reg.bind(this, "c", "d");
    instrs[0x4b] = this.LD_reg.bind(this, "c", "e");
    instrs[0x4c] = this.LD_reg.bind(this, "c", "h");
    instrs[0x4d] = this.LD_reg.bind(this, "c", "l");
    instrs[0x4e] = this.LD_byte_mem.bind(this, "c", "hl");
    instrs[0x4f] = this.LD_reg.bind(this, "c", "a");

    // LD D, r2
    instrs[0x50] = this.LD_reg.bind(this, "d", "b");
    instrs[0x51] = this.LD_reg.bind(this, "d", "c");
    instrs[0x52] = this.LD_reg.bind(this, "d", "d");
    instrs[0x53] = this.LD_reg.bind(this, "d", "e");
    instrs[0x54] = this.LD_reg.bind(this, "d", "h");
    instrs[0x55] = this.LD_reg.bind(this, "d", "l");
    instrs[0x56] = this.LD_byte_mem.bind(this, "d", "hl");
    instrs[0x57] = this.LD_reg.bind(this, "d", "a");

    // LD E, r2
    instrs[0x58] = this.LD_reg.bind(this, "e", "b");
    instrs[0x59] = this.LD_reg.bind(this, "e", "c");
    instrs[0x5a] = this.LD_reg.bind(this, "e", "d");
    instrs[0x5b] = this.LD_reg.bind(this, "e", "e");
    instrs[0x5c] = this.LD_reg.bind(this, "e", "h");
    instrs[0x5d] = this.LD_reg.bind(this, "e", "l");
    instrs[0x5e] = this.LD_byte_mem.bind(this, "e", "hl");
    instrs[0x5f] = this.LD_reg.bind(this, "e", "a");

    // LD H, r2
    instrs[0x60] = this.LD_reg.bind(this, "h", "b");
    instrs[0x61] = this.LD_reg.bind(this, "h", "c");
    instrs[0x62] = this.LD_reg.bind(this, "h", "d");
    instrs[0x63] = this.LD_reg.bind(this, "h", "e");
    instrs[0x64] = this.LD_reg.bind(this, "h", "h");
    instrs[0x65] = this.LD_reg.bind(this, "h", "l");
    instrs[0x66] = this.LD_byte_mem.bind(this, "h", "hl");
    instrs[0x67] = this.LD_reg.bind(this, "h", "a");

    // LD L, r2
    instrs[0x68] = this.LD_reg.bind(this, "l", "b");
    instrs[0x69] = this.LD_reg.bind(this, "l", "c");
    instrs[0x6a] = this.LD_reg.bind(this, "l", "d");
    instrs[0x6b] = this.LD_reg.bind(this, "l", "e");
    instrs[0x6c] = this.LD_reg.bind(this, "l", "h");
    instrs[0x6d] = this.LD_reg.bind(this, "l", "l");
    instrs[0x6e] = this.LD_byte_mem.bind(this, "l", "hl");
    instrs[0x6f] = this.LD_reg.bind(this, "l", "a");

    // TODO(7x-77 except 76 HALT): LD_reg (HL) r2

    // LD A, r2
    instrs[0x78] = this.LD_reg.bind(this, "a", "b");
    instrs[0x79] = this.LD_reg.bind(this, "a", "c");
    instrs[0x7a] = this.LD_reg.bind(this, "a", "d");
    instrs[0x7b] = this.LD_reg.bind(this, "a", "e");
    instrs[0x7c] = this.LD_reg.bind(this, "a", "h");
    instrs[0x7d] = this.LD_reg.bind(this, "a", "l");
    instrs[0x7e] = this.LD_byte_mem.bind(this, "a", "hl");
    instrs[0x7f] = this.LD_reg.bind(this, "a", "a");
    return instrs;
  };

  instructionMap: Function[] = this.buildInstructionMap();
}

// dispatcher process:
// while(true)
// {
//     var op = MMU.rb(Z80._r.pc++);              // Fetch instruction
//     Z80._map[op]();                            // Dispatch
//     Z80._r.pc &= 65535;                        // Mask PC to 16 bits
//     Z80._clock.m += Z80._r.m;                  // Add time to CPU clock
//     Z80._clock.t += Z80._r.t;
//
//     GPU.step(this.r.clock.t);  // tick the GPU
// }

// Z80._map = [
//     Z80._ops.NOP,
//     Z80._ops.LDBCnn,
//     Z80._ops.LDBCmA,
//     Z80._ops.INCBC,
//     Z80._ops.INCr_b,
//     ...
// ];

// If we're running in the browser, add this component to the window
if (typeof window !== "undefined") {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  (window as any).GbComponents.cpu = new Cpu();
}

// If we're running under Node, export it for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = new Cpu();
}

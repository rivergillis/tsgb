var LOG = (s?: any) => {
  console.log(s);
};
var ERR = (s?: any) => {
  console.error(s);
};
var LOGI = (s?: any) => {
  console.info(s);
};
var LOGV = (s?: any) => {
  console.debug(s);
};

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

// If you don't specify a flag, it is not affected
interface FlagOptions {
  z?: boolean;
  n?: boolean;
  h?: boolean;
  c?: boolean;
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
const word_regs_full: string[] = ["bc", "de", "hl", "sp", "af"];

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

  // Increments HL if @isInc, else decrements, handles overflow
  // TODO: Test this
  inc_dec_hl = (isInc: boolean) => {
    // Incrementing
    if (isInc) {
      // Increment if we don't overflow the low byte
      if (this.r.l < 0xff) {
        this.r.l++;
        return;
      }
      // Otherwise increment the high byte and set low byte to 0
      this.r.h++;
      this.r.l = 0x00;
      // Overflow, set both to 0
      if (this.r.h > 0xff) {
        this.r.h = 0x00;
      }
      return;
    }
    // Decrementing
    // Decrement if we don't underflow the low byte
    if (this.r.l > 0x00) {
      this.r.l--;
      return;
    }
    // Otherwise decrement the high byte and set low byte to 0xFF
    this.r.h--;
    this.r.l = 0xff;
    // Overflow, set both to 0xFF
    if (this.r.h < 0x00) {
      this.r.h = 0xff;
    }
  };

  set_flags = ({ z, n, h, c }: FlagOptions) => {
    // For each flag, we want to set bit if flag is true, or remove it if flag is false
    // This preserves undefined flags.
    // Zero
    if (z === true) {
      this.r.f |= 0x80;
    } else if (z === false) {
      this.r.f &= ~0x80;
    }

    // subtraction
    if (n === true) {
      this.r.f |= 0x40;
    } else if (n === false) {
      this.r.f &= ~0x40;
    }

    // half-carry
    if (h === true) {
      this.r.f |= 0x20;
    } else if (h === false) {
      this.r.f &= ~0x20;
    }

    // carry
    if (c === true) {
      this.r.f |= 0x10;
    } else if (c === false) {
      this.r.f &= ~0x10;
    }
  };

  set_instr_clock = (t: number) => {
    this.r.clock = { t: t, m: Math.floor(t / 4) };
  };

  word_from_regs = (regs: string): number => {
    if (word_regs_full.indexOf(regs) <= -1) {
      ERR(`WORD_FROM_REGS::BADREG ${regs}`);
    }
    const highByte = this.r[regs[0]] << 8;
    const lowByte = this.r[regs[1]];
    return highByte + lowByte;
  };

  // Adds @reg to A, leaving the result in A (ADD A, @reg)
  ADD_byte = (reg: string) => {
    if (add_byte_regs.indexOf(reg) <= -1) {
      ERR(`ADD_byte::BADREG ${reg}`);
      return;
    }
    LOGI(`ADD A, ${reg}`);

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
      ERR(`CP_reg::BADREG ${reg}`);
      return;
    }
    LOGI(`CP A, ${reg}`);

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
    LOGI(`NOP`);
    // 1 M-time taken
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // Push registers @regs[0] and @regs[1] (a word) to the stack (PUSH NN)
  PUSH = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      ERR(`PUSH::BADREG ${regs}`);
      return;
    }
    LOGI(`PUSH ${regs}`);

    // Use ww?
    this.r.sp--; // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[0]], this.r.pc, this.gpu); // Write reg0 at the stack pointer
    this.r.sp--; // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[1]], this.r.pc, this.gpu); // write reg1 at the stack pointer

    // Three M-times taken
    this.r.clock.m = 4;
    this.r.clock.t = 16;
  };

  // Pop registers @regs[0] and @regs[1] (a word) off the stack (POP NN)
  POP = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      ERR(`POP::BADREG ${regs}`);
      return;
    }
    LOGI(`POP ${regs}`);

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
      ERR(`LD_word_imm::BADREG ${regs}`);
      return;
    }
    const imm: number = this.mmu.rw(this.r.pc, this.r.pc, this.gpu); // get imm from instr
    LOGI(`LD ${regs}, ${imm.toString(16)}`);

    this.r.pc += 2; // advance PC twice bc 3-byte instr
    this.r.pc &= 0xffff;
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
  // For (LD (HL) d8), use STORE_hl_imm
  LD_byte_imm = (reg: string) => {
    if (imm_byte_ld_regs.indexOf(reg) <= -1) {
      ERR(`LD_byte_imm::BADREG ${reg}`);
    }
    const imm: number = this.mmu.rb(this.r.pc, this.r.pc, this.gpu);
    LOGI(`LD ${reg}, ${imm.toString(16)}`);

    this.r.pc += 1; // increment PC past the immediate
    this.r.pc &= 0xffff;

    this.r[reg] = imm;

    this.r.clock.m = 2;
    this.r.clock.t = 8;
  };

  // Stores byte immediate into mem specified by (HL)
  // LD (HL), d8
  STORE_hl_imm = () => {
    const imm: number = this.mmu.rb(this.r.pc, this.r.pc, this.gpu);
    this.r.pc += 1; // increment PC past the immediate (Does this need to go after the wb?)
    this.r.pc &= 0xffff;

    LOGI(`LD (HL), ${imm.toString(16)} (STORE_hl_imm)`);

    // H stores the high-byte, L stores the low-byte
    const highByte = this.r.h << 8;
    const lowByte = this.r.l;
    this.mmu.wb(highByte + lowByte, imm, this.r.pc, this.gpu);

    this.set_instr_clock(12);
  };

  // Loads @r1 with the value in @r2 (LD B, C)
  // For (LD H, (HL)), use LD_byte_mem
  // For (LD (HL), C), use STORE_mem_reg
  LD_reg = (r1: string, r2: string) => {
    if (ld_reg_regs.indexOf(r1) <= -1 || ld_reg_regs.indexOf(r2) <= -1) {
      ERR(`LD_reg::BADREG ${r1}, ${r2}`);
    }
    LOGI(`LD ${r1}, ${r2}`);
    this.r[r1] = this.r[r2];

    this.r.clock.m = 1;
    this.r.clock.t = 4;
  };

  // Stores @reg into the memory location specified by (HL) (LD (HL) B)
  // For LD (HL) A with inc/dec, use STORE_mem_acc_inc_dec(bool isInc)
  // FOr (LD (HL) d8) use STORE_hl_imm
  STORE_mem_reg = (reg: string) => {
    if (byte_regs.indexOf(reg) <= -1) {
      ERR(`STORE_mem_reg::BADREG ${reg}`);
    }
    LOGI(`LD (HL), ${reg} (STORE_mem_reg)`);

    // H stores the high-byte, L stores the low-byte
    const highByte = this.r.h << 8;
    const lowByte = this.r.l;
    const valToWrite = this.r[reg];
    this.mmu.wb(highByte + lowByte, valToWrite, this.r.pc, this.gpu);

    this.r.clock = { m: 2, t: 8 };
  };

  // Stores A into (HL), then increments or decrements HL (LD (HL+/-), A)
  // For (LD A, (HL+/-)) use LD_acc_hl_inc_dec(isInc)
  STORE_mem_acc_inc_dec = (isInc: boolean) => {
    this.STORE_mem_reg("a");
    LOGI(`...(with isInc: ${isInc})`);
    this.inc_dec_hl(isInc);
  };

  // Loads byte in mem specified by (@r2s[0] @r2s[1]) into register @r1 (LD B (HL); LD A (BC))
  // For (LD A (HL+/-)) use LD_acc_hl_inc_dec(bool isInc)
  LD_byte_mem = (r1: string, r2s: string) => {
    // || (r1 !== "a" && r2s !== "h") ???
    if (byte_regs.indexOf(r1) <= -1 || word_regs.indexOf(r2s) <= -1) {
      ERR(`LD_byte_mem::BADREG ${r1}, (${r2s})`);
    }
    LOGI(`LD ${r1}, (${r2s})`);

    // In BC, B contains the high byte and C contains the low byte (big endian?)
    const highByte: number = this.r[r2s[0]] << 8;
    const lowByte: number = this.r[r2s[1]];

    // Load the byte and assign to the reg
    this.r[r1] = this.mmu.rb(highByte + lowByte, this.r.pc, this.gpu);

    this.r.clock.m = 2;
    this.r.clock.t = 8;
  };

  LD_acc_hl_inc_dec = (isInc: boolean) => {
    this.LD_byte_mem("a", "hl");
    LOGI(`...(with isInc: ${isInc})`);
    this.inc_dec_hl(isInc);
  };

  // Bitwise XORs the register @r with A, then stores result back into A
  // For XOR (HL) use XOR_mem and for XOR d8 use XOR_imm
  XOR_reg = (reg: string) => {
    if (byte_regs.indexOf(reg) <= -1) {
      LOG(`XOR_reg::BADREG ${reg}`);
    }
    LOGI(`XOR A, (${reg})`);

    this.r.a ^= this.r[reg];
    const flags: FlagOptions = { z: false, n: false, h: false, c: false };
    if (this.r.a === 0x00) {
      flags.z = true;
    }
    this.set_flags(flags);
    this.set_instr_clock(4);
  };

  // Bitwise XORs the register the byte pointed at by (HL) with A, then stores result back into A
  XOR_mem = () => {
    LOGI(`XOR A, (HL)`);
    const addr = this.word_from_regs("hl");
    const byte = this.mmu.rb(addr, this.r.pc, this.gpu);
    this.r.a ^= byte;

    const flags: FlagOptions = { z: false, n: false, h: false, c: false };
    if (this.r.a === 0x00) {
      flags.z = true;
    }
    this.set_flags(flags);
    this.set_instr_clock(8);
  };
  // Bitwise XORs the immediate byte with A, then stores result back into A
  XOR_imm = () => {
    const imm = this.mmu.rb(this.r.pc, this.r.pc, this.gpu);
    this.r.pc++;

    LOGI(`XOR A, ${imm}`);
    this.r.a ^= imm;

    const flags: FlagOptions = { z: false, n: false, h: false, c: false };
    if (this.r.a === 0x00) {
      flags.z = true;
    }
    this.set_flags(flags);
    this.set_instr_clock(8);
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
    ERR(`CPU::Unimplemented function ${idx.toString(16)}`);
  };

  // TODO: Implement XOR and figure out the updateTile bug
  buildInstructionMap = (): Function[] => {
    const instrs: Function[] = [];
    for (let i = 0x00; i <= 0xcbff; i++) {
      instrs.push(this.unimplementedFunc.bind(this, i));
    }
    instrs[0x00] = this.NOP.bind(this);
    instrs[0x01] = this.LD_word_imm.bind(this, "bc");
    instrs[0x06] = this.LD_byte_imm.bind(this, "b");
    instrs[0x0a] = this.LD_byte_mem.bind(this, "a", "bc");
    instrs[0x0e] = this.LD_byte_imm.bind(this, "c");
    instrs[0x11] = this.LD_word_imm.bind(this, "de");
    instrs[0x16] = this.LD_byte_imm.bind(this, "d");
    instrs[0x1a] = this.LD_byte_mem.bind(this, "a", "de");
    instrs[0x1e] = this.LD_byte_imm.bind(this, "e");
    instrs[0x21] = this.LD_word_imm.bind(this, "hl");
    instrs[0x22] = this.STORE_mem_acc_inc_dec.bind(this, true);
    instrs[0x26] = this.LD_byte_imm.bind(this, "h");
    instrs[0x2a] = this.LD_acc_hl_inc_dec.bind(this, true);
    instrs[0x2e] = this.LD_byte_imm.bind(this, "l");
    instrs[0x31] = this.LD_word_imm.bind(this, "sp");
    instrs[0x32] = this.STORE_mem_acc_inc_dec.bind(this, false);
    instrs[0x3a] = this.LD_acc_hl_inc_dec.bind(this, false);
    instrs[0x36] = this.STORE_hl_imm.bind(this);
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

    // LD (HL) r
    instrs[0x70] = this.STORE_mem_reg.bind(this, "b");
    instrs[0x71] = this.STORE_mem_reg.bind(this, "c");
    instrs[0x72] = this.STORE_mem_reg.bind(this, "d");
    instrs[0x73] = this.STORE_mem_reg.bind(this, "e");
    instrs[0x74] = this.STORE_mem_reg.bind(this, "h");
    instrs[0x75] = this.STORE_mem_reg.bind(this, "l");
    // 0x76 HALT
    instrs[0x77] = this.STORE_mem_reg.bind(this, "a");

    // LD A, r2
    instrs[0x78] = this.LD_reg.bind(this, "a", "b");
    instrs[0x79] = this.LD_reg.bind(this, "a", "c");
    instrs[0x7a] = this.LD_reg.bind(this, "a", "d");
    instrs[0x7b] = this.LD_reg.bind(this, "a", "e");
    instrs[0x7c] = this.LD_reg.bind(this, "a", "h");
    instrs[0x7d] = this.LD_reg.bind(this, "a", "l");
    instrs[0x7e] = this.LD_byte_mem.bind(this, "a", "hl");
    instrs[0x7f] = this.LD_reg.bind(this, "a", "a");

    // XOR
    instrs[0xa8] = this.XOR_reg.bind(this, "b");
    instrs[0xa9] = this.XOR_reg.bind(this, "c");
    instrs[0xaa] = this.XOR_reg.bind(this, "d");
    instrs[0xab] = this.XOR_reg.bind(this, "e");
    instrs[0xac] = this.XOR_reg.bind(this, "h");
    instrs[0xad] = this.XOR_reg.bind(this, "l");
    instrs[0xae] = this.XOR_mem.bind(this);
    instrs[0xaf] = this.XOR_reg.bind(this, "a");

    instrs[0xee] = this.XOR_imm.bind(this);

    // CB Prefix instructions...

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

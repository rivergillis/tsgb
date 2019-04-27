interface Clock {
  m: number;
  t: number;
}
interface RegFile {
  // 8-bit registers
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  h: number,
  l: number,
  f: number,    // flags
  // 16-bit registers
  pc: number,   // program counter
  sp: number,   // stack pointer
  // clock for last instruction
  clock: Clock,
  [key: string]: any
}

/* I think:
PC should increas by 4 for each instr (maybe not all?)
SP inc/dec reversed, and also not just by 1?
*/

const add_byte_regs: string[] = ['a', 'b', 'c', 'd', 'e', 'h', 'l'];
const compare_reg_regs: string[] = ['a', 'b', 'c', 'd', 'e', 'h', 'l'];
const imm_byte_ld_regs: string[] = ['a', 'b', 'c', 'd', 'e', 'h', 'l'];
const push_pop_regs: string[] = ['bc', 'de', 'hl', 'af'];

/*
cpu = new Cpu();
cpu.mmu = new Mmu();
cpu.gpu = new Gpu();
mmu.reset();
cpu.reset();
gpu.reset();
*/
class Cpu {
  clock: Clock = {m: 0, t: 0};
  r: RegFile = {a: 0, b: 0, c: 0, d: 0, e:0, h: 0, l: 0, f: 0, pc: 0, sp: 0, clock: {m: 0, t: 0}};
  mmu: Mmu; // need to set this after creating
  gpu: Gpu; // need to set after creating

  // Adds @reg to A, leaving the result in A (ADD A, @reg)
  ADD_byte = (reg: string) => {
    if (add_byte_regs.indexOf(reg) <= -1) {
      console.error(`Adding reg ${reg} in ADD_byte, but ${reg} not an approved reg`);
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
    
    this.r.a &= 255;        // mask to 8-bits (discard the rest)

    // Took 1 M-time
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  }

  // Compare B to A, setting flags (CP A, B)
  CP_reg = (reg: string) => {
    if (compare_reg_regs.indexOf(reg) <= -1) {
      console.error(`Comparing reg ${reg} in CP_reg, but ${reg} not an approved reg`);
      return;
    }

    let i: number = this.r.a;       // temp copy of A
    i -= this.r[reg];               // sub reg from copy of A
    this.r.f |= 0x40;               // set subtraction flag
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
  }

  // No-operation
  NOP = () => {
    // 1 M-time taken
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  }

  // Push registers @regs[0] and @regs[1] (a word) to the stack (PUSH NN)
  PUSH = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      console.error(`Pushing regs ${regs} in PUSH, but ${regs} not an approved reg combo`);
      return;
    }
    this.r.sp--;                                // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[0]]);    // Write reg0 at the stack pointer
    this.r.sp--;                                // drop through the stack;
    this.mmu.wb(this.r.sp, this.r[regs[1]]);    // write reg1 at the stack pointer

    // Three M-times taken
    // TODO: Should this be 1 and 16?
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  }

  // Pop registers @regs[0] and @regs[1] (a word) off the stack (POP NN)
  POP = (regs: string) => {
    if (push_pop_regs.indexOf(regs) <= -1) {
      console.error(`Popping regs ${regs} in POP, but ${regs} not an approved reg combo`);
      return;
    }
    this.r[regs[1]] = this.mmu.rb(this.r.sp, this.r.pc, this.gpu);  // read reg1 at the stack pointer
    this.r.sp++;                                                    // move back up the stack
    this.r[regs[0]] = this.mmu.rb(this.r.sp, this.r.pc, this.gpu);  // read reg0 at the stack pointer
    this.r.sp++;                                                    // move back up the stack
    // Three M-times taken
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  }

  // Read a byte from absolute location into @reg (LD N, addr)
  LD_byte_imm = (reg: string) => {
    if (imm_byte_ld_regs.indexOf(reg) <= -1) {
      console.error(`Loading imm byte ${reg} in LD_byte_imm, but ${reg} not an approved reg`);
      return;
    }
    const addr: number = this.mmu.rw(this.r.pc, this.r.pc, this.gpu); // get address from instr (TODO???)
    this.r.pc += 2;                                         // advance PC, TODO: Do this before rb?
    this.r[reg] = this.mmu.rb(addr, this.r.pc, this.gpu);   // read from address
    // 4 M-times taken
    this.r.clock.m = 4;
    this.r.clock.t = 16;
  }

  // Reset the CPU (used on startup)
  reset = () => {
    this.r.a=0;this.r.b=0;this.r.c=0;this.r.d=0;this.r.e=0;this.r.h=0;
    this.r.l=0;this.r.f=0;this.r.sp=0;this.r.pc=0; this.r.clock.m=0;this.r.clock.t=0;
    this.clock.m=0;this.clock.t=0;

    // Reset our GPU and MMU
    this.gpu.reset();
    this.mmu.reset();
  }
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
if (typeof(window) !== 'undefined') {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  (window as any).GbComponents.cpu = new Cpu();
}


// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Cpu();
}
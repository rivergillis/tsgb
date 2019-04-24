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

// Also support hl?
const add_byte_regs: string[] = ['a', 'b', 'c', 'd', 'e', 'h', 'l'];

class Cpu {
  clock: Clock = {m: 0, t: 0};
  r: RegFile = {a: 0, b: 0, c: 0, d: 0, e:0, h: 0, l: 0, f: 0, pc: 0, sp: 0, clock: {m: 0, t: 0}};

  // Adds @reg to A, leaving the result in A (ADD A, @reg)
  // TODO: CHECK FOR HALF-CARRY
  // Half-carry (0x20): Set if, in the result of the last operation, the lower half of the byte overflowed past 15;
  //    check if (A^A)&0x10 is >0?
  ADD_byte = (reg: string) => {
    if (add_byte_regs.indexOf(reg) <= -1) {
      console.error(`Adding reg ${reg} in ADD_byte, but ${reg} not an approved reg`);
      return;
    }

    // Clear the flags
    this.r.f = 0;                 
    // Before we add, we need to check the half-carry bit
    // https://robdor.com/2016/08/10/gameboy-emulator-half-carry-flag/
    const halfByteSum = (this.r.a & 0xf) + (this.r['reg'] & 0xf);
    if ((halfByteSum & 0x10) == 0x10) {
      this.r.f |= 0x20;
    }

    // perform the addition
    this.r.a += this.r['reg'];
    
    // TODO: Check for integer overflow here? if a > 255 => a-=255
    
    // Check for zero (ANDing with 255 will produce 0 iff i===0)
    // TODO: check if we can just say this.r.a===0?
    if (!(this.r.a & 255)) {
      this.r.f |= 0x80;
    }
    // Check for zero
    if (this.r.a > 255) {
      this.r.f |= 0x10;
    }
    
    this.r.a &= 255;        // mask to 8-bits (discard the rest)

    // Took 1 M-time
    this.r.clock.m = 1;
    this.r.clock.t = 4;
  }

  // Compare B to A, settings flags (CP A, B)
  // TODO: CHECK FOR HALF-CARRY
  // TODO: MAKE THIS WORK FOR ALL OPERANDS THAT REQUIRE IT
  CPr_b = () => {
    let i: number = this.r.a;   // temp copy of A
    i -= this.r.b;              // sub b from copy of A
    this.r.f |= 0x40;           // set subtraction flag
    // check for zero
    if (!(i & 255)) {
      this.r.f |= 0x80;
    }
    // check for underflow
    if (i < 0) {
      this.r.f |= 0x10;
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

  // Push registers B and C to the stack (PUSH BC)
  PUSHBC = () => {
    this.r.sp--;                  // drop through the stack;
    mmu.wb(this.r.sp, this.r.b);  // Write b at the stack pointer
    this.r.sp--;                  // drop through the stack;
    mmu.wb(this.r.sp, this.r.c);  // write c at the stack pointer

    // Three M-times taken
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  }

  // Pop registers H and L off the stack (POP HL)
  POPHL = () => {
    this.r.l = mmu.rb(this.r.sp);   // read L at the stack pointer
    this.r.sp++;                    // move back up the stack
    this.r.h = mmu.rb(this.r.sp);   // read H at the stack pointer
    this.r.sp++;                    // move back up the stack
    // Three M-times taken
    this.r.clock.m = 3;
    this.r.clock.t = 12;
  }

  // Read a byte from absolute location into A (LD A, addr)
  LDAmm = () => {
    const addr: number = mmu.rw(this.r.pc);   // get address from instr (TODO???)
    this.r.pc += 2;                           // advance PC
    this.r.a = mmu.rb(addr);                  // read from address
    // 4 M-times taken
    this.r.clock.m = 4;
    this.r.clock.t = 16;
  }

  // Reset the CPU (used on startup)
  reset = () => {
    this.r.a=0;this.r.b=0;this.r.c=0;this.r.d=0;this.r.e=0;this.r.h=0;
    this.r.l=0;this.r.f=0;this.r.sp=0;this.r.pc=0; this.r.clock.m=0;this.r.clock.t=0;
    this.clock.m=0;this.clock.t=0;
  }
}

// while(true)
// {
//     var op = MMU.rb(Z80._r.pc++);              // Fetch instruction
//     Z80._map[op]();                            // Dispatch
//     Z80._r.pc &= 65535;                        // Mask PC to 16 bits
//     Z80._clock.m += Z80._r.m;                  // Add time to CPU clock
//     Z80._clock.t += Z80._r.t;
// }

// Z80._map = [
//     Z80._ops.NOP,
//     Z80._ops.LDBCnn,
//     Z80._ops.LDBCmA,
//     Z80._ops.INCBC,
//     Z80._ops.INCr_b,
//     ...
// ];


const cpu = new Cpu();

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = cpu;
}
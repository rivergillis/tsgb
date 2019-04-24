class Mmu {
  // Flag indicating BIOS is mapped in
  // BIOS is unmapped with the first instruction above 0x00FF
  inbios: boolean = true;

  // Memory region (init at reset time (TODO!))
  bios: number[] = [];
  rom: number[] = [];
  wram: number[] = [];  // vram
  eram: number[] = [];  // extended ram
  zram: number[] = [];  // working ram

  // Read 8-bit byte from @addr, @pc is the CPU's current program counter
  rb = (addr: number, pc: number): number => {
    // Switch on the upper byte
    switch (addr & 0xF000) {
      // Bios (256b/ROM0)
      case 0x0000:
        if (this.inbios) {
          if (addr < 0x0100) {
            return this.bios[addr];
          } else if (pc === 0x0100) {
            this.inbios = false;
          }
        }
        return this.rom[addr];
      // ROM0
      case 0x1000:
      case 0x2000:
      case 0x3000:
        return this.rom[addr];
      // ROM1 (unbanked) (16k)
      // case 0x4000:
      // case 0x5000:

    }
    return 0;
  }
  // Read 16-bit word from @addr
  rw = (addr: number): number => {return 0;}
  // Write 8-bit byte @val to @addr
  wb = (addr: number, val: number) => {}
  // Write 16-bit word @val to @addr
  ww = (addr: number, val: number) => {}
}

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Mmu();
}
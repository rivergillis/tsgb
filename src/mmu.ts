class Mmu {
  //TODO

  // Read 8-bit byte from @addr
  rb = (addr: number): number => {return 0;}
  // Read 16-bit word from @addr
  rw = (addr: number): number => {return 0;}
  // Write 8-bit byte @val to @addr
  wb = (addr: number, val: number) => {}
  // Write 16-bit word @val to @addr
  ww = (addr: number, val: number) => {}
}

const mmu = new Mmu();
import { LOG, ERR } from './helpers';
import Gpu from './gpu';

class Mmu {
  // 256-byte bios encompasses 0x0000 to 0x00FF when inbios=true
  // prettier-ignore
  bios: number[] = [0x31, 0xFE, 0xFF, 0xAF, 0x21, 0xFF, 0x9F, 0x32, 0xCB, 0x7C, 0x20, 0xFB, 0x21, 0x26, 0xFF, 0x0E,
    0x11, 0x3E, 0x80, 0x32, 0xE2, 0x0C, 0x3E, 0xF3, 0xE2, 0x32, 0x3E, 0x77, 0x77, 0x3E, 0xFC, 0xE0,
    0x47, 0x11, 0x04, 0x01, 0x21, 0x10, 0x80, 0x1A, 0xCD, 0x95, 0x00, 0xCD, 0x96, 0x00, 0x13, 0x7B,
    0xFE, 0x34, 0x20, 0xF3, 0x11, 0xD8, 0x00, 0x06, 0x08, 0x1A, 0x13, 0x22, 0x23, 0x05, 0x20, 0xF9,
    0x3E, 0x19, 0xEA, 0x10, 0x99, 0x21, 0x2F, 0x99, 0x0E, 0x0C, 0x3D, 0x28, 0x08, 0x32, 0x0D, 0x20,
    0xF9, 0x2E, 0x0F, 0x18, 0xF3, 0x67, 0x3E, 0x64, 0x57, 0xE0, 0x42, 0x3E, 0x91, 0xE0, 0x40, 0x04,
    0x1E, 0x02, 0x0E, 0x0C, 0xF0, 0x44, 0xFE, 0x90, 0x20, 0xFA, 0x0D, 0x20, 0xF7, 0x1D, 0x20, 0xF2,
    0x0E, 0x13, 0x24, 0x7C, 0x1E, 0x83, 0xFE, 0x62, 0x28, 0x06, 0x1E, 0xC1, 0xFE, 0x64, 0x20, 0x06,
    0x7B, 0xE2, 0x0C, 0x3E, 0x87, 0xF2, 0xF0, 0x42, 0x90, 0xE0, 0x42, 0x15, 0x20, 0xD2, 0x05, 0x20,
    0x4F, 0x16, 0x20, 0x18, 0xCB, 0x4F, 0x06, 0x04, 0xC5, 0xCB, 0x11, 0x17, 0xC1, 0xCB, 0x11, 0x17,
    0x05, 0x20, 0xF5, 0x22, 0x23, 0x22, 0x23, 0xC9, 0xCE, 0xED, 0x66, 0x66, 0xCC, 0x0D, 0x00, 0x0B,
    0x03, 0x73, 0x00, 0x83, 0x00, 0x0C, 0x00, 0x0D, 0x00, 0x08, 0x11, 0x1F, 0x88, 0x89, 0x00, 0x0E,
    0xDC, 0xCC, 0x6E, 0xE6, 0xDD, 0xDD, 0xD9, 0x99, 0xBB, 0xBB, 0x67, 0x63, 0x6E, 0x0E, 0xEC, 0xCC,
    0xDD, 0xDC, 0x99, 0x9F, 0xBB, 0xB9, 0x33, 0x3E, 0x3c, 0x42, 0xB9, 0xA5, 0xB9, 0xA5, 0x42, 0x4C,
    0x21, 0x04, 0x01, 0x11, 0xA8, 0x00, 0x1A, 0x13, 0xBE, 0x20, 0xFE, 0x23, 0x7D, 0xFE, 0x34, 0x20,
    0xF5, 0x06, 0x19, 0x78, 0x86, 0x23, 0x05, 0x20, 0xFB, 0x86, 0x20, 0xFE, 0x3E, 0x01, 0xE0, 0x50];

  // Flag indicating BIOS is mapped in
  // BIOS is unmapped with the first instruction above 0x00FF
  inbios: boolean = true;

  rom: number[] = [];
  wram: number[] = [];
  eram: number[] = []; // extended ram
  zram: number[] = []; // working ram

  reset = () => {
    // LOG('mmu reset');
    for (let i = 0; i < 8192; i++) {
      this.wram[i] = 0x00;
    }
    for (let i = 0; i < 32768; i++) {
      this.eram[i] = 0x00;
    }
    for (let i = 0; i < 127; i++) {
      this.zram[i] = 0x00;
    }
    this.inbios = true;
  };

  // Read 8-bit byte from @addr, @pc is the CPU's current program counter, @gpu is the gpu instance
  // todo: change switched to use if < chain?
  rb = (addr: number, pc: number, gpu: Gpu): number => {
    // Switch on the upper byte
    switch (addr & 0xf000) {
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
      // ROM0 (16k when you take 0x0000 after-bios into account)
      case 0x1000:
      case 0x2000:
      case 0x3000:
        return this.rom[addr];
      // ROM1 (unbanked) (16k)
      case 0x4000:
      case 0x5000:
      case 0x6000:
      case 0x7000:
        return this.rom[addr];
      // graphics (VRAM) (8k)
      case 0x8000:
      case 0x9000:
        return gpu.vram[addr & 0x1fff]; // TODO: why do we do this AND, or the following ones?
      // external RAM (8k)
      case 0xa000:
      case 0xb000:
        return this.eram[addr & 0x1fff];
      // working RAM (8k)
      case 0xc000:
      case 0xd000:
        return this.wram[addr & 0x1fff];
      // working RAM shadow
      case 0xe000:
        return this.wram[addr & 0x1fff];
      // working RAM shadow, I/O, zero-page RAM
      case 0xf000:
        switch (addr & 0x0f00) {
          // working ram shadow
          case 0x000:
          case 0x100:
          case 0x200:
          case 0x300:
          case 0x400:
          case 0x500:
          case 0x600:
          case 0x700:
          case 0x800:
          case 0x900:
          case 0xa00:
          case 0xb00:
          case 0xc00:
          case 0xd00:
            return this.wram[addr & 0x1fff];
          // graphics: object attribute memory
          // OAM is 160 bytes, remaining bytes read as 0
          case 0xe00:
            if (addr < 0xfea0) {
              return gpu.oam[addr & 0xff];
            } else {
              return 0;
            }
          // zero-page
          case 0xf00:
            if (addr >= 0xff80) {
              return this.zram[addr & 0x7f];
            } else {
              // I/O control handling
              switch (addr & 0x00f0) {
                // GPU (64 registers)
                case 0x40:
                case 0x50:
                case 0x60:
                case 0x70:
                  return gpu.rb(addr);
                default:
                  ERR(`Bad addr ${addr}`);
              }
              return 0;
            }
          default:
            ERR(`Bad addr ${addr}`);
        }
        break;
      default:
        ERR(`Bad addr ${addr}`);
    }
    return 0;
  };
  // Read 16-bit word from @addr, @pc is the CPU's current program counter, @gpu is the gpu instance
  rw = (addr: number, pc: number, gpu: Gpu): number => {
    // We shift the addr+1 byte back because it should be the high end of the word
    // so words are stored as low-byte high-byte
    return this.rb(addr, pc, gpu) + (this.rb(addr + 1, pc, gpu) << 8);
  };
  // Write 8-bit byte @val to @addr
  wb = (addr: number, val: number, pc: number, gpu: Gpu) => {
    // Switch on the upper byte
    switch (addr & 0xf000) {
      // Bios (256b/ROM0)
      case 0x0000:
        if (this.inbios) {
          if (addr < 0x0100) {
            // Should this exist?
            this.bios[addr] = val;
            break;
          } else if (pc === 0x0100) {
            this.inbios = false;
          }
        }
        this.rom[addr] = val;
        break;
      // ROM0 (16k when you take 0x0000 after-bios into account)
      case 0x1000:
      case 0x2000:
      case 0x3000:
        this.rom[addr] = val;
        break;
      // ROM1 (unbanked) (16k)
      case 0x4000:
      case 0x5000:
      case 0x6000:
      case 0x7000:
        this.rom[addr] = val;
        break;
      // VRAM (8k)
      case 0x8000:
      case 0x9000:
        gpu.vram[addr & 0x1fff] = val;
        // Update the tilesets after we write to VRAM
        gpu.updateTile(addr);
        break;
      // external RAM (8k)
      case 0xa000:
      case 0xb000:
        this.eram[addr & 0x1fff] = val;
        break;
      // working RAM (8k)
      case 0xc000:
      case 0xd000:
        this.wram[addr & 0x1fff] = val;
        break;
      // working RAM shadow
      case 0xe000:
        this.wram[addr & 0x1fff] = val;
        break;
      // working RAM shadow, I/O, zero-page RAM
      case 0xf000:
        switch (addr & 0x0f00) {
          // working ram shadow
          case 0x000:
          case 0x100:
          case 0x200:
          case 0x300:
          case 0x400:
          case 0x500:
          case 0x600:
          case 0x700:
          case 0x800:
          case 0x900:
          case 0xa00:
          case 0xb00:
          case 0xc00:
          case 0xd00:
            this.wram[addr & 0x1fff] = val;
            break;
          // graphics: object attribute memory
          // OAM is 160 bytes, remaining bytes read as 0
          case 0xe00:
            if (addr < 0xfea0) {
              gpu.oam[addr & 0xff] = val;
              break;
            }
            break;
          // zero-page
          case 0xf00:
            if (addr >= 0xff80) {
              this.zram[addr & 0x7f] = val;
              break;
            } else {
              // I/O
              switch (addr & 0x00f0) {
                //GPU
                case 0x40:
                case 0x50:
                case 0x60:
                case 0x70:
                  gpu.wb(addr, val);
                  break;
                default:
                  ERR(`Bad addr ${addr}`);
              }
            }
            break;
          default:
            ERR(`Bad addr ${addr}`);
        }
        break;
      default:
        ERR('Bad write in in mmu#wb');
    }
  };
  // Write 16-bit word @val to @addr
  ww = (addr: number, val: number, pc: number, gpu: Gpu) => {
    // Unsure if this is correct
    this.wb(addr, val & 0xff, pc, gpu); // write the lower byte
    this.wb(addr + 1, val >> 8, pc, gpu); // write the upper byte
  };

  loadRom = (data: Uint8Array) => {
    LOG('load rom');

    // First clear the rom
    this.rom = [];
    // Then copy the data over
    data.forEach(val => {
      this.rom.push(val);
    });
    LOG(this.rom);
  };
}

export default Mmu;

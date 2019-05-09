import Cpu from './cpu';
import Gpu from './gpu';
import Mmu from './mmu';
import { LOG, ERR } from './helpers';

// TODO: &= 0xffff doesn't overflow 0xffff+1 to 0 correctly!!!!!!!!!!!!

class Gameboy {
  ctx: CanvasRenderingContext2D;
  cpu: Cpu;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    const gpu = new Gpu(ctx);
    const mmu = new Mmu();
    this.cpu = new Cpu(mmu, gpu);

    this.reset();
  }
  reset = () => {
    this.cpu.reset();
    LOG(this.cpu);
  };

  tickFrame = () => {
    const { r, mmu, gpu } = this.cpu;

    const fclk = this.cpu.clock.t + 70224;

    const t0 = performance.now();
    let num_instrs = 0;
    do {
      let addr = mmu.rb(r.pc, r.pc, gpu);
      // move past the 1-byte opcode
      r.pc++;
      r.pc &= 65535;

      // If the addr we pulled was a CB prefix, we need to pull another byte to get the second half
      if (addr === 0xcb) {
        // shift the old byte to be the high byte and add the next byte as the low byte
        addr = addr << 8;
        addr += mmu.rb(r.pc, r.pc, gpu);
        // Gotta move the PC again since this was an extra byte
        r.pc++;
        r.pc &= 65535;
      }

      if (addr === undefined) {
        ERR(`UNDEFINED INSTR AT PC ${r.pc - 1}`);
      } else {
        LOG(`PC(${(r.pc - 1).toString(16)}) Executing ${addr.toString(16)}`);
      }

      // Fetch and decode the instruction
      const instr: Function = this.cpu.instructionMap[addr];

      // Execute the instruction
      instr();
      num_instrs++;

      // Update the clock. TODO: Should this be kept to 16-bits and overflow?
      this.cpu.clock.m += r.clock.m;
      this.cpu.clock.t += r.clock.t;

      // Update the PPU
      gpu.step(this.cpu.clock.t);
    } while (this.cpu.clock.t < fclk); // just execute a little bit for now
    // while (num_instrs < 150)
    // while (this.cpu.clock.t < fclk)
    const t1 = performance.now();
    console.log(`took ${t1 - t0}ms to execute ${num_instrs} instructions`);
  };

  loadRomFile = () => {};
  drawFrame = () => {
    // TODO: render gpu's framebuffer not this one
    this.ctx.putImageData(this.cpu.gpu.frameBuffer, 0, 0);
  };
}

export default Gameboy;
// (function() {
//   var LOG = (s?: any) => {
//     console.log(s);
//   };
//   var ERR = (s?: any) => {
//     // console.error(s);
//   };
//   var LOGI = (s?: any) => {
//     // console.info(s);
//   };
//   var LOGV = (s?: any) => {
//     // console.debug(s);
//   };

//   if (typeof window === "undefined") {
//     ERR("Stop trying to test gameboy.ts in mocha!");
//   }

//   if (typeof (window as any).GbComponents === "undefined") {
//     ERR("Incorrect load order, gameboy.js should be the last script loaded!");
//   }

//   const system: any = (window as any).GbComponents;
//   const reset = () => {
//     system.cpu.reset();
//     LOG(system);
//   };

//   // Read the file and send it to loadRom() on file upload
//   document.getElementById("fileInput").addEventListener(
//     "change",
//     event => {
//       const file: File = (event.target as HTMLInputElement).files[0];
//       const reader: FileReader = new FileReader();
//       reader.onload = e => {
//         const buf: ArrayBuffer = (e.target as any).result;
//         const data: Uint8Array = new Uint8Array(buf);
//         system.cpu.mmu.loadRom(data);
//       };
//       reader.readAsArrayBuffer(file);
//     },
//     false
//   );

//   const cpu: Cpu = system.cpu;
//   const gpu: Gpu = cpu.gpu;
//   const mmu: Mmu = cpu.mmu;

//   const frame = () => {
//     const fclk = system.cpu.clock.t + 70224;

//     const t0 = performance.now();
//     let num_instrs = 0;
//     do {
//       LOGV(cpu.r);
//       let addr = mmu.rb(cpu.r.pc, cpu.r.pc, gpu);
//       // move past the 1-byte opcode
//       cpu.r.pc++;
//       cpu.r.pc &= 65535;

//       if (cpu.r.pc >= 0x100) {
//         LOGI(cpu.r.pc.toString(16));
//       }

//       // If the addr we pulled was a CB prefix, we need to pull another byte to get the second half
//       if (addr === 0xcb) {
//         // shift the old byte to be the high byte and add the next byte as the low byte
//         addr = addr << 8;
//         addr += mmu.rb(cpu.r.pc, cpu.r.pc, gpu);
//         // Gotta move the PC again since this was an extra byte
//         cpu.r.pc++;
//         cpu.r.pc &= 65535;
//       }

//       if (addr === undefined) {
//         ERR(`UNDEFINED INSTR AT PC ${cpu.r.pc - 1}`);
//       } else {
//         LOGV(
//           `PC(${(cpu.r.pc - 1).toString(16)}) Executing ${addr.toString(16)}`
//         );
//       }

//       // Fetch and decode the instruction
//       const instr: Function = cpu.instructionMap[addr];

//       // Execute the instruction
//       instr();
//       num_instrs++;

//       // Update the clock. TODO: Should this be kept to 16-bits and overflow?
//       cpu.clock.m += cpu.r.clock.m;
//       cpu.clock.t += cpu.r.clock.t;

//       // Update the PPU
//       gpu.step(cpu.clock.t);
//     } while (cpu.clock.t < fclk); // just execute a little bit for now
//     // while (num_instrs < 150)
//     // while (cpu.clock.t < fclk)
//     const t1 = performance.now();
//     LOG(`took ${t1 - t0}ms to execute ${num_instrs} instructions`);
//   };

//   let interval: any = null;
//   const run = () => {
//     if (!interval) {
//       interval = setTimeout(frame, 1);
//       document.getElementById("run").innerHTML = "pause";
//     } else {
//       clearInterval(interval);
//       interval = null;
//       document.getElementById("run").innerHTML = "run";
//     }
//   };

//   window.onload = () => {
//     document.getElementById("reset").onclick = reset;
//     document.getElementById("run").onclick = run;
//     reset();
//   };
// })();

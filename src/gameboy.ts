if (typeof(window) === 'undefined') {
  console.error("Stop trying to test gameboy.ts in mocha!")
}

if (typeof((window as any).GbComponents) === 'undefined') {
  console.error("Incorrect load order, gameboy.js should be the last script loaded!")
}

const system: any = (window as any).GbComponents;
const reset = () => {
  system.cpu.reset();
  console.log(system);
}

// Read the file and send it to loadRom() on file upload
document.getElementById('fileInput').addEventListener('change', event => {
  const file: File =(event.target as HTMLInputElement).files[0];
  const reader: FileReader = new FileReader();
  reader.onload = e => {
    const buf: ArrayBuffer = (e.target as any).result;
    const data: Uint8Array = new Uint8Array(buf);
    system.cpu.mmu.loadRom(data);
  }
  reader.readAsArrayBuffer(file);
}, false);

const cpu: Cpu = system.cpu;
const gpu: Gpu = cpu.gpu;
const mmu: Mmu = cpu.mmu;

const frame = () => {
  const fclk = system.cpu.clock.t + 70224;
  do {
    console.log(cpu.r);
    console.log(`Executing ${mmu.rb(cpu.r.pc, cpu.r.pc, gpu).toString(16)}`);
    const instr: Function = cpu.instructionMap[mmu.rb(cpu.r.pc, cpu.r.pc, gpu)];
    cpu.r.pc++;
    cpu.r.pc &= 65535;
    instr();
    cpu.clock.m += cpu.r.clock.m;
    cpu.clock.t += cpu.r.clock.t;
    gpu.step(cpu.clock.t);
  } while (cpu.clock.t < fclk);
}

let interval: any = null;
const run = () => {
  if (!interval) {
    interval = setTimeout(frame, 1);
    document.getElementById('run').innerHTML = "pause";
  } else {
    clearInterval(interval);
    interval = null;
    document.getElementById('run').innerHTML = "run";
  }
}

window.onload = () => {
  document.getElementById('reset').onclick = reset;
  document.getElementById('run').onclick = run;
  reset();
}
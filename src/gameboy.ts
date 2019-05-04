(function() {
  var LOG = (s?: any) => {
    console.log(s);
  };

  var ERR = (s?: any) => {
    console.error(s);
  };

  if (typeof window === "undefined") {
    ERR("Stop trying to test gameboy.ts in mocha!");
  }

  if (typeof (window as any).GbComponents === "undefined") {
    ERR("Incorrect load order, gameboy.js should be the last script loaded!");
  }

  const system: any = (window as any).GbComponents;
  const reset = () => {
    system.cpu.reset();
    LOG(system);
  };

  // Read the file and send it to loadRom() on file upload
  document.getElementById("fileInput").addEventListener(
    "change",
    event => {
      const file: File = (event.target as HTMLInputElement).files[0];
      const reader: FileReader = new FileReader();
      reader.onload = e => {
        const buf: ArrayBuffer = (e.target as any).result;
        const data: Uint8Array = new Uint8Array(buf);
        system.cpu.mmu.loadRom(data);
      };
      reader.readAsArrayBuffer(file);
    },
    false
  );

  const cpu: Cpu = system.cpu;
  const gpu: Gpu = cpu.gpu;
  const mmu: Mmu = cpu.mmu;

  const frame = () => {
    const fclk = system.cpu.clock.t + 70224;

    const t0 = performance.now();
    let num_instrs = 0;
    do {
      LOG(cpu.r);
      LOG(`Executing ${mmu.rb(cpu.r.pc, cpu.r.pc, gpu).toString(16)}`);

      // Fetch and decode the instruction
      const instr: Function =
        cpu.instructionMap[mmu.rb(cpu.r.pc, cpu.r.pc, gpu)];

      // move past the 1-byte opcode
      cpu.r.pc++;
      cpu.r.pc &= 65535;

      // Execute the instruction
      instr();
      num_instrs++;

      // Update the clock. TODO: Should this be kept to 16-bits and overflow?
      cpu.clock.m += cpu.r.clock.m;
      cpu.clock.t += cpu.r.clock.t;

      // Update the PPU
      gpu.step(cpu.clock.t);
      // LOG(fclk - cpu.clock.t);
    } while (cpu.clock.t < fclk / 250); // just execute a little bit for now
    const t1 = performance.now();
    console.log(t1 - t0);
    console.log(num_instrs);
  };

  let interval: any = null;
  const run = () => {
    if (!interval) {
      interval = setTimeout(frame, 1);
      document.getElementById("run").innerHTML = "pause";
    } else {
      clearInterval(interval);
      interval = null;
      document.getElementById("run").innerHTML = "run";
    }
  };

  window.onload = () => {
    document.getElementById("reset").onclick = reset;
    document.getElementById("run").onclick = run;
    reset();
  };
})();

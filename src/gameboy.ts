if (typeof(window) === 'undefined') {
  console.error("Stop trying to test gameboy.ts in mocha!")
}

if (typeof((window as any).GbComponents) === 'undefined') {
  console.error("Incorrect load order, gameboy.js should be the last script loaded!")
}

const system: any = (window as any).GbComponents;

system.cpu.reset();

console.log(system);

// Read the file and send it to loadRom()
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

// system.cpu.mmu.loadRom();
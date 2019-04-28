var Mmu = (function () {
    function Mmu() {
        var _this = this;
        this.bios = [0x31, 0xFE, 0xFF, 0xAF, 0x21, 0xFF, 0x9F, 0x32, 0xCB, 0x7C, 0x20, 0xFB, 0x21, 0x26, 0xFF, 0x0E,
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
        this.inbios = true;
        this.rom = [];
        this.wram = [];
        this.eram = [];
        this.zram = [];
        this.reset = function () {
            for (var i = 0; i < 8192; i++) {
                _this.wram[i] = 0x00;
            }
            for (var i = 0; i < 32768; i++) {
                _this.eram[i] = 0x00;
            }
            for (var i = 0; i < 127; i++) {
                _this.zram[i] = 0x00;
            }
            _this.inbios = true;
        };
        this.rb = function (addr, pc, gpu) {
            switch (addr & 0xF000) {
                case 0x0000:
                    if (_this.inbios) {
                        if (addr < 0x0100) {
                            return _this.bios[addr];
                        }
                        else if (pc === 0x0100) {
                            _this.inbios = false;
                        }
                    }
                    return _this.rom[addr];
                case 0x1000:
                case 0x2000:
                case 0x3000:
                    return _this.rom[addr];
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    return _this.rom[addr];
                case 0x8000:
                case 0x9000:
                    return gpu.vram[addr & 0x1FFF];
                case 0xA000:
                case 0xB000:
                    return _this.eram[addr & 0x1FFF];
                case 0xC000:
                case 0xD000:
                    return _this.wram[addr & 0x1FFF];
                case 0xE000:
                    return _this.wram[addr & 0x1FFF];
                case 0xF000:
                    switch (addr & 0x0F00) {
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
                        case 0xA00:
                        case 0xB00:
                        case 0xC00:
                        case 0xD00:
                            return _this.wram[addr & 0x1FFF];
                        case 0xE00:
                            if (addr < 0xFEA0) {
                                return gpu.oam[addr & 0xFF];
                            }
                            else {
                                return 0;
                            }
                        case 0xF00:
                            if (addr >= 0xFF80) {
                                return _this.zram[addr & 0x7F];
                            }
                            else {
                                switch (addr & 0x00F0) {
                                    case 0x40:
                                    case 0x50:
                                    case 0x60:
                                    case 0x70:
                                        return gpu.rb(addr);
                                }
                                return 0;
                            }
                    }
            }
            return 0;
        };
        this.rw = function (addr, pc, gpu) {
            return _this.rb(addr, pc, gpu) + (_this.rb(addr + 1, pc, gpu) << 8);
        };
        this.wb = function (addr, val, pc, gpu) {
            switch (addr & 0xF000) {
                case 0x0000:
                    if (_this.inbios) {
                        if (addr < 0x0100) {
                            _this.bios[addr] = val;
                            break;
                        }
                        else if (pc === 0x0100) {
                            _this.inbios = false;
                        }
                    }
                    _this.rom[addr] = val;
                    break;
                case 0x1000:
                case 0x2000:
                case 0x3000:
                    _this.rom[addr] = val;
                    break;
                case 0x4000:
                case 0x5000:
                case 0x6000:
                case 0x7000:
                    _this.rom[addr] = val;
                    break;
                case 0x8000:
                case 0x9000:
                    gpu.vram[addr & 0x1FFF] = val;
                    gpu.updateTile(addr);
                    break;
                case 0xA000:
                case 0xB000:
                    _this.eram[addr & 0x1FFF] = val;
                    break;
                case 0xC000:
                case 0xD000:
                    _this.wram[addr & 0x1FFF];
                    break;
                case 0xE000:
                    _this.wram[addr & 0x1FFF];
                    break;
                case 0xF000:
                    switch (addr & 0x0F00) {
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
                        case 0xA00:
                        case 0xB00:
                        case 0xC00:
                        case 0xD00:
                            _this.wram[addr & 0x1FFF] = val;
                            break;
                        case 0xE00:
                            if (addr < 0xFEA0) {
                                gpu.oam[addr & 0xFF] = val;
                                break;
                            }
                            break;
                        case 0xF00:
                            if (addr >= 0xFF80) {
                                _this.zram[addr & 0x7F] = val;
                                break;
                            }
                            else {
                                switch (addr & 0x00F0) {
                                    case 0x40:
                                    case 0x50:
                                    case 0x60:
                                    case 0x70:
                                        gpu.wb(addr, val);
                                        break;
                                }
                            }
                            break;
                    }
                    break;
                default:
                    console.error('Bad write in in mmu#wb');
            }
        };
        this.ww = function (addr, val, pc, gpu) {
            _this.wb(addr, val & 0xFF, pc, gpu);
            _this.wb(addr + 1, val >> 8, pc, gpu);
        };
        this.loadRom = function (data) {
            console.log('load rom');
            _this.rom = [];
            data.forEach(function (val) {
                _this.rom.push(val);
            });
            console.log(_this.rom);
        };
    }
    return Mmu;
}());
if (typeof (window) !== 'undefined') {
    if (window.GbComponents === undefined) {
        window.GbComponents = {};
    }
    if (window.GbComponents.cpu === undefined) {
        console.error("Incorrect load order, MMU.js must load after CPU.js is loaded!");
        window.GbComponents.mmu = new Mmu();
    }
    else {
        window.GbComponents.cpu.mmu = new Mmu();
    }
}
if (typeof (module) !== 'undefined' && module.exports) {
    module.exports = new Mmu();
}
//# sourceMappingURL=mmu.js.map
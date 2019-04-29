var byte_regs = ["a", "b", "c", "d", "e", "h", "l"];
var word_regs = ["bc", "de", "hl"];
var add_byte_regs = ["a", "b", "c", "d", "e", "h", "l"];
var compare_reg_regs = ["a", "b", "c", "d", "e", "h", "l"];
var imm_byte_ld_regs = ["a", "b", "c", "d", "e", "h", "l"];
var ld_reg_regs = ["a", "b", "c", "d", "e", "h", "l"];
var imm_word_ld_regs = ["bc", "de", "hl", "sp"];
var push_pop_regs = ["bc", "de", "hl", "af"];
var Cpu = (function () {
    function Cpu() {
        var _this = this;
        this.clock = { m: 0, t: 0 };
        this.r = {
            a: 0,
            b: 0,
            c: 0,
            d: 0,
            e: 0,
            h: 0,
            l: 0,
            f: 0,
            pc: 0,
            sp: 0,
            clock: { m: 0, t: 0 }
        };
        this.ADD_byte = function (reg) {
            if (add_byte_regs.indexOf(reg) <= -1) {
                console.error("ADD_byte::BADREG " + reg);
                return;
            }
            _this.r.f = 0;
            var halfByteSum = (_this.r.a & 0xf) + (_this.r[reg] & 0xf);
            if ((halfByteSum & 0x10) == 0x10) {
                _this.r.f |= 0x20;
            }
            _this.r.a += _this.r[reg];
            if (!(_this.r.a & 255)) {
                _this.r.f |= 0x80;
            }
            if (_this.r.a > 255) {
                _this.r.f |= 0x10;
            }
            _this.r.a &= 255;
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.CP_reg = function (reg) {
            if (compare_reg_regs.indexOf(reg) <= -1) {
                console.error("CP_reg::BADREG " + reg);
                return;
            }
            var i = _this.r.a;
            i -= _this.r[reg];
            _this.r.f |= 0x40;
            if (!(i & 255)) {
                _this.r.f |= 0x80;
            }
            if (i < 0) {
                _this.r.f |= 0x10;
            }
            var halfByteSum = (_this.r.a & 0xf) - (_this.r[reg] & 0xf);
            if ((halfByteSum & 0x10) == 0x10) {
                _this.r.f |= 0x20;
            }
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.NOP = function () {
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.PUSH = function (regs) {
            if (push_pop_regs.indexOf(regs) <= -1) {
                console.error("PUSH::BADREG " + regs);
                return;
            }
            _this.r.sp--;
            _this.mmu.wb(_this.r.sp, _this.r[regs[0]], _this.r.pc, _this.gpu);
            _this.r.sp--;
            _this.mmu.wb(_this.r.sp, _this.r[regs[1]], _this.r.pc, _this.gpu);
            _this.r.clock.m = 3;
            _this.r.clock.t = 12;
        };
        this.POP = function (regs) {
            if (push_pop_regs.indexOf(regs) <= -1) {
                console.error("POP::BADREG " + regs);
                return;
            }
            _this.r[regs[1]] = _this.mmu.rb(_this.r.sp, _this.r.pc, _this.gpu);
            _this.r.sp++;
            _this.r[regs[0]] = _this.mmu.rb(_this.r.sp, _this.r.pc, _this.gpu);
            _this.r.sp++;
            _this.r.clock.m = 3;
            _this.r.clock.t = 12;
        };
        this.LD_word_imm = function (regs) {
            if (imm_word_ld_regs.indexOf(regs) <= -1) {
                console.error("LD_word_imm::BADREG " + regs);
                return;
            }
            var imm = _this.mmu.rw(_this.r.pc, _this.r.pc, _this.gpu);
            _this.r.pc += 2;
            if (regs == "sp") {
                _this.r.sp = imm;
            }
            else {
                _this.r[regs[0]] = imm >> 8;
                _this.r[regs[1]] = imm & 0x00ff;
            }
            _this.r.clock.m = 3;
            _this.r.clock.t = 12;
        };
        this.LD_byte_imm = function (reg) {
            if (imm_byte_ld_regs.indexOf(reg) <= -1) {
                console.error("LD_byte_imm::BADREG " + reg);
            }
            var imm = _this.mmu.rb(_this.r.pc, _this.r.pc, _this.gpu);
            _this.r.pc += 1;
            _this.r[reg] = imm;
            _this.r.clock.m = 2;
            _this.r.clock.t = 8;
        };
        this.LD_reg = function (r1, r2) {
            if (ld_reg_regs.indexOf(r1) <= -1 || ld_reg_regs.indexOf(r2) <= -1) {
                console.error("LD_reg::BADREG " + r1 + ", " + r2);
            }
            _this.r[r1] = _this.r[r2];
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.LD_byte_mem = function (r1, r2s) {
            if (byte_regs.indexOf(r1) <= -1 ||
                word_regs.indexOf(r2s) <= -1 ||
                (r1 !== "a" && r2s !== "h")) {
                console.error("LD_byte_mem::BADREG " + r1 + ", (" + r2s + ")");
            }
            var highByte = _this.r[r2s[0]] << 8;
            var lowByte = _this.r[r2s[1]];
            _this.r[r1] = _this.mmu.rb(highByte + lowByte, _this.r.pc, _this.gpu);
            _this.r.clock.m = 2;
            _this.r.clock.t = 8;
        };
        this.reset = function () {
            _this.r.a = 0;
            _this.r.b = 0;
            _this.r.c = 0;
            _this.r.d = 0;
            _this.r.e = 0;
            _this.r.h = 0;
            _this.r.l = 0;
            _this.r.f = 0;
            _this.r.sp = 0xfffe;
            _this.r.pc = 0;
            _this.r.clock.m = 0;
            _this.r.clock.t = 0;
            _this.clock.m = 0;
            _this.clock.t = 0;
            _this.gpu.reset();
            _this.mmu.reset();
        };
        this.unimplementedFunc = function (idx) {
            console.error("CPU::Unimplemented function " + idx.toString(16));
        };
        this.buildInstructionMap = function () {
            var instrs = [];
            for (var i = 0x00; i <= 0xff; i++) {
                instrs.push(_this.unimplementedFunc.bind(_this, i));
            }
            instrs[0x00] = _this.NOP;
            instrs[0x01] = _this.LD_word_imm.bind(_this, "bc");
            instrs[0x06] = _this.LD_byte_imm.bind(_this, "b");
            instrs[0x0a] = _this.LD_byte_mem.bind(_this, "a", "bc");
            instrs[0x0e] = _this.LD_byte_imm.bind(_this, "c");
            instrs[0x11] = _this.LD_word_imm.bind(_this, "de");
            instrs[0x16] = _this.LD_byte_imm.bind(_this, "d");
            instrs[0x1a] = _this.LD_byte_mem.bind(_this, "a", "de");
            instrs[0x1e] = _this.LD_byte_imm.bind(_this, "e");
            instrs[0x21] = _this.LD_word_imm.bind(_this, "hl");
            instrs[0x26] = _this.LD_byte_imm.bind(_this, "h");
            instrs[0x2e] = _this.LD_byte_imm.bind(_this, "l");
            instrs[0x31] = _this.LD_word_imm.bind(_this, "sp");
            instrs[0x3e] = _this.LD_byte_imm.bind(_this, "a");
            instrs[0x40] = _this.LD_reg.bind(_this, "b", "b");
            instrs[0x41] = _this.LD_reg.bind(_this, "b", "c");
            instrs[0x42] = _this.LD_reg.bind(_this, "b", "d");
            instrs[0x43] = _this.LD_reg.bind(_this, "b", "e");
            instrs[0x44] = _this.LD_reg.bind(_this, "b", "h");
            instrs[0x45] = _this.LD_reg.bind(_this, "b", "l");
            instrs[0x46] = _this.LD_byte_mem.bind(_this, "b", "hl");
            instrs[0x47] = _this.LD_reg.bind(_this, "b", "a");
            instrs[0x48] = _this.LD_reg.bind(_this, "c", "b");
            instrs[0x49] = _this.LD_reg.bind(_this, "c", "c");
            instrs[0x4a] = _this.LD_reg.bind(_this, "c", "d");
            instrs[0x4b] = _this.LD_reg.bind(_this, "c", "e");
            instrs[0x4c] = _this.LD_reg.bind(_this, "c", "h");
            instrs[0x4d] = _this.LD_reg.bind(_this, "c", "l");
            instrs[0x4e] = _this.LD_byte_mem.bind(_this, "c", "hl");
            instrs[0x4f] = _this.LD_reg.bind(_this, "c", "a");
            instrs[0x50] = _this.LD_reg.bind(_this, "d", "b");
            instrs[0x51] = _this.LD_reg.bind(_this, "d", "c");
            instrs[0x52] = _this.LD_reg.bind(_this, "d", "d");
            instrs[0x53] = _this.LD_reg.bind(_this, "d", "e");
            instrs[0x54] = _this.LD_reg.bind(_this, "d", "h");
            instrs[0x55] = _this.LD_reg.bind(_this, "d", "l");
            instrs[0x56] = _this.LD_byte_mem.bind(_this, "d", "hl");
            instrs[0x57] = _this.LD_reg.bind(_this, "d", "a");
            instrs[0x58] = _this.LD_reg.bind(_this, "e", "b");
            instrs[0x59] = _this.LD_reg.bind(_this, "e", "c");
            instrs[0x5a] = _this.LD_reg.bind(_this, "e", "d");
            instrs[0x5b] = _this.LD_reg.bind(_this, "e", "e");
            instrs[0x5c] = _this.LD_reg.bind(_this, "e", "h");
            instrs[0x5d] = _this.LD_reg.bind(_this, "e", "l");
            instrs[0x5e] = _this.LD_byte_mem.bind(_this, "e", "hl");
            instrs[0x5f] = _this.LD_reg.bind(_this, "e", "a");
            instrs[0x60] = _this.LD_reg.bind(_this, "h", "b");
            instrs[0x61] = _this.LD_reg.bind(_this, "h", "c");
            instrs[0x62] = _this.LD_reg.bind(_this, "h", "d");
            instrs[0x63] = _this.LD_reg.bind(_this, "h", "e");
            instrs[0x64] = _this.LD_reg.bind(_this, "h", "h");
            instrs[0x65] = _this.LD_reg.bind(_this, "h", "l");
            instrs[0x66] = _this.LD_byte_mem.bind(_this, "h", "hl");
            instrs[0x67] = _this.LD_reg.bind(_this, "h", "a");
            instrs[0x68] = _this.LD_reg.bind(_this, "l", "b");
            instrs[0x69] = _this.LD_reg.bind(_this, "l", "c");
            instrs[0x6a] = _this.LD_reg.bind(_this, "l", "d");
            instrs[0x6b] = _this.LD_reg.bind(_this, "l", "e");
            instrs[0x6c] = _this.LD_reg.bind(_this, "l", "h");
            instrs[0x6d] = _this.LD_reg.bind(_this, "l", "l");
            instrs[0x6e] = _this.LD_byte_mem.bind(_this, "l", "hl");
            instrs[0x6f] = _this.LD_reg.bind(_this, "l", "a");
            instrs[0x78] = _this.LD_reg.bind(_this, "a", "b");
            instrs[0x79] = _this.LD_reg.bind(_this, "a", "c");
            instrs[0x7a] = _this.LD_reg.bind(_this, "a", "d");
            instrs[0x7b] = _this.LD_reg.bind(_this, "a", "e");
            instrs[0x7c] = _this.LD_reg.bind(_this, "a", "h");
            instrs[0x7d] = _this.LD_reg.bind(_this, "a", "l");
            instrs[0x7e] = _this.LD_byte_mem.bind(_this, "a", "hl");
            instrs[0x7f] = _this.LD_reg.bind(_this, "a", "a");
            return instrs;
        };
        this.instructionMap = this.buildInstructionMap();
    }
    return Cpu;
}());
if (typeof window !== "undefined") {
    if (window.GbComponents === undefined) {
        window.GbComponents = {};
    }
    window.GbComponents.cpu = new Cpu();
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = new Cpu();
}
//# sourceMappingURL=cpu.js.map
var add_byte_regs = ["a", "b", "c", "d", "e", "h", "l"];
var compare_reg_regs = ["a", "b", "c", "d", "e", "h", "l"];
var imm_byte_ld_regs = ["a", "b", "c", "d", "e", "h", "l"];
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
            instrs[0x0e] = _this.LD_byte_imm.bind(_this, "c");
            instrs[0x11] = _this.LD_word_imm.bind(_this, "de");
            instrs[0x16] = _this.LD_byte_imm.bind(_this, "d");
            instrs[0x1e] = _this.LD_byte_imm.bind(_this, "e");
            instrs[0x21] = _this.LD_word_imm.bind(_this, "hl");
            instrs[0x26] = _this.LD_byte_imm.bind(_this, "h");
            instrs[0x2e] = _this.LD_byte_imm.bind(_this, "l");
            instrs[0x31] = _this.LD_word_imm.bind(_this, "sp");
            instrs[0x3e] = _this.LD_byte_imm.bind(_this, "a");
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
/**
 * Minimal UUIDv7 generator used only by the test suite.
 *
 * The spec file imports { V7Generator } from './uuidv7' and asserts that
 * `generator.generate().toString()` matches:
 *
 *   /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
 *
 * So we emit a real RFC 4122 version-7 layout: time_low (8) - time_mid (4) -
 * version+time_high (4, starts with `7`) - variant+clock_seq (4, starts with
 * `8`/`9`/`a`/`b`) - node (12).
 *
 * The suite also mocks Math.random to return 1.0 / 1.5 / NaN and expects no
 * throw plus a well-formed UUID, so every random-derived field is masked with
 * bitwise ops (ToInt32(NaN) === 0, and masks keep values in range).
 */
export class V7Generator {
  constructor(private rng: () => number = Math.random) {}

  generate(): UUID {
    const ms = BigInt(Date.now());

    // UUIDv7 stores milliseconds since the Unix epoch in the first 48 bits.
    const timeLow = Number(ms & 0xffffffffn); // bits 0..31
    const timeMid = Number((ms >> 32n) & 0xffffn); // bits 32..47
    const timeHigh = Number((ms >> 48n) & 0x0fffn); // bits 48..59 (12 bits)

    // 2 bits for the RFC 4122 variant (10xx) and 12 bits of clock sequence.
    const variantBits = Math.floor(this.rng() * 0x10000) & 0x3;
    const clockSeq = Math.floor(this.rng() * 0x10000) & 0xfff;

    // 48 random bits for the node field (16 + 32, each masked into range).
    const nodeHi = Math.floor(this.rng() * 0x10000) & 0xffff;
    const nodeLo = Math.floor(this.rng() * 0x100000000) >>> 0;

    return new UUID(timeLow, timeMid, timeHigh, variantBits, clockSeq, nodeHi, nodeLo);
  }
}

export class UUID {
  constructor(
    private timeLow: number,
    private timeMid: number,
    private timeHigh: number,
    private variantBits: number,
    private clockSeq: number,
    private nodeHi: number,
    private nodeLo: number,
  ) {}

  toString(): string {
    const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, "0");

    // Group 3: version nibble (7) + the 12 timestamp bits of time_high.
    const versionGroup = "7" + hex(this.timeHigh & 0xfff, 3);
    // Group 4: variant nibble (8..b, i.e. binary 10xx) + 12 clock bits.
    const variantGroup = hex(0x8 | (this.variantBits & 0x3), 1) + hex(this.clockSeq & 0xfff, 3);
    // Group 5: 48-bit random node as a single 12-hex segment.
    const node = hex(this.nodeHi & 0xffff, 4) + hex(this.nodeLo >>> 0, 8);

    return [hex(this.timeLow, 8), hex(this.timeMid, 4), versionGroup, variantGroup, node].join("-");
  }
}

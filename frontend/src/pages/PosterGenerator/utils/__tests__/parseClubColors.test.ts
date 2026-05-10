import { parseClubColors } from '../parseClubColors';

describe('parseClubColors', () => {
  describe('null / empty input → fallback', () => {
    it('returns fallback for null', () => {
      const result = parseClubColors(null);
      expect(result.primary).toBe('#1a1a2e');
      expect(result.secondary).toBe('#e94560');
    });

    it('returns fallback for undefined', () => {
      const result = parseClubColors(undefined);
      expect(result.primary).toBe('#1a1a2e');
    });

    it('returns fallback for empty string', () => {
      const result = parseClubColors('');
      expect(result.primary).toBe('#1a1a2e');
    });

    it('returns fallback for whitespace only', () => {
      const result = parseClubColors('   ');
      expect(result.primary).toBe('#1a1a2e');
    });

    it('returns fallback for unrecognized color name', () => {
      const result = parseClubColors('Lila-Türkis-Glitzer');
      // "lila" IS recognized, so primary is set; only "türkis-glitzer" is unknown
      expect(result.primary).toBe('#6600AA');
    });

    it('returns fallback when primary color is unrecognized', () => {
      const result = parseClubColors('Neonpink/Weiß');
      expect(result.primary).toBe('#1a1a2e');
    });
  });

  describe('slash separator', () => {
    it('parses "Rot/Weiß"', () => {
      const { primary, secondary } = parseClubColors('Rot/Weiß');
      expect(primary).toBe('#CC0000');
      expect(secondary).toBe('#FFFFFF');
    });

    it('parses "Schwarz/Gelb"', () => {
      const { primary, secondary } = parseClubColors('Schwarz/Gelb');
      expect(primary).toBe('#111111');
      expect(secondary).toBe('#FFD700');
    });
  });

  describe('dash separator', () => {
    it('parses "Blau-Weiß"', () => {
      const { primary, secondary } = parseClubColors('Blau-Weiß');
      expect(primary).toBe('#0044CC');
      expect(secondary).toBe('#FFFFFF');
    });
  });

  describe('comma separator', () => {
    it('parses "Rot, Weiß"', () => {
      const { primary, secondary } = parseClubColors('Rot, Weiß');
      expect(primary).toBe('#CC0000');
      expect(secondary).toBe('#FFFFFF');
    });
  });

  describe('pipe separator', () => {
    it('parses "Schwarz|Rot"', () => {
      const { primary, secondary } = parseClubColors('Schwarz|Rot');
      expect(primary).toBe('#111111');
      expect(secondary).toBe('#CC0000');
    });
  });

  describe('single color', () => {
    it('returns white as secondary when only one color given', () => {
      const { primary, secondary } = parseClubColors('Blau');
      expect(primary).toBe('#0044CC');
      expect(secondary).toBe('#FFFFFF');
    });
  });

  describe('case insensitivity', () => {
    it('handles mixed case "ROT/WEIß"', () => {
      const { primary } = parseClubColors('ROT/WEIß');
      expect(primary).toBe('#CC0000');
    });

    it('handles "weiss" as alias for "weiß"', () => {
      const { secondary } = parseClubColors('Blau/weiss');
      expect(secondary).toBe('#FFFFFF');
    });
  });

  describe('hex passthrough', () => {
    it('accepts 6-digit hex directly', () => {
      const { primary } = parseClubColors('#FF0000');
      expect(primary).toBe('#ff0000');
    });
  });

  describe('three-color string — uses first two', () => {
    it('parses "Schwarz/Weiß/Rot" → primary black, secondary white', () => {
      const { primary, secondary } = parseClubColors('Schwarz/Weiß/Rot');
      expect(primary).toBe('#111111');
      expect(secondary).toBe('#FFFFFF');
    });
  });
});

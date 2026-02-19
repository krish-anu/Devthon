import { calculatePoints, isEwasteCategory } from './points-calculator';

describe('calculatePoints', () => {
  it('calculates base points with no multiplier', () => {
    const result = calculatePoints({
      items: [
        { categoryName: 'Plastic', weightKg: 2 },
        { categoryName: 'Metal', weightKg: 1 },
      ],
      includesEwaste: false,
      isFirstBooking: false,
      hasWeeklyStreak: false,
    });

    expect(result.basePoints).toBe(40);
    expect(result.bonusPoints).toBe(0);
    expect(result.multiplier).toBe(1);
    expect(result.finalPoints).toBe(40);
  });

  it('adds e-waste bonus and applies weekly multiplier', () => {
    const result = calculatePoints({
      items: [{ categoryName: 'Plastic', weightKg: 1.2 }],
      includesEwaste: true,
      isFirstBooking: false,
      hasWeeklyStreak: true,
    });

    expect(result.basePoints).toBe(12);
    expect(result.bonusPoints).toBe(30);
    expect(result.multiplier).toBe(2);
    expect(result.finalPoints).toBe(84);
  });

  it('uses highest multiplier when multiple flags are true', () => {
    const result = calculatePoints({
      items: [{ categoryName: 'Plastic', weightKg: 1 }],
      includesEwaste: false,
      isFirstBooking: true,
      hasWeeklyStreak: true,
    });

    expect(result.multiplier).toBe(2);
    expect(result.finalPoints).toBe(20);
  });

  it('detects common e-waste category naming', () => {
    expect(isEwasteCategory('E-Waste')).toBe(true);
    expect(isEwasteCategory('E Waste')).toBe(true);
    expect(isEwasteCategory('Ewaste')).toBe(true);
    expect(isEwasteCategory('Electronics')).toBe(true);
    expect(isEwasteCategory('Reusable Electronics')).toBe(true);
    expect(isEwasteCategory('Whatever Name', 'e-waste')).toBe(true);
    expect(isEwasteCategory('Plastic')).toBe(false);
  });
});

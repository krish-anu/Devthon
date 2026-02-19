import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeWasteName } from '../lib/wasteTypeUtils';

@Injectable()
export class WasteTypesService {
  constructor(private prisma: PrismaService) {}

  async listWasteTypes() {
    const categories = await this.prisma.wasteCategory.findMany({
      where: { isActive: true },
      include: { pricing: true },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => {
      const activePricing = category.pricing?.isActive ? category.pricing : null;
      const minPriceLkrPerKg = activePricing?.minPriceLkrPerKg ?? null;
      const maxPriceLkrPerKg = activePricing?.maxPriceLkrPerKg ?? null;
      const ratePerKg =
        minPriceLkrPerKg !== null && maxPriceLkrPerKg !== null
          ? Math.round((((minPriceLkrPerKg + maxPriceLkrPerKg) / 2) * 100)) / 100
          : null;

      return {
        id: category.id,
        name: category.name,
        slug: (category as any).slug ?? normalizeWasteName(category.name),
        description: category.description,
        minPriceLkrPerKg,
        maxPriceLkrPerKg,
        ratePerKg,
      };
    });
  }
}

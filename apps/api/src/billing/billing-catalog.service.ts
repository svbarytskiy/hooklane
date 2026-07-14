import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { billingCatalog } from 'src/database/schema';

@Injectable()
export class BillingCatalogService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async getActiveProductByCode(code: string) {
    const [product] = await this.db
      .select({
        id: billingCatalog.id,
        code: billingCatalog.code,
        stripeProductId: billingCatalog.stripeProductId,
        stripePriceId: billingCatalog.stripePriceId,
        type: billingCatalog.type,
        creditsAmount: billingCatalog.creditsAmount,
      })
      .from(billingCatalog)
      .where(
        and(eq(billingCatalog.code, code), eq(billingCatalog.active, true)),
      )
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Active billing product not found: ${code}`);
    }

    return product;
  }
}

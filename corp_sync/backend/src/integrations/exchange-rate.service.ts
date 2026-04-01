import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type RatesResult = {
  base: string;
  rates: Record<string, number>;
};

@Injectable()
export class ExchangeRateService {
  async getRates(baseCurrency: string): Promise<RatesResult> {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const apiUrl =
      process.env.EXCHANGE_RATE_API_URL ?? 'https://v6.exchangerate-api.com/v6';

    if (!apiKey) {
      throw new ServiceUnavailableException('EXCHANGE_RATE_API_KEY is missing in .env');
    }

    const endpoint = `${apiUrl}/${apiKey}/latest/${baseCurrency.toUpperCase()}`;

    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ServiceUnavailableException('ExchangeRate API rejected provided key');
        }
        throw new ServiceUnavailableException('ExchangeRate API is unavailable');
      }

      const payload = (await response.json()) as Record<string, unknown>;

      const conversionRates =
        (payload.conversion_rates as Record<string, number> | undefined) ??
        (payload.rates as Record<string, number> | undefined);

      if (!conversionRates || Object.keys(conversionRates).length === 0) {
        throw new ServiceUnavailableException('Exchange rate payload has no rates');
      }

      return {
        base: baseCurrency.toUpperCase(),
        rates: conversionRates,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('ExchangeRate API is unavailable');
    }
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    targetCurrencies: string[],
  ): Promise<Record<string, number>> {
    const rates = await this.getRates(fromCurrency);
    const result: Record<string, number> = {};

    for (const currency of targetCurrencies) {
      const normalizedCurrency = currency.toUpperCase();
      if (normalizedCurrency === fromCurrency.toUpperCase()) {
        result[normalizedCurrency] = Number(amount.toFixed(2));
        continue;
      }

      const rate = rates.rates[normalizedCurrency];
      if (!rate) {
        throw new ServiceUnavailableException(
          `ExchangeRate API does not provide rate for '${normalizedCurrency}'`,
        );
      }
      result[normalizedCurrency] = Number((amount * rate).toFixed(2));
    }

    return result;
  }
}

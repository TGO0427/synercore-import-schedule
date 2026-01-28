/**
 * Exchange Rate Service
 * Fetches and caches USD/ZAR exchange rates
 */

import { costingRepository } from '../db/repositories/CostingRepository.js';
import { logInfo, logError } from '../utils/logger.js';

interface ExchangeRateResponse {
  rate: number;
  source: string;
  fetchedAt: string;
  isStale: boolean;
}

export class ExchangeRateService {
  private static readonly CURRENCY_PAIR = 'USD/ZAR';
  private static readonly CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Get current USD/ZAR exchange rate
   * Tries cache first, then fetches from API if stale
   */
  static async getCurrentRate(): Promise<ExchangeRateResponse> {
    try {
      // Check cache first
      const cached = await costingRepository.getCachedRate(this.CURRENCY_PAIR);
      const isStale = await costingRepository.isRateStale(this.CURRENCY_PAIR);

      if (cached && !isStale) {
        return {
          rate: Number(cached.rate),
          source: cached.source || 'cache',
          fetchedAt: cached.fetched_at,
          isStale: false,
        };
      }

      // Try to fetch fresh rate
      try {
        const freshRate = await this.fetchRateFromAPI();
        if (freshRate) {
          await costingRepository.cacheRate(this.CURRENCY_PAIR, freshRate.rate, freshRate.source);
          return {
            rate: freshRate.rate,
            source: freshRate.source,
            fetchedAt: new Date().toISOString(),
            isStale: false,
          };
        }
      } catch (apiError) {
        logError('Failed to fetch rate from API, using cached value', apiError);
      }

      // Return cached value even if stale
      if (cached) {
        return {
          rate: Number(cached.rate),
          source: cached.source || 'cache',
          fetchedAt: cached.fetched_at,
          isStale: true,
        };
      }

      // Fallback to hardcoded rate if no cache
      logInfo('No cached rate available, using fallback rate');
      return {
        rate: 18.50, // Reasonable fallback for USD/ZAR
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
        isStale: true,
      };
    } catch (error) {
      logError('Error getting exchange rate', error);
      return {
        rate: 18.50,
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
        isStale: true,
      };
    }
  }

  /**
   * Fetch rate from external API
   * Uses exchangerate-api.com free tier
   */
  private static async fetchRateFromAPI(): Promise<{ rate: number; source: string } | null> {
    // Try multiple sources in order
    const sources = [
      this.fetchFromExchangeRateAPI,
      this.fetchFromOpenExchangeRates,
    ];

    for (const fetchFn of sources) {
      try {
        const result = await fetchFn.call(this);
        if (result) {
          logInfo(`Exchange rate fetched: ${result.rate} from ${result.source}`);
          return result;
        }
      } catch (error) {
        logError(`Failed to fetch from source`, error);
      }
    }

    return null;
  }

  /**
   * Fetch from exchangerate-api.com (free tier: 1500 requests/month)
   */
  private static async fetchFromExchangeRateAPI(): Promise<{ rate: number; source: string } | null> {
    try {
      const response = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      if (data?.rates?.ZAR) {
        return {
          rate: Number(data.rates.ZAR),
          source: 'exchangerate-api.com',
        };
      }
    } catch (error) {
      logError('exchangerate-api.com fetch failed', error);
    }
    return null;
  }

  /**
   * Fallback: Fetch from open exchange rates API
   */
  private static async fetchFromOpenExchangeRates(): Promise<{ rate: number; source: string } | null> {
    try {
      // This is a free API that doesn't require authentication
      const response = await fetch(
        'https://open.er-api.com/v6/latest/USD',
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      if (data?.rates?.ZAR) {
        return {
          rate: Number(data.rates.ZAR),
          source: 'open.er-api.com',
        };
      }
    } catch (error) {
      logError('open.er-api.com fetch failed', error);
    }
    return null;
  }

  /**
   * Manually set exchange rate
   */
  static async setManualRate(rate: number): Promise<ExchangeRateResponse> {
    const cached = await costingRepository.cacheRate(this.CURRENCY_PAIR, rate, 'manual');
    return {
      rate: Number(cached.rate),
      source: 'manual',
      fetchedAt: cached.fetched_at,
      isStale: false,
    };
  }

  /**
   * Force refresh rate from API
   */
  static async refreshRate(): Promise<ExchangeRateResponse> {
    const freshRate = await this.fetchRateFromAPI();
    if (freshRate) {
      await costingRepository.cacheRate(this.CURRENCY_PAIR, freshRate.rate, freshRate.source);
      return {
        rate: freshRate.rate,
        source: freshRate.source,
        fetchedAt: new Date().toISOString(),
        isStale: false,
      };
    }

    // If API fails, return current cached value
    return this.getCurrentRate();
  }
}

export default ExchangeRateService;

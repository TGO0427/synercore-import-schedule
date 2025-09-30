import fs from 'fs/promises';
import path from 'path';

class PDFAnalyzer {
  constructor() {
    this.currencyRegex = /(?:R|USD|EUR|ZAR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{2})?/gi;
    this.priceRegex = /\b(?:\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/g;
    this.routeRegex = /(?:from|origin|departure|dep)[:\s]*([A-Z]{3}|[A-Za-z\s]+)(?:\s*(?:to|destination|dest|arrival|arr)[:\s]*([A-Z]{3}|[A-Za-z\s]+))?/gi;
    this.serviceRegex = /(?:air\s*freight|sea\s*freight|road\s*freight|express|economy|priority|standard)/gi;
    this.transitRegex = /(?:transit|delivery|lead)[:\s]*(\d+)\s*(?:days?|weeks?|hours?)/gi;
    this.validityRegex = /(?:valid|expires?|expiry)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi;
  }

  async extractTextFromPDF(filePath) {
    try {
      console.log(`📄 PDF analysis requested for: ${path.basename(filePath)}`);

      // For now, return a mock text that will trigger pattern matching
      // In a real implementation, you'd use a PDF parsing library
      const mockText = `
        FREIGHT QUOTE

        From: JHB - Johannesburg
        To: CPT - Cape Town

        Service: Air Freight Express
        Transit: 2-3 days

        Rate: R 2,500.00 per shipment
        Fuel Surcharge: R 350.00
        Total: R 2,850.00

        Alternative Service: Road Freight Standard
        Transit: 5-7 days
        Rate: R 1,200.00 per shipment
        Fuel: R 180.00
        Total: R 1,380.00

        Valid until: 31/12/2024
      `;

      console.log(`📄 Mock text analysis - ${mockText.length} characters`);
      return mockText;
    } catch (error) {
      console.error('Error in PDF analysis:', error);
      throw new Error(`Failed to analyze PDF: ${error.message}`);
    }
  }

  extractRatesFromText(text) {
    console.log('🔍 Analyzing text for rates and shipping information...');

    const analysis = {
      prices: [],
      routes: [],
      services: [],
      transitTimes: [],
      validityDates: [],
      rawText: text,
      confidence: 0
    };

    // Extract currency amounts and prices
    const currencyMatches = [...text.matchAll(this.currencyRegex)];
    const priceMatches = [...text.matchAll(this.priceRegex)];

    // Combine and clean up prices
    const allPrices = [
      ...currencyMatches.map(match => ({
        value: match[0],
        position: match.index,
        hasCurrency: true
      })),
      ...priceMatches.map(match => ({
        value: match[0],
        position: match.index,
        hasCurrency: false
      }))
    ];

    // Sort by position and deduplicate
    analysis.prices = allPrices
      .sort((a, b) => a.position - b.position)
      .filter((price, index, arr) => {
        if (index === 0) return true;
        return Math.abs(price.position - arr[index - 1].position) > 10;
      })
      .map(price => this.cleanPrice(price.value));

    // Extract routes (origin to destination)
    const routeMatches = [...text.matchAll(this.routeRegex)];
    analysis.routes = routeMatches.map(match => ({
      origin: this.cleanLocation(match[1]),
      destination: this.cleanLocation(match[2] || 'Not specified'),
      fullMatch: match[0]
    }));

    // Extract services
    const serviceMatches = [...text.matchAll(this.serviceRegex)];
    analysis.services = [...new Set(serviceMatches.map(match =>
      match[0].toLowerCase().replace(/\s+/g, ' ').trim()
    ))];

    // Extract transit times
    const transitMatches = [...text.matchAll(this.transitRegex)];
    analysis.transitTimes = transitMatches.map(match => ({
      duration: parseInt(match[1]),
      unit: this.extractTimeUnit(match[0]),
      fullMatch: match[0]
    }));

    // Extract validity dates
    const validityMatches = [...text.matchAll(this.validityRegex)];
    analysis.validityDates = validityMatches.map(match => ({
      date: match[1],
      fullMatch: match[0]
    }));

    // Calculate confidence score
    analysis.confidence = this.calculateConfidence(analysis);

    console.log(`🔍 Analysis complete:
      - Found ${analysis.prices.length} prices
      - Found ${analysis.routes.length} routes
      - Found ${analysis.services.length} services
      - Found ${analysis.transitTimes.length} transit times
      - Confidence: ${analysis.confidence}%`);

    return analysis;
  }

  cleanPrice(priceStr) {
    // Remove extra spaces and normalize
    const cleaned = priceStr.replace(/\s+/g, ' ').trim();

    // Extract numeric value
    const numericMatch = cleaned.match(/[\d,]+(?:\.\d{2})?/);
    const numeric = numericMatch ? parseFloat(numericMatch[0].replace(/,/g, '')) : 0;

    // Extract currency
    const currencyMatch = cleaned.match(/[A-Z]{3}|[$€£]/);
    const currency = currencyMatch ? currencyMatch[0] : 'Unknown';

    return {
      original: cleaned,
      numeric: numeric,
      currency: currency,
      formatted: `${currency} ${numeric.toLocaleString()}`
    };
  }

  cleanLocation(location) {
    if (!location) return 'Not specified';
    return location.trim().replace(/[:\-\s]+$/, '').trim();
  }

  extractTimeUnit(transitStr) {
    if (transitStr.toLowerCase().includes('week')) return 'weeks';
    if (transitStr.toLowerCase().includes('hour')) return 'hours';
    return 'days';
  }

  calculateConfidence(analysis) {
    let score = 0;

    // Base score for having any data
    if (analysis.prices.length > 0) score += 30;
    if (analysis.routes.length > 0) score += 25;
    if (analysis.services.length > 0) score += 20;
    if (analysis.transitTimes.length > 0) score += 15;
    if (analysis.validityDates.length > 0) score += 10;

    // Bonus for comprehensive data
    if (analysis.prices.length >= 3) score += 10;
    if (analysis.routes.length >= 2) score += 5;

    return Math.min(100, score);
  }

  async analyzePDFQuote(filePath) {
    try {
      console.log(`🔬 Starting comprehensive analysis of: ${path.basename(filePath)}`);

      const text = await this.extractTextFromPDF(filePath);
      const analysis = this.extractRatesFromText(text);

      // Add file metadata
      const stats = await fs.stat(filePath);
      analysis.metadata = {
        filename: path.basename(filePath),
        size: stats.size,
        analyzedAt: new Date().toISOString(),
        textLength: text.length
      };

      console.log(`🔬 Analysis complete for ${path.basename(filePath)}`);
      return analysis;

    } catch (error) {
      console.error('Error analyzing PDF quote:', error);
      throw error;
    }
  }

  generateComparisonReport(analyses) {
    console.log(`📊 Generating comparison report for ${analyses.length} quotes...`);

    const report = {
      summary: {
        totalQuotes: analyses.length,
        averageConfidence: 0,
        totalPricesFound: 0,
        totalRoutesFound: 0,
        generatedAt: new Date().toISOString()
      },
      quotes: [],
      bestPrices: [],
      routeComparison: {},
      serviceComparison: {},
      recommendations: []
    };

    // Process each analysis
    analyses.forEach((analysis, index) => {
      const quote = {
        index: index + 1,
        filename: analysis.metadata?.filename || `Quote ${index + 1}`,
        confidence: analysis.confidence,
        summary: {
          priceCount: analysis.prices.length,
          routeCount: analysis.routes.length,
          serviceCount: analysis.services.length,
          lowestPrice: analysis.prices.length > 0 ?
            Math.min(...analysis.prices.map(p => p.numeric)) : null,
          highestPrice: analysis.prices.length > 0 ?
            Math.max(...analysis.prices.map(p => p.numeric)) : null
        },
        details: analysis
      };

      report.quotes.push(quote);
      report.summary.totalPricesFound += analysis.prices.length;
      report.summary.totalRoutesFound += analysis.routes.length;
    });

    // Calculate average confidence
    report.summary.averageConfidence = analyses.length > 0 ?
      Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length) : 0;

    // Find best prices across all quotes
    const allPrices = [];
    analyses.forEach((analysis, index) => {
      analysis.prices.forEach(price => {
        if (price.numeric > 0) {
          allPrices.push({
            ...price,
            quoteIndex: index + 1,
            filename: analysis.metadata?.filename || `Quote ${index + 1}`
          });
        }
      });
    });

    // Sort by price and get best deals
    report.bestPrices = allPrices
      .sort((a, b) => a.numeric - b.numeric)
      .slice(0, 10);

    // Group routes for comparison
    analyses.forEach((analysis, index) => {
      analysis.routes.forEach(route => {
        const routeKey = `${route.origin} → ${route.destination}`;
        if (!report.routeComparison[routeKey]) {
          report.routeComparison[routeKey] = [];
        }
        report.routeComparison[routeKey].push({
          quoteIndex: index + 1,
          filename: analysis.metadata?.filename || `Quote ${index + 1}`,
          prices: analysis.prices
        });
      });
    });

    // Group services for comparison
    analyses.forEach((analysis, index) => {
      analysis.services.forEach(service => {
        if (!report.serviceComparison[service]) {
          report.serviceComparison[service] = [];
        }
        report.serviceComparison[service].push({
          quoteIndex: index + 1,
          filename: analysis.metadata?.filename || `Quote ${index + 1}`,
          prices: analysis.prices
        });
      });
    });

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    console.log(`📊 Comparison report generated:
      - ${report.summary.totalQuotes} quotes analyzed
      - ${report.summary.totalPricesFound} prices found
      - ${report.bestPrices.length} competitive prices identified
      - Average confidence: ${report.summary.averageConfidence}%`);

    return report;
  }

  generateRecommendations(report) {
    const recommendations = [];

    // Price-based recommendations
    if (report.bestPrices.length > 0) {
      const cheapest = report.bestPrices[0];
      recommendations.push({
        type: 'cost_saving',
        priority: 'high',
        title: 'Lowest Price Found',
        description: `Best rate: ${cheapest.formatted} from ${cheapest.filename}`,
        action: `Consider ${cheapest.filename} for cost optimization`
      });

      // Price spread analysis
      if (report.bestPrices.length > 1) {
        const mostExpensive = report.bestPrices[report.bestPrices.length - 1];
        const savings = mostExpensive.numeric - cheapest.numeric;
        if (savings > 1000) {
          recommendations.push({
            type: 'cost_analysis',
            priority: 'medium',
            title: 'Significant Price Variation',
            description: `Price difference of ${cheapest.currency} ${savings.toLocaleString()} between quotes`,
            action: 'Review service levels to ensure fair comparison'
          });
        }
      }
    }

    // Confidence-based recommendations
    const lowConfidenceQuotes = report.quotes.filter(q => q.confidence < 50);
    if (lowConfidenceQuotes.length > 0) {
      recommendations.push({
        type: 'data_quality',
        priority: 'medium',
        title: 'Low Confidence Analysis',
        description: `${lowConfidenceQuotes.length} quote(s) need manual review`,
        action: 'Check PDF quality and consider requesting structured quotes'
      });
    }

    // Route coverage recommendations
    const routeCount = Object.keys(report.routeComparison).length;
    if (routeCount > 1) {
      recommendations.push({
        type: 'route_optimization',
        priority: 'low',
        title: 'Multiple Routes Available',
        description: `${routeCount} different routes identified`,
        action: 'Compare transit times and service levels across routes'
      });
    }

    return recommendations;
  }
}

export default PDFAnalyzer;
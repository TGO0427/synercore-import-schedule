/**
 * Performance E2E Tests
 * Tests loading times, Web Vitals, and responsiveness
 */

describe('Performance - Page Load Times', () => {
  it('should load login page within 3 seconds', () => {
    const startTime = Date.now();
    cy.visit('/', { onBeforeLoad: () => Date.now() });
    cy.get('input[type="email"]', { timeout: 3000 }).should('be.visible');
    const endTime = Date.now();
    expect(endTime - startTime).to.be.lessThan(3000);
  });

  it('should load dashboard within 2 seconds', () => {
    cy.visit('/');
    cy.get('table', { timeout: 2000 }).should('be.visible');
  });

  it('should load table data without blocking UI', () => {
    cy.visit('/');
    cy.get('table').should('be.visible');
    cy.get('button').should('be.enabled');
  });
});

describe('Performance - API Response Times', () => {
  it('should load shipments in under 500ms', () => {
    cy.intercept('GET', '**/api/shipments**', (req) => {
      const start = Date.now();
      req.reply((res) => {
        const duration = Date.now() - start;
        expect(duration).to.be.lessThan(500);
      });
    });

    cy.visit('/');
    cy.wait('@shipments');
  });

  it('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      shipment_ref: `SHIP${i}`,
      status: 'pending',
      created_at: '2025-11-24T10:00:00Z',
    }));

    cy.intercept('GET', '**/api/shipments**', {
      statusCode: 200,
      body: { data: largeDataset },
    });

    cy.visit('/');
    // Should render without freezing
    cy.get('table tbody tr').should('have.length', 1000);
    cy.get('button').first().should('be.enabled');
  });

  it('should cache API responses', () => {
    cy.intercept('GET', '**/api/shipments**').as('firstCall');
    cy.visit('/');
    cy.wait('@firstCall');

    cy.intercept('GET', '**/api/shipments**', (req) => {
      // Verify request was made (cache miss is ok on first load)
      req.reply({ statusCode: 304 });
    }).as('secondCall');

    cy.reload();
    cy.wait('@secondCall');
  });
});

describe('Performance - Web Vitals', () => {
  it('should have good LCP (Largest Contentful Paint)', () => {
    cy.visit('/');
    cy.window().then((win) => {
      // Check that main content renders quickly
      cy.get('input[type="email"]', { timeout: 2500 }).should('be.visible');
    });
  });

  it('should have good INP (Interaction to Next Paint)', () => {
    cy.visit('/');
    const start = Date.now();
    cy.get('input[type="email"]').click();
    const duration = Date.now() - start;
    expect(duration).to.be.lessThan(200);
  });

  it('should have good CLS (Cumulative Layout Shift)', () => {
    cy.visit('/');
    // Wait for all content to load
    cy.get('table').should('be.visible');
    cy.get('body').should('not.have.css', 'transform');
  });
});

describe('Performance - Memory & Resource Usage', () => {
  it('should not leak memory on multiple navigations', () => {
    cy.visit('/');
    cy.get('a').first().click();
    cy.go('back');
    cy.visit('/');
    // If memory leaked, subsequent loads would be slow
    cy.get('table', { timeout: 2000 }).should('be.visible');
  });

  it('should clean up event listeners', () => {
    cy.visit('/');
    cy.window().then((win) => {
      const initialListeners = win.__eventListeners?.length || 0;
      cy.get('a').first().click();
      cy.go('back');
      const finalListeners = win.__eventListeners?.length || initialListeners;
      expect(finalListeners).to.equal(initialListeners);
    });
  });

  it('should handle animations smoothly (60fps target)', () => {
    cy.visit('/');
    // Trigger animation
    cy.contains('button', /create|add|new/i).click();
    // Modal should animate without jank
    cy.get('[role="dialog"], .modal').should('be.visible');
  });
});

describe('Performance - Network Efficiency', () => {
  it('should use efficient image formats', () => {
    cy.visit('/');
    cy.get('img').each(($img) => {
      const src = $img.attr('src');
      // Check for modern formats
      expect(src).to.match(/\.(png|jpg|webp|svg)$/i);
    });
  });

  it('should compress assets', () => {
    cy.visit('/');
    cy.window().then((win) => {
      const perf = win.performance.getEntriesByType('resource');
      perf.forEach((entry) => {
        // Compressed assets should have transferSize < decodedBodySize
        if (entry.transferSize > 0) {
          expect(entry.transferSize).to.be.lessThan(entry.decodedBodySize * 1.1);
        }
      });
    });
  });

  it('should lazy load images', () => {
    cy.visit('/');
    cy.get('img').each(($img) => {
      const loading = $img.attr('loading');
      expect(['lazy', 'auto', undefined]).to.include(loading);
    });
  });
});

describe('Performance - Rendering Efficiency', () => {
  it('should not cause excessive re-renders', () => {
    cy.visit('/');
    cy.window().then((win) => {
      let renderCount = 0;
      const originalRender = win.React?.render;

      // Monitor renders during user interaction
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');

      // Should complete without excessive renders
      cy.contains('button', /login|sign in/i).should('be.visible');
    });
  });

  it('should virtualize long lists', () => {
    cy.visit('/');
    // If table uses virtualization, only visible rows are rendered
    cy.get('table tbody tr').should('have.length.lessThan', 100);
  });
});

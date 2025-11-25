/**
 * Cypress E2E Test Support
 * Contains helper functions and command extensions for testing
 */

// Custom command for keyboard tab navigation
Cypress.Commands.add('tab', { prevSubject: 'element' }, (subject) => {
  return cy.wrap(subject).type('{tab}');
});

// Custom command for form filling
Cypress.Commands.add('fillForm', (formData) => {
  Object.entries(formData).forEach(([selector, value]) => {
    cy.get(selector).clear().type(value);
  });
});

// Custom command for login
Cypress.Commands.add('login', (email, password) => {
  cy.visit('/');
  cy.get('input[type="email"]').clear().type(email);
  cy.get('input[type="password"]').clear().type(password);
  cy.contains('button', /login|sign in/i).click();
  cy.url().should('not.include', '/');
});

// Custom command for checking accessibility
Cypress.Commands.add('checkA11y', () => {
  cy.window().then((win) => {
    // Check for basic a11y issues
    const headings = win.document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings.length).to.be.greaterThan(0);

    // Check for focus indicators
    const buttons = win.document.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn.getAttribute('type')).to.not.be.null;
    });

    // Check for alt text on images
    const images = win.document.querySelectorAll('img');
    images.forEach((img) => {
      expect(img.getAttribute('alt')).to.exist;
    });
  });
});

// Custom command for performance check
Cypress.Commands.add('checkPerformance', () => {
  cy.window().then((win) => {
    const perf = win.performance.timing;
    const pageLoadTime = perf.loadEventEnd - perf.navigationStart;
    expect(pageLoadTime).to.be.lessThan(3000);
  });
});

// Before each test hook
beforeEach(() => {
  // Clear local storage between tests
  cy.window().then((win) => {
    win.localStorage.clear();
  });

  // Mock common API responses
  cy.intercept('GET', '**/api/shipments', {
    statusCode: 200,
    body: { data: [] },
  }).as('getShipments');

  cy.intercept('POST', '**/api/auth/login', {
    statusCode: 401,
    body: { error: 'Invalid credentials' },
  });

  cy.intercept('GET', '**/api/suppliers', {
    statusCode: 200,
    body: { data: [] },
  }).as('getSuppliers');
});

// After each test hook
afterEach(() => {
  // Check for console errors
  cy.window().then((win) => {
    const errors = win.__consoleErrors || [];
    // Filter out expected errors
    const filteredErrors = errors.filter(
      (e) => !e.includes('Unexpected token') && !e.includes('Cannot find module')
    );
    if (filteredErrors.length > 0) {
      console.warn('Console errors detected:', filteredErrors);
    }
  });
});

// Global error handler
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore network errors and ResizeObserver unrelated to testing
  if (
    err.message.includes('Network error') ||
    err.message.includes('ResizeObserver loop')
  ) {
    return false;
  }
  throw err;
});

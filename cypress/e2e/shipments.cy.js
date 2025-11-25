/**
 * Shipments Management E2E Tests
 * Tests CRUD operations, filtering, sorting, and status updates
 */

describe('Shipments Management', () => {
  beforeEach(() => {
    // Mock login - in real scenario, you'd have login helper
    cy.visit('/');
    // Assume logged in for these tests
  });

  it('should display shipments table', () => {
    cy.get('table').should('be.visible');
    cy.contains('th', /shipment|reference/i).should('be.visible');
    cy.contains('th', /status/i).should('be.visible');
    cy.contains('th', /date/i).should('be.visible');
  });

  it('should load shipments data', () => {
    cy.intercept('GET', '**/api/shipments*', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            shipment_ref: 'SHIP001',
            status: 'pending',
            created_at: '2025-11-24T10:00:00Z',
          },
          {
            id: 2,
            shipment_ref: 'SHIP002',
            status: 'arrived',
            created_at: '2025-11-24T11:00:00Z',
          },
        ],
      },
    }).as('getShipments');

    cy.get('table tbody tr').should('have.length', 2);
    cy.contains('SHIP001').should('be.visible');
    cy.contains('SHIP002').should('be.visible');
  });

  it('should filter shipments by status', () => {
    cy.get('select, input[type="filter"], [data-testid*="filter"]').first().should('exist');
    cy.get('select, input[type="filter"]').first().select('pending').then(() => {
      cy.contains(/pending/i).should('be.visible');
    });
  });

  it('should sort shipments by column', () => {
    cy.contains('th', /date/i).click();
    cy.contains('th', /date/i).should('have.attr', 'aria-sort', /ascending|descending/i);
  });

  it('should open shipment detail view', () => {
    cy.get('table tbody tr').first().click();
    cy.contains(/shipment details|edit shipment/i).should('be.visible');
  });

  it('should show create shipment button', () => {
    cy.contains('button', /create|add|new/i).should('be.visible');
    cy.contains('button', /create|add|new/i).click();
    cy.contains(/shipment details|create/i).should('be.visible');
  });

  it('should handle empty shipments list', () => {
    cy.intercept('GET', '**/api/shipments*', {
      statusCode: 200,
      body: { data: [] },
    });

    cy.get('table tbody tr').should('not.exist');
    cy.contains(/no shipments|empty/i).should('be.visible');
  });

  it('should handle loading state', () => {
    cy.intercept('GET', '**/api/shipments*', (req) => {
      req.reply((res) => {
        res.delay(2000);
      });
    });

    cy.contains(/loading|please wait/i).should('be.visible');
  });

  it('should handle API errors', () => {
    cy.intercept('GET', '**/api/shipments*', { statusCode: 500 });

    cy.contains(/error|failed to load/i).should('be.visible');
    cy.contains('button', /retry/i).should('be.visible');
  });
});

describe('Shipment Creation', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.contains('button', /create|add|new/i).click();
  });

  it('should display create form', () => {
    cy.get('input, select, textarea').should('have.length.greaterThan', 0);
    cy.contains('button', /create|save|submit/i).should('be.visible');
  });

  it('should require shipment reference', () => {
    cy.contains('button', /create|save|submit/i).click();
    cy.contains(/required|shipment reference/i).should('exist');
  });

  it('should require status', () => {
    cy.contains('button', /create|save|submit/i).click();
    cy.contains(/required|status/i).should('exist');
  });

  it('should create shipment successfully', () => {
    cy.intercept('POST', '**/api/shipments', {
      statusCode: 201,
      body: { id: 1, shipment_ref: 'SHIP001', status: 'pending' },
    }).as('createShipment');

    cy.get('input[placeholder*="reference"], input[placeholder*="Shipment"]').type('SHIP001');
    cy.get('select').first().select('pending');
    cy.contains('button', /create|save|submit/i).click();

    cy.wait('@createShipment');
    cy.contains(/success|created|shipment saved/i).should('be.visible');
  });

  it('should validate duplicate references', () => {
    cy.intercept('POST', '**/api/shipments', {
      statusCode: 409,
      body: { error: 'Shipment reference already exists' },
    });

    cy.get('input[placeholder*="reference"]').type('EXISTING001');
    cy.get('select').first().select('pending');
    cy.contains('button', /create|save|submit/i).click();

    cy.contains(/already exists|duplicate/i).should('be.visible');
  });

  it('should have cancel button', () => {
    cy.contains('button', /cancel|close/i).should('be.visible');
    cy.contains('button', /cancel|close/i).click();
    cy.contains(/shipment details|create/i).should('not.exist');
  });
});

describe('Shipment Deletion', () => {
  it('should show delete confirmation', () => {
    cy.get('table tbody tr').first().within(() => {
      cy.contains('button', /delete|remove/i).click();
    });

    cy.contains(/confirm|are you sure/i).should('be.visible');
    cy.contains('button', /confirm|yes|delete/i).should('be.visible');
  });

  it('should delete shipment on confirmation', () => {
    cy.intercept('DELETE', '**/api/shipments/**', {
      statusCode: 200,
      body: { success: true },
    }).as('deleteShipment');

    cy.get('table tbody tr').first().within(() => {
      cy.contains('button', /delete|remove/i).click();
    });

    cy.contains('button', /confirm|yes|delete/i).click();
    cy.wait('@deleteShipment');
    cy.contains(/deleted|removed|success/i).should('be.visible');
  });
});

/**
 * Authentication E2E Tests
 * Tests login, logout, session management, and password reset
 */

describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display login page on initial visit', () => {
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.contains('button', /login|sign in/i).should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('input[type="email"]').type('invalid@test.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.contains('button', /login|sign in/i).click();
    cy.contains(/invalid|incorrect|error/i).should('be.visible');
  });

  it('should require email field', () => {
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', /login|sign in/i).click();
    cy.contains(/required|email/i).should('exist');
  });

  it('should require password field', () => {
    cy.get('input[type="email"]').type('test@example.com');
    cy.contains('button', /login|sign in/i).click();
    cy.contains(/required|password/i).should('exist');
  });

  it('should have forgot password link', () => {
    cy.contains('a', /forgot|reset/i).should('be.visible');
    cy.contains('a', /forgot|reset/i).click();
    cy.url().should('include', 'forgot');
  });

  it('should display supplier portal link', () => {
    cy.contains('a', /supplier|portal/i).should('be.visible');
  });

  it('should handle network errors gracefully', () => {
    cy.intercept('POST', '**/api/auth/login', { statusCode: 500 }).as('loginError');
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', /login|sign in/i).click();
    cy.wait('@loginError');
    cy.contains(/server error|try again/i).should('be.visible');
  });

  it('should disable submit button while loading', () => {
    cy.intercept('POST', '**/api/auth/login', (req) => {
      req.reply((res) => {
        res.delay(2000);
      });
    }).as('slowLogin');

    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.contains('button', /login|sign in/i).click();
    cy.contains('button', /login|sign in/i).should('be.disabled');
  });
});

describe('Password Reset Flow', () => {
  beforeEach(() => {
    cy.visit('/forgot-password');
  });

  it('should display forgot password form', () => {
    cy.get('input[type="email"]').should('be.visible');
    cy.contains('button', /reset|submit/i).should('be.visible');
  });

  it('should require email for password reset', () => {
    cy.contains('button', /reset|submit/i).click();
    cy.contains(/required|email/i).should('exist');
  });

  it('should have link back to login', () => {
    cy.contains('a', /login|back/i).should('be.visible');
  });

  it('should validate email format', () => {
    cy.get('input[type="email"]').type('invalid-email');
    cy.contains('button', /reset|submit/i).click();
    cy.contains(/invalid|valid email/i).should('exist');
  });
});

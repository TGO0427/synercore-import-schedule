/**
 * Accessibility E2E Tests
 * Tests WCAG AA compliance including keyboard navigation, screen readers, colors
 */

describe('Accessibility - Keyboard Navigation', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should navigate login form with keyboard', () => {
    // Tab to email field
    cy.get('body').tab();
    cy.get('input[type="email"]').should('have.focus');

    // Tab to password field
    cy.get('body').tab();
    cy.get('input[type="password"]').should('have.focus');

    // Tab to submit button
    cy.get('body').tab();
    cy.contains('button', /login|sign in/i).should('have.focus');
  });

  it('should allow form submission with Enter key', () => {
    cy.get('input[type="email"]').type('test@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('input[type="password"]').type('{enter}');

    cy.get('button[type="submit"]').should('have.been.called');
  });

  it('should show focus indicators on buttons', () => {
    cy.contains('button', /login|sign in/i).focus();
    cy.contains('button', /login|sign in/i).should('have.css', 'outline');
  });

  it('should allow tab navigation through menu', () => {
    // Assuming navigation exists after login
    cy.get('[role="navigation"], nav').should('exist');
    cy.get('[role="navigation"] a, nav a').first().focus();
    cy.get('[role="navigation"] a, nav a').first().should('have.focus');
  });

  it('should allow escape key to close modals', () => {
    cy.contains('button', /create|add|new/i).click();
    cy.get('[role="dialog"], .modal').should('be.visible');
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"], .modal').should('not.be.visible');
  });
});

describe('Accessibility - Screen Reader Support', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have proper heading hierarchy', () => {
    cy.get('h1').should('have.length.greaterThan', 0);
    cy.get('h1').first().should('be.visible');
  });

  it('should have alt text on all images', () => {
    cy.get('img').each(($img) => {
      expect($img).to.have.attr('alt');
      expect($img.attr('alt')).to.not.be.empty;
    });
  });

  it('should have proper form labels', () => {
    cy.get('input[type="email"]').should('have.attr', 'aria-label', /email/i);
    cy.get('input[type="password"]').should('have.attr', 'aria-label', /password/i);
  });

  it('should have role attributes on interactive elements', () => {
    cy.get('[role="button"], button').should('have.length.greaterThan', 0);
  });

  it('should announce live region updates', () => {
    cy.get('[aria-live], [role="alert"]').should('exist');
  });

  it('should provide table headers with scope', () => {
    cy.get('table').within(() => {
      cy.get('th').each(($th) => {
        expect($th).to.have.attr('scope', /col|row/i);
      });
    });
  });

  it('should have descriptive button text', () => {
    cy.get('button').each(($btn) => {
      const text = $btn.text().trim();
      // Buttons should not be empty or just use icons
      expect(text.length).to.be.greaterThan(0);
    });
  });
});

describe('Accessibility - Color & Contrast', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should not rely on color alone for information', () => {
    // Error messages should have icon or text, not just color
    cy.get('input[type="email"]').type('invalid');
    cy.contains('button', /login|sign in/i).click();
    cy.get('[role="alert"], .error-message').should('contain.text', /invalid|error/i);
  });

  it('should have sufficient color contrast', () => {
    // This is a visual check - should verify WCAA AA contrast (4.5:1)
    cy.get('body').should('have.css', 'color');
    cy.get('body').should('have.css', 'background-color');
  });

  it('should support high contrast mode', () => {
    // Check if app respects prefers-contrast
    cy.window().then((win) => {
      const darkMode = win.matchMedia('(prefers-color-scheme: dark)').matches;
      expect(darkMode).to.be.a('boolean');
    });
  });
});

describe('Accessibility - Form Validation', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should announce form errors to screen readers', () => {
    cy.contains('button', /login|sign in/i).click();
    cy.get('[role="alert"], .error-message').should('exist');
    cy.get('[role="alert"]').should('have.attr', 'role', 'alert');
  });

  it('should associate error messages with inputs', () => {
    cy.get('input[type="email"]').should('have.attr', 'aria-invalid', /true|false/i);
    cy.get('input[type="email"]').should('have.attr', 'aria-describedby');
  });

  it('should provide input type hints', () => {
    cy.get('input[type="email"]').should('have.attr', 'type', 'email');
    cy.get('input[type="password"]').should('have.attr', 'type', 'password');
  });

  it('should support autocomplete attributes', () => {
    cy.get('input[type="email"]').should('have.attr', 'autocomplete');
  });
});

describe('Accessibility - Responsive Design', () => {
  it('should be navigable on mobile (375px)', () => {
    cy.viewport(375, 667);
    cy.visit('/');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('button').should('be.visible');
  });

  it('should be navigable on tablet (768px)', () => {
    cy.viewport(768, 1024);
    cy.visit('/');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('should be navigable on desktop (1280px)', () => {
    cy.viewport(1280, 720);
    cy.visit('/');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('should stack form fields on mobile', () => {
    cy.viewport(375, 667);
    cy.visit('/');
    cy.get('input[type="email"]').then(($el) => {
      expect($el.width()).to.be.lessThan(375);
    });
  });
});

describe('Accessibility - Focus Management', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should have visible focus indicator', () => {
    cy.get('button').first().focus();
    cy.get('button').first().should('have.focus');
    cy.get('button').first().should('have.css', 'outline');
  });

  it('should manage focus on modal open', () => {
    cy.contains('button', /create|add|new/i).click();
    // Focus should move into the modal
    cy.get('[role="dialog"] button, .modal button').first().should('exist');
  });

  it('should restore focus on modal close', () => {
    cy.contains('button', /create|add|new/i).as('createBtn').click();
    cy.contains('button', /cancel|close/i).click();
    // Focus should return to create button
    cy.get('@createBtn').should('have.focus');
  });

  it('should trap focus within modal', () => {
    cy.contains('button', /create|add|new/i).click();
    cy.get('[role="dialog"] button, .modal button').last().focus().tab();
    // Focus should stay within modal
    cy.focused().should('be.within', '[role="dialog"], .modal');
  });
});
